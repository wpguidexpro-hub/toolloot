/* ========================================
   Audio Module
   Procedural sound effects via Web Audio API
   Weapon-specific sounds for all weapon types
   ======================================== */

let audioCtx = null;
let masterGain = null;
let ambientRunning = false;

function ensureAudioContext() {
    if (audioCtx) return true;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.4;
        masterGain.connect(audioCtx.destination);
        return true;
    } catch (e) {
        return false;
    }
}

// --- Noise buffer cache (prevents GC allocations on every shot/footstep) ---
const _noiseBufferCache = new Map();

function createNoiseBuffer(duration, sampleRate) {
    if (!audioCtx) return null;
    sampleRate = sampleRate || audioCtx.sampleRate;
    const roundedDur = Math.round(duration * 100) / 100;
    const cacheKey = `${roundedDur}_${sampleRate}`;

    if (_noiseBufferCache.has(cacheKey)) {
        return _noiseBufferCache.get(cacheKey);
    }

    const len = Math.floor(roundedDur * sampleRate);
    const buf = audioCtx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    _noiseBufferCache.set(cacheKey, buf);
    return buf;
}

// --- Ambient forest sounds (looping wind + bird chirps) ---
function startAmbient() {
    if (ambientRunning) return;
    if (!ensureAudioContext()) return;
    ambientRunning = true;

    // Wind noise
    const windBuf = createNoiseBuffer(2);
    const windSrc = audioCtx.createBufferSource();
    windSrc.buffer = windBuf;
    windSrc.loop = true;

    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.5;

    const windGain = audioCtx.createGain();
    windGain.gain.value = 0.08;

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windSrc.start();

    scheduleBirdChirps();
}

function scheduleBirdChirps() {
    const delay = 3000 + Math.random() * 8000;
    setTimeout(() => {
        if (audioCtx && audioCtx.state === "running") {
            playBirdChirp();
        }
        scheduleBirdChirps();
    }, delay);
}

function playBirdChirp() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const baseFreq = 2000 + Math.random() * 2000;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, t + 0.15);
    osc.type = "sine";

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.015, t + 0.02);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
}

// --- Footstep sound ---
let lastFootstepTime = 0;

function playFootstep(isRunning) {
    if (!ensureAudioContext()) return;
    const now = audioCtx.currentTime;
    const interval = isRunning ? 0.3 : 0.45;
    if (now - lastFootstepTime < interval) return;
    lastFootstepTime = now;

    const buf = createNoiseBuffer(0.08);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600 + Math.random() * 400;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start();
    src.stop(now + 0.1);
}

// ============================================================
// WEAPON-SPECIFIC SOUNDS
// ============================================================

// --- Knife swing (whoosh) ---
function playKnifeSwing() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    const buf = createNoiseBuffer(0.15);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(2500, t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    filter.Q.value = 2;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(t);
    src.stop(t + 0.2);
}

// --- Knife hit (meaty thud) ---
function playKnifeHit() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.15);

    // Impact noise layer
    const buf = createNoiseBuffer(0.06);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.15, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    const nFilter = audioCtx.createBiquadFilter();
    nFilter.type = "lowpass";
    nFilter.frequency.value = 500;
    src.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(masterGain);
    src.start(t);
    src.stop(t + 0.1);
}

// --- 3D Spatial Audio Helpers ---
function createPanner(x, y, z) {
    if (!audioCtx) return masterGain;
    try {
        const panner = audioCtx.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 4;
        panner.maxDistance = 160;
        panner.rolloffFactor = 1.2;
        panner.coneInnerAngle = 360;

        if (panner.positionX) {
            const t = audioCtx.currentTime;
            panner.positionX.setValueAtTime(x, t);
            panner.positionY.setValueAtTime(y, t);
            panner.positionZ.setValueAtTime(z, t);
        } else if (panner.setPosition) {
            panner.setPosition(x, y, z);
        }
        panner.connect(masterGain);
        return panner;
    } catch (e) {
        return masterGain;
    }
}

// --- MW11 Pistol (sharp crack) ---
function playMW11Shot(dest = masterGain) {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    // Sharp attack
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.25, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.12);

    // Noise crack
    const buf = createNoiseBuffer(0.06);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2000;
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.3, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    src.start(t);
    src.stop(t + 0.08);
}

// --- M16 Rifle (rapid burst) ---
function playM16Shot(dest = masterGain) {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    // Low body
    const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.18);

    // High snap
    const buf = createNoiseBuffer(0.04);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const hpFilter = audioCtx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 3000;
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.35, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    src.connect(hpFilter);
    hpFilter.connect(nGain);
    nGain.connect(dest);
    src.start(t);
    src.stop(t + 0.06);

    // Mid-range body
    const buf2 = createNoiseBuffer(0.08);
    const src2 = audioCtx.createBufferSource();
    src2.buffer = buf2;
    const bpFilter = audioCtx.createBiquadFilter();
    bpFilter.type = "bandpass";
    bpFilter.frequency.value = 800;
    bpFilter.Q.value = 1;
    const nGain2 = audioCtx.createGain();
    nGain2.gain.setValueAtTime(0.2, t);
    nGain2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    src2.connect(bpFilter);
    bpFilter.connect(nGain2);
    nGain2.connect(dest);
    src2.start(t);
    src2.stop(t + 0.12);
}

// --- BY15 Shotgun (deep boom) ---
function playBY15Shot(dest = masterGain) {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    // Deep bass
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.3);

    // Explosion noise
    const buf = createNoiseBuffer(0.15);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = "lowpass";
    lpFilter.frequency.setValueAtTime(3000, t);
    lpFilter.frequency.exponentialRampToValueAtTime(200, t + 0.2);
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.4, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    src.connect(lpFilter);
    lpFilter.connect(nGain);
    nGain.connect(dest);
    src.start(t);
    src.stop(t + 0.25);

    // High crack
    const buf2 = createNoiseBuffer(0.03);
    const src2 = audioCtx.createBufferSource();
    src2.buffer = buf2;
    const hpFilter = audioCtx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 4000;
    const nGain2 = audioCtx.createGain();
    nGain2.gain.setValueAtTime(0.25, t);
    nGain2.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    src2.connect(hpFilter);
    hpFilter.connect(nGain2);
    nGain2.connect(dest);
    src2.start(t);
    src2.stop(t + 0.05);
}

// --- Rytec AMR Sniper (heavy cannon) ---
function playRytecShot(dest = masterGain) {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    // Ultra-low body
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.6);

    // Supersonic crack
    const buf = createNoiseBuffer(0.02);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const hpFilter = audioCtx.createBiquadFilter();
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 5000;
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.5, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    src.connect(hpFilter);
    hpFilter.connect(nGain);
    nGain.connect(dest);
    src.start(t);
    src.stop(t + 0.04);

    // Boom reverb tail
    const buf2 = createNoiseBuffer(0.3);
    const src2 = audioCtx.createBufferSource();
    src2.buffer = buf2;
    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = "lowpass";
    lpFilter.frequency.setValueAtTime(600, t);
    lpFilter.frequency.exponentialRampToValueAtTime(100, t + 0.4);
    const nGain2 = audioCtx.createGain();
    nGain2.gain.setValueAtTime(0.25, t + 0.02);
    nGain2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    src2.connect(lpFilter);
    lpFilter.connect(nGain2);
    nGain2.connect(dest);
    src2.start(t);
    src2.stop(t + 0.6);
}

// --- Pickup collect chime ---
function playPickupSound() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    // Rising chime
    const osc1 = audioCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(800, t);
    osc1.frequency.setValueAtTime(1200, t + 0.08);
    osc1.frequency.setValueAtTime(1600, t + 0.16);

    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain1.gain.setValueAtTime(0.12, t + 0.08);
    gain1.gain.setValueAtTime(0.1, t + 0.16);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(t);
    osc1.stop(t + 0.4);

    // Sparkle
    const osc2 = audioCtx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(2400, t + 0.1);
    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.06, t + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(t);
    osc2.stop(t + 0.35);
}

// --- Reload sound (mechanical click) ---
function playReload() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    // Click 1 — magazine out
    function click1() {
        const buf = createNoiseBuffer(0.03);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 3000;
        filter.Q.value = 2;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        src.start(t);
        src.stop(t + 0.05);
    }

    // Click 2 — magazine in (delayed)
    function click2() {
        const t2 = t + 0.4;
        const buf = createNoiseBuffer(0.04);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 2500;
        filter.Q.value = 3;
        gain.gain.setValueAtTime(0.25, t2);
        gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.05);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        src.start(t2);
        src.stop(t2 + 0.06);
    }

    // Click 3 — bolt (delayed)
    function click3() {
        const t3 = t + 0.8;
        const osc = audioCtx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(800, t3);
        osc.frequency.exponentialRampToValueAtTime(200, t3 + 0.06);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.15, t3);
        gain.gain.exponentialRampToValueAtTime(0.001, t3 + 0.08);

        const nBuf = createNoiseBuffer(0.04);
        const nSrc = audioCtx.createBufferSource();
        nSrc.buffer = nBuf;
        const nGain = audioCtx.createGain();
        const nFilter = audioCtx.createBiquadFilter();
        nFilter.type = "highpass";
        nFilter.frequency.value = 4000;
        nGain.gain.setValueAtTime(0.15, t3);
        nGain.gain.exponentialRampToValueAtTime(0.001, t3 + 0.05);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t3);
        osc.stop(t3 + 0.1);

        nSrc.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(masterGain);
        nSrc.start(t3);
        nSrc.stop(t3 + 0.06);
    }

    click1();
    click2();
    click3();
}

// --- Jump sound (whoosh) ---
function playJump() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;
    const buf = createNoiseBuffer(0.15);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.2);
    filter.Q.value = 1;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(t);
    src.stop(t + 0.25);
}

// --- Empty click (no ammo) ---
function playEmptyClick() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
}

// --- Play local weapon shot by weapon type ---
function playWeaponShot(weaponType) {
    switch (weaponType) {
        case "knife":   playKnifeSwing(); break;
        case "mw11":    playMW11Shot(); break;
        case "m16":     playM16Shot(); break;
        case "by15":    playBY15Shot(); break;
        case "rytec":   playRytecShot(); break;
        default:        playM16Shot(); break;
    }
}

// --- Play 3D Positional weapon shot for remote players ---
function play3DShot(weaponType, x, y, z) {
    if (!ensureAudioContext()) return;
    const panner = createPanner(x, y, z);
    switch (weaponType) {
        case "knife":   playKnifeSwing(panner); break;
        case "mw11":    playMW11Shot(panner); break;
        case "m16":     playM16Shot(panner); break;
        case "by15":    playBY15Shot(panner); break;
        case "rytec":   playRytecShot(panner); break;
        default:        playM16Shot(panner); break;
    }
}

// --- Hit & Kill Feedback Sounds (tactical chime/ping) ---
function playHitNotification(isKill = false) {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;

    if (isKill) {
        // Dramatic chord for kill confirmation
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        freqs.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, t + idx * 0.03);
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0, t + idx * 0.03);
            gain.gain.linearRampToValueAtTime(0.12, t + idx * 0.03 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(t + idx * 0.03);
            osc.stop(t + 0.55);
        });
    } else {
        // Crisp high-tech hitmarker ping
        const osc = audioCtx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1800, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.08);
    }
}

// --- Weapon Switch Click ---
function playWeaponSwitch() {
    if (!ensureAudioContext()) return;
    const t = audioCtx.currentTime;
    const buf = createNoiseBuffer(0.02);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(t);
    src.stop(t + 0.05);
}

// --- Update Web Audio Listener Orientation & Position ---
function updateListener(camera) {
    if (!audioCtx || !camera) return;
    const pos = camera.position;
    const fwd = camera.getForwardRay(1).direction;
    const up = BABYLON.Vector3.Up();

    const listener = audioCtx.listener;
    const t = audioCtx.currentTime;
    if (listener.positionX) {
        listener.positionX.setValueAtTime(pos.x, t);
        listener.positionY.setValueAtTime(pos.y, t);
        listener.positionZ.setValueAtTime(pos.z, t);
        listener.forwardX.setValueAtTime(fwd.x, t);
        listener.forwardY.setValueAtTime(fwd.y, t);
        listener.forwardZ.setValueAtTime(fwd.z, t);
        listener.upX.setValueAtTime(up.x, t);
        listener.upY.setValueAtTime(up.y, t);
        listener.upZ.setValueAtTime(up.z, t);
    } else if (listener.setPosition) {
        listener.setPosition(pos.x, pos.y, pos.z);
        listener.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
}

// --- Public API ---
export function createAudioSystem(player, weapons) {
    // Start ambient on first user interaction
    const startOnce = () => {
        startAmbient();
        document.removeEventListener("click", startOnce);
        document.removeEventListener("keydown", startOnce);
        document.removeEventListener("touchstart", startOnce);
    };
    document.addEventListener("click", startOnce);
    document.addEventListener("keydown", startOnce);
    document.addEventListener("touchstart", startOnce);

    function update(dt, camera) {
        if (camera) {
            updateListener(camera);
        }
        if (!player || !player.isMoving || !player.isGrounded || !player.alive) return;
        playFootstep(player.isRunning);
    }

    return {
        update,
        updateListener,
        playWeaponShot,
        play3DShot,
        playHitNotification,
        playWeaponSwitch,
        playKnifeSwing,
        playKnifeHit,
        playReload,
        playEmptyClick,
        playJump,
        playPickupSound,
        // Legacy aliases
        playGunshot: playM16Shot,
    };
}
