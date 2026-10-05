/* ========================================
   Terrain Module
   Procedural heightmap terrain with physics
   ======================================== */

import { generateNormalMap } from './environment.js';

// --- Noise functions for heightmap generation ---

const SEED = 42;

function hash2D(ix, iy) {
    let h = ix * 374761393 + iy * 668265263 + SEED * 1013904223;
    h = (h ^ (h >> 13)) * 1274126177;
    h = (h ^ (h >> 16));
    return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    // Smoothstep interpolation
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = hash2D(ix, iy);
    const n10 = hash2D(ix + 1, iy);
    const n01 = hash2D(ix, iy + 1);
    const n11 = hash2D(ix + 1, iy + 1);

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;
    return nx0 * (1 - sy) + nx1 * sy;
}

function fbm(x, y, octaves, lacunarity, gain) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
        value += amplitude * smoothNoise(x * frequency, y * frequency);
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value;
}

// --- Configuration ---
const WORLD_SIZE = 200;
const MAX_HEIGHT = 12;
const SUBDIVISIONS = 128;
const NOISE_SCALE = 3.5;
const OCTAVES = 6;
const LACUNARITY = 2.0;
const GAIN = 0.48;

/**
 * Get terrain height at world coordinates (x, z).
 * This function uses the same noise used to generate the visual heightmap.
 */
export function getHeightAtCoordinates(x, z) {
    // Map world coords to normalized noise coords
    const nx = (x + WORLD_SIZE / 2) / WORLD_SIZE;
    const nz = (z + WORLD_SIZE / 2) / WORLD_SIZE;
    return fbm(nx * NOISE_SCALE, nz * NOISE_SCALE, OCTAVES, LACUNARITY, GAIN) * MAX_HEIGHT;
}

/**
 * Creates the terrain ground mesh with a procedural heightmap.
 * Returns a Promise that resolves with { ground, getHeightAtCoordinates }.
 */
export function createTerrain(scene, shadowGenerator) {
    return new Promise((resolve) => {
        // Generate heightmap image as data URL
        const hmSize = 256;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = hmSize;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.createImageData(hmSize, hmSize);

        for (let py = 0; py < hmSize; py++) {
            for (let px = 0; px < hmSize; px++) {
                const nx = px / hmSize;
                const ny = py / hmSize;
                const h = fbm(nx * NOISE_SCALE, ny * NOISE_SCALE, OCTAVES, LACUNARITY, GAIN);
                const val = Math.floor(Math.max(0, Math.min(1, h)) * 255);
                const idx = (py * hmSize + px) * 4;
                imageData.data[idx]     = val;
                imageData.data[idx + 1] = val;
                imageData.data[idx + 2] = val;
                imageData.data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const heightmapURL = canvas.toDataURL();

        // Create ground from heightmap
        const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
            "ground",
            heightmapURL,
            {
                width: WORLD_SIZE,
                height: WORLD_SIZE,
                subdivisions: SUBDIVISIONS,
                minHeight: 0,
                maxHeight: MAX_HEIGHT,
                onReady: (mesh) => {
                    mesh.checkCollisions = true;
                    mesh.isPickable = true;
                    mesh.receiveShadows = true;

                    // Pre-compute height data from actual mesh geometry
                    mesh.updateCoordinateHeights();

                    resolve({
                        ground: mesh,
                        // Use the ACTUAL mesh heights (not noise) for perfect alignment
                        getHeightAtCoordinates: (x, z) => {
                            const half = WORLD_SIZE / 2 - 0.5;
                            const cx = Math.max(-half, Math.min(half, x));
                            const cz = Math.max(-half, Math.min(half, z));
                            try {
                                const h = mesh.getHeightAtCoordinates(cx, cz);
                                return (h !== null && h !== undefined && !isNaN(h)) ? h : 0;
                            } catch (e) {
                                return 0;
                            }
                        },
                        worldSize: WORLD_SIZE,
                        maxHeight: MAX_HEIGHT
                    });
                }
            },
            scene
        );

        // Apply ground material
        ground.material = createGroundMaterial(scene);
    });
}

/**
 * Creates a forest-floor material with procedural texture
 */
function createGroundMaterial(scene) {
    const mat = new BABYLON.PBRMaterial("groundMat", scene);

    // Generate procedural ground texture
    const texSize = 512;
    const tex = new BABYLON.DynamicTexture("groundTex", texSize, scene, true);
    const ctx = tex.getContext();

    // Base color — earthy brown-green
    ctx.fillStyle = "#3a4a28";
    ctx.fillRect(0, 0, texSize, texSize);

    // Add noise patches (dirt, leaves, moss)
    const colors = [
        "#4a5a30", "#35442a", "#504830", "#2d3a20",
        "#5a6a38", "#3e3828", "#486030", "#554a30",
        "#2a3518", "#4d5e35", "#6a7040", "#383020"
    ];

    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * texSize;
        const y = Math.random() * texSize;
        const size = 1 + Math.random() * 6;
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.globalAlpha = 0.3 + Math.random() * 0.5;
        ctx.fillRect(x, y, size, size);
    }

    // Add some lighter spots (sunlight patches)
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * texSize;
        const y = Math.random() * texSize;
        const r = 10 + Math.random() * 30;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, "#8a9a50");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    ctx.globalAlpha = 1;
    tex.update();

    mat.albedoTexture = tex;
    mat.albedoTexture.uScale = 12;
    mat.albedoTexture.vScale = 12;

    // Apply procedural dirt normal map for tactile ground detailing
    mat.bumpTexture = generateNormalMap(scene, 256, 256, "dirt");
    mat.bumpTexture.uScale = 12;
    mat.bumpTexture.vScale = 12;

    mat.metallic = 0.05;
    mat.roughness = 0.95;

    return mat;
}
