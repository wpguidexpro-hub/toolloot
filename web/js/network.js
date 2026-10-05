/* ========================================
   Network Module
   WebSocket client for LAN multiplayer
   Auto-reconnect, delta state sends,
   buffered message processing
   ======================================== */

const STATE_SEND_RATE = 30; // ms between state sends (~33 Hz for low latency)

// ---- Delta send thresholds ----
const POS_TOLERANCE = 0.01;
const ROT_TOLERANCE = 0.001;

export function createNetworkSystem() {
    let ws = null;
    let myId = null;
    let connected = false;
    let lastStateSend = 0;
    let currentPing = 0;
    let pingInterval = null;

    // ---- Delta state tracking ----
    let lastSentX = null, lastSentY = null, lastSentZ = null;
    let lastSentYaw = null, lastSentPitch = null;
    let lastSentAnimState = null;
    let lastSentWeapon = null;
    let lastSentInvuln = null;

    // ---- Auto-reconnect state ----
    let reconnecting = false;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let savedServerUrl = null;
    let savedPlayerName = null;
    let savedFaceImg = null;
    let savedBodyImg = null;
    let savedMap = null;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const BASE_RECONNECT_DELAY = 1000; // 1s

    // ---- Message buffer for batched processing ----
    const messageBuffer = [];
    let processingMessages = false;

    // ---- Event Callbacks (set by main.js) ----
    const callbacks = {
        onWelcome: null,      // ({ id, spawn, team, players }) => {}
        onPlayerJoined: null, // ({ id, name, x, y, z, hp, team }) => {}
        onPlayerLeft: null,   // ({ id }) => {}
        onWorldState: null,   // ({ players }) => {}
        onDamage: null,       // ({ targetId, shooterId, shooterName, hp, damage, shooterX, shooterY, shooterZ }) => {}
        onKill: null,         // ({ killerId, killerName, victimId, victimName }) => {}
        onRespawn: null,      // ({ id, x, y, z, hp }) => {}
        onPickupCollected: null, // ({ pickupId, playerId }) => {}
        onTeamChanged: null,  // ({ id, team }) => {}
        onWeaponFired: null,  // ({ shooterId, weapon, x, y, z, yaw, pitch }) => {}
        onPing: null,         // (pingMs) => {}
        onReconnecting: null, // ({ attempt, maxAttempts }) => {}
        onReconnected: null,  // () => {}
        onDisconnected: null, // () => {}
    };

    // ---- Connect to Server ----
    function connect(serverUrl, playerName, faceImg, bodyImg, map) {
        // Save connection params for reconnection
        savedServerUrl = serverUrl;
        savedPlayerName = playerName;
        savedFaceImg = faceImg;
        savedBodyImg = bodyImg;
        savedMap = map;
        reconnectAttempts = 0;

        return _connect(serverUrl, playerName, faceImg, bodyImg, map);
    }

    function _connect(serverUrl, playerName, faceImg, bodyImg, map) {
        return new Promise((resolve, reject) => {
            try {
                ws = new WebSocket(serverUrl);
            } catch (e) {
                reject(new Error("Invalid server URL"));
                return;
            }

            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error("Connection timed out"));
            }, 5000);

            ws.onopen = () => {
                clearTimeout(timeout);
                connected = true;
                reconnecting = false;
                reconnectAttempts = 0;

                // Reset delta tracking on new connection
                lastSentX = null;
                lastSentY = null;
                lastSentZ = null;
                lastSentYaw = null;
                lastSentPitch = null;
                lastSentAnimState = null;
                lastSentWeapon = null;
                lastSentInvuln = null;

                // Start ping / RTT measurement loop (every 1s)
                if (pingInterval) clearInterval(pingInterval);
                pingInterval = setInterval(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        send({ type: "ping", t: performance.now() });
                    }
                }, 1000);

                // Send join message with optional avatar images and map choice
                const joinMsg = { type: "join", name: playerName, map: map || "forest" };
                if (faceImg) joinMsg.faceImg = faceImg;
                if (bodyImg) joinMsg.bodyImg = bodyImg;
                send(joinMsg);
            };

            ws.onmessage = (event) => {
                let msg;
                try {
                    msg = JSON.parse(event.data);
                } catch (e) {
                    return;
                }

                // Welcome resolves the connect promise
                if (msg.type === "welcome") {
                    myId = msg.id;
                    if (callbacks.onWelcome) callbacks.onWelcome(msg);
                    if (reconnecting) {
                        // Reconnect succeeded
                        if (callbacks.onReconnected) callbacks.onReconnected(msg);
                    }
                    resolve(msg);
                    return;
                }

                // Buffer all other messages for batched processing
                messageBuffer.push(msg);
            };

            ws.onclose = () => {
                if (pingInterval) {
                    clearInterval(pingInterval);
                    pingInterval = null;
                }
                const wasConnected = connected;
                connected = false;
                console.log("[Network] Disconnected from server");

                // Attempt auto-reconnect if we were previously connected
                if (wasConnected && !reconnecting) {
                    attemptReconnect();
                }
            };

            ws.onerror = (err) => {
                clearTimeout(timeout);
                if (!connected && !reconnecting) {
                    connected = false;
                    reject(new Error("Could not connect to server"));
                }
            };
        });
    }

    // ---- Auto-Reconnect with Exponential Backoff ----
    function attemptReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log("[Network] Max reconnect attempts reached");
            if (callbacks.onDisconnected) callbacks.onDisconnected();
            return;
        }

        reconnecting = true;
        reconnectAttempts++;
        const delay = Math.min(
            BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
            16000 // 16s max
        );

        console.log(`[Network] Reconnecting in ${delay/1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        if (callbacks.onReconnecting) {
            callbacks.onReconnecting({
                attempt: reconnectAttempts,
                maxAttempts: MAX_RECONNECT_ATTEMPTS,
            });
        }

        reconnectTimer = setTimeout(() => {
            _connect(savedServerUrl, savedPlayerName, savedFaceImg, savedBodyImg, savedMap)
                .catch((err) => {
                    console.warn("[Network] Reconnect failed:", err.message);
                    attemptReconnect();
                });
        }, delay);
    }

    // ---- Process buffered messages (call once per frame) ----
    function processMessages() {
        if (messageBuffer.length === 0) return;

        // Swap buffer to avoid issues if new messages arrive during processing
        const batch = messageBuffer.splice(0, messageBuffer.length);

        for (const msg of batch) {
            switch (msg.type) {
                case "playerJoined":
                    if (callbacks.onPlayerJoined) callbacks.onPlayerJoined(msg);
                    break;
                case "playerLeft":
                    if (callbacks.onPlayerLeft) callbacks.onPlayerLeft(msg);
                    break;
                case "worldState":
                    if (callbacks.onWorldState) callbacks.onWorldState(msg);
                    break;
                case "damage":
                    if (callbacks.onDamage) callbacks.onDamage(msg);
                    break;
                case "kill":
                    if (callbacks.onKill) callbacks.onKill(msg);
                    break;
                case "respawn":
                    if (callbacks.onRespawn) callbacks.onRespawn(msg);
                    break;
                case "pickupCollected":
                    if (callbacks.onPickupCollected) callbacks.onPickupCollected(msg);
                    break;
                case "teamChanged":
                    if (callbacks.onTeamChanged) callbacks.onTeamChanged(msg);
                    break;
                case "weaponFired":
                    if (callbacks.onWeaponFired) callbacks.onWeaponFired(msg);
                    break;
                case "pong":
                    currentPing = Math.max(0, Math.round(performance.now() - msg.t));
                    if (callbacks.onPing) callbacks.onPing(currentPing);
                    break;
            }
        }
    }

    // ---- Send JSON ----
    function send(data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(data));
            } catch (e) {
                console.warn("[Network] Send error:", e.message);
            }
        }
    }

    // ---- Send Player State (throttled + delta) ----
    function sendState(player) {
        const now = performance.now();
        if (now - lastStateSend < STATE_SEND_RATE) return;
        lastStateSend = now;

        const px = player.position.x;
        const py = player.position.y;
        const pz = player.position.z;
        const pyaw = player.yaw;
        const ppitch = player.pitch;
        const pAnim = player.state;
        const pWeapon = player.currentWeapon;
        const pInvuln = player.invulnerable;

        // ---- Build delta message — only changed fields ----
        const msg = { type: "state" };
        let hasChanges = false;

        if (lastSentX === null || Math.abs(px - lastSentX) > POS_TOLERANCE) {
            msg.x = px; hasChanges = true;
        }
        if (lastSentY === null || Math.abs(py - lastSentY) > POS_TOLERANCE) {
            msg.y = py; hasChanges = true;
        }
        if (lastSentZ === null || Math.abs(pz - lastSentZ) > POS_TOLERANCE) {
            msg.z = pz; hasChanges = true;
        }
        if (lastSentYaw === null || Math.abs(pyaw - lastSentYaw) > ROT_TOLERANCE) {
            msg.yaw = pyaw; hasChanges = true;
        }
        if (lastSentPitch === null || Math.abs(ppitch - lastSentPitch) > ROT_TOLERANCE) {
            msg.pitch = ppitch; hasChanges = true;
        }
        if (lastSentAnimState !== pAnim) {
            msg.animState = pAnim; hasChanges = true;
        }
        if (lastSentWeapon !== pWeapon) {
            msg.weapon = pWeapon; hasChanges = true;
        }

        // Only send if something actually changed
        if (!hasChanges) return;

        // Update last sent values
        lastSentX = px;
        lastSentY = py;
        lastSentZ = pz;
        lastSentYaw = pyaw;
        lastSentPitch = ppitch;
        lastSentAnimState = pAnim;
        lastSentWeapon = pWeapon;
        lastSentInvuln = pInvuln;

        send(msg);
    }

    // ---- Send Fire Event (for 3D audio and remote muzzle flash) ----
    function sendFire(weaponType) {
        send({ type: "fire", weapon: weaponType || "knife" });
    }

    // ---- Send Hit Event ----
    function sendHit(targetId, weaponType, pellets = 1) {
        send({ type: "hit", targetId, weapon: weaponType || "knife", pellets });
    }

    // ---- Disconnect ----
    function disconnect() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        reconnecting = false;
        if (ws) {
            ws.close();
            ws = null;
            connected = false;
        }
    }

    return {
        connect,
        send,
        sendState,
        sendFire,
        sendHit,
        disconnect,
        processMessages,
        callbacks,
        get connected() { return connected; },
        get myId() { return myId; },
        get reconnecting() { return reconnecting; },
        get ping() { return currentPing; },
    };
}
