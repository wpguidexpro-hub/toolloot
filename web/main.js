import * as THREE from "three";
import {GLTFLoader} from "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/loaders/GLTFLoader.js";

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8fa0a8);
scene.fog=new THREE.Fog(0x8fa0a8,45,180);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,300);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
status("LOADING REAL 3D ASSETS…");
renderer.shadowMap.enabled=true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xddeeff,0x35402f,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3);
sun.position.set(40,70,25);sun.castShadow=true;scene.add(sun);

const loader=new GLTFLoader();
const root=new THREE.Group();scene.add(root);

loader.load("https://cdn.3dassets.dev/assets/28276/v1/model.glb",g=>{
 g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 root.add(g.scene);
 status("READY — CLICK TO AIM");
},undefined,e=>{console.error("STARTER SCENE LOAD FAILED",e);status("SCENE LOAD FAILED");});

const me={x:0,z:0,yaw:0,pitch:0,hp:100};
const keys={};
let locked=false,lastShot=0;
const statusEl=document.getElementById("status");
function status(t){if(statusEl)statusEl.textContent=t;}

function loadAsset(url,pos,scale=1,rotY=0,parent=scene){
 loader.load(url,g=>{
   const m=g.scene;m.position.copy(pos);m.scale.setScalar(scale);m.rotation.y=rotY;
   m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
   parent.add(m);
 },undefined,e=>console.error("ASSET LOAD FAILED",url,e));
}

// Real posed enemy/operator asset. The pack is static, so it is used as a visible enemy until rigged player animation is added.
loadAsset("https://cdn.3dassets.dev/assets/28249/v1/model.glb",new THREE.Vector3(10,0,-6),1.05,Math.PI);

// Real vehicle
loadAsset("https://cdn.3dassets.dev/assets/28243/v1/model.glb",new THREE.Vector3(14,0,-10),.9,Math.PI/2);

// Real loot from the verified pack manifest.
const loot=[
 ["assault rifle","https://cdn.3dassets.dev/assets/28220/v1/model.glb",new THREE.Vector3(4,0,2),.8],
 ["armour plate","https://cdn.3dassets.dev/assets/28222/v1/model.glb",new THREE.Vector3(6,0,2),1.8],
 ["plate carrier","https://cdn.3dassets.dev/assets/28224/v1/model.glb",new THREE.Vector3(8,0,2),1.4],
 ["small backpack","https://cdn.3dassets.dev/assets/28223/v1/model.glb",new THREE.Vector3(10,0,2),1.2],
 ["large backpack","https://cdn.3dassets.dev/assets/28225/v1/model.glb",new THREE.Vector3(12,0,2),1.1],
 ["medkit","https://cdn.3dassets.dev/assets/28226/v1/model.glb",new THREE.Vector3(4,0,5),2.2],
 ["bandage","https://cdn.3dassets.dev/assets/28228/v1/model.glb",new THREE.Vector3(6,0,5),2.4],
 ["ammo","https://cdn.3dassets.dev/assets/28227/v1/model.glb",new THREE.Vector3(8,0,5),1.5],
 ["munitions crate","https://cdn.3dassets.dev/assets/28229/v1/model.glb",new THREE.Vector3(11,0,5),1]
];
loot.forEach(x=>loadAsset(x[1],x[2],x[3]));

const fppGroup=new THREE.Group();
let runTime=0;
camera.add(fppGroup);
scene.add(camera);

// Real Battle Rifle GLB held in FPP view.
loader.load("https://cdn.3dassets.dev/assets/28219/v1/model.glb",g=>{
 const gun=g.scene;
 gun.scale.setScalar(.42);
 gun.position.set(.34,-.30,-.62);
 gun.rotation.set(0,Math.PI,0);
 gun.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 fppGroup.add(gun);
 status("READY — FPP WEAPON LOADED");
},undefined,e=>{console.error("FPP GUN LOAD FAILED",e);status("WEAPON LOAD FAILED");});

const bullets=[];
function shoot(){
 const now=performance.now();
 if(now-lastShot<120)return;
 lastShot=now;
 const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
 const p=camera.getWorldPosition(new THREE.Vector3());
 const b=new THREE.Mesh(
   new THREE.SphereGeometry(.045,8,8),
   new THREE.MeshBasicMaterial({color:0xffd54a})
 );
 b.position.copy(p).addScaledVector(dir,.8);
 b.userData.velocity=dir.multiplyScalar(65);
 b.userData.life=1.4;
 scene.add(b);bullets.push(b);
}
addEventListener("mousedown",e=>{if(e.button===0){if(!locked)lockPointer();shoot()}});
addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Space")shoot()});
addEventListener("keyup",e=>keys[e.code]=false);

function lockPointer(){
 renderer.domElement.requestPointerLock?.();
 locked=true;
}
document.addEventListener("pointerlockchange",()=>locked=document.pointerLockElement===renderer.domElement);
document.addEventListener("mousemove",e=>{
 if(!locked)return;
 me.yaw-=e.movementX*.0025;
 me.pitch=THREE.MathUtils.clamp(me.pitch-e.movementY*.0022,-1.35,1.35);
});

function update(){
 const forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);
 const strafe=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
 const len=Math.hypot(forward,strafe)||1;
 const moving=!!(forward||strafe); const speed=moving?.105:.0; if(moving)runTime+=.16;
 const c=Math.cos(me.yaw),s=Math.sin(me.yaw);
 me.x+=((strafe/len)*c+(forward/len)*s)*speed;
 me.z+=((strafe/len)*-s+(forward/len)*c)*speed;
 me.x=THREE.MathUtils.clamp(me.x,-65,65);
 me.z=THREE.MathUtils.clamp(me.z,-65,65);

 camera.position.set(me.x,1.62,me.z);
 camera.rotation.order="YXZ";
 camera.rotation.y=me.yaw;
 camera.rotation.x=me.pitch;
 // weapon stays in the player hand area and bobs while running
 fppGroup.position.y=moving?Math.sin(runTime)*.018:0;
 fppGroup.position.x=moving?Math.sin(runTime*.5)*.012:0;
 fppGroup.rotation.z=moving?Math.sin(runTime)*.012:0;

 for(let i=bullets.length-1;i>=0;i--){
   const b=bullets[i];
   b.position.addScaledVector(b.userData.velocity,.016);
   b.userData.life-=.016;
   if(b.userData.life<=0){scene.remove(b);bullets.splice(i,1)}
 }
}

function loop(){requestAnimationFrame(loop);update();renderer.render(scene,camera)}
loop();

addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
