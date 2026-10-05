/* ========================================
   Touch Controls Module
   Call of Duty Mobile-style mobile controls
   Floating joystick + drag-to-aim + action buttons
   ======================================== */

export function createTouchControls(player) {
    // Detect a REAL touch-primary device using the media-query gold standard.
    // Returns FALSE on Windows desktops (even with touchscreen) and TRUE on phones/tablets.
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    if (!isTouchDevice) {
        return { update: () => {}, isMobile: false };
    }

    const container = document.getElementById("mobile-controls");
    if (container) container.classList.add("show");

    // ---- State ----
    let moveX = 0; // -1..1 (joystick X)
    let moveY = 0; // -1..1 (joystick Y, positive = forward)
    let lookDX = 0; // accumulated look delta X (radians)
    let lookDY = 0; // accumulated look delta Y (radians)

    // ---- Joystick geometry (matches CSS) ----
    const JOYSTICK_RADIUS = 52;      // max thumb travel in px
    const JOYSTICK_BASE_SIZE = 124;  // visual base diameter
    const JOYSTICK_THUMB_SIZE = 56;  // visual thumb diameter
    const BASE_OFFSET = JOYSTICK_BASE_SIZE / 2;
    const THUMB_OFFSET = JOYSTICK_THUMB_SIZE / 2;

    // ---- Left Joystick (movement) ----
    const joystickArea = document.getElementById("joystick-area");
    const joystickBase = document.getElementById("joystick-base");
    const joystickThumb = document.getElementById("joystick-thumb");
    let joystickActive = false;
    let joystickTouchId = null;
    let joystickCenterX = 0;
    let joystickCenterY = 0;

    if (joystickArea) {
        joystickArea.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystickActive = true;
            joystickTouchId = touch.identifier;

            // Position the (floating) joystick base at the touch point
            const rect = joystickArea.getBoundingClientRect();
            joystickCenterX = touch.clientX - rect.left;
            joystickCenterY = touch.clientY - rect.top;

            if (joystickBase) {
                joystickBase.style.display = "block";
                joystickBase.style.left = (joystickCenterX - BASE_OFFSET) + "px";
                joystickBase.style.top = (joystickCenterY - BASE_OFFSET) + "px";
            }
            if (joystickThumb) {
                joystickThumb.style.left = (joystickCenterX - THUMB_OFFSET) + "px";
                joystickThumb.style.top = (joystickCenterY - THUMB_OFFSET) + "px";
            }
        }, { passive: false });

        joystickArea.addEventListener("touchmove", (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier !== joystickTouchId) continue;
                const rect = joystickArea.getBoundingClientRect();
                let dx = (touch.clientX - rect.left) - joystickCenterX;
                let dy = (touch.clientY - rect.top) - joystickCenterY;

                // Clamp to radius
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > JOYSTICK_RADIUS) {
                    dx = (dx / dist) * JOYSTICK_RADIUS;
                    dy = (dy / dist) * JOYSTICK_RADIUS;
                }

                moveX = dx / JOYSTICK_RADIUS;
                moveY = -dy / JOYSTICK_RADIUS; // invert Y (up = forward)

                if (joystickThumb) {
                    joystickThumb.style.left = (joystickCenterX + dx - THUMB_OFFSET) + "px";
                    joystickThumb.style.top = (joystickCenterY + dy - THUMB_OFFSET) + "px";
                }
            }
        }, { passive: false });

        const endJoystick = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier !== joystickTouchId) continue;
                joystickActive = false;
                joystickTouchId = null;
                moveX = 0;
                moveY = 0;
                if (joystickBase) {
                    joystickBase.style.display = "none";
                    joystickBase.classList.remove("sprinting");
                }
                if (joystickThumb) { joystickThumb.style.left = ""; joystickThumb.style.top = ""; }
            }
        };
        joystickArea.addEventListener("touchend", endJoystick, { passive: false });
        joystickArea.addEventListener("touchcancel", endJoystick, { passive: false });
    }

    // ---- Right Look Area (drag to aim) ----
    const lookArea = document.getElementById("look-area");
    let lookTouchId = null;
    let lastLookX = 0;
    let lastLookY = 0;
    const LOOK_SENSITIVITY = 0.0035; // radians/pixel (~0.2 deg/px, CoD-like feel)

    if (lookArea) {
        lookArea.addEventListener("touchstart", (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (lookTouchId === null) {
                    lookTouchId = touch.identifier;
                    lastLookX = touch.clientX;
                    lastLookY = touch.clientY;
                    break;
                }
            }
        }, { passive: false });

        lookArea.addEventListener("touchmove", (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier !== lookTouchId) continue;
                lookDX += (touch.clientX - lastLookX) * LOOK_SENSITIVITY;
                lookDY += (touch.clientY - lastLookY) * LOOK_SENSITIVITY;
                lastLookX = touch.clientX;
                lastLookY = touch.clientY;
            }
        }, { passive: false });

        const endLook = (e) => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === lookTouchId) lookTouchId = null;
            }
        };
        lookArea.addEventListener("touchend", endLook, { passive: false });
        lookArea.addEventListener("touchcancel", endLook, { passive: false });
    }

    // ---- Action Buttons ----
    function setupButton(id, keyName, toggle) {
        const btn = document.getElementById(id);
        if (!btn) return;

        if (toggle) {
            let active = false;
            btn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                active = !active;
                player.keys[keyName] = active;
                btn.classList.toggle("active", active);
            }, { passive: false });
        } else {
            btn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                if (keyName === "shoot") {
                    player.mouseButtons.left = true;
                } else {
                    player.keys[keyName] = true;
                }
                btn.classList.add("active");
            }, { passive: false });

            const endBtn = (e) => {
                e.preventDefault();
                if (keyName === "shoot") {
                    player.mouseButtons.left = false;
                } else {
                    player.keys[keyName] = false;
                }
                btn.classList.remove("active");
            };
            btn.addEventListener("touchend", endBtn, { passive: false });
            btn.addEventListener("touchcancel", endBtn, { passive: false });
        }
    }

    // Fire (hold), Jump (tap), Crouch (toggle), Reload (hold)
    setupButton("btn-fire", "shoot", false);
    setupButton("btn-jump", "space", false);
    setupButton("btn-crouch", "ctrl", true);
    setupButton("btn-reload", "r", false);

    // Camera toggle (FPS <-> TPS)
    const camBtn = document.getElementById("btn-camera");
    if (camBtn) {
        camBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            player.keys.v = true;
            camBtn.classList.add("active");
            setTimeout(() => {
                player.keys.v = false;
                camBtn.classList.remove("active");
            }, 100);
        }, { passive: false });
    }

    // ---- Update (called each frame) ----
    const SPRINT_THRESHOLD = 0.9;
    function update() {
        const deadzone = 0.15;

        // Movement axes (forward/back)
        if (moveY > deadzone) { player.keys.w = true; player.keys.s = false; }
        else if (moveY < -deadzone) { player.keys.w = false; player.keys.s = true; }
        else { player.keys.w = false; player.keys.s = false; }

        // Movement axes (strafe left/right)
        if (moveX > deadzone) { player.keys.d = true; player.keys.a = false; }
        else if (moveX < -deadzone) { player.keys.d = false; player.keys.a = true; }
        else { player.keys.d = false; player.keys.a = false; }

        // Auto-sprint (CoD Mobile-style): push the joystick fully forward to sprint.
        const joystickMag = Math.sqrt(moveX * moveX + moveY * moveY);
        const autoSprint = joystickMag > SPRINT_THRESHOLD;
        player.keys.shift = autoSprint;

        // Visual feedback: highlight the joystick rim while sprinting.
        if (joystickBase) joystickBase.classList.toggle("sprinting", autoSprint);
    }

    // ---- Look delta getters ----
    function consumeLookDelta() {
        const dx = lookDX;
        const dy = lookDY;
        lookDX = 0;
        lookDY = 0;
        return { dx, dy };
    }

    // Prevent default touch behavior on the canvas to avoid scrolling/zoom
    const canvas = document.getElementById("renderCanvas");
    if (canvas) {
        canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
        canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    }

    return {
        update,
        consumeLookDelta,
        isMobile: true,
        get moveX() { return moveX; },
        get moveY() { return moveY; },
    };
}
