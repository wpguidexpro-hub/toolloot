/* ========================================
   Main Game Module
   Engine init, scene setup, game loop,
   pointer lock, multiplayer networking
   ======================================== */

import { createEnvironment } from './environment.js';
import { createTerrain } from './terrain.js';
import { createForest } from './forest.js';
import { createCity, checkCityCollision, getCityHeightAt } from './city.js';
import { createVehicleSystem } from './vehicles.js';
import { createPlayer } from './player.js';
import { createCameraSystem } from './camera.js';
import { createWeaponSystem } from './weapons.js';
import { createHUD } from './hud.js';
import { createAudioSystem } from './audio.js';
import { createNetworkSystem } from './network.js';
import { createRemotePlayers } from './remote-players.js';
import { createTouchControls } from './touch-controls.js';
import { createMinimap } from './minimap.js';
import { createPickupSystem } from './pickups.js';

// ---- Global References ----
let engine, scene;
let environment, terrain, forest, city, vehicles, player, cameraSystem, weapons, hud, audio;
let network, remotePlayers, touchControls, minimap, pickups;
let playerName = "Player";
let currentMap = "forest"; // "forest" or "city"
let myTeam = null; // "X" or "Y"

// ---- Connection Screen ----
let faceDataUrl = null;
let bodyDataUrl = null;

function readFileAsDataUrl(file, maxW, maxH) {
    return new Promise((resolve) => {
        // Downscale large images to keep network payloads small and uniform.
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        const readRawFallback = () => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        };

        img.onload = () => {
            try {
                const w = maxW ? Math.min(img.width, maxW) : img.width;
                const h = maxH ? Math.min(img.height, maxH) : img.height;
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(objectUrl);
                resolve(canvas.toDataURL("image/jpeg", 0.85));
            } catch (e) {
                URL.revokeObjectURL(objectUrl);
                readRawFallback();
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            readRawFallback();
        };
        img.src = objectUrl;
    });
}

function setupConnectionScreen() {
    const connectScreen = document.getElementById("connect-screen");
    const connectBtn = document.getElementById("connect-btn");
    const nameInput = document.getElementById("player-name-input");
    const ipInput = document.getElementById("server-ip-input");
    const statusEl = document.getElementById("connect-status");

    // Image inputs and previews
    const faceInput = document.getElementById("face-image-input");
    const bodyInput = document.getElementById("body-image-input");
    const facePreview = document.getElementById("face-preview");
    const bodyPreview = document.getElementById("body-preview");

    // Auto-generate a name
    nameInput.value = "Player" + Math.floor(Math.random() * 999);

    // Handle face image selection
    if (faceInput) {
        faceInput.addEventListener("change", async () => {
            if (faceInput.files && faceInput.files[0]) {
                faceDataUrl = await readFileAsDataUrl(faceInput.files[0], 128, 128);
                if (facePreview) {
                    facePreview.innerHTML = `<img src="${faceDataUrl}" alt="Face">`;
                }
            }
        });
    }

    // Handle body image selection
    if (bodyInput) {
        bodyInput.addEventListener("change", async () => {
            if (bodyInput.files && bodyInput.files[0]) {
                bodyDataUrl = await readFileAsDataUrl(bodyInput.files[0], 128, 256);
                if (bodyPreview) {
                    bodyPreview.innerHTML = `<img src="${bodyDataUrl}" alt="Body">`;
                }
            }
        });
    }

    connectBtn.addEventListener("click", async () => {
        const name = nameInput.value.trim() || "Player";
        let serverAddr = ipInput.value.trim();
        if (!serverAddr) {
            serverAddr = window.location.host;
        }
        playerName = name;

        connectBtn.disabled = true;
        statusEl.textContent = "Connecting...";
        statusEl.className = "connect-status";

        try {
            // Get selected map
            const mapSelect = document.getElementById("map-select");
            currentMap = mapSelect ? mapSelect.value : "forest";

            // Create network and connect (pass image data URLs)
            network = createNetworkSystem();
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const wsUrl = `${protocol}//${serverAddr}`;
            const welcomeMsg = await network.connect(wsUrl, name, faceDataUrl, bodyDataUrl, currentMap);

            statusEl.textContent = "Connected! Loading game...";
            statusEl.className = "connect-status success";

            // Hide connection screen, show loading
            setTimeout(async () => {
                connectScreen.classList.add("hidden");
                document.getElementById("loading-screen").style.display = "flex";

                try {
                    // Initialize the game with spawn data
                    await initGame(welcomeMsg);
                } catch (gameErr) {
                    console.error("Game initialization failed:", gameErr);
                    // Show the error on the loading screen so it's visible
                    const loadingScreen = document.getElementById("loading-screen");
                    if (loadingScreen) {
                        loadingScreen.innerHTML = `<div style="color:#ff4444;font-size:18px;padding:20px;text-align:center;font-family:sans-serif;">
                            <div style="font-size:28px;margin-bottom:12px;">❌ Game Failed to Load</div>
                            <div style="color:#ccc;margin-bottom:8px;">${gameErr.message || gameErr}</div>
                            <div style="color:#888;font-size:13px;">Check the browser console (F12) for details.</div>
                            <button onclick="location.reload()" style="margin-top:20px;padding:10px 30px;background:#335;color:#fff;border:1px solid #557;border-radius:6px;cursor:pointer;font-size:14px;">Reload</button>
                        </div>`;
                    }
                }
            }, 500);

        } catch (err) {
            statusEl.textContent = "❌ " + err.message;
            statusEl.className = "connect-status";
            connectBtn.disabled = false;
        }
    });

    // Enter key triggers connect
    nameInput.addEventListener("keypress", (e) => { if (e.key === "Enter") connectBtn.click(); });
    ipInput.addEventListener("keypress", (e) => { if (e.key === "Enter") connectBtn.click(); });
}

async function initGame(welcomeMsg) {
    const canvas = document.getElementById("renderCanvas");

    // ---- Create Engine ----
    engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: false,
        stencil: false,
        antialias: true,
        powerPreference: "high-performance"
    });
    engine.setHardwareScalingLevel(1);

    // ---- Create Scene ----
    scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = false;
    scene.autoClear = true;
    scene.autoClearDepthAndStencil = true;

    // ---- Performance Optimizations ----
    scene.skipPointerMovePicking = true;
    scene.pointerDownPredicate = () => false;
    scene.pointerUpPredicate = () => false;
    scene.pointerMovePredicate = () => false;

    // Detach Babylon.js internal pointer event processing on the canvas.
    // Without this, Babylon intercepts pointermove while LMB is held,
    // which blocks mouse-look during firing.
    scene.detachControl();

    // ---- Loading Steps ----
    showLoadingStatus("Initializing environment...");
    environment = createEnvironment(scene);

    showLoadingStatus("Generating terrain...");
    if (currentMap === "city") {
        // City map: flat ground with buildings
        showLoadingStatus("Building city...");
        city = createCity(scene, environment.shadowGenerator);
        terrain = {
            ground: city.ground,
            getHeightAtCoordinates: city.getHeightAtCoordinates,
            worldSize: city.worldSize,
            maxHeight: 30,
        };

        showLoadingStatus("Spawning vehicles...");
        vehicles = createVehicleSystem(scene);
    } else {
        // Forest map: heightmap terrain + trees
        terrain = await createTerrain(scene, environment.shadowGenerator);

        showLoadingStatus("Planting forest...");
        forest = createForest(scene, terrain, environment.shadowGenerator);
    }

    // Centrally load the humanoid character model (Soldier.glb)
    showLoadingStatus("Loading character model...");
    let soldierContainer = null;
    try {
        soldierContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync(
            "./models/", "soldier.glb", scene
        );
        console.log("Soldier character model loaded successfully!");

        // Stop template animation groups so they do not conflict with cloned instances
        if (soldierContainer.animationGroups) {
            for (const ag of soldierContainer.animationGroups) {
                ag.stop();
            }
        }

        // Diagnostic: Measure native model size
        let min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        let max = new BABYLON.Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
        for (const mesh of soldierContainer.meshes) {
            mesh.computeWorldMatrix(true);
            const boundingInfo = mesh.getBoundingInfo();
            const boundingBox = boundingInfo.boundingBox;
            min = BABYLON.Vector3.Minimize(min, boundingBox.minimumWorld);
            max = BABYLON.Vector3.Maximize(max, boundingBox.maximumWorld);
        }
        const size = max.subtract(min);
        console.log(`[Diagnostic] Native soldier model size: X=${size.x.toFixed(2)}, Y=${size.y.toFixed(2)}, Z=${size.z.toFixed(2)}`);
    } catch (err) {
        console.error("Failed to load soldier.glb:", err);
    }

    showLoadingStatus("Creating player...");
    player = createPlayer(scene, canvas, terrain, currentMap, soldierContainer);

    // Spawn at server-assigned position
    if (welcomeMsg && welcomeMsg.spawn) {
        player.teleportTo(welcomeMsg.spawn.x, welcomeMsg.spawn.y, welcomeMsg.spawn.z);
    }

    // Store team assignment
    if (welcomeMsg && welcomeMsg.team) {
        myTeam = welcomeMsg.team;
        player.team = myTeam;
    }

    // Apply custom character textures from connection screen
    if (faceDataUrl || bodyDataUrl) {
        player.setCustomTextures(faceDataUrl, bodyDataUrl);
    }

    cameraSystem = createCameraSystem(scene, canvas, player);

    // Attach SSAO2 post-processing to camera if supported
    if (environment.ssao) {
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", cameraSystem.camera);
    }

    showLoadingStatus("Setting up audio...");
    audio = createAudioSystem(player, null);

    // ---- Multiplayer Modules ----
    showLoadingStatus("Connecting to server...");
    remotePlayers = createRemotePlayers(scene, soldierContainer);

    // Set local player position reference for LOD calculations
    remotePlayers.setLocalPlayerPosition(player.position);

    // Add existing players from welcome message
    if (welcomeMsg && welcomeMsg.players) {
        for (const p of welcomeMsg.players) {
            remotePlayers.addPlayer(p.id, p.name, p.x, p.y, p.z, p.faceImg, p.bodyImg, p.team);
            remotePlayers.updatePlayerState(p.id, p);
        }
    }

    // Weapon system (with network + remotePlayers for hit detection)
    weapons = createWeaponSystem(scene, player, cameraSystem, audio, network, remotePlayers);

    // HUD (with network + remotePlayers for scoreboard)
    hud = createHUD(player, weapons, cameraSystem, engine, network, remotePlayers, myTeam);

    // ---- Touch Controls (mobile only) ----
    touchControls = createTouchControls(player);

    // ---- Minimap ----
    minimap = createMinimap(player, remotePlayers, currentMap, myTeam);

    // ---- Pickups ----
    pickups = createPickupSystem(scene, player, weapons, audio, network, terrain, currentMap);

    // ---- Mouse Wheel for Sniper Zoom ----
    canvas.addEventListener("wheel", (e) => {
        if (document.pointerLockElement === canvas) {
            e.preventDefault();
            weapons.handleZoom(e.deltaY);
        }
    }, { passive: false });

    // ---- Network Event Handlers ----
    setupNetworkCallbacks();

    // ---- Wire fall death to network ----
    player.onFallDeath = () => {
        if (network && network.connected) {
            network.send({ type: "fallDeath" });
        }
    };

    // ---- Game Loop ----
    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;

        // ---- Process buffered network messages (batched per frame) ----
        if (network) {
            network.processMessages();
        }

        // Apply touch look before player update
        if (touchControls && touchControls.isMobile) {
            touchControls.update(dt);
            const lookDelta = touchControls.consumeLookDelta();
            player.injectLookDelta(lookDelta.dx, lookDelta.dy);
        }

        player.update(dt);
        cameraSystem.update(dt);
        weapons.update(dt);
        remotePlayers.update(dt);
        hud.update();
        audio.update(dt, cameraSystem.camera);
        if (minimap) minimap.update();
        if (pickups) pickups.update(dt);
        if (vehicles) vehicles.update(dt);

        // Sync weapon key to player for network state sends
        player.currentWeapon = player.isHolstered ? "none" : weapons.currentWeaponKey;

        // Send our state to server (throttled internally by network.sendState)
        if (network && network.connected && player.alive) {
            network.sendState(player);
        }
    });

    // ---- Pointer Lock (desktop only) ----
    if (!touchControls || !touchControls.isMobile) {
        setupPointerLock(canvas);
    } else {
        // On mobile, hide the lock overlay (no pointer lock needed)
        const overlay = document.getElementById("lock-overlay");
        if (overlay) overlay.classList.add("hidden");
    }

    // ---- Scene Optimizer ----
    const optOptions = BABYLON.SceneOptimizerOptions.LowDegradationAllowed();
    optOptions.targetFrameRate = 55; // Kick in if FPS drops below 55
    const optimizer = new BABYLON.SceneOptimizer(scene, optOptions, true, true);
    optimizer.start();

    // ---- Start Render Loop ----
    engine.runRenderLoop(() => {
        scene.render();
    });

    // ---- Handle Resize ----
    window.addEventListener("resize", () => {
        engine.resize();
    });

    // ---- Freeze static meshes for performance ----
    if (environment.skybox) {
        environment.skybox.freezeWorldMatrix();
    }

    // ---- Hide loading ----
    hideLoadingStatus();

    console.log("🎮 Thalvorn — LAN Multiplayer loaded!");
    console.log(`Connected as "${playerName}" (ID: ${network.myId})`);
    console.log("Controls: WASD=Move, Mouse=Look, Shift=Run, Ctrl=Crouch, Space=Jump, V=Camera, LMB=Shoot, R=Reload, Tab=Scoreboard");
}

// ---- Network Event Handlers ----
function setupNetworkCallbacks() {
    network.callbacks.onPlayerJoined = (msg) => {
        console.log(`[+] ${msg.name} joined Team ${msg.team}`);
        remotePlayers.addPlayer(msg.id, msg.name, msg.x, msg.y, msg.z, msg.faceImg, msg.bodyImg, msg.team);
    };

    network.callbacks.onPlayerLeft = (msg) => {
        console.log(`[-] Player ${msg.id} left`);
        remotePlayers.removePlayer(msg.id);
    };

    network.callbacks.onWorldState = (msg) => {
        for (const p of msg.players) {
            if (p.id === network.myId) {
                // Server-authoritative scores: update local kills/deaths
                // (Handle in a future iteration if needed)
                continue;
            }
            // If we haven't seen this player yet, create them with available data
            // (handles edge case where playerJoined was missed)
            if (!remotePlayers.all.has(p.id)) {
                remotePlayers.addPlayer(
                    p.id,
                    p.name || "Player",
                    p.x ?? 0, p.y ?? 0, p.z ?? 0,
                    p.faceImg, p.bodyImg, p.team
                );
            }
            // Apply delta or full state update
            remotePlayers.updatePlayerState(p.id, p);
        }
    };

    network.callbacks.onDamage = (msg) => {
        let targetPos = null;

        if (msg.targetId === network.myId) {
            // WE got hit
            targetPos = player.position.clone();
            targetPos.y += 1.0;
            player.hp = msg.hp;
            hud.showDamageFlash();
            if (msg.shooterX !== undefined && msg.shooterZ !== undefined) {
                hud.showDirectionalDamage(msg.shooterX, msg.shooterZ, player.position.x, player.position.z, player.yaw);
            }
            if (msg.hp <= 0) {
                player.alive = false;
            }
        } else {
            // Remote player got hit
            const remoteEntry = remotePlayers.all.get(msg.targetId);
            if (remoteEntry && remoteEntry.mesh) {
                targetPos = remoteEntry.mesh.position.clone();
                targetPos.y += 1.0; // Chest height
                // Trigger hit animation
                if (remotePlayers.playHitReaction) {
                    remotePlayers.playHitReaction(msg.targetId);
                }
            }
        }

        // If WE were the shooter, play responsive hit ping
        if (msg.shooterId === network.myId && msg.targetId !== network.myId) {
            if (audio && audio.playHitNotification) {
                audio.playHitNotification(false);
            }
        }

        if (targetPos) {
            createBloodParticles(scene, targetPos);
        }
    };

    network.callbacks.onWeaponFired = (msg) => {
        // Remote player shot their weapon: play 3D positional audio and trigger CS2 recoil + flash
        if (msg.shooterId !== network.myId) {
            if (audio && audio.play3DShot) {
                audio.play3DShot(msg.weapon, msg.x, msg.y, msg.z);
            }
            if (remotePlayers && remotePlayers.triggerWeaponFire) {
                remotePlayers.triggerWeaponFire(msg.shooterId, msg.weapon);
            }
        }
    };

    network.callbacks.onKill = (msg) => {
        // Add to kill feed
        hud.addKillFeedEntry(msg.killerName, msg.victimName);

        if (msg.killerId === network.myId) {
            player.addKill();
            if (hud && hud.showKillBanner) {
                hud.showKillBanner(msg.victimName);
            }
            if (audio && audio.playHitNotification) {
                audio.playHitNotification(true);
            }
        }
        if (msg.victimId === network.myId) {
            player.alive = false;
        } else {
            if (remotePlayers && remotePlayers.triggerDeath) {
                remotePlayers.triggerDeath(msg.victimId);
            }
        }
    };

    network.callbacks.onRespawn = (msg) => {
        if (msg.id === network.myId) {
            // WE are respawning
            player.respawnAt(msg.x, msg.y, msg.z);
            // Reset weapon to knife on respawn
            weapons.switchWeapon("knife");
        } else {
            // Another player respawned
            remotePlayers.updatePlayerState(msg.id, {
                x: msg.x, y: msg.y, z: msg.z,
                hp: msg.hp, alive: true,
                invulnerable: true,
            });
        }
    };

    // ---- Pickup network callback ----
    network.callbacks.onPickupCollected = (msg) => {
        if (pickups) pickups.onRemoteCollect(msg.pickupId);
    };

    // ---- Team changed callback ----
    network.callbacks.onTeamChanged = (msg) => {
        if (msg.id === network.myId) {
            myTeam = msg.team;
            player.team = myTeam;
            console.log(`[⚖] You were moved to Team ${msg.team} for balance`);
            if (hud) hud.setTeam(msg.team);
        } else {
            if (remotePlayers && remotePlayers.updatePlayerState) {
                remotePlayers.updatePlayerState(msg.id, { team: msg.team });
                const rp = remotePlayers.all.get(msg.id);
                if (rp) console.log(`[⚖] ${rp.name} was moved to Team ${msg.team}`);
            }
        }
    };

    // ---- Ping callback ----
    network.callbacks.onPing = (pingMs) => {
        if (hud && hud.setPing) {
            hud.setPing(pingMs);
        }
    };

    // ---- Reconnection callbacks ----
    network.callbacks.onReconnecting = (info) => {
        console.log(`[Network] Reconnecting... attempt ${info.attempt}/${info.maxAttempts}`);
        // Could show a UI overlay here
    };

    network.callbacks.onReconnected = (msg) => {
        console.log("[Network] Reconnected successfully!");
        // Re-add existing players from the new welcome message
        if (msg && msg.players) {
            // Clear existing remote players first
            for (const [id] of remotePlayers.all) {
                remotePlayers.removePlayer(id);
            }
            for (const p of msg.players) {
                remotePlayers.addPlayer(p.id, p.name, p.x, p.y, p.z, p.faceImg, p.bodyImg, p.team);
                remotePlayers.updatePlayerState(p.id, p);
            }
        }
        if (msg && msg.spawn) {
            player.teleportTo(msg.spawn.x, msg.spawn.y, msg.spawn.z);
        }
        if (msg && msg.team) {
            myTeam = msg.team;
            player.team = myTeam;
        }
    };

    network.callbacks.onDisconnected = () => {
        console.log("[Network] Permanently disconnected");
    };
}

// ---- Pointer Lock & Keyboard Lock Management ----
function setupPointerLock(canvas) {
    const overlay = document.getElementById("lock-overlay");
    const btnFullscreen = document.getElementById("btn-fullscreen");

    // Helper: engage Keyboard Lock ONLY when fullscreen is active
    const engageKeyboardLock = () => {
        if (document.fullscreenElement && navigator.keyboard && typeof navigator.keyboard.lock === "function") {
            navigator.keyboard.lock().catch(() => {});
        }
    };

    // Helper: always release Keyboard Lock so browser defaults return
    const releaseKeyboardLock = () => {
        if (navigator.keyboard && typeof navigator.keyboard.unlock === "function") {
            navigator.keyboard.unlock();
        }
    };

    const requestGameFocus = () => {
        if (!document.pointerLockElement) {
            canvas.requestPointerLock();
        }
        // Only lock keyboard if we're in fullscreen
        engageKeyboardLock();
    };

    if (btnFullscreen) {
        btnFullscreen.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().then(() => {
                    requestGameFocus();
                }).catch(() => {
                    requestGameFocus();
                });
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });
    }

    overlay.addEventListener("click", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
        requestGameFocus();
    });

    canvas.addEventListener("click", requestGameFocus);

    // ---- React to pointer lock changes ----
    document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement === canvas) {
            overlay.classList.add("hidden");
            // Engage keyboard lock only if fullscreen
            engageKeyboardLock();
        } else {
            overlay.classList.remove("hidden");
            // Pointer lock released (Esc pressed) — release keyboard lock
            // so all browser defaults (Ctrl+W, Ctrl+T, etc.) work normally
            releaseKeyboardLock();
        }
    });

    // ---- React to fullscreen changes ----
    document.addEventListener("fullscreenchange", () => {
        if (document.fullscreenElement) {
            // Entered fullscreen — engage keyboard lock if playing
            if (document.pointerLockElement === canvas) {
                engageKeyboardLock();
            }
        } else {
            // Exited fullscreen — always release keyboard lock
            releaseKeyboardLock();
        }
    });

    document.addEventListener("pointerlockerror", () => {
        console.warn("Pointer lock failed. Click the game area to try again.");
    });

    // Block browser shortcuts during active gameplay (pointer lock engaged)
    // Note: Keyboard Lock API handles system keys (Ctrl+W) in fullscreen;
    // preventDefault handles non-system keys (Tab, F-keys, etc.) in windowed mode
    window.addEventListener("keydown", (e) => {
        if (document.pointerLockElement === canvas) {
            if (e.code === "Escape") {
                // Esc always passes through — exits pointer lock, returns browser defaults
                return;
            }
            // In fullscreen: Keyboard Lock API already blocks Ctrl+W, etc.
            // In windowed: preventDefault blocks what it can (Tab, F5, etc.)
            e.preventDefault();
        }
    }, { capture: true, passive: false });

    window.addEventListener("keyup", (e) => {
        if (document.pointerLockElement === canvas && e.code !== "Escape") {
            e.preventDefault();
        }
    }, { capture: true, passive: false });
}

// ---- Loading Status ----
function showLoadingStatus(msg) {
    const el = document.getElementById("loading-status");
    if (el) el.textContent = msg;
}

function hideLoadingStatus() {
    const el = document.getElementById("loading-screen");
    if (el) {
        el.style.transition = "opacity 0.5s";
        el.style.opacity = "0";
        setTimeout(() => { el.style.display = "none"; }, 500);
    }
}

// ---- Start ----
setupConnectionScreen();

// ---- Visual FX: Blood Splatter (Pooled, zero-allocation) ----
let _sharedBloodTex = null;
let _sharedBloodSystem = null;
const _bloodPos = new BABYLON.Vector3();

function createBloodParticles(scene, position) {
    if (!scene) return;

    if (!_sharedBloodTex) {
        _sharedBloodTex = new BABYLON.DynamicTexture("bloodTex", { width: 16, height: 16 }, scene, false);
        const ctx = _sharedBloodTex.getContext();
        ctx.fillStyle = "#aa0000";
        ctx.beginPath();
        ctx.arc(8, 8, 8, 0, Math.PI * 2);
        ctx.fill();
        _sharedBloodTex.update();
    }

    if (!_sharedBloodSystem) {
        _sharedBloodSystem = new BABYLON.ParticleSystem("bloodPooled", 100, scene);
        _sharedBloodSystem.particleTexture = _sharedBloodTex;
        _sharedBloodSystem.minEmitBox = new BABYLON.Vector3(-0.2, -0.2, -0.2);
        _sharedBloodSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0.2, 0.2);
        _sharedBloodSystem.color1 = new BABYLON.Color4(0.8, 0, 0, 1.0);
        _sharedBloodSystem.color2 = new BABYLON.Color4(0.5, 0, 0, 1.0);
        _sharedBloodSystem.colorDead = new BABYLON.Color4(0.2, 0, 0, 0.0);
        _sharedBloodSystem.minSize = 0.05;
        _sharedBloodSystem.maxSize = 0.15;
        _sharedBloodSystem.minLifeTime = 0.2;
        _sharedBloodSystem.maxLifeTime = 0.45;
        _sharedBloodSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        _sharedBloodSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);
        _sharedBloodSystem.direction1 = new BABYLON.Vector3(-1, 0.5, -1);
        _sharedBloodSystem.direction2 = new BABYLON.Vector3(1, 1.5, 1);
        _sharedBloodSystem.minEmitPower = 1;
        _sharedBloodSystem.maxEmitPower = 3.5;
        _sharedBloodSystem.updateSpeed = 0.02;
    }

    _bloodPos.copyFrom(position);
    _sharedBloodSystem.emitter = _bloodPos;
    _sharedBloodSystem.manualEmitCount = 20;
    _sharedBloodSystem.start();
}
