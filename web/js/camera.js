/* ========================================
   Camera Module
   FPS/TPS hybrid camera with smooth toggle
   ======================================== */

const FPS_OFFSET = new BABYLON.Vector3(0, 0, 0);        // At eye height
const TPS_OFFSET = new BABYLON.Vector3(0, 2.0, -4.5);   // Behind and above
const TRANSITION_SPEED = 5.0; // Lerp speed for camera transitions

export function createCameraSystem(scene, canvas, player) {
    // ---- Create Camera ----
    const camera = new BABYLON.FreeCamera("mainCamera", new BABYLON.Vector3(0, 10, 0), scene);
    camera.inputs.clear(); // We handle all input manually
    camera.minZ = 0.1;
    camera.maxZ = 500;
    camera.fov = 0.85; // ~49 degrees, natural FPS FOV

    scene.activeCamera = camera;

    // ---- State ----
    let mode = "FPS";  // "FPS" or "TPS"
    let currentOffset = FPS_OFFSET.clone();
    let targetOffset = FPS_OFFSET.clone();
    let wasVPressed = false;
    let currentFOV = 0.85;
    let targetFOV = 0.85;
    let fovLocked = false; // When true, external code (sniper zoom) controls FOV

    // Smooth camera position (to avoid jitter)
    const smoothedPosition = new BABYLON.Vector3(0, 10, 0);

    // ---- Toggle Handler ----
    function handleToggle() {
        const vNow = player.keys.v;
        if (vNow && !wasVPressed) {
            // Toggle mode
            if (mode === "FPS") {
                mode = "TPS";
                targetOffset.copyFrom(TPS_OFFSET);
                targetFOV = 0.75;
                setPlayerVisibility(true);
            } else {
                mode = "FPS";
                targetOffset.copyFrom(FPS_OFFSET);
                targetFOV = 0.85;
                setPlayerVisibility(false);
            }
        }
        wasVPressed = vNow;
    }

    // ---- Player Visibility ----
    function setPlayerVisibility(visible) {
        const vis = visible ? 1.0 : 0.0;
        // The root physics capsule must strictly remain invisible
        player.mesh.visibility = 0;

        // Character body parts (GLB soldier)
        if (player.characterBody) {
            const children = player.characterBody.getChildMeshes();
            for (const child of children) {
                child.visibility = vis;
                child.isVisible = visible;
            }
        }

        // Weapon visibility — always visible in FPS (as viewmodel), adjusted in TPS
        if (player.weaponMesh) {
            const weaponParts = player.weaponMesh.getChildMeshes();
            for (const part of weaponParts) {
                part.visibility = 1.0;
                part.isVisible = true;
            }
        }
    }

    // Start in FPS mode — hide character
    setPlayerVisibility(false);

    // ---- Update ----
    function update(dt) {
        dt = Math.min(dt, 0.05);
        handleToggle();

        // Smoothly interpolate offset
        const lerpFactor = 1 - Math.pow(0.001, dt * TRANSITION_SPEED);
        currentOffset.x = BABYLON.Scalar.Lerp(currentOffset.x, targetOffset.x, lerpFactor);
        currentOffset.y = BABYLON.Scalar.Lerp(currentOffset.y, targetOffset.y, lerpFactor);
        currentOffset.z = BABYLON.Scalar.Lerp(currentOffset.z, targetOffset.z, lerpFactor);

        // FOV interpolation (sprint effect) — skip when fovLocked (sniper zoom)
        if (!fovLocked) {
            if (mode === "FPS") {
                targetFOV = player.isRunning ? 0.95 : 0.85;
            }
            currentFOV = BABYLON.Scalar.Lerp(currentFOV, targetFOV, lerpFactor);
            camera.fov = currentFOV;
        }

        // ---- Calculate Camera Position ----
        const playerPos = player.position;
        const eyeY = playerPos.y - (1.8 / 2) + player.eyeHeight;

        // Camera base position (at player's eye level)
        const eyePos = new BABYLON.Vector3(playerPos.x, eyeY, playerPos.z);

        // Apply offset rotated by yaw (for TPS, the offset is behind the player)
        const sinY = Math.sin(player.yaw);
        const cosY = Math.cos(player.yaw);

        // Rotate the offset by yaw
        const rotatedX = currentOffset.x * cosY + currentOffset.z * sinY;
        const rotatedZ = -currentOffset.x * sinY + currentOffset.z * cosY;

        const targetPosition = new BABYLON.Vector3(
            eyePos.x + rotatedX,
            eyePos.y + currentOffset.y,
            eyePos.z + rotatedZ
        );

        // Smooth camera follow
        const followLerp = mode === "TPS" ? 0.12 : 1.0;
        smoothedPosition.x = BABYLON.Scalar.Lerp(smoothedPosition.x, targetPosition.x, 1 - Math.pow(1 - followLerp, dt * 60));
        smoothedPosition.y = BABYLON.Scalar.Lerp(smoothedPosition.y, targetPosition.y, 1 - Math.pow(1 - followLerp, dt * 60));
        smoothedPosition.z = BABYLON.Scalar.Lerp(smoothedPosition.z, targetPosition.z, 1 - Math.pow(1 - followLerp, dt * 60));

        camera.position.copyFrom(mode === "FPS" ? targetPosition : smoothedPosition);

        // ---- Camera Rotation ----
        camera.rotation.x = player.pitch;
        camera.rotation.y = player.yaw;
        camera.rotation.z = 0;
    }

    /**
     * Get a forward ray from the camera center (for shooting)
     */
    function getForwardRay(length) {
        length = length || 200;
        return camera.getForwardRay(length);
    }

    return {
        camera,
        update,
        getForwardRay,
        get activeCamera() { return camera; },
        get mode() { return mode; },
        get fovLocked() { return fovLocked; },
        set fovLocked(v) { fovLocked = v; },
    };
}
