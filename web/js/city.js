/* ========================================
   City Module
   Procedural city with buildings (1,2,3,6,9
   floors), diagonal ramp staircases, roads
   ======================================== */

import { generateNormalMap } from './environment.js';

// ---- Constants ----
const PLAYER_HEIGHT = 1.8;
const CITY_SIZE = 100;
const HALF_CITY = CITY_SIZE / 2;
const FLOOR_HEIGHT = PLAYER_HEIGHT * 1.5;  // 2.7 units per floor (150% of player)

// Building floor counts — distributed across the 4x4 grid
const BUILDING_FLOORS = [
    1, 3, 6, 2,
    9, 1, 3, 6,
    2, 9, 1, 3,
    6, 2, 9, 1,
];

// Grid layout
const ROAD_WIDTH = 8;
const BLOCK_PADDING = 1.5;
const GRID_COLS = 4;
const GRID_ROWS = 4;

// Ramp config
const RAMP_WIDTH = 2.5;   // width of the ramp
const RAMP_THICKNESS = 0.3;

// Collision spatial grid
const COL_CELL = 4;
const cityCollisionGrid = {};
const cityHeightMap = []; // { xMin, xMax, zMin, zMax, yTop, slope? }

// All building data for minimap
const allBuildings = [];

// ---- Spatial grid helpers ----

function colKey(x, z) {
    return `${Math.floor(x / COL_CELL)},${Math.floor(z / COL_CELL)}`;
}

function addCollisionRect(xMin, xMax, zMin, zMax, yTop) {
    for (let gx = Math.floor(xMin / COL_CELL); gx <= Math.floor(xMax / COL_CELL); gx++) {
        for (let gz = Math.floor(zMin / COL_CELL); gz <= Math.floor(zMax / COL_CELL); gz++) {
            const key = `${gx},${gz}`;
            if (!cityCollisionGrid[key]) cityCollisionGrid[key] = [];
            cityCollisionGrid[key].push({ xMin, xMax, zMin, zMax, yTop });
        }
    }
}

/**
 * Check collision of a circle (px, pz, radius) against city buildings.
 * Returns push-out vector { x, z } or null if no collision.
 */
export function checkCityCollision(px, pz, playerRadius, playerY) {
    const gx = Math.floor(px / COL_CELL);
    const gz = Math.floor(pz / COL_CELL);
    let pushX = 0, pushZ = 0;
    let hit = false;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const key = `${gx + dx},${gz + dz}`;
            const rects = cityCollisionGrid[key];
            if (!rects) continue;
            for (const rect of rects) {
                // Only collide if player is below the top of this obstacle
                if (playerY >= rect.yTop - 0.3) continue;

                // Closest point on AABB to circle center
                const cx = Math.max(rect.xMin, Math.min(px, rect.xMax));
                const cz = Math.max(rect.zMin, Math.min(pz, rect.zMax));
                const ddx = px - cx;
                const ddz = pz - cz;
                const dist2 = ddx * ddx + ddz * ddz;
                const r2 = playerRadius * playerRadius;
                if (dist2 < r2 && dist2 > 0.0001) {
                    const dist = Math.sqrt(dist2);
                    const overlap = playerRadius - dist;
                    pushX += (ddx / dist) * overlap;
                    pushZ += (ddz / dist) * overlap;
                    hit = true;
                }
            }
        }
    }
    return hit ? { x: pushX, z: pushZ } : null;
}

/**
 * Get the height the player should be at given their position.
 * Supports flat platforms (rooftops) and sloped ramps.
 * Only returns platform heights that are reachable from the player's current Y
 * (within STEP_UP tolerance), preventing teleportation to distant heights.
 */
export function getCityHeightAt(x, z, currentFeetY) {
    let maxH = 0;
    const STEP_UP = 1.0; // max height a player can step up onto

    for (const platform of cityHeightMap) {
        if (x >= platform.xMin && x <= platform.xMax &&
            z >= platform.zMin && z <= platform.zMax) {
            let platformH;
            if (platform.slope) {
                // Sloped ramp — interpolate height based on position along slope axis
                let t;
                if (platform.slopeAxis === "x") {
                    t = (x - platform.xMin) / (platform.xMax - platform.xMin);
                } else {
                    t = (z - platform.zMin) / (platform.zMax - platform.zMin);
                }
                if (platform.slopeInvert) t = 1 - t;
                platformH = platform.yBottom + t * (platform.yTop - platform.yBottom);

                // For ramps: check if player can access this ramp SEGMENT
                // (feet must be near the ramp's bottom entry point)
                if (currentFeetY >= platform.yBottom - STEP_UP && platformH > maxH) {
                    maxH = platformH;
                }
            } else {
                platformH = platform.yTop;

                // For flat platforms: strict check against platform height
                if (currentFeetY >= platformH - STEP_UP && platformH > maxH) {
                    maxH = platformH;
                }
            }
        }
    }
    return maxH;
}

/**
 * Get all building data for minimap rendering
 */
export function getCityBuildings() {
    return allBuildings;
}

/**
 * Creates the entire city: ground, buildings, ramp staircases, rooftops.
 */
export function createCity(scene, shadowGenerator) {
    // ---- Clear previous data ----
    allBuildings.length = 0;
    cityHeightMap.length = 0;
    for (const key in cityCollisionGrid) delete cityCollisionGrid[key];

    // ---- Shared Normal Maps (generated ONCE, reused for all buildings/roads) ----
    const sharedConcreteNormal = generateNormalMap(scene, 128, 128, "concrete");
    const sharedAsphaltNormal = generateNormalMap(scene, 256, 256, "asphalt");

    // ---- Ground Plane ----
    const ground = BABYLON.MeshBuilder.CreateGround("cityGround", {
        width: CITY_SIZE,
        height: CITY_SIZE,
        subdivisions: 4,
    }, scene);
    ground.position.y = 0;
    ground.receiveShadows = true;
    ground.isPickable = true;
    ground.material = createRoadMaterial(scene, sharedAsphaltNormal);

    // ---- Calculate building layout ----
    const blockWidth = (CITY_SIZE - ROAD_WIDTH * (GRID_COLS + 1)) / GRID_COLS;
    const blockDepth = (CITY_SIZE - ROAD_WIDTH * (GRID_ROWS + 1)) / GRID_ROWS;

    // Seeded random for textures
    let seed = 12345;
    function seededRandom() {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed & 0x7fffffff) / 0x7fffffff;
    }

    let buildingIndex = 0;
    for (let col = 0; col < GRID_COLS; col++) {
        for (let row = 0; row < GRID_ROWS; row++) {
            const bx = -HALF_CITY + ROAD_WIDTH + col * (blockWidth + ROAD_WIDTH) + blockWidth / 2;
            const bz = -HALF_CITY + ROAD_WIDTH + row * (blockDepth + ROAD_WIDTH) + blockDepth / 2;

            // Building size within block (leave room for ramp on one side)
            const buildW = blockWidth - BLOCK_PADDING * 2 - RAMP_WIDTH;
            const buildD = blockDepth - BLOCK_PADDING * 2 - RAMP_WIDTH;
            const floors = BUILDING_FLOORS[buildingIndex % BUILDING_FLOORS.length];
            const buildH = floors * FLOOR_HEIGHT;

            createBuilding(scene, shadowGenerator, bx, bz, buildW, buildD, buildH, floors, seededRandom, sharedConcreteNormal);

            allBuildings.push({
                x: bx, z: bz,
                w: buildW, d: buildD,
                h: buildH, floors,
            });
            buildingIndex++;
        }
    }

    // ---- Road markings ----
    createRoadMarkings(scene);

    return {
        ground,
        worldSize: CITY_SIZE,
        getHeightAtCoordinates: () => 0, // flat city ground; ramp/rooftop heights handled via getCityHeightAt in player.js
        checkCollision: checkCityCollision,
        buildings: allBuildings,
    };
}

/**
 * Creates a single building with walls, rooftop, and diagonal ramp staircases.
 */
function createBuilding(scene, shadowGenerator, cx, cz, width, depth, height, floors, rng, sharedConcreteNormal) {
    // ---- Building Body ----
    const body = BABYLON.MeshBuilder.CreateBox("building", {
        width: width,
        height: height,
        depth: depth,
    }, scene);
    body.position.set(cx, height / 2, cz);
    body.material = createBuildingMaterial(scene, width, depth, height, floors, rng, sharedConcreteNormal);
    body.receiveShadows = true;
    body.isPickable = true;  // Bullets hit buildings

    if (shadowGenerator) {
        shadowGenerator.addShadowCaster(body);
    }

    // Register building as collision
    addCollisionRect(
        cx - width / 2, cx + width / 2,
        cz - depth / 2, cz + depth / 2,
        height + 0.1
    );

    // ---- Rooftop ----
    const roof = BABYLON.MeshBuilder.CreateGround("roof", {
        width: width + 0.2,
        height: depth + 0.2,
        subdivisions: 1,
    }, scene);
    roof.position.set(cx, height, cz);
    roof.material = createRooftopMaterial(scene, sharedConcreteNormal);
    roof.receiveShadows = true;
    roof.isPickable = true;

    // Register rooftop as walkable platform
    cityHeightMap.push({
        xMin: cx - width / 2 - 0.5,
        xMax: cx + width / 2 + 0.5,
        zMin: cz - depth / 2 - 0.5,
        zMax: cz + depth / 2 + 0.5,
        yTop: height,
    });

    // ---- Ramp Staircases ----
    const rampMat = createStairMaterial(scene, sharedConcreteNormal);
    createRampStaircases(scene, rampMat, shadowGenerator, cx, cz, width, depth, height, floors);
}

/**
 * Creates spiral ramp staircases wrapping around the building.
 * - 1-3 floors: Front face only.
 * - 6 floors: Front -> Right faces.
 * - 9 floors: Front -> Right -> Back faces.
 */
function createRampStaircases(scene, material, shadowGenerator, cx, cz, buildW, buildD, buildH, floors) {
    const hw = buildW / 2;
    const hd = buildD / 2;
    // Offset from wall to center of ramp
    const offset = RAMP_WIDTH / 2 + 0.1;

    let numRamps = 1;
    if (floors === 6) numRamps = 2;
    if (floors === 9) numRamps = 3;

    const heightPerRamp = buildH / numRamps;

    for (let i = 0; i < numRamps; i++) {
        const yBottom = i * heightPerRamp;
        const yTop = (i + 1) * heightPerRamp;
        
        // Side 0: Front (-Z), goes Left (-X) to Right (+X)
        // Side 1: Right (+X), goes Front (-Z) to Back (+Z)
        // Side 2: Back (+Z), goes Right (+X) to Left (-X)
        // Side 3: Left (-X), goes Back (+Z) to Front (-Z)
        
        const side = i % 4; 

        // Landing at the START of this ramp (except first ramp which starts at ground)
        if (i > 0) {
             // Corner index matches previous side index
             // Side 0 ends at Front-Right (Corner 0)
             // Side 1 ends at Back-Right (Corner 1)
             createCornerLanding(scene, material, cx, cz, hw, hd, side - 1, yBottom);
        }

        switch (side) {
            case 0: // Front (-Z face)
                createSingleRamp(scene, material, shadowGenerator,
                    cx - hw, cx + hw, cz - hd - offset, RAMP_WIDTH,
                    yBottom, yTop, "x", false);
                break;
            case 1: // Right (+X face)
                createSingleRamp(scene, material, shadowGenerator,
                    cz - hd, cz + hd, cx + hw + offset, RAMP_WIDTH,
                    yBottom, yTop, "z", false); // "z" axis, not inverted
                break;
            case 2: // Back (+Z face)
                createSingleRamp(scene, material, shadowGenerator,
                    cx - hw, cx + hw, cz + hd + offset, RAMP_WIDTH,
                    yBottom, yTop, "x", true); // "x" axis, inverted (Right to Left)
                break;
            case 3: // Left (-X face)
                createSingleRamp(scene, material, shadowGenerator,
                    cz - hd, cz + hd, cx - hw - offset, RAMP_WIDTH,
                    yBottom, yTop, "z", true); // "z" axis, inverted (Back to Front)
                break;
        }
    }
}

/**
 * Creates landing platform at corners.
 */
function createCornerLanding(scene, material, cx, cz, hw, hd, corner, y) {
    let lx, lz;
    const size = RAMP_WIDTH + 1.0; 
    const shift = (RAMP_WIDTH / 2) + 0.1;
    const off = shift;

    switch (corner) {
        case 0: // Front-Right
            lx = cx + hw + off;
            lz = cz - hd - off;
            break;
        case 1: // Back-Right
            lx = cx + hw + off;
            lz = cz + hd + off;
            break;
        case 2: // Back-Left
            lx = cx - hw - off;
            lz = cz + hd + off;
            break;
        case 3: // Front-Left
            lx = cx - hw - off;
            lz = cz - hd - off;
            break;
        default: return;
    }
    createLandingPlatform(scene, material, lx, lz, size, size, y);
}

/**
 * Creates a single diagonal ramp mesh and registers it in the height map.
 * supports slopeAxis "x" or "z".
 */
function createSingleRamp(scene, material, shadowGenerator, startVar, endVar, fixedPos, rampW, yBottom, yTop, slopeAxis, slopeInvert) {
    const rampLen = Math.abs(endVar - startVar);
    const rampH = yTop - yBottom;
    const angle = Math.atan2(rampH, rampLen); 

    const diagLen = Math.sqrt(rampLen * rampLen + rampH * rampH);
    
    let boxW, boxD;
    if (slopeAxis === "x") {
        boxW = diagLen;
        boxD = rampW;
    } else {
        boxW = rampW;
        boxD = diagLen;
    }

    const ramp = BABYLON.MeshBuilder.CreateBox("ramp", {
        width: boxW,
        height: RAMP_THICKNESS,
        depth: boxD,
    }, scene);

    const midVar = (startVar + endVar) / 2;
    const midY = (yBottom + yTop) / 2;
    
    if (slopeAxis === "x") {
        ramp.position.set(midVar, midY, fixedPos);
        ramp.rotation.z = slopeInvert ? -angle : angle;
    } else {
        ramp.position.set(fixedPos, midY, midVar);
        ramp.rotation.x = slopeInvert ? angle : -angle;
    }

    ramp.material = material;
    ramp.receiveShadows = true;
    ramp.isPickable = true;

    if (shadowGenerator) shadowGenerator.addShadowCaster(ramp);

    // Register in height map
    let xMin, xMax, zMin, zMax;
    if (slopeAxis === "x") {
        xMin = Math.min(startVar, endVar) - 0.3;
        xMax = Math.max(startVar, endVar) + 0.3;
        zMin = fixedPos - rampW / 2 - 0.3;
        zMax = fixedPos + rampW / 2 + 0.3;
    } else {
        xMin = fixedPos - rampW / 2 - 0.3;
        xMax = fixedPos + rampW / 2 + 0.3;
        zMin = Math.min(startVar, endVar) - 0.3;
        zMax = Math.max(startVar, endVar) + 0.3;
    }

    cityHeightMap.push({
        xMin, xMax, zMin, zMax,
        yBottom, yTop,
        slope: true,
        slopeAxis,
        slopeInvert: !!slopeInvert,
    });
}

/**
 * Creates a flat landing platform between zigzag ramps.
 */
function createLandingPlatform(scene, material, x, z, w, d, y) {
    const platform = BABYLON.MeshBuilder.CreateBox("landing", {
        width: w,
        height: RAMP_THICKNESS,
        depth: d,
    }, scene);
    platform.position.set(x, y, z);
    platform.material = material;
    platform.receiveShadows = true;
    platform.isPickable = true;

    cityHeightMap.push({
        xMin: x - w / 2 - 0.2,
        xMax: x + w / 2 + 0.2,
        zMin: z - d / 2 - 0.2,
        zMax: z + d / 2 + 0.2,
        yTop: y + RAMP_THICKNESS / 2,
    });
}

// ---- Materials ----

function createRoadMaterial(scene, sharedAsphaltNormal) {
    const mat = new BABYLON.PBRMaterial("roadMat", scene);
    const texSize = 512;
    const tex = new BABYLON.DynamicTexture("roadTex", texSize, scene, false);
    const ctx = tex.getContext();

    // Dark asphalt base
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, texSize, texSize);

    // Asphalt grain noise
    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * texSize;
        const y = Math.random() * texSize;
        const v = 40 + Math.random() * 30;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    // Sidewalk edges
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#888888";
    const sw = texSize * 0.08;
    ctx.fillRect(0, 0, texSize, sw);
    ctx.fillRect(0, texSize - sw, texSize, sw);
    ctx.fillRect(0, 0, sw, texSize);
    ctx.fillRect(texSize - sw, 0, sw, texSize);

    ctx.globalAlpha = 1;
    tex.update();

    mat.albedoTexture = tex;
    mat.albedoTexture.uScale = 8;
    mat.albedoTexture.vScale = 8;

    // Reuse shared asphalt normal map
    mat.bumpTexture = sharedAsphaltNormal;

    mat.metallic = 0.05;
    mat.roughness = 0.85;
    return mat;
}


function createBuildingMaterial(scene, w, d, h, floors, rng, sharedConcreteNormal) {
    const mat = new BABYLON.PBRMaterial("buildMat_" + Math.random().toString(36).slice(2), scene);
    const texSize = 256;
    const tex = new BABYLON.DynamicTexture("buildTex", texSize, scene, false);
    const ctx = tex.getContext();

    const ormTex = new BABYLON.DynamicTexture("buildOrmTex", texSize, scene, false);
    const ormCtx = ormTex.getContext();

    const facades = [
        "#8899aa", "#aa9988", "#778899", "#99887b",
        "#7a8a8a", "#9a8a7a", "#88888e", "#a09080",
        "#b0a090", "#707a80", "#8b7d6b", "#6b7d8b",
    ];
    const baseColor = facades[Math.floor(rng() * facades.length)];
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, texSize, texSize);

    // Default ORM: AO = 1.0 (Red = 255), Roughness = 0.8 (Green = 204), Metallic = 0.0 (Blue = 0)
    ormCtx.fillStyle = "rgb(255, 204, 0)";
    ormCtx.fillRect(0, 0, texSize, texSize);

    // Draw windows grid
    const windowCols = Math.max(2, Math.floor(w / 2));
    const windowRows = floors;
    const cellW = texSize / windowCols;
    const cellH = texSize / windowRows;
    const winW = cellW * 0.5;
    const winH = cellH * 0.55;

    for (let r = 0; r < windowRows; r++) {
        for (let c = 0; c < windowCols; c++) {
            const wx = c * cellW + (cellW - winW) / 2;
            const wy = r * cellH + (cellH - winH) / 2;

            ctx.fillStyle = "#222222";
            ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);

            const brightness = 0.3 + rng() * 0.5;
            const lit = rng() > 0.6;
            if (lit) {
                ctx.fillStyle = `rgba(255, 240, 180, ${brightness})`;
            } else {
                ctx.fillStyle = `rgba(100, 140, 180, ${brightness})`;
            }
            ctx.fillRect(wx, wy, winW, winH);

            // Window ORM: AO = 1.0, Roughness = 0.08 (Green = 20), Metallic = 0.95 (Blue = 242)
            ormCtx.fillStyle = "rgb(255, 20, 242)";
            ormCtx.fillRect(wx, wy, winW, winH);
        }
    }

    tex.update();
    ormTex.update();

    mat.albedoTexture = tex;
    mat.metallicTexture = ormTex;
    mat.useMetallnessFromMetallicTextureBlue = true;
    mat.useRoughnessFromMetallicTextureGreen = true;
    mat.useAmbientOcclusionFromMetallicTextureRed = true;

    // Reuse shared concrete normal map
    mat.bumpTexture = sharedConcreteNormal;

    return mat;
}

function createRooftopMaterial(scene, sharedConcreteNormal) {
    const mat = new BABYLON.PBRMaterial("roofMat", scene);
    mat.albedoColor = new BABYLON.Color3(0.35, 0.35, 0.35);

    // Reuse shared concrete normal map
    mat.bumpTexture = sharedConcreteNormal;
    mat.bumpTexture.uScale = 6;
    mat.bumpTexture.vScale = 6;

    mat.metallic = 0.05;
    mat.roughness = 0.9;
    return mat;
}

function createStairMaterial(scene, sharedConcreteNormal) {
    const mat = new BABYLON.PBRMaterial("stairMat", scene);
    mat.albedoColor = new BABYLON.Color3(0.6, 0.55, 0.45);

    mat.bumpTexture = sharedConcreteNormal;
    mat.bumpTexture.uScale = 2;
    mat.bumpTexture.vScale = 2;

    mat.metallic = 0.1;
    mat.roughness = 0.8;
    return mat;
}

function createRoadMarkings(scene) {
    const lineMat = new BABYLON.StandardMaterial("roadLineMat", scene);
    lineMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.3);
    lineMat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.05);

    const blockWidth = (CITY_SIZE - ROAD_WIDTH * (GRID_COLS + 1)) / GRID_COLS;
    const blockDepth = (CITY_SIZE - ROAD_WIDTH * (GRID_ROWS + 1)) / GRID_ROWS;

    const lineMatrices = [];

    // Horizontal road center lines
    for (let row = 0; row <= GRID_ROWS; row++) {
        const z = -HALF_CITY + ROAD_WIDTH / 2 + row * (blockDepth + ROAD_WIDTH);
        for (let i = 0; i < 20; i++) {
            const x = -HALF_CITY + 5 + i * (CITY_SIZE / 20);
            const matrix = BABYLON.Matrix.Compose(
                new BABYLON.Vector3(3, 0.02, 0.15),
                BABYLON.Quaternion.Identity(),
                new BABYLON.Vector3(x, 0.01, z)
            );
            lineMatrices.push(matrix);
        }
    }

    // Vertical road center lines
    for (let col = 0; col <= GRID_COLS; col++) {
        const x = -HALF_CITY + ROAD_WIDTH / 2 + col * (blockWidth + ROAD_WIDTH);
        for (let i = 0; i < 20; i++) {
            const z = -HALF_CITY + 5 + i * (CITY_SIZE / 20);
            const matrix = BABYLON.Matrix.Compose(
                new BABYLON.Vector3(0.15, 0.02, 3),
                BABYLON.Quaternion.Identity(),
                new BABYLON.Vector3(x, 0.01, z)
            );
            lineMatrices.push(matrix);
        }
    }

    if (lineMatrices.length > 0) {
        const lineMesh = BABYLON.MeshBuilder.CreateBox("roadLine", {
            width: 1, height: 1, depth: 1
        }, scene);
        lineMesh.material = lineMat;
        lineMesh.isPickable = false;

        const buf = new Float32Array(lineMatrices.length * 16);
        for (let i = 0; i < lineMatrices.length; i++) {
            lineMatrices[i].copyToArray(buf, i * 16);
        }
        lineMesh.thinInstanceSetBuffer("matrix", buf, 16);
        lineMesh.thinInstanceCount = lineMatrices.length;
    }
}
