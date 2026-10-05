/* ========================================
   Vehicles Module
   Autonomous traffic: sedans, pickups, buses
   driving on predefined road paths
   ======================================== */

const CITY_SIZE = 100;
const HALF_CITY = CITY_SIZE / 2;
const ROAD_WIDTH = 8;
const GRID_COLS = 4;
const GRID_ROWS = 4;

// Vehicle speeds
const SEDAN_SPEED = 10;
const PICKUP_SPEED = 8;
const BUS_SPEED = 6;

// Color palette for vehicles
const VEHICLE_COLORS = [
    "#cc2222", "#2255cc", "#22aa44", "#dddddd", "#222222",
    "#ddcc22", "#aaaaaa", "#cc6622", "#5522aa", "#22aaaa",
    "#dd4466", "#88cc22", "#4488cc", "#cc8844", "#666688",
];

// Vehicle bounding boxes for player collision (updated each frame)
const vehicleBoxes = [];

export function createVehicleSystem(scene) {
    const vehicles = [];

    // ---- Compute road paths (waypoint loops) ----
    const paths = generateRoadPaths();

    // ---- Materials cache ----
    const materialCache = {};

    function getColorMaterial(hexColor) {
        if (materialCache[hexColor]) return materialCache[hexColor];
        const mat = new BABYLON.PBRMaterial("vehMat_" + hexColor, scene);
        const c = BABYLON.Color3.FromHexString(hexColor);
        mat.albedoColor = c;
        mat.metallic = 0.85;  // Highly metallic car paint
        mat.roughness = 0.18; // Glossy finish to reflect skybox/IBL
        materialCache[hexColor] = mat;
        return mat;
    }

    // Glass material
    const glassMat = new BABYLON.PBRMaterial("glassMat", scene);
    glassMat.albedoColor = new BABYLON.Color3(0.2, 0.25, 0.3);
    glassMat.alpha = 0.6;
    glassMat.metallic = 0.95;
    glassMat.roughness = 0.05;

    // Wheel material (rough rubber)
    const wheelMat = new BABYLON.PBRMaterial("wheelMat", scene);
    wheelMat.albedoColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    wheelMat.metallic = 0.05;
    wheelMat.roughness = 0.88;

    // ---- Spawn vehicles ----
    // 8 sedans, 6 pickups, 4 buses
    for (let i = 0; i < 8; i++) {
        spawnVehicle("sedan", paths[i % paths.length], Math.random());
    }
    for (let i = 0; i < 6; i++) {
        spawnVehicle("pickup", paths[(i + 3) % paths.length], Math.random());
    }
    for (let i = 0; i < 4; i++) {
        spawnVehicle("bus", paths[(i + 1) % paths.length], Math.random());
    }

    function spawnVehicle(type, path, startT) {
        const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
        const bodyMat = getColorMaterial(color);

        let rootMesh;
        let speed;

        switch (type) {
            case "sedan":
                rootMesh = createSedan(scene, bodyMat, glassMat, wheelMat);
                speed = SEDAN_SPEED + (Math.random() - 0.5) * 3;
                break;
            case "pickup":
                rootMesh = createPickup(scene, bodyMat, glassMat, wheelMat);
                speed = PICKUP_SPEED + (Math.random() - 0.5) * 2;
                break;
            case "bus":
                rootMesh = createBus(scene, bodyMat, glassMat, wheelMat);
                speed = BUS_SPEED + (Math.random() - 0.5) * 2;
                break;
        }

        // Get vehicle dimensions for collision AABB
        const dims = getVehicleDims(type);

        const vehicle = {
            type,
            mesh: rootMesh,
            path,
            pathLength: computePathLength(path),
            t: startT, // 0..1 position along path
            speed,
            dims, // { halfW, halfD, roofY }
        };

        // Position at start
        updateVehiclePosition(vehicle);
        vehicles.push(vehicle);
    }

    function computePathLength(path) {
        let total = 0;
        for (let i = 0; i < path.length; i++) {
            const a = path[i];
            const b = path[(i + 1) % path.length];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            total += Math.sqrt(dx * dx + dz * dz);
        }
        return total;
    }

    function updateVehiclePosition(vehicle) {
        const path = vehicle.path;
        const totalLen = vehicle.pathLength;
        const distAlong = vehicle.t * totalLen;

        let accum = 0;
        for (let i = 0; i < path.length; i++) {
            const a = path[i];
            const b = path[(i + 1) % path.length];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const segLen = Math.sqrt(dx * dx + dz * dz);

            if (accum + segLen >= distAlong) {
                const frac = (distAlong - accum) / segLen;
                const x = a.x + dx * frac;
                const z = a.z + dz * frac;
                vehicle.mesh.position.set(x, 0, z);

                // Face direction of travel
                const angle = Math.atan2(dx, dz);
                vehicle.mesh.rotation.y = angle;
                return;
            }
            accum += segLen;
        }
    }

    function update(dt) {
        // Clear and rebuild collision boxes
        vehicleBoxes.length = 0;

        for (const vehicle of vehicles) {
            const distPerSec = vehicle.speed;
            vehicle.t += (distPerSec * dt) / vehicle.pathLength;
            if (vehicle.t >= 1) vehicle.t -= 1;
            updateVehiclePosition(vehicle);

            // Register AABB for player collision
            const pos = vehicle.mesh.position;
            const d = vehicle.dims;
            // Use axis-aligned box (approximate, ignoring rotation for simplicity)
            vehicleBoxes.push({
                xMin: pos.x - d.halfW,
                xMax: pos.x + d.halfW,
                zMin: pos.z - d.halfD,
                zMax: pos.z + d.halfD,
                roofY: d.roofY,
            });
        }
    }

    return { update };
}

// ---- Vehicle mesh builders ----

function createSedan(scene, bodyMat, glassMat, wheelMat) {
    const root = new BABYLON.TransformNode("sedan", scene);

    // Body
    const body = BABYLON.MeshBuilder.CreateBox("sedanBody", {
        width: 1.8, height: 0.8, depth: 4.0
    }, scene);
    body.position.y = 0.5;
    body.material = bodyMat;
    body.parent = root;
    body.isPickable = true; // Bullets stop at vehicles

    // Cabin (top)
    const cabin = BABYLON.MeshBuilder.CreateBox("sedanCabin", {
        width: 1.6, height: 0.6, depth: 2.0
    }, scene);
    cabin.position.set(0, 1.1, -0.2);
    cabin.material = glassMat;
    cabin.parent = root;
    cabin.isPickable = false;

    // Wheels
    createWheels(scene, root, wheelMat, 0.8, 1.6, 0.3);

    return root;
}

function createPickup(scene, bodyMat, glassMat, wheelMat) {
    const root = new BABYLON.TransformNode("pickup", scene);
    const sizeScale = 1.0 + Math.random() * 0.3; // Varied sizes

    // Body (longer base)
    const body = BABYLON.MeshBuilder.CreateBox("pickupBody", {
        width: 2.0 * sizeScale, height: 0.9, depth: 5.0 * sizeScale
    }, scene);
    body.position.y = 0.6;
    body.material = bodyMat;
    body.parent = root;
    body.isPickable = true; // Bullets stop at vehicles

    // Cabin (front half only)
    const cabin = BABYLON.MeshBuilder.CreateBox("pickupCabin", {
        width: 1.8 * sizeScale, height: 0.7, depth: 2.0 * sizeScale
    }, scene);
    cabin.position.set(0, 1.25, -0.8 * sizeScale);
    cabin.material = glassMat;
    cabin.parent = root;
    cabin.isPickable = false;

    // Open bed (rear — just walls)
    const bedFloor = BABYLON.MeshBuilder.CreateBox("pickupBed", {
        width: 1.8 * sizeScale, height: 0.05, depth: 2.0 * sizeScale
    }, scene);
    bedFloor.position.set(0, 1.05, 1.2 * sizeScale);
    bedFloor.material = bodyMat;
    bedFloor.parent = root;
    bedFloor.isPickable = false;

    createWheels(scene, root, wheelMat, 0.9 * sizeScale, 1.8 * sizeScale, 0.35);

    return root;
}

function createBus(scene, bodyMat, glassMat, wheelMat) {
    const root = new BABYLON.TransformNode("bus", scene);

    // Body
    const body = BABYLON.MeshBuilder.CreateBox("busBody", {
        width: 2.4, height: 2.0, depth: 8.0
    }, scene);
    body.position.y = 1.2;
    body.material = bodyMat;
    body.parent = root;
    body.isPickable = true; // Bullets stop at vehicles

    // Windows (glass strips on both sides)
    const windowL = BABYLON.MeshBuilder.CreateBox("busWinL", {
        width: 0.05, height: 0.8, depth: 6.5
    }, scene);
    windowL.position.set(-1.22, 1.6, 0);
    windowL.material = glassMat;
    windowL.parent = root;
    windowL.isPickable = false;

    const windowR = BABYLON.MeshBuilder.CreateBox("busWinR", {
        width: 0.05, height: 0.8, depth: 6.5
    }, scene);
    windowR.position.set(1.22, 1.6, 0);
    windowR.material = glassMat;
    windowR.parent = root;
    windowR.isPickable = false;

    // Windshield
    const windshield = BABYLON.MeshBuilder.CreateBox("busWindshield", {
        width: 2.2, height: 1.0, depth: 0.05
    }, scene);
    windshield.position.set(0, 1.6, -4.0);
    windshield.material = glassMat;
    windshield.parent = root;
    windshield.isPickable = false;

    createWheels(scene, root, wheelMat, 1.1, 3.0, 0.4);

    return root;
}

function createWheels(scene, parent, wheelMat, xOffset, zSpacing, radius) {
    const positions = [
        { x: -xOffset, z: -zSpacing / 2 },
        { x:  xOffset, z: -zSpacing / 2 },
        { x: -xOffset, z:  zSpacing / 2 },
        { x:  xOffset, z:  zSpacing / 2 },
    ];
    for (const pos of positions) {
        const wheel = BABYLON.MeshBuilder.CreateCylinder("wheel", {
            diameter: radius * 2,
            height: 0.2,
            tessellation: 12,
        }, scene);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, radius, pos.z);
        wheel.material = wheelMat;
        wheel.parent = parent;
        wheel.isPickable = false;
    }
}

// ---- Road path generation ----

function generateRoadPaths() {
    const blockWidth = (CITY_SIZE - ROAD_WIDTH * (GRID_COLS + 1)) / GRID_COLS;
    const blockDepth = (CITY_SIZE - ROAD_WIDTH * (GRID_ROWS + 1)) / GRID_ROWS;
    const paths = [];

    // Generate loop paths along each horizontal road
    for (let row = 0; row <= GRID_ROWS; row++) {
        const z = -HALF_CITY + ROAD_WIDTH / 2 + row * (blockDepth + ROAD_WIDTH);
        const zOffset = (row % 2 === 0) ? 1.5 : -1.5; // Drive on different lanes
        const path = [];
        const startX = -HALF_CITY + 2;
        const endX = HALF_CITY - 2;

        if (row % 2 === 0) {
            // Go east, loop back
            for (let x = startX; x <= endX; x += 5) {
                path.push({ x, z: z + zOffset });
            }
            // U-turn
            for (let x = endX; x >= startX; x -= 5) {
                path.push({ x, z: z - zOffset });
            }
        } else {
            // Go west, loop back
            for (let x = endX; x >= startX; x -= 5) {
                path.push({ x, z: z + zOffset });
            }
            for (let x = startX; x <= endX; x += 5) {
                path.push({ x, z: z - zOffset });
            }
        }
        paths.push(path);
    }

    // Generate loop paths along each vertical road
    for (let col = 0; col <= GRID_COLS; col++) {
        const x = -HALF_CITY + ROAD_WIDTH / 2 + col * (blockWidth + ROAD_WIDTH);
        const xOffset = (col % 2 === 0) ? 1.5 : -1.5;
        const path = [];
        const startZ = -HALF_CITY + 2;
        const endZ = HALF_CITY - 2;

        if (col % 2 === 0) {
            for (let z = startZ; z <= endZ; z += 5) {
                path.push({ x: x + xOffset, z });
            }
            for (let z = endZ; z >= startZ; z -= 5) {
                path.push({ x: x - xOffset, z });
            }
        } else {
            for (let z = endZ; z >= startZ; z -= 5) {
                path.push({ x: x + xOffset, z });
            }
            for (let z = startZ; z <= endZ; z += 5) {
                path.push({ x: x - xOffset, z });
            }
        }
        paths.push(path);
    }

    return paths;
}

// ---- Vehicle dimensions by type ----
function getVehicleDims(type) {
    switch (type) {
        case "sedan":
            return { halfW: 0.9, halfD: 2.0, roofY: 1.4 }; // body 0.8 + cabin 0.6
        case "pickup":
            return { halfW: 1.15, halfD: 2.75, roofY: 1.7 };
        case "bus":
            return { halfW: 1.2, halfD: 4.0, roofY: 2.2 }; // body height 2.0 + offset
        default:
            return { halfW: 1.0, halfD: 2.0, roofY: 1.5 };
    }
}

/**
 * Returns the vehicle roof height if the player is above a vehicle at (x, z),
 * or 0 if not above any vehicle.
 */
export function getVehicleHeightAt(x, z) {
    let maxH = 0;
    for (const box of vehicleBoxes) {
        if (x >= box.xMin && x <= box.xMax &&
            z >= box.zMin && z <= box.zMax) {
            if (box.roofY > maxH) maxH = box.roofY;
        }
    }
    return maxH;
}

/**
 * Check collision of a circle (px, pz, radius) against all vehicles.
 * Returns push-out vector { x, z } or null if no collision.
 */
export function checkVehicleCollision(px, pz, radius, playerY) {
    let pushX = 0, pushZ = 0;
    let hit = false;
    for (const box of vehicleBoxes) {
        // Only collide if player is below the roof
        if (playerY >= box.roofY - 0.3) continue;

        const cx = Math.max(box.xMin, Math.min(px, box.xMax));
        const cz = Math.max(box.zMin, Math.min(pz, box.zMax));
        const ddx = px - cx;
        const ddz = pz - cz;
        const dist2 = ddx * ddx + ddz * ddz;
        const r2 = radius * radius;
        if (dist2 < r2 && dist2 > 0.0001) {
            const dist = Math.sqrt(dist2);
            const overlap = radius - dist;
            pushX += (ddx / dist) * overlap;
            pushZ += (ddz / dist) * overlap;
            hit = true;
        }
    }
    return hit ? { x: pushX, z: pushZ } : null;
}
