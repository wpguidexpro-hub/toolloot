/* ========================================
   Weapons Module
   Multi-weapon system with knife default,
   timed pickups, sniper zoom, shotgun spread
   ======================================== */

// ---- Weapon Definitions ----
export const WEAPON_DEFS = {
    knife: {
        name: "Knife",
        icon: "🔪",
        type: "melee",
        damage: 35,
        fireRate: 0.5,
        range: 3,
        ammo: Infinity,
        maxAmmo: Infinity,
        reloadTime: 0,
        isAutomatic: false,
        duration: Infinity, // permanent
        spreadAngle: 0,
        pellets: 1,
    },
    mw11: {
        name: "MW11 Pistol",
        icon: "🔫",
        type: "hitscan",
        damage: 20,
        fireRate: 0.25,
        range: 100,
        ammo: 12,
        maxAmmo: 12,
        reloadTime: 1.5,
        isAutomatic: false,
        duration: 60,
        spreadAngle: 0.01,
        pellets: 1,
    },
    m16: {
        name: "M16 Rifle",
        icon: "🎯",
        type: "hitscan",
        damage: 25,
        fireRate: 0.12,
        range: 150,
        ammo: 30,
        maxAmmo: 30,
        reloadTime: 2.0,
        isAutomatic: true,
        duration: 60,
        spreadAngle: 0.015,
        pellets: 1,
    },
    by15: {
        name: "BY15 Shotgun",
        icon: "💥",
        type: "hitscan",
        damage: 5,
        fireRate: 0.8,
        range: 30,
        ammo: 6,
        maxAmmo: 6,
        reloadTime: 2.5,
        isAutomatic: false,
        duration: 60,
        spreadAngle: 0.12,
        pellets: 8,
    },
    rytec: {
        name: "Rytec AMR",
        icon: "🎯",
        type: "hitscan",
        damage: 90,
        fireRate: 1.2,
        range: 300,
        ammo: 5,
        maxAmmo: 5,
        reloadTime: 3.0,
        isAutomatic: false,
        duration: 120,
        spreadAngle: 0.002,
        pellets: 1,
    },
};

export const RANDOM_WEAPONS = ["mw11", "m16", "by15", "rytec"];

export function createWeaponSystem(scene, player, cameraSystem, audioSystem, network, remotePlayers) {
    // ---- State ----
    let currentWeaponKey = "knife";
    let currentAmmo = Infinity;
    let isReloading = false;
    let reloadTimer = 0;
    let fireCooldown = 0;
    let isFiring = false;

    // Weapon timer (for timed weapons)
    let weaponTimer = 0; // seconds remaining
    let weaponTimerActive = false;

    // Sniper zoom state — 3 discrete levels
    const ZOOM_LEVELS = [1, 2, 4, 8]; // 1× normal, 2× medium, 4× high, 8× max
    let zoomIndex = 0; // index into ZOOM_LEVELS
    let zoomLevel = 1;
    let defaultFOV = null; // stored when zoom first used

    // Knife swing animation state
    let knifeSwingTimer = 0;

    // Viewmodel Recoil Animation State (spring physics)
    let recoilZ = 0;
    let recoilRotX = 0;
    const RECOIL_RECOVERY = 16.0;

    // ---- Muzzle Flash Particle System ----
    const muzzleFlash = createMuzzleFlash(scene);

    // ---- Impact Particle System ----
    const impactSpark = createImpactParticles(scene);

    // ---- DOM elements for visual feedback ----
    const flashOverlay = document.getElementById("muzzle-flash");
    const hitMarker = document.getElementById("hit-marker");
    const scopeOverlay = document.getElementById("scope-overlay");

    // FPS weapon mesh references
    let fpsWeaponRoot = null;
    let fpsWeaponMeshes = {};
    createFPSWeaponMeshes();

    // ---- Create FPS weapon meshes ----
    function createFPSWeaponMeshes() {
        fpsWeaponRoot = new BABYLON.TransformNode("fpsWeaponRoot", scene);

        // Knife mesh
        const knifeMat = new BABYLON.StandardMaterial("knifeMat", scene);
        knifeMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.75);
        knifeMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);

        const knifeHandleMat = new BABYLON.StandardMaterial("knifeHandleMat", scene);
        knifeHandleMat.diffuseColor = new BABYLON.Color3(0.2, 0.15, 0.1);

        const blade = BABYLON.MeshBuilder.CreateBox("fpsBlade", { width: 0.02, height: 0.22, depth: 0.04 }, scene);
        blade.material = knifeMat;
        blade.isPickable = false;

        const handle = BABYLON.MeshBuilder.CreateBox("fpsHandle", { width: 0.025, height: 0.1, depth: 0.04 }, scene);
        handle.position.y = -0.16;
        handle.material = knifeHandleMat;
        handle.isPickable = false;

        const knifeGroup = new BABYLON.TransformNode("fpsKnife", scene);
        blade.parent = knifeGroup;
        handle.parent = knifeGroup;
        knifeGroup.parent = fpsWeaponRoot;
        knifeGroup.setEnabled(false);
        fpsWeaponMeshes.knife = knifeGroup;

        // Gun materials
        const gunMat = new BABYLON.StandardMaterial("fpsGunMat", scene);
        gunMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        gunMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

        const woodMat = new BABYLON.StandardMaterial("fpsWoodMat", scene);
        woodMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);

        // MW11 Pistol
        const mw11Group = new BABYLON.TransformNode("fpsMW11", scene);
        const mw11Barrel = BABYLON.MeshBuilder.CreateCylinder("mw11Barrel", { height: 0.2, diameter: 0.025, tessellation: 8 }, scene);
        mw11Barrel.rotation.x = Math.PI / 2;
        mw11Barrel.position.set(0, 0.01, 0.12);
        mw11Barrel.material = gunMat;
        mw11Barrel.parent = mw11Group;
        mw11Barrel.isPickable = false;
        const mw11Body = BABYLON.MeshBuilder.CreateBox("mw11Body", { width: 0.035, height: 0.06, depth: 0.15 }, scene);
        mw11Body.position.set(0, 0, 0.04);
        mw11Body.material = gunMat;
        mw11Body.parent = mw11Group;
        mw11Body.isPickable = false;
        const mw11Grip = BABYLON.MeshBuilder.CreateBox("mw11Grip", { width: 0.03, height: 0.08, depth: 0.03 }, scene);
        mw11Grip.position.set(0, -0.06, -0.02);
        mw11Grip.rotation.x = 0.3;
        mw11Grip.material = woodMat;
        mw11Grip.parent = mw11Group;
        mw11Grip.isPickable = false;
        mw11Group.parent = fpsWeaponRoot;
        mw11Group.setEnabled(false);
        fpsWeaponMeshes.mw11 = mw11Group;

        // M16 Rifle
        const m16Group = new BABYLON.TransformNode("fpsM16", scene);
        const m16Barrel = BABYLON.MeshBuilder.CreateCylinder("m16Barrel", { height: 0.45, diameter: 0.022, tessellation: 8 }, scene);
        m16Barrel.rotation.x = Math.PI / 2;
        m16Barrel.position.set(0, 0.02, 0.28);
        m16Barrel.material = gunMat;
        m16Barrel.parent = m16Group;
        m16Barrel.isPickable = false;
        const m16Body = BABYLON.MeshBuilder.CreateBox("m16Body", { width: 0.045, height: 0.065, depth: 0.3 }, scene);
        m16Body.position.set(0, 0, 0.05);
        m16Body.material = gunMat;
        m16Body.parent = m16Group;
        m16Body.isPickable = false;
        const m16Stock = BABYLON.MeshBuilder.CreateBox("m16Stock", { width: 0.04, height: 0.06, depth: 0.15 }, scene);
        m16Stock.position.set(0, -0.01, -0.16);
        m16Stock.material = woodMat;
        m16Stock.parent = m16Group;
        m16Stock.isPickable = false;
        const m16Mag = BABYLON.MeshBuilder.CreateBox("m16Mag", { width: 0.02, height: 0.1, depth: 0.04 }, scene);
        m16Mag.position.set(0, -0.07, 0.02);
        m16Mag.material = gunMat;
        m16Mag.parent = m16Group;
        m16Mag.isPickable = false;
        m16Group.parent = fpsWeaponRoot;
        m16Group.setEnabled(false);
        fpsWeaponMeshes.m16 = m16Group;

        // BY15 Shotgun
        const by15Group = new BABYLON.TransformNode("fpsBY15", scene);
        const by15Barrel = BABYLON.MeshBuilder.CreateCylinder("by15Barrel", { height: 0.5, diameter: 0.035, tessellation: 8 }, scene);
        by15Barrel.rotation.x = Math.PI / 2;
        by15Barrel.position.set(0, 0.02, 0.3);
        by15Barrel.material = gunMat;
        by15Barrel.parent = by15Group;
        by15Barrel.isPickable = false;
        const by15Body = BABYLON.MeshBuilder.CreateBox("by15Body", { width: 0.05, height: 0.06, depth: 0.25 }, scene);
        by15Body.position.set(0, 0, 0.02);
        by15Body.material = gunMat;
        by15Body.parent = by15Group;
        by15Body.isPickable = false;
        const by15Pump = BABYLON.MeshBuilder.CreateBox("by15Pump", { width: 0.04, height: 0.04, depth: 0.1 }, scene);
        by15Pump.position.set(0, -0.04, 0.15);
        by15Pump.material = woodMat;
        by15Pump.parent = by15Group;
        by15Pump.isPickable = false;
        const by15Stock = BABYLON.MeshBuilder.CreateBox("by15Stock", { width: 0.04, height: 0.06, depth: 0.18 }, scene);
        by15Stock.position.set(0, -0.01, -0.18);
        by15Stock.material = woodMat;
        by15Stock.parent = by15Group;
        by15Stock.isPickable = false;
        by15Group.parent = fpsWeaponRoot;
        by15Group.setEnabled(false);
        fpsWeaponMeshes.by15 = by15Group;

        // Rytec AMR Sniper
        const rytecGroup = new BABYLON.TransformNode("fpsRytec", scene);
        const rytecBarrel = BABYLON.MeshBuilder.CreateCylinder("rytecBarrel", { height: 0.65, diameter: 0.03, tessellation: 8 }, scene);
        rytecBarrel.rotation.x = Math.PI / 2;
        rytecBarrel.position.set(0, 0.02, 0.38);
        rytecBarrel.material = gunMat;
        rytecBarrel.parent = rytecGroup;
        rytecBarrel.isPickable = false;
        const rytecBody = BABYLON.MeshBuilder.CreateBox("rytecBody", { width: 0.055, height: 0.07, depth: 0.35 }, scene);
        rytecBody.position.set(0, 0, 0.05);
        rytecBody.material = gunMat;
        rytecBody.parent = rytecGroup;
        rytecBody.isPickable = false;
        const rytecScope = BABYLON.MeshBuilder.CreateCylinder("rytecScope", { height: 0.15, diameter: 0.03, tessellation: 8 }, scene);
        rytecScope.rotation.x = Math.PI / 2;
        rytecScope.position.set(0, 0.06, 0.08);
        rytecScope.material = gunMat;
        rytecScope.parent = rytecGroup;
        rytecScope.isPickable = false;
        const rytecStock = BABYLON.MeshBuilder.CreateBox("rytecStock", { width: 0.05, height: 0.07, depth: 0.2 }, scene);
        rytecStock.position.set(0, -0.01, -0.2);
        rytecStock.material = woodMat;
        rytecStock.parent = rytecGroup;
        rytecStock.isPickable = false;
        const rytecMag = BABYLON.MeshBuilder.CreateBox("rytecMag", { width: 0.025, height: 0.08, depth: 0.05 }, scene);
        rytecMag.position.set(0, -0.065, 0.0);
        rytecMag.material = gunMat;
        rytecMag.parent = rytecGroup;
        rytecMag.isPickable = false;
        rytecGroup.parent = fpsWeaponRoot;
        rytecGroup.setEnabled(false);
        fpsWeaponMeshes.rytec = rytecGroup;
    }

    // ---- Show/hide FPS weapon meshes ----
    function showCurrentFPSWeapon() {
        for (const key in fpsWeaponMeshes) {
            fpsWeaponMeshes[key].setEnabled(key === currentWeaponKey);
        }
    }

    // ---- Pre-allocated Vector Scratchpads (eliminates thousands of GC allocations per minute) ----
    const _vPos = new BABYLON.Vector3();
    const _vFwd = new BABYLON.Vector3();
    const _vRight = new BABYLON.Vector3();
    const _vUp = new BABYLON.Vector3();
    const _vUpConst = BABYLON.Vector3.Up();

    // ---- Position FPS weapons relative to camera ----
    function updateFPSWeaponPosition() {
        if (!fpsWeaponRoot || !cameraSystem) return;

        const cam = cameraSystem.activeCamera;
        if (!cam || cameraSystem.mode !== "FPS") {
            fpsWeaponRoot.setEnabled(false);
            return;
        }
        fpsWeaponRoot.setEnabled(true);

        // Position weapon at bottom-right of view with recoil offset
        _vPos.copyFrom(cam.position);
        cam.getDirectionToRef(BABYLON.Vector3.Forward(), _vFwd);
        BABYLON.Vector3.CrossToRef(_vFwd, _vUpConst, _vRight);
        _vRight.normalize();
        BABYLON.Vector3.CrossToRef(_vRight, _vFwd, _vUp);
        _vUp.normalize();

        if (currentWeaponKey === "knife") {
            // Knife: center-right, angled
            _vPos.addInPlace(_vFwd.scale(0.4 + recoilZ));
            _vPos.addInPlace(_vRight.scale(0.25));
            _vPos.addInPlace(_vUp.scale(-0.2));

            // Swing animation
            if (knifeSwingTimer > 0) {
                const swingProgress = 1 - knifeSwingTimer / 0.3;
                const swingAngle = Math.sin(swingProgress * Math.PI) * 1.2;
                fpsWeaponMeshes.knife.rotation.z = swingAngle;
                fpsWeaponMeshes.knife.rotation.x = Math.sin(swingProgress * Math.PI) * 0.4;
            } else {
                fpsWeaponMeshes.knife.rotation.set(0.3, 0, 0.1);
            }
        } else {
            // Guns: bottom-right with kickback along forward axis and slight lift
            _vPos.addInPlace(_vFwd.scale(0.5 + recoilZ));
            _vPos.addInPlace(_vRight.scale(0.2));
            _vPos.addInPlace(_vUp.scale(-0.18 + Math.abs(recoilZ) * 0.3));
        }

        fpsWeaponRoot.position.copyFrom(_vPos);

        // Match camera rotation + recoil pitch lift
        const camRotation = cam.rotation || BABYLON.Vector3.ZeroReadOnly;
        fpsWeaponRoot.rotation.y = camRotation.y || player.yaw;
        fpsWeaponRoot.rotation.x = (camRotation.x || -player.pitch) - recoilRotX;

        // ---- Holster Animation ----
        if (player.isHolstered) {
            // Drop it down and rotate it down relative to camera
            fpsWeaponRoot.position.addInPlace(_vUp.scale(-0.5));
            fpsWeaponRoot.rotation.x += 1.0;
        }

        // Smoothly interpolate the actual render node to the target transform
        if (!fpsWeaponRoot._renderNode) {
            fpsWeaponRoot._renderNode = new BABYLON.TransformNode("weaponRenderNode", scene);
            for (const key in fpsWeaponMeshes) {
                fpsWeaponMeshes[key].parent = fpsWeaponRoot._renderNode;
            }
        }
        
        fpsWeaponRoot._renderNode.position = BABYLON.Vector3.Lerp(
            fpsWeaponRoot._renderNode.position || BABYLON.Vector3.Zero(), 
            fpsWeaponRoot.position, 
            0.35
        );
        
        if (!fpsWeaponRoot._renderNode.rotationQuaternion) {
            fpsWeaponRoot._renderNode.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(0,0,0);
        }
        if (!fpsWeaponRoot.rotationQuaternion) {
            fpsWeaponRoot.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(0,0,0);
        }
        BABYLON.Quaternion.RotationYawPitchRollToRef(
            fpsWeaponRoot.rotation.y, fpsWeaponRoot.rotation.x, fpsWeaponRoot.rotation.z, 
            fpsWeaponRoot.rotationQuaternion
        );
        
        fpsWeaponRoot._renderNode.rotationQuaternion = BABYLON.Quaternion.Slerp(
            fpsWeaponRoot._renderNode.rotationQuaternion,
            fpsWeaponRoot.rotationQuaternion,
            0.35
        );
    }

    // ---- Switch weapon ----
    function switchWeapon(weaponKey, resetAmmo = true) {
        const def = WEAPON_DEFS[weaponKey];
        if (!def) return;

        const prevKey = currentWeaponKey;
        currentWeaponKey = weaponKey;

        if (resetAmmo) {
            currentAmmo = def.ammo;
        }

        isReloading = false;
        reloadTimer = 0;
        fireCooldown = 0;

        // Play weapon switch mechanical sound
        if (audioSystem && audioSystem.playWeaponSwitch) {
            audioSystem.playWeaponSwitch();
        }

        // Handle weapon timer
        if (def.duration < Infinity) {
            weaponTimer = def.duration;
            weaponTimerActive = true;
        } else {
            weaponTimer = 0;
            weaponTimerActive = false;
        }

        // Reset zoom when switching away from sniper
        if (prevKey === "rytec" && weaponKey !== "rytec") {
            resetZoom();
        }

        showCurrentFPSWeapon();

        // Notify network
        if (network && network.connected) {
            network.send({ type: "weaponChanged", weapon: weaponKey });
        }
    }

    // ---- Sniper Zoom (3 discrete levels) ----
    function handleZoom(delta) {
        if (currentWeaponKey !== "rytec") return;
        if (!cameraSystem || !cameraSystem.activeCamera) return;

        const cam = cameraSystem.activeCamera;
        if (defaultFOV === null) defaultFOV = cam.fov;

        // Scroll down = zoom in (next level), scroll up = zoom out (prev level)
        if (delta < 0) {
            zoomIndex = Math.min(zoomIndex + 1, ZOOM_LEVELS.length - 1);
        } else {
            zoomIndex = Math.max(zoomIndex - 1, 0);
        }

        zoomLevel = ZOOM_LEVELS[zoomIndex];
        cam.fov = defaultFOV / zoomLevel;

        // Show scope overlay at 2× and above
        if (scopeOverlay) {
            if (zoomLevel >= 2) {
                scopeOverlay.classList.add("show");
            } else {
                scopeOverlay.classList.remove("show");
            }
        }

        // Lock camera FOV so sprint interpolation doesn't override zoom
        cameraSystem.fovLocked = (zoomLevel > 1);
    }

    function resetZoom() {
        zoomIndex = 0;
        zoomLevel = 1;
        if (cameraSystem && cameraSystem.activeCamera && defaultFOV !== null) {
            cameraSystem.activeCamera.fov = defaultFOV;
        }
        if (scopeOverlay) scopeOverlay.classList.remove("show");
        if (cameraSystem) cameraSystem.fovLocked = false;
    }

    // ---- Update ----
    // ---- Frame-based timers (avoid setTimeout GC pressure) ----
    let firingResetTimer = 0;   // replaces setTimeout(() => isFiring = false, 50)
    let autoReloadTimer = 0;    // replaces setTimeout for auto-reload
    let flashResetTimer = 0;    // replaces setTimeout for muzzle flash

    function update(dt) {
        dt = Math.min(dt, 0.05);

        // Don't act when dead
        if (!player.alive) return;

        // ---- Frame-based firing reset ----
        if (firingResetTimer > 0) {
            firingResetTimer -= dt;
            if (firingResetTimer <= 0) {
                isFiring = false;
            }
        }

        // ---- Frame-based auto-reload ----
        if (autoReloadTimer > 0) {
            autoReloadTimer -= dt;
            if (autoReloadTimer <= 0 && currentAmmo <= 0 && !isReloading) {
                startReload();
            }
        }

        // ---- Frame-based flash reset ----
        if (flashResetTimer > 0) {
            flashResetTimer -= dt;
            if (flashResetTimer <= 0 && flashOverlay) {
                flashOverlay.classList.remove("flash");
            }
        }

        // Weapon timer countdown
        if (weaponTimerActive && weaponTimer > 0) {
            weaponTimer -= dt;
            if (weaponTimer <= 0) {
                // Revert to knife
                switchWeapon("knife");
            }
        }

        // Fire cooldown
        if (fireCooldown > 0) {
            fireCooldown -= dt;
        }

        // Knife swing timer
        if (knifeSwingTimer > 0) {
            knifeSwingTimer -= dt;
        }

        // Reload timer
        if (isReloading) {
            reloadTimer -= dt;
            if (reloadTimer <= 0) {
                currentAmmo = WEAPON_DEFS[currentWeaponKey].maxAmmo;
                isReloading = false;
            }
        }

        // Reload on R key
        const def = WEAPON_DEFS[currentWeaponKey];
        if (player.keys.r && !isReloading && currentAmmo < def.maxAmmo && def.type !== "melee") {
            startReload();
        }

        // Fire on left mouse button
        if (player.mouseButtons.left && !isReloading && fireCooldown <= 0) {
            fire();
        }

        // Smooth spring recoil recovery
        recoilZ = BABYLON.Scalar.Lerp(recoilZ, 0, dt * RECOIL_RECOVERY);
        recoilRotX = BABYLON.Scalar.Lerp(recoilRotX, 0, dt * RECOIL_RECOVERY);

        // Update FPS weapon position
        updateFPSWeaponPosition();
    }

    function fire() {
        const def = WEAPON_DEFS[currentWeaponKey];

        // Attacking immediately cancels spawn invulnerability
        if (player.cancelInvulnerability) {
            player.cancelInvulnerability();
        }

        if (def.type !== "melee" && currentAmmo <= 0) {
            if (audioSystem) audioSystem.playEmptyClick();
            fireCooldown = 0.3;
            return;
        }

        if (def.type !== "melee") {
            currentAmmo--;
        }
        fireCooldown = def.fireRate;
        isFiring = true;

        // Apply procedural viewmodel recoil kick
        if (currentWeaponKey === "mw11") {
            recoilZ = -0.06;
            recoilRotX = 0.08;
        } else if (currentWeaponKey === "m16") {
            recoilZ = -0.05;
            recoilRotX = 0.06;
        } else if (currentWeaponKey === "by15") {
            recoilZ = -0.12;
            recoilRotX = 0.15;
        } else if (currentWeaponKey === "rytec") {
            recoilZ = -0.20;
            recoilRotX = 0.25;
        }

        // Sound
        if (audioSystem) audioSystem.playWeaponShot(currentWeaponKey);

        // Broadcast shot to remote players for 3D positional audio & remote muzzle flashes
        if (network && network.connected) {
            network.sendFire(currentWeaponKey);
        }

        // Visual effects
        if (currentWeaponKey === "knife") {
            // Knife swing animation
            knifeSwingTimer = 0.3;
        } else {
            // Muzzle flash for guns (timer-based, no setTimeout)
            if (flashOverlay) {
                flashOverlay.classList.add("flash");
                flashResetTimer = 0.06; // 60ms
            }
            triggerMuzzleFlash();
        }

        // Hit detection
        if (def.type === "melee") {
            fireMelee(def);
        } else if (def.pellets > 1) {
            fireShotgun(def);
        } else {
            fireHitscan(def);
        }

        // Auto-reload when empty (guns only) — timer-based, no setTimeout
        if (def.type !== "melee" && currentAmmo <= 0) {
            autoReloadTimer = 0.5; // 500ms
        }

        // Reset firing flag — timer-based, no setTimeout
        firingResetTimer = 0.05; // 50ms
    }

    // ---- Melee attack (knife) ----
    function fireMelee(def) {
        const ray = cameraSystem.getForwardRay(def.range);
        const pickResult = scene.pickWithRay(ray, (mesh) => {
            return mesh.isPickable && mesh !== player.mesh;
        });

        if (pickResult && pickResult.hit) {
            let hitPlayerId = null;
            if (remotePlayers) {
                hitPlayerId = remotePlayers.getPlayerIdFromMesh(pickResult.pickedMesh);
            }

            if (hitPlayerId !== null && network) {
                network.sendHit(hitPlayerId, currentWeaponKey, 1);
                showHitMarker(true);
                if (audioSystem) audioSystem.playKnifeHit();
            } else {
                showHitMarker(false);
            }
        }
    }

    // ---- Hitscan attack (single bullet) ----
    function fireHitscan(def) {
        // Apply slight spread
        const ray = cameraSystem.getForwardRay(def.range);
        if (def.spreadAngle > 0) {
            applySpread(ray, def.spreadAngle);
        }

        const pickResult = scene.pickWithRay(ray, (mesh) => {
            return mesh.isPickable && mesh !== player.mesh;
        });

        if (pickResult && pickResult.hit && pickResult.pickedPoint) {
            let hitPlayerId = null;
            if (remotePlayers) {
                hitPlayerId = remotePlayers.getPlayerIdFromMesh(pickResult.pickedMesh);
            }

            if (hitPlayerId !== null && network) {
                network.sendHit(hitPlayerId, currentWeaponKey, 1);
                showHitMarker(true);
            } else {
                showHitMarker(false);
            }

            triggerImpact(pickResult.pickedPoint, pickResult.getNormal(true));
        }
    }

    // ---- Shotgun attack (optimized: 8 pellets, accurate multi-pellet damage) ----
    const _shotgunPickPredicate = (mesh) => mesh.isPickable && mesh !== player.mesh;

    function fireShotgun(def) {
        const playerHitCounts = new Map(); // hitPlayerId -> pelletsCount
        const pelletCount = Math.min(def.pellets, 8);

        for (let i = 0; i < pelletCount; i++) {
            const ray = cameraSystem.getForwardRay(def.range);
            applySpread(ray, def.spreadAngle);

            const pickResult = scene.pickWithRay(ray, _shotgunPickPredicate);

            if (pickResult && pickResult.hit && pickResult.pickedPoint) {
                let hitPlayerId = null;
                if (remotePlayers) {
                    hitPlayerId = remotePlayers.getPlayerIdFromMesh(pickResult.pickedMesh);
                }

                if (hitPlayerId !== null) {
                    playerHitCounts.set(hitPlayerId, (playerHitCounts.get(hitPlayerId) || 0) + 1);
                }

                triggerImpact(pickResult.pickedPoint, pickResult.getNormal(true));
            }
        }

        // Send hits with pellet count so server scales damage proportionally
        if (network) {
            for (const [pid, count] of playerHitCounts) {
                network.sendHit(pid, currentWeaponKey, count);
            }
        }

        if (playerHitCounts.size > 0) {
            showHitMarker(true);
        }
    }

    // ---- Apply spread to a ray ----
    function applySpread(ray, angle) {
        const randAngle1 = (Math.random() - 0.5) * angle * 2;
        const randAngle2 = (Math.random() - 0.5) * angle * 2;

        const right = BABYLON.Vector3.Cross(ray.direction, BABYLON.Vector3.Up()).normalize();
        const up = BABYLON.Vector3.Cross(right, ray.direction).normalize();

        ray.direction.addInPlace(right.scale(Math.sin(randAngle1)));
        ray.direction.addInPlace(up.scale(Math.sin(randAngle2)));
        ray.direction.normalize();
    }

    function startReload() {
        if (isReloading) return;
        const def = WEAPON_DEFS[currentWeaponKey];
        if (def.type === "melee") return;
        isReloading = true;
        reloadTimer = def.reloadTime;
        if (audioSystem) audioSystem.playReload();
    }

    // ---- Refill ammo ----
    function refillAmmo() {
        const def = WEAPON_DEFS[currentWeaponKey];
        if (def.type === "melee") return;
        currentAmmo = def.maxAmmo;
        isReloading = false;
    }

    // ---- Reusable Vector Scratchpads for FX ----
    const _muzzlePos = new BABYLON.Vector3();
    const _impactPos = new BABYLON.Vector3();
    const _impactDir1 = new BABYLON.Vector3();
    const _impactDir2 = new BABYLON.Vector3();

    // ---- Muzzle Flash (Timer-free, zero-allocation burst) ----
    function triggerMuzzleFlash() {
        if (!muzzleFlash) return;

        const sinY = Math.sin(player.yaw);
        const cosY = Math.cos(player.yaw);
        _muzzlePos.set(
            player.position.x + sinY * 1.2 + cosY * 0.3,
            player.position.y + player.eyeHeight - 0.8,
            player.position.z + cosY * 1.2 - sinY * 0.3
        );

        muzzleFlash.emitter = _muzzlePos;
        muzzleFlash.manualEmitCount = 8;
        muzzleFlash.start();
    }

    // ---- Impact Effect (Timer-free, zero-allocation burst) ----
    function triggerImpact(point, normal) {
        if (!impactSpark) return;
        _impactPos.copyFrom(point);
        impactSpark.emitter = _impactPos;
        if (normal) {
            _impactDir1.set(normal.x * 2 - 1, normal.y * 2, normal.z * 2 - 1);
            _impactDir2.set(normal.x * 4 + 1, normal.y * 4 + 2, normal.z * 4 + 1);
            impactSpark.direction1 = _impactDir1;
            impactSpark.direction2 = _impactDir2;
        }
        impactSpark.manualEmitCount = 10;
        impactSpark.start();
    }

    // ---- Hit Marker ----
    function showHitMarker(isPlayerHit) {
        if (!hitMarker) return;
        hitMarker.classList.add("show");
        if (isPlayerHit) hitMarker.classList.add("player-hit");
        setTimeout(() => {
            hitMarker.classList.remove("show");
            hitMarker.classList.remove("player-hit");
        }, 150);
    }

    // Initialize with knife
    showCurrentFPSWeapon();

    // ---- Public Interface ----
    return {
        update,
        switchWeapon,
        handleZoom,
        resetZoom,
        refillAmmo,
        get currentWeaponKey() { return currentWeaponKey; },
        get currentWeaponDef() { return WEAPON_DEFS[currentWeaponKey]; },
        get currentAmmo() { return currentAmmo; },
        get maxAmmo() { return WEAPON_DEFS[currentWeaponKey].maxAmmo; },
        get isReloading() { return isReloading; },
        get isFiring() { return isFiring; },
        get weaponTimer() { return weaponTimer; },
        get weaponTimerActive() { return weaponTimerActive; },
        get zoomLevel() { return zoomLevel; },
        get reloadProgress() {
            if (!isReloading) return 1;
            return 1 - (reloadTimer / WEAPON_DEFS[currentWeaponKey].reloadTime);
        },
    };
}

// ---- Create muzzle flash particle system ----
function createMuzzleFlash(scene) {
    const ps = new BABYLON.ParticleSystem("muzzleFlash", 20, scene);
    ps.createPointEmitter(
        new BABYLON.Vector3(-0.1, -0.1, -0.1),
        new BABYLON.Vector3(0.1, 0.1, 0.1)
    );
    ps.particleTexture = createParticleTexture(scene, "#ffaa33", "#ff6600");
    ps.color1 = new BABYLON.Color4(1, 0.8, 0.3, 1);
    ps.color2 = new BABYLON.Color4(1, 0.5, 0.1, 1);
    ps.colorDead = new BABYLON.Color4(0.3, 0.1, 0, 0);
    ps.emitRate = 200;
    ps.minLifeTime = 0.02;
    ps.maxLifeTime = 0.06;
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.minEmitPower = 2;
    ps.maxEmitPower = 5;
    ps.updateSpeed = 0.01;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.manualEmitCount = 0;
    ps.targetStopDuration = 0.05;
    return ps;
}

// ---- Create impact particle system ----
function createImpactParticles(scene) {
    const ps = new BABYLON.ParticleSystem("impact", 30, scene);
    ps.createPointEmitter(
        new BABYLON.Vector3(-1, 0, -1),
        new BABYLON.Vector3(1, 2, 1)
    );
    ps.particleTexture = createParticleTexture(scene, "#aa8855", "#665533");
    ps.color1 = new BABYLON.Color4(0.7, 0.55, 0.3, 1);
    ps.color2 = new BABYLON.Color4(0.5, 0.4, 0.25, 1);
    ps.colorDead = new BABYLON.Color4(0.3, 0.25, 0.15, 0);
    ps.emitRate = 300;
    ps.minLifeTime = 0.1;
    ps.maxLifeTime = 0.3;
    ps.minSize = 0.02;
    ps.maxSize = 0.08;
    ps.minEmitPower = 1;
    ps.maxEmitPower = 4;
    ps.gravity = new BABYLON.Vector3(0, -8, 0);
    ps.updateSpeed = 0.01;
    ps.targetStopDuration = 0.1;
    return ps;
}

// ---- Generate a simple procedural particle texture ----
function createParticleTexture(scene, colorCenter, colorEdge) {
    const size = 32;
    const dt = new BABYLON.DynamicTexture("particleTex_" + Math.random(), size, scene, false);
    const ctx = dt.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, colorCenter);
    gradient.addColorStop(0.4, colorCenter);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    dt.update(false);
    dt.hasAlpha = true;
    return dt;
}
