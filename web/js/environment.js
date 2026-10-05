/* ========================================
   Environment Module
   Skybox, fog, lighting, and shadows
   ======================================== */

export function createEnvironment(scene) {
    // ---- Scene settings ----
    scene.clearColor = new BABYLON.Color4(0.4, 0.55, 0.72, 1);
    scene.ambientColor = new BABYLON.Color3(0.2, 0.22, 0.25);

    // Prefiltered environment texture for Image-Based Lighting (IBL)
    try {
        const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
            "./models/environmentSpecular.env",
            scene
        );
        envTexture.name = "envTex";
        envTexture.gammaSpace = false;
        scene.environmentTexture = envTexture;
    } catch (e) {
        console.warn("Failed to load environment specular texture, falling back to hemispheric ambient light:", e);
    }

    // ---- Fog (atmospheric depth) ----
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.009; // slightly clearer for better distance visibility
    scene.fogColor = new BABYLON.Color3(0.5, 0.6, 0.65);

    // ---- Skybox (gradient sky dome) ----
    const skybox = createSkyDome(scene);

    // ---- Hemisphere Light (ambient fill, lowered to complement IBL) ----
    const hemiLight = new BABYLON.HemisphericLight(
        "hemiLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemiLight.intensity = 0.35;
    hemiLight.diffuse = new BABYLON.Color3(0.8, 0.85, 0.9);
    hemiLight.groundColor = new BABYLON.Color3(0.2, 0.18, 0.15);
    hemiLight.specular = new BABYLON.Color3(0.05, 0.05, 0.05);

    // ---- Directional Light (sun) with shadows ----
    const sunLight = new BABYLON.DirectionalLight(
        "sunLight",
        new BABYLON.Vector3(-0.4, -0.9, 0.5).normalize(),
        scene
    );
    sunLight.position = new BABYLON.Vector3(40, 90, -40);
    sunLight.intensity = 1.7; // Brighter sun for beautiful PBR highlights
    sunLight.diffuse = new BABYLON.Color3(1.0, 0.96, 0.88);
    sunLight.specular = new BABYLON.Color3(0.4, 0.4, 0.35);

    // ---- Shadow Generator (high-quality soft PCF shadows) ----
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
    const shadowMapSize = isMobile ? 512 : 2048; // 2K shadows for high fidelity

    const shadowGenerator = new BABYLON.ShadowGenerator(shadowMapSize, sunLight);
    if (isMobile) {
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 4;
    } else {
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    }
    shadowGenerator.darkness = 0.25;

    // ---- Freeze skybox for performance ----
    skybox.freezeWorldMatrix();
    skybox.material.freeze();
    skybox.receiveShadows = false;

    // ---- Post-Processing & Graphics Pipeline ----
    const pipeline = new BABYLON.DefaultRenderingPipeline(
        "defaultPipeline", // Name
        true, // HDR
        scene, // Scene
        scene.cameras // Attach to cameras
    );

    // FXAA & MSAA
    pipeline.samples = isMobile ? 1 : 4;
    pipeline.fxaaEnabled = true;

    // Bloom (Glow)
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 0.25;
    pipeline.bloomKernel = isMobile ? 32 : 64;
    pipeline.bloomScale = 0.5;

    // Filmic ACES Tone Mapping & Color Adjustments
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.contrast = 1.15;
    pipeline.imageProcessing.exposure = 1.15;

    // Screen Space Ambient Occlusion v2 (SSAO2) for realistic shadows in crevices
    let ssao = null;
    if (!isMobile) {
        ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene, {
            ssaoRatio: 0.5,
            blurRatio: 0.5
        });
        ssao.radius = 1.5;
        ssao.totalStrength = 1.0;
        ssao.expensiveBlur = true;
    }

    return { hemiLight, sunLight, shadowGenerator, skybox, pipeline, ssao };
}

/**
 * Creates a procedural sky dome with gradient colors
 */
function createSkyDome(scene) {
    const sky = BABYLON.MeshBuilder.CreateSphere("skyDome", {
        diameter: 900,
        segments: 16,
        sideOrientation: BABYLON.Mesh.BACKSIDE
    }, scene);

    const texSize = 512;
    const skyTex = new BABYLON.DynamicTexture("skyTex", texSize, scene, false);
    const ctx = skyTex.getContext();

    const gradient = ctx.createLinearGradient(0, 0, 0, texSize);
    gradient.addColorStop(0.0,  "#0b172a");  // Deep slate blue
    gradient.addColorStop(0.2,  "#13253e");  // Atmospheric dark blue
    gradient.addColorStop(0.45, "#25486b");  // Sky blue gradient
    gradient.addColorStop(0.68, "#5085a5");  // Warm horizon light blue
    gradient.addColorStop(0.85, "#a8c2cf");  // Horizon fog blend
    gradient.addColorStop(1.0,  "#768d99");  // Fog matching color

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, texSize, texSize);
    skyTex.update();

    const skyMat = new BABYLON.StandardMaterial("skyMat", scene);
    skyMat.emissiveTexture = skyTex;
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;

    sky.material = skyMat;
    sky.infiniteDistance = true;
    sky.renderingGroupId = 0;
    sky.isPickable = false;

    return sky;
}

// --- Global Normal Map Cache (prevents duplicate textures in VRAM) ---
const _normalMapCache = new Map();

/**
 * Generates dynamic, high-quality seamless normal maps in memory.
 */
export function generateNormalMap(scene, width, height, type) {
    const key = `${type}_${width}_${height}`;
    if (_normalMapCache.has(key)) {
        const cached = _normalMapCache.get(key);
        if (cached && !cached.isDisposed) {
            return cached;
        }
    }

    const tex = new BABYLON.DynamicTexture("normTex_" + type, { width, height }, scene, false);
    const ctx = tex.getContext();
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Height function based on texture type
    const getHeight = (x, y) => {
        if (type === "bark") {
            const val1 = Math.sin(x * 0.15) * Math.cos(y * 0.05);
            const val2 = Math.sin(x * 0.45) * 0.3;
            return (val1 + val2) * 4;
        } else if (type === "rock") {
            const nx = x / 8;
            const ny = y / 8;
            const v1 = Math.sin(nx) * Math.cos(ny);
            const v2 = Math.sin(nx * 2.5) * Math.cos(ny * 2.5) * 0.4;
            const v3 = Math.sin(nx * 6) * Math.cos(ny * 6) * 0.15;
            return (v1 + v2 + v3) * 3;
        } else if (type === "asphalt") {
            // Fine-grained noise
            let noise = 0;
            const nx1 = x * 0.5, ny1 = y * 0.5;
            const nx2 = x * 1.5, ny2 = y * 1.5;
            noise += (Math.sin(nx1) + Math.cos(ny1)) * 0.1;
            noise += (Math.sin(nx2) * Math.cos(ny2)) * 0.05;
            noise += Math.random() * 0.25;
            return noise;
        } else if (type === "concrete") {
            // Very subtle fine texture + occasional lines
            let val = Math.random() * 0.15;
            if (x % 64 === 0 || y % 64 === 0) val -= 0.6; // brick tile lines
            return val;
        } else if (type === "dirt") {
            const nx = x / 6;
            const ny = y / 6;
            return (Math.sin(nx) + Math.cos(ny) + Math.sin(nx * 3) * 0.4) * 1.5;
        } else if (type === "fabric") {
            // Fine canvas/Kevlar weave
            const row = Math.floor(x / 1.5) % 2;
            const col = Math.floor(y / 1.5) % 2;
            return (row === col) ? 0.35 : 0.0;
        }
        return 0;
    };

    // Finite difference loop to calculate normals
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const hL = getHeight((x - 1 + width) % width, y);
            const hR = getHeight((x + 1) % width, y);
            const hD = getHeight(x, (y - 1 + height) % height);
            const hU = getHeight(x, (y + 1) % height);

            const scale = (type === "concrete" || type === "asphalt") ? 0.15 : 1.0;
            const dx = (hR - hL) * scale;
            const dy = (hU - hD) * scale;

            const len = Math.sqrt(dx * dx + dy * dy + 1);
            const nx = -dx / len;
            const ny = -dy / len;
            const nz = 1 / len;

            const idx = (y * width + x) * 4;
            data[idx] = Math.floor((nx + 1) * 127.5);
            data[idx + 1] = Math.floor((ny + 1) * 127.5);
            data[idx + 2] = Math.floor((nz + 1) * 127.5);
            data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imgData, 0, 0);
    tex.update();
    _normalMapCache.set(key, tex);
    return tex;
}

