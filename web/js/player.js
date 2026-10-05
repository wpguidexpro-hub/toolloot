/* ========================================
   Player Module
   Capsule player, movement FSM, physics,
   ground detection, collision handling
   ======================================== */

import { checkForestCollision } from './forest.js';
import { checkCityCollision, getCityHeightAt } from './city.js';
import { getVehicleHeightAt, checkVehicleCollision } from './vehicles.js';
import { generateNormalMap } from './environment.js';

// --- Constants (Calibrated to natural realistic human physics) ---
const WALK_SPEED = 3.6;      // Natural tactical walk (~13 km/h)
const RUN_SPEED = 6.5;       // Natural combat sprint (~23.4 km/h)
const CROUCH_SPEED = 1.8;    // Natural tactical crouch-walk (~6.5 km/h)
const JUMP_FORCE = 7.0;      // Natural jump height (~1.1m)
const GRAVITY = -22.0;       // Realistic grounded gravity
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const EYE_HEIGHT = 1.6;
const CROUCH_EYE_HEIGHT = 0.8;
let MOUSE_SENSITIVITY = 0.0008; // Adjustable via HUD slider
const MAX_PITCH = Math.PI * 0.45; // 81 degrees

export function createPlayer(scene, canvas, terrain, mapType, soldierContainer) {
    const isCity = mapType === "city";
    // ---- Input State ----
    const keys = {
        w: false, a: false, s: false, d: false,
        shift: false, ctrl: false, space: false, r: false, v: false
    };
    let mouseButtons = { left: false, right: false };

    // ---- Player State ----
    let yaw = 0;
    let pitch = 0;
    let verticalVelocity = 0;
    let isGrounded = false;
    let isCrouching = false;
    let isRunning = false;
    let isMoving = false;
    let state = "IDLE";
    let currentEyeHeight = EYE_HEIGHT;
    let limbTime = 0; // Animation timer for Minecraft-style limb swing
    let landingDip = 0; // CS2 knee compression on landing
    let strafeLean = 0; // CS2 lateral banking lean
    let deathProgress = 0; // CS2 ragdoll death progress

    // ---- Multiplayer State ----
    let hp = 100;
    let maxHp = 100;
    let alive = true;
    let kills = 0;
    let deaths = 0;
    let holstered = false;

    // ---- Invulnerability State ----
    let invulnerable = true;
    let invulnTimer = 2.0; // 2 seconds on initial spawn (cancels immediately on attack)
    let currentWeapon = "knife";
    let team = null; // "X" or "Y"

    // ---- Fall Damage State ----
    const FLOOR_HEIGHT_FALL = 2.7; // same as city floor height
    const FALL_DMG_PER_FLOOR = 5;
    let lastGroundedY = 0; // feet Y when last grounded
    let wasGroundedLastFrame = true;

    // Reusable vectors (avoid GC pressure)
    const moveDirection = new BABYLON.Vector3(0, 0, 0);
    const forwardVec = new BABYLON.Vector3(0, 0, 0);
    const rightVec = new BABYLON.Vector3(0, 0, 0);

    // ---- Create Player Mesh (Capsule) ----
    const mesh = BABYLON.MeshBuilder.CreateCapsule("playerCapsule", {
        height: PLAYER_HEIGHT,
        radius: PLAYER_RADIUS,
        tessellation: 12,
        subdivisions: 1
    }, scene);

    // Start above terrain to fall into place
    mesh.position.set(0, 10, 0);

    // Strictly invisible physics capsule container
    const invisibleCapsuleMat = new BABYLON.StandardMaterial("localInvCapMat", scene);
    invisibleCapsuleMat.alpha = 0;
    invisibleCapsuleMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    invisibleCapsuleMat.freeze();
    mesh.material = invisibleCapsuleMat;
    mesh.visibility = 0;
    mesh.isPickable = false;

    // ---- Create Character Body (visible in TPS) ----
    let characterBody = null;
    let isGLBModel = false;
    let animationGroups = [];
    let animMap = {};

    if (soldierContainer) {
        try {
            // Clone the soldier model from the centrally preloaded container, WITH material cloning (true)
            const cloneResult = soldierContainer.instantiateModelsToScene(
                (name) => name + "_local",
                true,
                { doNotInstantiate: false }
            );

            if (cloneResult.rootNodes.length > 0) {
                characterBody = cloneResult.rootNodes[0];
                characterBody.parent = mesh;

                // Scale and center it to align with the player capsule
                characterBody.scaling.setAll(1.0);
                characterBody.position.y = -PLAYER_HEIGHT / 2;
                characterBody.rotation.y = Math.PI; // Face forward

                // Generate ONE shared fabric normal map (reuse across all meshes)
                const sharedFabricNormal = generateNormalMap(scene, 128, 128, "fabric");
                sharedFabricNormal.uScale = 4.0;
                sharedFabricNormal.vScale = 4.0;

                // Tweak the natively cloned PBR materials and fix bounding boxes
                const allMeshes = characterBody.getChildMeshes(false);
                for (const child of allMeshes) {
                    child.isPickable = false;
                    child.receiveShadows = true;
                    child.visibility = 1.0;
                    child.isVisible = true;

                    // Prevent frustum culling from incorrectly hiding animated skinned meshes
                    child.computeWorldMatrix(true);
                    child.refreshBoundingInfo();
                    if (child.skeleton) {
                        // A static bounding box is wrong for skeletal animation and caused
                        // the character to disappear at certain camera angles. Bypass
                        // frustum culling for these few meshes instead (cheap).
                        child.alwaysSelectAsActiveMesh = true;
                    }

                    if (child.material && child.material.getClassName() === "PBRMaterial") {
                        const pbrMat = child.material;
                        
                        // Apply shared fabric normal map if available
                        if (sharedFabricNormal) {
                            pbrMat.bumpTexture = sharedFabricNormal;
                        }
                    }
                }

                isGLBModel = true;
                animationGroups = cloneResult.animationGroups || [];

                // Index animation groups with robust fallbacks
                animMap = {
                    idle: animationGroups.find(ag => ag.name.toLowerCase().includes("idle")) || animationGroups[0],
                    walk: animationGroups.find(ag => ag.name.toLowerCase().includes("walk")) || animationGroups[3] || animationGroups[0],
                    run: animationGroups.find(ag => ag.name.toLowerCase().includes("run")) || animationGroups[1] || animationGroups[0],
                    tpose: animationGroups.find(ag => ag.name.toLowerCase().includes("tpose")) || animationGroups[2] || animationGroups[0],
                };

                // Stop all cloned animations initially so they start cleanly on first frame
                for (const ag of animationGroups) {
                    ag.stop();
                }
            }
        } catch (err) {
            console.error("Failed to clone soldier model for local player:", err);
            characterBody = null; // Force fallback
        }
    }

    if (!characterBody) {
        // Fallback to legacy blocky model
        characterBody = createCharacterModel(scene, mesh);
    }

    // ---- Create Weapon Mesh ----
    const weaponMesh = createWeaponMesh(scene, mesh);

    // ---- Input Handlers ----
    const keyMap = {
        "KeyW": "w", "KeyA": "a", "KeyS": "s", "KeyD": "d",
        "ShiftLeft": "shift", "ShiftRight": "shift",
        "ControlLeft": "ctrl", "ControlRight": "ctrl",
        "KeyC": "ctrl", // Also allow 'C' for crouching like standard FPS games
        "Space": "space", "KeyR": "r", "KeyV": "v", "KeyH": "h"
    };

    const onKeyDown = (e) => {
        if (document.pointerLockElement === canvas && e.code !== "Escape") {
            e.preventDefault();
        }
        const k = keyMap[e.code];
        if (k) {
            // Toggle holster on keydown
            if (k === 'h' && !keys.h) {
                holstered = !holstered;
            }
            keys[k] = true;
        }
    };

    const onKeyUp = (e) => {
        if (document.pointerLockElement === canvas && e.code !== "Escape") {
            e.preventDefault();
        }
        const k = keyMap[e.code];
        if (k) keys[k] = false;
    };

    const onPointerDown = (e) => {
        // Only register mouse buttons when pointer is locked (game is active)
        if (document.pointerLockElement === canvas) {
            if (e.button === 0) mouseButtons.left = true;
            if (e.button === 2) mouseButtons.right = true;
        }
    };

    const onPointerUp = (e) => {
        if (e.button === 0) mouseButtons.left = false;
        if (e.button === 2) mouseButtons.right = false;
    };

    // Mouse look (only when pointer locked)
    let mouseDX = 0, mouseDY = 0;
    const onMouseMove = (e) => {
        if (document.pointerLockElement === canvas) {
            mouseDX += e.movementX;
            mouseDY += e.movementY;
        }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true, passive: false });
    window.addEventListener("keyup", onKeyUp, { capture: true, passive: false });

    // Listen for pointer events at document level — Babylon.js intercepts
    // canvas-level pointer events internally, so document level is the
    // only reliable way to capture clicks during pointer lock.
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Clear mouse & key state when pointer lock is lost (e.g. on Esc)
    document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement !== canvas) {
            mouseButtons.left = false;
            mouseButtons.right = false;
            for (const k in keys) {
                keys[k] = false;
            }
        }
    });

    // Sensitivity slider
    const sensSlider = document.getElementById("sensitivity-slider");
    const sensValue = document.getElementById("sensitivity-value");
    if (sensSlider) {
        MOUSE_SENSITIVITY = parseInt(sensSlider.value) * 0.0001;
        sensSlider.addEventListener("input", () => {
            const val = parseInt(sensSlider.value);
            MOUSE_SENSITIVITY = val * 0.0001;
            if (sensValue) sensValue.textContent = val;
        });
    }

    // ---- Inject look delta from touch controls ----
    function injectLookDelta(dx, dy) {
        mouseDX += dx / MOUSE_SENSITIVITY; // Convert back so sensitivity is applied uniformly
        mouseDY += dy / MOUSE_SENSITIVITY;
    }

    // ---- Update (called each frame) ----
    function update(dt) {
        // Clamp dt to prevent huge jumps on lag spikes
        dt = Math.min(dt, 0.05);

        // Skip movement when dead — also reset inputs to prevent stuck keys
        if (!alive) {
            resetInputs();
            return;
        }

        // ---- Invulnerability timer ----
        if (invulnerable) {
            invulnTimer -= dt;
            if (invulnTimer <= 0) {
                invulnerable = false;
                invulnTimer = 0;
                setTransparency(1.0); // Fully opaque
            }
        }

        // Process mouse look
        yaw += mouseDX * MOUSE_SENSITIVITY;
        pitch += mouseDY * MOUSE_SENSITIVITY;
        pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
        mouseDX = 0;
        mouseDY = 0;

        // ---- Ground Detection ----
        const terrainH = terrain.getHeightAtCoordinates(mesh.position.x, mesh.position.z);
        const feetY = mesh.position.y - PLAYER_HEIGHT / 2;
        let groundH = terrainH;
        if (isCity) {
            // City: also account for rooftops, ramps and vehicle roofs
            const cityH = getCityHeightAt(mesh.position.x, mesh.position.z, feetY);
            if (cityH > groundH) groundH = cityH;
            const vehH = getVehicleHeightAt(mesh.position.x, mesh.position.z);
            if (vehH > groundH) groundH = vehH;
        }
        isGrounded = feetY <= groundH + 0.15;

        // ---- State Machine ----
        isCrouching = keys.ctrl;
        isRunning = keys.shift && !isCrouching;

        // Movement speed
        let speed = WALK_SPEED;
        if (isRunning) speed = RUN_SPEED;
        if (isCrouching) speed = CROUCH_SPEED;

        // Calculate forward/right vectors from yaw
        forwardVec.set(Math.sin(yaw), 0, Math.cos(yaw));
        rightVec.set(Math.cos(yaw), 0, -Math.sin(yaw));

        // Build movement direction
        moveDirection.set(0, 0, 0);
        if (keys.w) moveDirection.addInPlace(forwardVec);
        if (keys.s) moveDirection.subtractInPlace(forwardVec);
        if (keys.d) moveDirection.addInPlace(rightVec);
        if (keys.a) moveDirection.subtractInPlace(rightVec);

        // Normalize to prevent diagonal speed boost
        isMoving = moveDirection.lengthSquared() > 0.001;
        if (isMoving) {
            moveDirection.normalize();
        }

        // Determine state label
        if (!isGrounded) {
            state = "AIRBORNE";
        } else if (!isMoving) {
            state = isCrouching ? "CROUCHING" : "IDLE";
        } else {
            state = isRunning ? "RUNNING" : (isCrouching ? "CROUCHING" : "WALKING");
        }

        // ---- Jump ----
        if (keys.space && isGrounded) {
            verticalVelocity = JUMP_FORCE;
            isGrounded = false;
            keys.space = false; // Consume the press
        }

        // ---- Gravity ----
        verticalVelocity += GRAVITY * dt;

        // ---- Apply Movement ----
        let newX = mesh.position.x + moveDirection.x * speed * dt;
        let newZ = mesh.position.z + moveDirection.z * speed * dt;
        let newY = mesh.position.y + verticalVelocity * dt;

        // ---- Obstacle Collision ----
        if (isCity) {
            // City: check building collision
            const push = checkCityCollision(newX, newZ, PLAYER_RADIUS, newY - PLAYER_HEIGHT / 2);
            if (push) {
                newX += push.x;
                newZ += push.z;
            }
            // City: check vehicle collision
            const vPush = checkVehicleCollision(newX, newZ, PLAYER_RADIUS, newY - PLAYER_HEIGHT / 2);
            if (vPush) {
                newX += vPush.x;
                newZ += vPush.z;
            }
        } else {
            // Forest: check tree/rock collision
            const push = checkForestCollision(newX, newZ, PLAYER_RADIUS);
            if (push) {
                newX += push.x;
                newZ += push.z;
            }
        }

        // ---- Terrain / Staircase / Vehicle Collision (ground clamp) ----
        let newTerrainH = terrain.getHeightAtCoordinates(newX, newZ);
        if (isCity) {
            // On city map, also check stair/rooftop height
            const currentFeetY = newY - PLAYER_HEIGHT / 2;
            const cityH = getCityHeightAt(newX, newZ, currentFeetY);
            if (cityH > newTerrainH) newTerrainH = cityH;
            // Also check vehicle roof height
            const vehH = getVehicleHeightAt(newX, newZ);
            if (vehH > newTerrainH) newTerrainH = vehH;
        }
        const minY = newTerrainH + PLAYER_HEIGHT / 2;

        if (newY < minY) {
            newY = minY;

            // ---- Fall Damage ----
            if (!wasGroundedLastFrame && alive) {
                const fallDist = lastGroundedY - (newY - PLAYER_HEIGHT / 2);
                if (fallDist > FLOOR_HEIGHT_FALL * 0.9) { // threshold: ~1 floor
                    const floorsDropped = Math.floor(fallDist / FLOOR_HEIGHT_FALL);
                    if (floorsDropped >= 1) {
                        const damage = floorsDropped * FALL_DMG_PER_FLOOR;
                        hp = Math.max(0, hp - damage);
                        console.log(`[💥] Fall damage: ${damage} HP (${floorsDropped} floors)`);
                        if (hp <= 0) {
                            alive = false;
                            state = "DEAD";
                            deaths++;
                            if (onFallDeath) onFallDeath();
                        }
                    }
                }
            }

            verticalVelocity = 0;
            isGrounded = true;
            lastGroundedY = newY - PLAYER_HEIGHT / 2; // feet Y
            wasGroundedLastFrame = true;
        } else {
            // Track if we just left the ground
            if (isGrounded) {
                lastGroundedY = mesh.position.y - PLAYER_HEIGHT / 2; // feet Y before leaving
            }
            wasGroundedLastFrame = false;
        }

        // ---- World Bounds ----
        const bound = terrain.worldSize / 2 - 2;
        newX = Math.max(-bound, Math.min(bound, newX));
        newZ = Math.max(-bound, Math.min(bound, newZ));

        // ---- Apply Position ----
        mesh.position.set(newX, newY, newZ);

        // ---- Rotate capsule to face movement direction ----
        mesh.rotation.y = yaw;

        // ---- CS2 Jump / Airborne & Landing Impact Compression ----
        const isAirborne = (state === "AIRBORNE");
        if (wasGroundedLastFrame && !isGrounded && keys.space) {
            landingDip = 0;
        } else if (!wasGroundedLastFrame && isGrounded) {
            landingDip = -0.22; // Knee compression dip upon landing
        }
        if (landingDip < 0) {
            landingDip += dt * 1.8;
            if (landingDip > 0) landingDip = 0;
        }

        // ---- CS2 Strafe Lean (Inertial Banking) ----
        let strafeTarget = 0;
        if (keys.a && !keys.d) strafeTarget = 0.08;
        else if (keys.d && !keys.a) strafeTarget = -0.08;
        strafeLean = BABYLON.Scalar.Lerp(strafeLean, strafeTarget, dt * 12);

        // ---- Crouch — interpolate eye height ----
        const targetEye = isCrouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
        currentEyeHeight = BABYLON.Scalar.Lerp(currentEyeHeight, targetEye, 12 * dt);

        // ---- Weapon Holster Animation ----
        const targetWeaponY = holstered ? -0.5 : 0;
        weaponMesh.position.y = BABYLON.Scalar.Lerp(weaponMesh.position.y, targetWeaponY, 15 * dt);

        // ---- Character Body CS2 Procedural Layers ----
        if (characterBody) {
            if (alive) {
                // CS2 Crouch & Jump Knee-Tuck Posture
                const targetScaleY = isCrouching ? 0.62 : 1.0;
                const targetPosY = isCrouching ? (-PLAYER_HEIGHT / 2 - 0.25) : (isAirborne ? (-PLAYER_HEIGHT / 2 + 0.2) : (-PLAYER_HEIGHT / 2 + landingDip));
                characterBody.scaling.y = BABYLON.Scalar.Lerp(characterBody.scaling.y, targetScaleY, dt * 14);
                characterBody.position.y = BABYLON.Scalar.Lerp(characterBody.position.y, targetPosY, dt * 14);

                // Aim Pitching in Third-Person + Strafe Lean
                characterBody.rotation.x = -pitch * 0.45;
                characterBody.rotation.z = strafeLean;
                deathProgress = 0;
            } else {
                // CS2 Ragdoll physical collapse
                deathProgress = Math.min(1.0, deathProgress + dt * 2.8);
                characterBody.position.y = BABYLON.Scalar.Lerp(-PLAYER_HEIGHT / 2, -PLAYER_HEIGHT / 2 - 0.45, deathProgress);
                characterBody.rotation.x = BABYLON.Scalar.Lerp(0, 1.45, deathProgress);
                characterBody.rotation.z = BABYLON.Scalar.Lerp(0, 0.35, deathProgress);
            }
        }

        // ---- Character Animation ----
        if (isGLBModel && animationGroups.length > 0) {
            updateGLBAnimation();
        } else {
            animateLocalLimbs(characterBody, dt);
        }
    }

    // ---- Minecraft-style limb swing for local player ----
    function animateLocalLimbs(body, dt) {
        const pivots = body && body._limbPivots;
        if (!pivots) return;

        let swingSpeed = 0;
        let swingAmplitude = 0;

        if (isMoving) {
            if (isRunning) {
                swingSpeed = 10;
                swingAmplitude = 0.9;
            } else if (isCrouching) {
                swingSpeed = 5;
                swingAmplitude = 0.35;
            } else {
                swingSpeed = 7;
                swingAmplitude = 0.6;
            }
        }

        if (swingAmplitude > 0) {
            limbTime += dt * swingSpeed;
        } else {
            limbTime *= 0.85; // Smoothly return to idle
        }

        const swing = Math.sin(limbTime) * swingAmplitude;

        pivots.armL.rotation.x = swing;
        pivots.armR.rotation.x = -swing;
        pivots.legL.rotation.x = -swing;
        pivots.legR.rotation.x = swing;
    }

    // ---- GLB Skeletal Animation controller (O(1) dictionary lookups) ----
    let currentPlayingAG = null;
    function updateGLBAnimation() {
        if (!isGLBModel || animationGroups.length === 0) return;

        let desiredKey = "idle";
        let desiredSpeed = 1.0;
        if (state === "WALKING") { desiredKey = "walk"; desiredSpeed = 1.0; }
        else if (state === "RUNNING") { desiredKey = "run"; desiredSpeed = 1.0; }
        else if (state === "CROUCHING") { desiredKey = isMoving ? "walk" : "idle"; desiredSpeed = 0.65; }
        else if (state === "DEAD") { desiredKey = "tpose"; desiredSpeed = 1.0; }

        const targetAG = (animMap && animMap[desiredKey]) || animationGroups[0];

        if (targetAG) {
            targetAG.speedRatio = desiredSpeed;

            if (currentPlayingAG !== targetAG || !targetAG.isPlaying) {
                // Stop other animations
                for (const ag of animationGroups) {
                    if (ag !== targetAG) ag.stop();
                }

                // Explicit start call with time range
                targetAG.start(true, desiredSpeed, targetAG.from, targetAG.to, false);
                currentPlayingAG = targetAG;
            }
        }
    }

    const TEAM_COLORS = {
        X: new BABYLON.Color3(0.2, 0.5, 1.0),   // Blue
        Y: new BABYLON.Color3(1.0, 0.55, 0.15),  // Orange
        default: new BABYLON.Color3(0.5, 0.5, 0.5),
    };

    function applyTeamColor() {
        if (!team) return;
        const color = TEAM_COLORS[team] || TEAM_COLORS.default;

        if (isGLBModel && characterBody) {
            const meshes = characterBody.getChildMeshes(false);
            for (const m of meshes) {
                if (m.name.toLowerCase().includes("visor") || m.name.toLowerCase().includes("glass")) {
                    continue; // Skip tinting helmet visor/glass
                }
                if (m.material) {
                    const mat = m.material;
                    if (mat.albedoColor) {
                        mat.albedoColor = BABYLON.Color3.Lerp(mat.albedoColor, color, 0.45);
                    }
                }
            }
        } else {
            // Fallback for procedural model
            if (characterBody._bodyMat) {
                characterBody._bodyMat.diffuseColor = color;
            }
        }
    }

    // ---- Multiplayer Methods ----
    function takeDamage(amount) {
        if (!alive) return;
        hp = Math.max(0, hp - amount);
        if (hp <= 0) {
            alive = false;
            state = "DEAD";
            deaths++;
        }
    }

    function respawnAt(x, y, z) {
        mesh.position.set(x, y, z);
        hp = maxHp;
        alive = true;
        verticalVelocity = 0;
        state = "IDLE";
        currentWeapon = "knife";

        // Start invulnerability
        invulnerable = true;
        invulnTimer = 2.0;
        setTransparency(0.4);
    }

    function cancelInvulnerability() {
        if (invulnerable) {
            invulnerable = false;
            invulnTimer = 0;
            setTransparency(1.0);
        }
    }

    function teleportTo(x, y, z) {
        mesh.position.set(x, y, z);
        verticalVelocity = 0;
    }

    function addKill() {
        kills++;
    }

    // ---- Apply Custom Textures from data URLs ----
    function setCustomTextures(faceDataUrl, bodyDataUrl) {
        if (faceDataUrl && characterBody._headMat) {
            const faceTex = new BABYLON.Texture(faceDataUrl, scene);
            characterBody._headMat.diffuseTexture = faceTex;
            characterBody._headMat.diffuseColor = BABYLON.Color3.White();
        }
        if (bodyDataUrl && characterBody._bodyMat) {
            const bodyTex = new BABYLON.Texture(bodyDataUrl, scene);
            characterBody._bodyMat.diffuseTexture = bodyTex;
            characterBody._bodyMat.diffuseColor = BABYLON.Color3.White();
        }
    }

    // ---- Set transparency for invulnerability visual ----
    function setTransparency(alpha) {
        // Helper to apply transparency parameters to a material
        const applyAlphaToMat = (mat) => {
            if (!mat) return;
            mat.alpha = alpha;
            if (alpha < 1) {
                mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            } else {
                mat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
            }
        };

        // Apply to character body parts flatly (no recursion to prevent Stack Overflow)
        if (characterBody) {
            if (characterBody.material) {
                applyAlphaToMat(characterBody.material);
            }
            if (characterBody.getChildMeshes) {
                const meshes = characterBody.getChildMeshes(false);
                for (const m of meshes) {
                    if (m.material) {
                        applyAlphaToMat(m.material);
                    }
                }
            }
        }
    }

    // Set initial invulnerability transparency
    setTransparency(0.4);

    // ---- Reset all inputs (prevents stuck keys) ----
    function resetInputs() {
        keys.w = false; keys.a = false; keys.s = false; keys.d = false;
        keys.shift = false; keys.ctrl = false; keys.space = false;
        keys.r = false; keys.v = false; keys.h = false;
        mouseButtons.left = false;
        mouseButtons.right = false;
        mouseDX = 0;
        mouseDY = 0;
        verticalVelocity = 0;
    }

    // ---- Fall death callback (set by main.js) ----
    let onFallDeath = null;

    // ---- Public Interface ----
    return {
        mesh,
        characterBody,
        weaponMesh,
        keys,
        mouseButtons,
        update,
        takeDamage,
        respawnAt,
        cancelInvulnerability,
        teleportTo,
        addKill,
        injectLookDelta,
        setCustomTextures,
        setTransparency,
        get position() { return mesh.position; },
        get yaw() { return yaw; },
        get pitch() { return pitch; },
        get eyeHeight() { return currentEyeHeight; },
        get state() { return state; },
        get isGrounded() { return isGrounded; },
        get isRunning() { return isRunning; },
        get isCrouching() { return isCrouching; },
        get isMoving() { return isMoving; },
        get verticalVelocity() { return verticalVelocity; },
        get hp() { return hp; },
        get maxHp() { return maxHp; },
        get alive() { return alive; },
        get kills() { return kills; },
        get deaths() { return deaths; },
        get invulnerable() { return invulnerable; },
        get invulnTimer() { return invulnTimer; },
        get currentWeapon() { return currentWeapon; },
        get isHolstered() { return holstered; },
        set currentWeapon(v) { currentWeapon = v; },
        set hp(v) { hp = v; },
        set alive(v) { alive = v; },
        get team() { return team; },
        set team(v) { team = v; applyTeamColor(); },
        set onFallDeath(fn) { onFallDeath = fn; },
    };
}

// ---- Character Model for TPS view ----
function createCharacterModel(scene, parentMesh) {
    const root = new BABYLON.TransformNode("characterRoot", scene);
    root.parent = parentMesh;

    const bodyMat = new BABYLON.StandardMaterial("bodyMat", scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.25, 0.3, 0.2);
    bodyMat.specularColor = BABYLON.Color3.Black();

    const skinMat = new BABYLON.StandardMaterial("skinMat", scene);
    skinMat.diffuseColor = new BABYLON.Color3(0.8, 0.65, 0.5);
    skinMat.specularColor = BABYLON.Color3.Black();

    // Torso (box)
    const torso = BABYLON.MeshBuilder.CreateBox("torso",
        { width: 0.5, height: 0.6, depth: 0.25 }, scene);
    torso.position.y = 0.05;
    torso.material = bodyMat;
    torso.parent = root;
    torso.isPickable = false;

    // Head (box - Minecraft style!)
    const head = BABYLON.MeshBuilder.CreateBox("head",
        { width: 0.4, height: 0.4, depth: 0.4 }, scene);
    head.position.y = 0.55;
    head.material = skinMat;
    head.parent = root;
    head.isPickable = false;

    // ---- Arms with pivot nodes at shoulder ----
    const armPivotL = new BABYLON.TransformNode("armPivotL", scene);
    armPivotL.position.set(-0.35, 0.3, 0);
    armPivotL.parent = root;

    const armL = BABYLON.MeshBuilder.CreateBox("armL",
        { width: 0.12, height: 0.55, depth: 0.12 }, scene);
    armL.position.y = -0.275;
    armL.material = bodyMat;
    armL.parent = armPivotL;
    armL.isPickable = false;

    const armPivotR = new BABYLON.TransformNode("armPivotR", scene);
    armPivotR.position.set(0.35, 0.3, 0);
    armPivotR.parent = root;

    const armR = BABYLON.MeshBuilder.CreateBox("armR",
        { width: 0.12, height: 0.55, depth: 0.12 }, scene);
    armR.position.y = -0.275;
    armR.material = bodyMat;
    armR.parent = armPivotR;
    armR.isPickable = false;

    // ---- Legs with pivot nodes at hip ----
    const legPivotL = new BABYLON.TransformNode("legPivotL", scene);
    legPivotL.position.set(-0.13, -0.25, 0);
    legPivotL.parent = root;

    const legL = BABYLON.MeshBuilder.CreateBox("legL",
        { width: 0.14, height: 0.55, depth: 0.14 }, scene);
    legL.position.y = -0.275;
    legL.material = bodyMat;
    legL.parent = legPivotL;
    legL.isPickable = false;

    const legPivotR = new BABYLON.TransformNode("legPivotR", scene);
    legPivotR.position.set(0.13, -0.25, 0);
    legPivotR.parent = root;

    const legR = BABYLON.MeshBuilder.CreateBox("legR",
        { width: 0.14, height: 0.55, depth: 0.14 }, scene);
    legR.position.y = -0.275;
    legR.material = bodyMat;
    legR.parent = legPivotR;
    legR.isPickable = false;

    // Store pivot references for animation
    root._limbPivots = {
        armL: armPivotL,
        armR: armPivotR,
        legL: legPivotL,
        legR: legPivotR,
    };

    // Return root AND mesh references for texture application
    root._headMesh = head;
    root._torsoMesh = torso;
    root._headMat = skinMat;
    root._bodyMat = bodyMat;

    return root;
}

// ---- Weapon Mesh (simple rifle) ----
function createWeaponMesh(scene, parentMesh) {
    const root = new BABYLON.TransformNode("weaponRoot", scene);
    root.parent = parentMesh;

    const gunMat = new BABYLON.StandardMaterial("gunMat", scene);
    gunMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    gunMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    const woodMat = new BABYLON.StandardMaterial("woodMat", scene);
    woodMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);
    woodMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Barrel
    const barrel = BABYLON.MeshBuilder.CreateCylinder("barrel", {
        height: 0.8, diameter: 0.04, tessellation: 8
    }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.3, 0.1, 0.5);
    barrel.material = gunMat;
    barrel.parent = root;
    barrel.isPickable = false;

    // Body
    const body = BABYLON.MeshBuilder.CreateBox("gunBody", {
        width: 0.06, height: 0.08, depth: 0.45
    }, scene);
    body.position.set(0.3, 0.08, 0.3);
    body.material = gunMat;
    body.parent = root;
    body.isPickable = false;

    // Stock
    const stock = BABYLON.MeshBuilder.CreateBox("gunStock", {
        width: 0.05, height: 0.12, depth: 0.2
    }, scene);
    stock.position.set(0.3, 0.06, 0.0);
    stock.material = woodMat;
    stock.parent = root;
    stock.isPickable = false;

    // Magazine
    const mag = BABYLON.MeshBuilder.CreateBox("magazine", {
        width: 0.04, height: 0.12, depth: 0.06
    }, scene);
    mag.position.set(0.3, -0.02, 0.25);
    mag.material = gunMat;
    mag.parent = root;
    mag.isPickable = false;

    return root;
}
