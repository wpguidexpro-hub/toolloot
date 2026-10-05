/* ========================================
   Pickups Module
   Metallic spheres: green (HP), brown (weapon),
   grey (ammo) spawned around the map
   ======================================== */

import { RANDOM_WEAPONS } from './weapons.js';
import { getCityBuildings } from './city.js';

// ---- Seeded PRNG (mulberry32) so every client generates identical
// pickup layouts and IDs — required for multiplayer pickup sync. ----
let _seed = 1337;
function rng() {
    _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const PICKUP_RADIUS = 0.4;
const COLLECT_DISTANCE = 2.0;
const RESPAWN_TIME = 15; // seconds
const FLOAT_ABOVE_GROUND = 0.9; // waist height above terrain
const BOB_AMPLITUDE = 0.15;
const BOB_SPEED = 2.0;
const ROTATE_SPEED = 1.5;

// Spawn config
const HP_SPHERE_COUNT = 8;
const WEAPON_SPHERE_COUNT = 20;
const AMMO_SPHERE_COUNT = 8;

export function createPickupSystem(scene, player, weapons, audioSystem, network, terrain, currentMap) {
    const pickups = new Map(); // id -> pickup object
    let nextId = 0;
    let time = 0;
    const worldSize = terrain ? terrain.worldSize : 200;

    // ---- Materials ----
    // Green (HP) — metallic green
    const greenMat = new BABYLON.StandardMaterial("pickupGreen", scene);
    greenMat.diffuseColor = new BABYLON.Color3(0.15, 0.7, 0.2);
    greenMat.specularColor = new BABYLON.Color3(0.6, 0.9, 0.6);
    greenMat.specularPower = 64;
    greenMat.emissiveColor = new BABYLON.Color3(0.03, 0.15, 0.04);

    // Brown (Weapon) — metallic brown/bronze
    const brownMat = new BABYLON.StandardMaterial("pickupBrown", scene);
    brownMat.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.12);
    brownMat.specularColor = new BABYLON.Color3(0.7, 0.5, 0.3);
    brownMat.specularPower = 64;
    brownMat.emissiveColor = new BABYLON.Color3(0.1, 0.06, 0.02);

    // Grey (Ammo) — metallic grey/silver
    const greyMat = new BABYLON.StandardMaterial("pickupGrey", scene);
    greyMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55);
    greyMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.85);
    greyMat.specularPower = 64;
    greyMat.emissiveColor = new BABYLON.Color3(0.06, 0.06, 0.07);

    // ---- Glow layer for subtle sphere glow ----
    let glowLayer = scene._glowLayer;
    if (!glowLayer) {
        glowLayer = new BABYLON.GlowLayer("pickupGlow", scene, {
            mainTextureFixedSize: 256,
            blurKernelSize: 32,
        });
        glowLayer.intensity = 0.5;
        scene._glowLayer = glowLayer;
    }

    // Map weapon keys to specific display names requested by user
    const WEAPON_LABELS = {
        "mw11": "Pistola: MW11",
        "m16": "Rifle: M16",
        "by15": "Escopeta: BY15",
        "rytec": "Sniper: Rytec AMR"
    };

    // ---- Spawn pickup ----
    function spawnPickup(type, x, z) {
        const id = nextId++;
        const mesh = BABYLON.MeshBuilder.CreateSphere("pickup_" + id, {
            diameter: PICKUP_RADIUS * 2,
            segments: 12,
        }, scene);

        // Get terrain height at this position
        let terrainY = 0;
        if (terrain && terrain.getHeightAtCoordinates) {
            try {
                terrainY = terrain.getHeightAtCoordinates(x, z) || 0;
            } catch (e) {
                terrainY = 0;
            }
        }
        const baseY = terrainY + FLOAT_ABOVE_GROUND;

        mesh.position.set(x, baseY, z);
        mesh.isPickable = false;

        let weaponKey = null;
        let labelMesh = null;

        switch (type) {
            case "hp":     mesh.material = greenMat; break;
            case "weapon":
                mesh.material = brownMat;
                // Assign specific weapon on spawn
                weaponKey = RANDOM_WEAPONS[Math.floor(rng() * RANDOM_WEAPONS.length)];
                // Create label
                labelMesh = createPickupLabel(mesh, WEAPON_LABELS[weaponKey]);
                break;
            case "ammo":   mesh.material = greyMat; break;
        }

        // Register with glow layer
        if (glowLayer) glowLayer.addIncludedOnlyMesh(mesh);

        const pickup = {
            id,
            type,
            mesh,
            labelMesh, // Store reference to label
            weaponKey, // Store assigned weapon
            baseX: x,
            baseZ: z,
            baseY: baseY,
            active: true,
            respawnTimer: 0,
            phaseOffset: rng() * Math.PI * 2,
        };

        pickups.set(id, pickup);
        return pickup;
    }

    // ---- Create floating label for pickup ----
    function createPickupLabel(parentMesh, text) {
        const planeWidth = 3;
        const planeHeight = 0.5;
        const plane = BABYLON.MeshBuilder.CreatePlane("label_" + parentMesh.name, {
            width: planeWidth,
            height: planeHeight,
        }, scene);

        plane.parent = parentMesh;
        plane.position.y = 0.8; // Floating above sphere
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; // Always face camera

        const dt = new BABYLON.DynamicTexture("dt_" + parentMesh.name, { width: 512, height: 128 }, scene);
        dt.hasAlpha = true;
        
        // Draw text
        const ctx = dt.getContext();
        ctx.clearRect(0, 0, 512, 128);
        ctx.font = "bold 60px monospace";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Text shadow
        ctx.shadowColor = "black";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        ctx.fillText(text, 256, 64);
        dt.update();

        const mat = new BABYLON.StandardMaterial("labelMat_" + parentMesh.name, scene);
        mat.diffuseTexture = dt;
        mat.emissiveColor = BABYLON.Color3.White();
        mat.disableLighting = true;
        mat.useAlphaFromDiffuseTexture = true;
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
        
        plane.material = mat;
        plane.isPickable = false;
        
        return plane;
    }

    // ---- Generate spawn positions ----
    function generateSpawnPositions(count) {
        const positions = [];
        const margin = 10;
        const half = worldSize / 2;

        if (currentMap === "city") {
            // For city: spawn only on roads (not inside buildings)
            const buildings = getCityBuildings();
            for (let i = 0; i < count * 5 && positions.length < count; i++) {
                const x = (rng() - 0.5) * (worldSize - margin * 2);
                const z = (rng() - 0.5) * (worldSize - margin * 2);
                // Check if inside any building footprint
                let insideBuilding = false;
                for (const b of buildings) {
                    if (x >= b.x - b.w / 2 - 1 && x <= b.x + b.w / 2 + 1 &&
                        z >= b.z - b.d / 2 - 1 && z <= b.z + b.d / 2 + 1) {
                        insideBuilding = true;
                        break;
                    }
                }
                if (!insideBuilding) {
                    positions.push({ x, z });
                }
            }
        } else {
            // Forest: random anywhere within map
            for (let i = 0; i < count; i++) {
                const x = (rng() - 0.5) * (worldSize - margin * 2);
                const z = (rng() - 0.5) * (worldSize - margin * 2);
                positions.push({ x, z });
            }
        }
        return positions;
    }

    // ---- Initialize pickups ----
    function init() {
        const hpPositions = generateSpawnPositions(HP_SPHERE_COUNT);
        const weaponPositions = generateSpawnPositions(WEAPON_SPHERE_COUNT);
        const ammoPositions = generateSpawnPositions(AMMO_SPHERE_COUNT);

        for (const p of hpPositions) spawnPickup("hp", p.x, p.z);
        for (const p of weaponPositions) spawnPickup("weapon", p.x, p.z);
        for (const p of ammoPositions) spawnPickup("ammo", p.x, p.z);
    }

    // ---- Collect a pickup ----
    function collectPickup(pickup) {
        if (!pickup.active) return;

        switch (pickup.type) {
            case "hp":
                if (player.hp >= player.maxHp) return; // Already full
                player.hp = Math.min(player.hp + 25, player.maxHp);
                break;

            case "weapon": {
                // Use the specifically assigned weapon key
                if (pickup.weaponKey) {
                    weapons.switchWeapon(pickup.weaponKey);
                }
                break;
            }

            case "ammo":
                if (weapons.currentWeaponDef.type === "melee") return; // Can't refill knife
                weapons.refillAmmo();
                break;
        }

        // Play pickup sound
        if (audioSystem) audioSystem.playPickupSound();

        // Deactivate
        pickup.active = false;
        pickup.mesh.setEnabled(false);
        if (pickup.labelMesh) pickup.labelMesh.setEnabled(false); // Hide label
        pickup.respawnTimer = RESPAWN_TIME;

        // Notify server
        if (network && network.connected) {
            network.send({ type: "pickupCollected", pickupId: pickup.id });
        }
    }

    // ---- Update ----
    function update(dt) {
        time += dt;

        const px = player.position.x;
        const pz = player.position.z;

        for (const [id, pickup] of pickups) {
            if (!pickup.active) {
                // Respawn timer
                pickup.respawnTimer -= dt;
                if (pickup.respawnTimer <= 0) {
                    // Respawn at a NEW random position (terrain-aware, map-aware)
                    const respawnPos = generateSpawnPositions(1);
                    const newX = respawnPos.length > 0 ? respawnPos[0].x : 0;
                    const newZ = respawnPos.length > 0 ? respawnPos[0].z : 0;
                    let newTerrainY = 0;
                    if (terrain && terrain.getHeightAtCoordinates) {
                        try {
                            newTerrainY = terrain.getHeightAtCoordinates(newX, newZ) || 0;
                        } catch (e) {
                            newTerrainY = 0;
                        }
                    }
                    pickup.baseX = newX;
                    pickup.baseZ = newZ;
                    pickup.baseY = newTerrainY + FLOAT_ABOVE_GROUND;
                    pickup.mesh.position.set(newX, pickup.baseY, newZ);

                    // If weapon, assign NEW random weapon and update label
                    if (pickup.type === "weapon") {
                         pickup.weaponKey = RANDOM_WEAPONS[Math.floor(rng() * RANDOM_WEAPONS.length)];
                         if (pickup.labelMesh && pickup.labelMesh.material && pickup.labelMesh.material.diffuseTexture) {
                             const dt = pickup.labelMesh.material.diffuseTexture;
                             const ctx = dt.getContext();
                             ctx.clearRect(0, 0, 512, 128);
                             ctx.fillStyle = "white";
                             ctx.shadowColor = "black";
                             ctx.shadowBlur = 10;
                             ctx.shadowOffsetX = 4;
                             ctx.shadowOffsetY = 4;
                             ctx.fillText(WEAPON_LABELS[pickup.weaponKey], 256, 64);
                             dt.update();
                         }
                    }

                    pickup.active = true;
                    pickup.mesh.setEnabled(true);
                    if (pickup.labelMesh) pickup.labelMesh.setEnabled(true);
                }
                continue;
            }

            // Animate: bob + rotate
            const phase = time * BOB_SPEED + pickup.phaseOffset;
            pickup.mesh.position.y = pickup.baseY + Math.sin(phase) * BOB_AMPLITUDE;
            pickup.mesh.rotation.y = time * ROTATE_SPEED + pickup.phaseOffset;

            // Check collection distance (squared, no sqrt needed)
            if (!player.alive) continue;
            const dx = px - pickup.baseX;
            const dz = pz - pickup.baseZ;
            const distSq = dx * dx + dz * dz;
            const collectDistSq = COLLECT_DISTANCE * COLLECT_DISTANCE;

            if (distSq < collectDistSq) {
                collectPickup(pickup);
            }
        }
    }

    // ---- Remote collection (from server message) ----
    function onRemoteCollect(pickupId) {
        const pickup = pickups.get(pickupId);
        if (pickup && pickup.active) {
            pickup.active = false;
            pickup.mesh.setEnabled(false);
            pickup.respawnTimer = RESPAWN_TIME;
        }
    }

    // Init on creation
    init();

    return {
        update,
        onRemoteCollect,
        get all() { return pickups; },
    };
}
