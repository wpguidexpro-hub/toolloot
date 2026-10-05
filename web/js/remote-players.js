import { generateNormalMap } from './environment.js';

/* ========================================
   Remote Players Module
   Renders other players in the scene,
   interpolates positions, name labels.
   Includes: GLB model loading, team coloring,
   material disposal, stale cleanup,
   LOD-based updates
   ======================================== */

const LERP_SPEED = 18; // Ultra-smooth, responsive interpolation speed
const STALE_TIMEOUT = 5.0; // Seconds without updates before considering player stale
const LOD_DISTANCE_SQ_MED = 50 * 50;   // 50 units — reduce animation frequency
const LOD_DISTANCE_SQ_FAR = 100 * 100; // 100 units — skip limb animation

// Team colors
const TEAM_COLORS = {
    X: new BABYLON.Color3(0.2, 0.5, 1.0),   // Blue
    Y: new BABYLON.Color3(1.0, 0.55, 0.15),  // Orange
    default: new BABYLON.Color3(0.5, 0.5, 0.5), // Grey (no team)
};

export function createRemotePlayers(scene, soldierContainer) {
    const remotePlayers = new Map(); // id -> { mesh, body, nameLabel, targetPos, targetYaw, ... }
    const modelLoadFailed = !soldierContainer;

    // ---- Shared Materials (never disposed) ----
    const remoteGunMat = new BABYLON.StandardMaterial("remoteGunMat", scene);
    remoteGunMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    remoteGunMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    remoteGunMat.freeze();

    // Dead player material (grey)
    const deadMat = new BABYLON.StandardMaterial("deadMat", scene);
    deadMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    deadMat.specularColor = BABYLON.Color3.Black();
    deadMat.freeze();

    // ---- Shared fabric normal map (generated ONCE, reused for all players) ----
    let sharedFabricNormal = null;
    try {
        sharedFabricNormal = generateNormalMap(scene, 128, 128, "fabric");
        sharedFabricNormal.uScale = 4.0;
        sharedFabricNormal.vScale = 4.0;
    } catch (e) {
        console.warn("Failed to generate shared fabric normal map:", e);
    }

    // ---- Reference to local player position for LOD (set externally) ----
    let localPlayerPosition = null;

    // ---- Create a remote player mesh ----
    function addPlayer(id, name, x, y, z, faceImg, bodyImg, team) {
        if (remotePlayers.has(id)) return;

        // Root capsule (pickable for hit detection, strictly invisible)
        const capsule = BABYLON.MeshBuilder.CreateCapsule("remote_" + id, {
            height: 1.8,
            radius: 0.4,
            tessellation: 10,
            subdivisions: 1,
        }, scene);
        capsule.position.set(x, y, z);
        capsule.isPickable = true;
        capsule.visibility = 0;

        const invisibleCapsuleMat = new BABYLON.StandardMaterial("invCapMat_" + id, scene);
        invisibleCapsuleMat.alpha = 0;
        invisibleCapsuleMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        invisibleCapsuleMat.freeze();
        capsule.material = invisibleCapsuleMat;
        capsule.metadata = { playerId: id, playerName: name };

        // Determine team color
        const teamColor = TEAM_COLORS[team] || TEAM_COLORS.default;

        // Try to use GLB model, fallback to procedural
        let body = null;
        let isGLBModel = false;
        let animationGroups = [];
        let animMap = null;

        if (soldierContainer && !modelLoadFailed) {
            try {
                // Clone from the preloaded container with unique suffix to avoid name collisions
                const uniqueSuffix = id + "_" + Math.floor(Math.random() * 1000000);
                const cloneResult = soldierContainer.instantiateModelsToScene(
                    (name) => name + "_" + uniqueSuffix,
                    true,
                    { doNotInstantiate: false }
                );

                if (cloneResult.rootNodes.length > 0) {
                    const modelRoot = cloneResult.rootNodes[0];
                    modelRoot.parent = capsule;

                    // Scale and position to fit our capsule
                    modelRoot.scaling.setAll(1.0);
                    modelRoot.position.y = -0.9;
                    modelRoot.rotation.y = Math.PI;

                    // Tweak the natively cloned PBR materials, fix bounding boxes, and enable pickability
                    const allMeshes = modelRoot.getChildMeshes(false);
                    for (const m of allMeshes) {
                        m.isPickable = true;
                        m.metadata = { playerId: id, playerName: name };
                        m.receiveShadows = true;
                        m.visibility = 1.0;
                        m.isVisible = true;

                        // Prevent frustum culling from incorrectly hiding animated skinned meshes
                        m.computeWorldMatrix(true);
                        m.refreshBoundingInfo();
                        if (m.skeleton) {
                            // Bypass frustum culling (cheap for a handful of meshes)
                            m.alwaysSelectAsActiveMesh = true;
                        }

                        if (m.material && m.material.getClassName() === "PBRMaterial") {
                            const pbrMat = m.material;
                            
                            // Apply team color overlay (except helmet visor/glass)
                            if (!m.name.toLowerCase().includes("visor") && !m.name.toLowerCase().includes("glass")) {
                                pbrMat.albedoColor = BABYLON.Color3.Lerp(new BABYLON.Color3(1, 1, 1), teamColor, 0.35);
                            }

                            // Apply shared fabric normal map if available
                            if (sharedFabricNormal) {
                                pbrMat.bumpTexture = sharedFabricNormal;
                            }
                        }
                    }

                    body = modelRoot;
                    isGLBModel = true;
                    animationGroups = cloneResult.animationGroups || [];

                    // Index animation groups with robust fallbacks
                    animMap = {
                        idle: animationGroups.find(ag => ag.name.toLowerCase().includes("idle")) || animationGroups[0],
                        walk: animationGroups.find(ag => ag.name.toLowerCase().includes("walk")) || animationGroups[3] || animationGroups[0],
                        run: animationGroups.find(ag => ag.name.toLowerCase().includes("run")) || animationGroups[1] || animationGroups[0],
                        tpose: animationGroups.find(ag => ag.name.toLowerCase().includes("tpose")) || animationGroups[2] || animationGroups[0],
                    };

                    console.log(`[RemotePlayers] Cloned soldier for ${id}: ${modelRoot.getChildMeshes(false).length} meshes, ${animationGroups.length} animations`);

                    // Stop all cloned animations initially so they start cleanly on first frame
                    for (const ag of animationGroups) {
                        ag.stop();
                    }
                }
            } catch (err) {
                console.error("Failed to clone soldier model for remote player " + id + ":", err);
            }
        }

        // Fallback: procedural capsule body
        if (!body) {
            const fallbackBodyMat = new BABYLON.StandardMaterial("bodyMat_" + id, scene);
            fallbackBodyMat.diffuseColor = teamColor.clone();
            fallbackBodyMat.specularColor = BABYLON.Color3.Black();

            const fallbackSkinMat = new BABYLON.StandardMaterial("skinMat_" + id, scene);
            fallbackSkinMat.diffuseColor = new BABYLON.Color3(0.8, 0.65, 0.5);
            fallbackSkinMat.specularColor = BABYLON.Color3.Black();

            body = createProceduralBody(scene, capsule, fallbackBodyMat, fallbackSkinMat);
        }

        // Weapon (Create procedural fallback weapon for all remote players)
        let weapon = createRemoteWeapon(scene, capsule, remoteGunMat);
        if (isGLBModel) {
            // Adjust position for the GLB soldier
            weapon.position.set(0.35, -0.1, 0.4);
            // Optional: rotate if needed
        }

        // Name label (floating text using a simple plane + dynamic texture)
        const nameLabel = createNameLabel(scene, name, capsule, team);

        const entry = {
            id,
            name,
            mesh: capsule,
            body,
            weapon,
            nameLabel,
            targetX: x,
            targetY: y,
            targetZ: z,
            targetYaw: 0,
            targetPitch: 0,
            animState: "IDLE",
            hp: 100,
            kills: 0,
            deaths: 0,
            alive: true,
            invulnerable: false, // Track invulnerability state
            weaponType: null,    // Track weapon type string
            faceImg: faceImg || null,
            bodyImg: bodyImg || null,
            team: team || null,
            isGLBModel,
            animationGroups,
            animMap: animMap || {},
            currentAnim: null,
            activeAG: null,      // Currently playing animation group
            limbTime: 0,
            prevX: x,
            prevZ: z,
            lastUpdateTime: performance.now() / 1000,
            lodFrameCounter: 0,

            // ---- Counter-Strike 2 Animation Layers ----
            aimPitch: 0,          // Vertical 3D look/aim pitch
            recoilZ: 0,           // Weapon firing kick backward
            recoilRotX: 0,        // Weapon firing muzzle flip
            flinchPitch: 0,       // Damage hit twitch pitch
            flinchRoll: 0,        // Damage hit twitch roll
            strafeLean: 0,        // Lateral banking lean
            landingDip: 0,        // Jump landing compression
            wasAirborne: false,   // Airborne detection
            deathProgress: 0,     // 0 = alive, 0..1 = CS2 ragdoll collapse
            meleeSwingTimer: 0,   // Knife slash swing timer
            reloadTimer: 0,       // Reloading animation timer
            reloadDuration: 2.0,  // Reloading duration
        };

        remotePlayers.set(id, entry);
        return entry;
    }

    // ---- Remove a remote player (with full cleanup) ----
    function removePlayer(id) {
        const entry = remotePlayers.get(id);
        if (!entry) return;

        // Dispose name label + its unique material & texture
        if (entry.nameLabel) {
            const labelMat = entry.nameLabel.material;
            if (labelMat) {
                if (labelMat.diffuseTexture) labelMat.diffuseTexture.dispose();
                if (labelMat.emissiveTexture && labelMat.emissiveTexture !== labelMat.diffuseTexture) {
                    labelMat.emissiveTexture.dispose();
                }
                labelMat.dispose();
            }
            entry.nameLabel.dispose();
        }

        // Stop animations
        if (entry.animationGroups) {
            for (const ag of entry.animationGroups) {
                ag.stop();
                ag.dispose();
            }
        }

        // Dispose body child meshes and their cloned materials
        if (entry.body) {
            const childMeshes = entry.body.getChildMeshes ? entry.body.getChildMeshes() : [];
            for (const m of childMeshes) {
                if (m.material) {
                    // Dispose per-player textures (NOT bumpTexture, which is shared)
                    if (m.material.albedoTexture) m.material.albedoTexture.dispose();
                    if (m.material.diffuseTexture) m.material.diffuseTexture.dispose();
                    m.material.dispose();
                }
                m.dispose();
            }
            entry.body.dispose();
        }

        // Dispose weapon child meshes
        if (entry.weapon && typeof entry.weapon.dispose === "function") {
            if (entry.weapon.getChildMeshes) {
                entry.weapon.getChildMeshes().forEach(m => m.dispose());
            }
            entry.weapon.dispose();
        }

        // Dispose root capsule
        entry.mesh.dispose();

        remotePlayers.delete(id);
    }

    // ---- Update remote player targets from server data ----
    function updatePlayerState(id, data) {
        const entry = remotePlayers.get(id);
        if (!entry) return;

        // Update stale timer
        entry.lastUpdateTime = performance.now() / 1000;

        if (data.x !== undefined) entry.targetX = data.x;
        if (data.y !== undefined) entry.targetY = data.y;
        if (data.z !== undefined) entry.targetZ = data.z;
        entry.targetYaw = data.yaw ?? entry.targetYaw;
        entry.targetPitch = data.pitch ?? entry.targetPitch;
        entry.animState = data.animState ?? entry.animState;
        if (data.hp !== undefined) entry.hp = data.hp;
        if (data.kills !== undefined) entry.kills = data.kills;
        if (data.deaths !== undefined) entry.deaths = data.deaths;

        // Track weapon type (use separate property to avoid overwriting weapon mesh)
        if (data.weapon !== undefined) {
            entry.weaponType = data.weapon;
            if (entry.weapon) {
                entry.weapon.setEnabled(entry.weaponType !== "none");
            }
        }

        // Track invulnerability + transparency
        if (data.invulnerable !== undefined) {
            const wasInvuln = entry.invulnerable;
            entry.invulnerable = !!data.invulnerable;
            if (entry.invulnerable !== wasInvuln) {
                setRemoteAlpha(entry, entry.invulnerable ? 0.4 : 1.0);
            }
        }

        // Track team changes
        if (data.team !== undefined && data.team !== entry.team) {
            entry.team = data.team;
            const newTeamColor = TEAM_COLORS[data.team] || TEAM_COLORS.default;
            const meshes = entry.mesh.getChildMeshes ? entry.mesh.getChildMeshes() : [];
            for (const m of meshes) {
                if (m.material && m.material.getClassName() === "PBRMaterial") {
                    if (!m.name.toLowerCase().includes("visor") && !m.name.toLowerCase().includes("glass")) {
                        m.material.albedoColor = BABYLON.Color3.Lerp(new BABYLON.Color3(1, 1, 1), newTeamColor, 0.45);
                    }
                } else if (m.material && m.material.getClassName() === "StandardMaterial" && (m.name.startsWith("rTorso") || m.name.startsWith("bodyMat"))) {
                    m.material.diffuseColor = newTeamColor.clone();
                }
            }
        }

        if (data.alive !== undefined) {
            const wasAlive = entry.alive;
            entry.alive = data.alive !== false;

            if (wasAlive && !entry.alive) {
                triggerDeath(entry);
            } else if (!wasAlive && entry.alive) {
                resetDeath(entry);
            }
        }
    }

    // ---- Set alpha for remote player body meshes (never the root capsule) ----
    function setRemoteAlpha(entry, alpha) {
        if (entry.body && entry.body.getChildMeshes) {
            const meshes = entry.body.getChildMeshes(false);
            for (const m of meshes) {
                if (m.material) {
                    m.material.alpha = alpha;
                    if (alpha < 1) {
                        m.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
                    } else {
                        m.material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
                    }
                }
            }
        }
    }

    // ---- Interpolate positions + animate limbs each frame (Ultra-fluid 60/144 FPS + CS2 Layers) ----
    function update(dt) {
        dt = Math.min(dt, 0.05);
        const factor = 1 - Math.exp(-LERP_SPEED * dt);

        for (const [id, entry] of remotePlayers) {
            // ---- Handle CS2 Physical Death Ragdoll Collapse ----
            if (!entry.alive) {
                entry.deathProgress = Math.min(1.0, entry.deathProgress + dt * 2.8);
                if (entry.body) {
                    // Fall body backward flat onto ground with inertia
                    // GLB models have rotation.x = 0 as upright; procedural bodies too
                    entry.body.position.y = BABYLON.Scalar.Lerp(-0.9, -1.35, entry.deathProgress);
                    entry.body.rotation.x = BABYLON.Scalar.Lerp(0, 1.45, entry.deathProgress);
                    entry.body.rotation.z = BABYLON.Scalar.Lerp(0, 0.35, entry.deathProgress);
                }
                if (entry.weapon) {
                    entry.weapon.position.y = BABYLON.Scalar.Lerp(-0.1, -0.6, entry.deathProgress);
                    entry.weapon.rotation.x = BABYLON.Scalar.Lerp(0, 0.8, entry.deathProgress);
                }
                if (entry.nameLabel) {
                    entry.nameLabel.position.x = entry.mesh.position.x;
                    entry.nameLabel.position.y = entry.mesh.position.y + 0.3;
                    entry.nameLabel.position.z = entry.mesh.position.z;
                }
                continue;
            }

            const pos = entry.mesh.position;
            const dx = entry.targetX - pos.x;
            const dy = entry.targetY - pos.y;
            const dz = entry.targetZ - pos.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            // If player teleported or respawned, snap immediately
            if (distSq > 100) {
                pos.x = entry.targetX;
                pos.y = entry.targetY;
                pos.z = entry.targetZ;
            } else {
                pos.x += dx * factor;
                pos.y += dy * factor;
                pos.z += dz * factor;
            }

            // Smooth shortest-path yaw rotation
            let diffYaw = entry.targetYaw - entry.mesh.rotation.y;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
            entry.mesh.rotation.y += diffYaw * factor;

            // Update name label position
            if (entry.nameLabel) {
                entry.nameLabel.position.x = pos.x;
                entry.nameLabel.position.y = pos.y + 1.5;
                entry.nameLabel.position.z = pos.z;
            }

            // ---- CS2 Jump / Airborne & Landing Impact Cushioning ----
            const isAirborne = entry.animState === "AIRBORNE";
            if (entry.wasAirborne && !isAirborne) {
                entry.landingDip = -0.22; // Knee compression on touching ground
            }
            entry.wasAirborne = isAirborne;
            if (entry.landingDip < 0) {
                entry.landingDip += dt * 1.8;
                if (entry.landingDip > 0) entry.landingDip = 0;
            }

            // ---- CS2 Strafe Lean (Inertial Banking) ----
            const rightX = Math.cos(entry.mesh.rotation.y);
            const rightZ = -Math.sin(entry.mesh.rotation.y);
            const safeDt = Math.max(0.001, dt);
            const vx = (entry.targetX - entry.prevX) / safeDt;
            const vz = (entry.targetZ - entry.prevZ) / safeDt;
            const lateralSpeed = vx * rightX + vz * rightZ;
            const targetLean = BABYLON.Scalar.Clamp(lateralSpeed * -0.015, -0.12, 0.12);
            entry.strafeLean = BABYLON.Scalar.Lerp(entry.strafeLean, targetLean, dt * 12);
            entry.prevX = entry.targetX;
            entry.prevZ = entry.targetZ;

            // ---- CS2 Flinch & Recoil spring decay ----
            entry.aimPitch = BABYLON.Scalar.Lerp(entry.aimPitch, entry.targetPitch || 0, dt * 15);
            entry.flinchPitch = BABYLON.Scalar.Lerp(entry.flinchPitch, 0, dt * 12);
            entry.flinchRoll = BABYLON.Scalar.Lerp(entry.flinchRoll, 0, dt * 12);
            entry.recoilZ = BABYLON.Scalar.Lerp(entry.recoilZ, 0, dt * 18);
            entry.recoilRotX = BABYLON.Scalar.Lerp(entry.recoilRotX, 0, dt * 18);

            // ---- Run skeletal animation + crouch/jump posture first ----
            if (entry.isGLBModel) {
                updateGLBAnimation(entry, dt);
            } else {
                animateLimbs(entry, dt);
            }

            // ---- CS2 Procedural layers applied AFTER skeleton (additive, not override) ----
            // Only apply strafe lean Z-roll; never overwrite rotation.x on GLB models
            // (the skeleton drives the pose; we just add a subtle body tilt)
            if (entry.body && entry.isGLBModel) {
                // Subtle strafe lean roll — safe additive Z rotation only
                entry.body.rotation.z = entry.strafeLean + entry.flinchRoll;
            }

            // ---- CS2 Weapon Recoil Kick & Tactical Actions ----
            if (entry.weapon) {
                let wY = -0.1;
                let wZ = 0.4 + entry.recoilZ;
                let wRotX = entry.recoilRotX;
                let wRotY = 0;
                let wRotZ = 0;

                // Knife Slash Swing
                if (entry.meleeSwingTimer > 0) {
                    entry.meleeSwingTimer -= dt;
                    const p = 1 - (entry.meleeSwingTimer / 0.35);
                    const slash = Math.sin(p * Math.PI) * 1.4;
                    wRotY = slash;
                    wRotX -= slash * 0.4;
                }

                // Tactical Reload Dip & Tilt
                if (entry.reloadTimer > 0) {
                    entry.reloadTimer -= dt;
                    const rp = 1 - (entry.reloadTimer / entry.reloadDuration);
                    const dip = Math.sin(rp * Math.PI) * 0.28;
                    const tilt = Math.sin(rp * Math.PI) * 0.45;
                    wY -= dip;
                    wRotZ = tilt;
                }

                entry.weapon.position.y = wY;
                entry.weapon.position.z = wZ;
                entry.weapon.rotation.x = wRotX;
                entry.weapon.rotation.y = wRotY;
                entry.weapon.rotation.z = wRotZ;
            }
        }
    }

    // ---- GLB animation state machine (CS2 Stances & Locomotion) ----
    function updateGLBAnimation(entry, dt) {
        if (!entry.animationGroups || entry.animationGroups.length === 0) return;

        // Map network state to animation key and speed
        const state = entry.animState;
        let desiredKey = "idle";
        let desiredSpeedRatio = 1.0;

        if (state === "RUNNING") {
            desiredKey = "run";
            desiredSpeedRatio = 1.0;
        } else if (state === "WALKING") {
            desiredKey = "walk";
            desiredSpeedRatio = 1.0;
        } else if (state === "CROUCHING") {
            desiredKey = "walk";
            desiredSpeedRatio = 0.65;
        } else if (state === "DEAD") {
            desiredKey = "tpose";
            desiredSpeedRatio = 1.0;
        } else { // IDLE, AIRBORNE, etc.
            desiredKey = "idle";
            desiredSpeedRatio = 1.0;
        }

        const targetAG = (entry.animMap && entry.animMap[desiredKey]) || entry.animationGroups[0];

        if (targetAG) {
            targetAG.speedRatio = desiredSpeedRatio;

            // Switch animation if target changed or if not currently playing
            if (entry.activeAG !== targetAG || !targetAG.isPlaying) {
                // Stop other animations
                for (const ag of entry.animationGroups) {
                    if (ag !== targetAG) {
                        ag.stop();
                    }
                }

                // Explicit start call with time range
                targetAG.start(true, desiredSpeedRatio, targetAG.from, targetAG.to, false);
                entry.activeAG = targetAG;
                entry.currentAnim = desiredKey;
            }
        }

        // ---- CS2 Crouch & Jump Knee-Tuck — position/scale only (no rotation.x!) ----
        const isCrouching = (state === "CROUCHING");
        const isAirborne  = (state === "AIRBORNE");
        const targetScaleY = isCrouching ? 0.62 : 1.0;
        const targetPosY   = isCrouching ? -1.15 : (isAirborne ? -0.7 : -0.9 + entry.landingDip);

        if (entry.body) {
            entry.body.scaling.y = BABYLON.Scalar.Lerp(entry.body.scaling.y, targetScaleY, dt * 14);
            entry.body.position.y = BABYLON.Scalar.Lerp(entry.body.position.y, targetPosY, dt * 14);
            // rotation.x and rotation.y are INTENTIONALLY not touched — the GLB skeleton drives the pose
        }
    }

    // ---- Limb swing & Organic Animation (procedural fallback) ----
    function animateLimbs(entry, dt) {
        const pivots = entry.body && entry.body._limbPivots;
        if (!pivots) return;

        const state = entry.animState;
        let swingSpeed = 0;
        let swingAmplitude = 0;

        if (state === "RUNNING") {
            swingSpeed = 10;
            swingAmplitude = 0.9;
        } else if (state === "CROUCHING") {
            swingSpeed = 5;
            swingAmplitude = 0.35;
        } else if (state === "WALKING") {
            swingSpeed = 7;
            swingAmplitude = 0.6;
        }

        // Advance animation time smoothly
        if (swingAmplitude > 0) {
            entry.limbTime += dt * swingSpeed;
        } else {
            entry.limbTime += (0 - entry.limbTime) * Math.min(1, dt * 8);
        }

        const swing = Math.sin(entry.limbTime) * swingAmplitude;
        const bounce = Math.abs(Math.cos(entry.limbTime)) * (swingAmplitude * 0.15);
        const twist = Math.sin(entry.limbTime) * (swingAmplitude * 0.2);

        // Arms swing opposite to legs (natural walk cycle)
        if (pivots.armL) pivots.armL.rotation.x = swing;
        if (pivots.armR) pivots.armR.rotation.x = -swing;
        if (pivots.legL) pivots.legL.rotation.x = -swing;
        if (pivots.legR) pivots.legR.rotation.x = swing;

        // Torso twisting
        if (pivots.torso) {
            pivots.torso.rotation.y = twist;
        }

        // Body bobbing
        if (entry.body) {
            entry.body.position.y = BABYLON.Scalar.Lerp(entry.body.position.y, bounce, dt * 10);
        }
    }

    // ---- CS2 Weapon Fire Trigger ----
    function triggerWeaponFire(id, weaponKey) {
        const entry = remotePlayers.get(id);
        if (!entry || !entry.alive) return;

        showRemoteMuzzleFlash(id);

        if (weaponKey === "knife") {
            entry.meleeSwingTimer = 0.35; // Knife slash arc
        } else if (weaponKey === "rytec") {
            entry.recoilZ = -0.32; // Heavy sniper recoil
            entry.recoilRotX = 0.30;
            entry.flinchPitch = -0.15;
        } else if (weaponKey === "by15") {
            entry.recoilZ = -0.24; // Shotgun kick
            entry.recoilRotX = 0.22;
        } else if (weaponKey === "m16") {
            entry.recoilZ = -0.12; // Rifle burst kick
            entry.recoilRotX = 0.12;
        } else {
            entry.recoilZ = -0.08; // Pistol muzzle flip
            entry.recoilRotX = 0.14;
        }
    }

    // ---- CS2 Reload Trigger ----
    function triggerReload(id, duration) {
        const entry = remotePlayers.get(id);
        if (!entry || !entry.alive) return;
        entry.reloadDuration = duration || 2.0;
        entry.reloadTimer = entry.reloadDuration;
    }

    // ---- CS2 Death Ragdoll Trigger ----
    function triggerDeath(entryOrId) {
        const entry = typeof entryOrId === "object" ? entryOrId : remotePlayers.get(entryOrId);
        if (!entry) return;
        entry.alive = false;
        entry.deathProgress = 0;
        if (entry.animationGroups) {
            for (const ag of entry.animationGroups) ag.stop();
        }
    }

    // ---- CS2 Death Reset (Respawn) ----
    function resetDeath(entryOrId) {
        const entry = typeof entryOrId === "object" ? entryOrId : remotePlayers.get(entryOrId);
        if (!entry) return;
        entry.alive = true;
        entry.deathProgress = 0;
        if (entry.body) {
            entry.body.position.y = -0.9;
            entry.body.rotation.x = 0;  // GLB models: 0 is upright (rotation.y = Math.PI handles facing)
            entry.body.rotation.z = 0;
        }
        if (entry.weapon) {
            entry.weapon.position.set(0.35, -0.1, 0.4);
            entry.weapon.rotation.set(0, 0, 0);
        }
        if (entry.nameLabel) {
            entry.nameLabel.position.y = entry.mesh.position.y + 1.5;
        }
        entry.currentAnim = null; // Force re-evaluation
        entry.activeAG = null;    // Force animation restart
    }

    // ---- CS2 Procedural Hit Reaction (Aim Punch) ----
    function playHitReaction(id) {
        const entry = remotePlayers.get(id);
        if (!entry || !entry.body || !entry.alive) return;
        
        // Procedural twitch / aim punch
        entry.flinchPitch = (Math.random() - 0.5) * 0.35 - 0.2;
        entry.flinchRoll = (Math.random() - 0.5) * 0.3;

        // Flash red
        entry.body.getChildMeshes(false).forEach(m => {
            if (m.material && m.material.getClassName() === "PBRMaterial") {
                const orig = m.material.albedoColor.clone();
                m.material.albedoColor = new BABYLON.Color3(1, 0.1, 0.1);
                setTimeout(() => {
                    if (m && m.material) m.material.albedoColor = orig;
                }, 150);
            }
        });
    }

    // ---- Pooled Remote Muzzle Flash Visual Effect (Zero allocations, zero shader rebinds) ----
    let _pooledFlashLight = null;
    let _flashTimer = null;
    const _rFlashPos = new BABYLON.Vector3();

    function showRemoteMuzzleFlash(id) {
        const entry = remotePlayers.get(id);
        if (!entry || !entry.mesh || !entry.alive) return;

        const sinY = Math.sin(entry.mesh.rotation.y);
        const cosY = Math.cos(entry.mesh.rotation.y);
        _rFlashPos.set(
            entry.mesh.position.x + sinY * 0.8 + cosY * 0.35,
            entry.mesh.position.y + 0.4,
            entry.mesh.position.z + cosY * 0.8 - sinY * 0.35
        );

        if (!_pooledFlashLight) {
            _pooledFlashLight = new BABYLON.PointLight("rFlashPooled", _rFlashPos, scene);
            _pooledFlashLight.diffuse = new BABYLON.Color3(1.0, 0.75, 0.25);
            _pooledFlashLight.range = 10.0;
            _pooledFlashLight.intensity = 1.8;
            _pooledFlashLight.setEnabled(false);
        }

        _pooledFlashLight.position.copyFrom(_rFlashPos);
        _pooledFlashLight.intensity = 1.8;
        _pooledFlashLight.setEnabled(true);

        if (_flashTimer) clearTimeout(_flashTimer);
        _flashTimer = setTimeout(() => {
            if (_pooledFlashLight) _pooledFlashLight.setEnabled(false);
        }, 60);
    }

    // ---- Get player ID from picked mesh ----
    function getPlayerIdFromMesh(mesh) {
        // Check the mesh itself
        if (mesh.metadata && mesh.metadata.playerId !== undefined) {
            return mesh.metadata.playerId;
        }
        // Check parent chain (body parts are children of the capsule)
        let parent = mesh.parent;
        while (parent) {
            if (parent.metadata && parent.metadata.playerId !== undefined) {
                return parent.metadata.playerId;
            }
            parent = parent.parent;
        }
        return null;
    }

    // ---- Set local player position reference for LOD ----
    function setLocalPlayerPosition(pos) {
        localPlayerPosition = pos;
    }

    return {
        addPlayer,
        removePlayer,
        updatePlayerState,
        update,
        getPlayerIdFromMesh,
        setLocalPlayerPosition,
        playHitReaction,
        showRemoteMuzzleFlash,
        triggerWeaponFire,
        triggerReload,
        triggerDeath,
        resetDeath,
        get count() { return remotePlayers.size; },
        get all() { return remotePlayers; },
    };
}

// ---- Create human-like procedural body (fallback when GLB fails) ----
function createProceduralBody(scene, parentMesh, bodyMat, skinMat) {
    const root = new BABYLON.TransformNode("remoteBodyRoot_" + parentMesh.name, scene);
    root.parent = parentMesh;
    root.position.y = -0.1; // Sits naturally on terrain

    const meta = parentMesh.metadata || {};

    // Torso (capsule)
    const torso = BABYLON.MeshBuilder.CreateCapsule("rTorso", { radius: 0.22, capSubdivisions: 6, subdivisions: 2, height: 0.75, tessellation: 16 }, scene);
    torso.position.y = 0.1;
    torso.material = bodyMat;
    torso.parent = root;
    torso.isPickable = true;
    torso.metadata = meta;

    // Head (sphere)
    const head = BABYLON.MeshBuilder.CreateSphere("rHead", { diameter: 0.38, segments: 16 }, scene);
    head.position.y = 0.65;
    head.rotation.y = Math.PI;
    head.material = skinMat;
    head.parent = root;
    head.isPickable = true;
    head.metadata = meta;

    // Left Arm
    const armPivotL = new BABYLON.TransformNode("rArmPivotL", scene);
    armPivotL.position.set(-0.32, 0.35, 0);
    armPivotL.parent = root;
    const armL = BABYLON.MeshBuilder.CreateCapsule("rArmL", { radius: 0.08, capSubdivisions: 6, height: 0.65, tessellation: 16 }, scene);
    armL.position.y = -0.325;
    armL.material = bodyMat;
    armL.parent = armPivotL;
    armL.isPickable = true;
    armL.metadata = meta;

    // Right Arm
    const armPivotR = new BABYLON.TransformNode("rArmPivotR", scene);
    armPivotR.position.set(0.32, 0.35, 0);
    armPivotR.parent = root;
    const armR = BABYLON.MeshBuilder.CreateCapsule("rArmR", { radius: 0.08, capSubdivisions: 6, height: 0.65, tessellation: 16 }, scene);
    armR.position.y = -0.325;
    armR.material = bodyMat;
    armR.parent = armPivotR;
    armR.isPickable = true;
    armR.metadata = meta;

    // Left Leg
    const legPivotL = new BABYLON.TransformNode("rLegPivotL", scene);
    legPivotL.position.set(-0.14, -0.25, 0);
    legPivotL.parent = root;
    const legL = BABYLON.MeshBuilder.CreateCapsule("rLegL", { radius: 0.1, capSubdivisions: 6, height: 0.7, tessellation: 16 }, scene);
    legL.position.y = -0.35;
    legL.material = bodyMat;
    legL.parent = legPivotL;
    legL.isPickable = true;
    legL.metadata = meta;

    // Right Leg
    const legPivotR = new BABYLON.TransformNode("rLegPivotR", scene);
    legPivotR.position.set(0.14, -0.25, 0);
    legPivotR.parent = root;
    const legR = BABYLON.MeshBuilder.CreateCapsule("rLegR", { radius: 0.1, capSubdivisions: 6, height: 0.7, tessellation: 16 }, scene);
    legR.position.y = -0.35;
    legR.material = bodyMat;
    legR.parent = legPivotR;
    legR.isPickable = true;
    legR.metadata = meta;

    root._limbPivots = {
        armL: armPivotL,
        armR: armPivotR,
        legL: legPivotL,
        legR: legPivotR,
        torso: torso
    };

    return root;
}

// ---- Create weapon for remote player (procedural fallback only) ----
function createRemoteWeapon(scene, parentMesh, gunMat) {
    const root = new BABYLON.TransformNode("remoteWeaponRoot_" + parentMesh.name, scene);
    root.parent = parentMesh;

    const barrel = BABYLON.MeshBuilder.CreateCylinder("rBarrel", { height: 0.6, diameter: 0.04, tessellation: 6 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.3, 0.1, 0.4);
    barrel.material = gunMat;
    barrel.parent = root;
    barrel.isPickable = false;

    const body = BABYLON.MeshBuilder.CreateBox("rGunBody", { width: 0.06, height: 0.08, depth: 0.35 }, scene);
    body.position.set(0.3, 0.08, 0.25);
    body.material = gunMat;
    body.parent = root;
    body.isPickable = false;

    return root;
}

// ---- Create floating name label ----
function createNameLabel(scene, name, parentMesh, team) {
    const planeWidth = 2;
    const planeHeight = 0.4;
    const plane = BABYLON.MeshBuilder.CreatePlane("nameLabel_" + parentMesh.name, {
        width: planeWidth,
        height: planeHeight,
    }, scene);
    plane.position.y = 1.5;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;

    // Dynamic texture for the name
    const texRes = 256;
    const dt = new BABYLON.DynamicTexture("nameTex_" + parentMesh.name, { width: texRes, height: 64 }, scene, false);
    const ctx = dt.getContext();

    ctx.clearRect(0, 0, texRes, 64);
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    const metrics = ctx.measureText(name);
    const bgW = Math.min(metrics.width + 20, texRes);
    ctx.fillRect((texRes - bgW) / 2, 8, bgW, 48);

    // Text — color by team
    const teamColor = team === "X" ? "#66aaff" : team === "Y" ? "#ffaa44" : "#ffffff";
    ctx.fillStyle = teamColor;
    ctx.fillText(name, texRes / 2, 32);
    dt.update();
    dt.hasAlpha = true;

    const mat = new BABYLON.StandardMaterial("nameMat_" + parentMesh.name, scene);
    mat.diffuseTexture = dt;
    mat.emissiveTexture = dt;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;

    plane.material = mat;

    return plane;
}
