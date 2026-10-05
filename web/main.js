import * as THREE from "three";
import {GLTFLoader} from "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/loaders/GLTFLoader.js";

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8fa0a8);
scene.fog=new THREE.Fog(0x8fa0a8,45,180);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,300);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xddeeff,0x35402f,2.2));
const sun=new THREE.DirectionalLight(0xffffff,3);
sun.position.set(40,70,25);sun.castShadow=true;scene.add(sun);

const statusEl=document.getElementById("status");
function status(t){if(statusEl)statusEl.textContent=t;}

const loader=new GLTFLoader();
const root=new THREE.Group();scene.add(root);

loader.load("https://cdn.3dassets.dev/assets/28276/v1/model.glb",g=>{
 g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 root.add(g.scene);
 status("READY — CLICK TO AIM");
},undefined,e=>{console.error("STARTER SCENE LOAD FAILED",e);status("SCENE LOAD FAILED");});

status("LOADING REAL 3D ASSETS…");

const me={x:0,z:0,yaw:0,pitch:0,hp:100};
const keys={};
let locked=false,lastShot=0;
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

let lastFrame=performance.now();
function loop(){requestAnimationFrame(loop);const now=performance.now();const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;update();if(typeof updateBattle==="function")updateBattle(dt);renderer.render(scene,camera)}

addEventListener("resize",()=>{
 camera.aspect=innerWidth/innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});


// ===== BATTLE-ROYALE GAMEPLAY: SAFE ZONE + BOTS + COMBAT =====
const arenaCenter=new THREE.Vector3(0,0,0);
let zoneRadius=58;
const zoneMinRadius=10;
let zoneTimer=90;
let zonePhase=0;

const zoneMat=new THREE.MeshBasicMaterial({color:0x35a7ff,transparent:true,opacity:.9});
const zoneRing=new THREE.Mesh(new THREE.RingGeometry(zoneRadius-.10,zoneRadius+.10,96),zoneMat);
zoneRing.rotation.x=-Math.PI/2;
zoneRing.position.y=.035;
scene.add(zoneRing);

const zoneFill=new THREE.Mesh(
 new THREE.CircleGeometry(zoneRadius,96),
 new THREE.MeshBasicMaterial({color:0x3b8cff,transparent:true,opacity:.025,side:THREE.DoubleSide})
);
zoneFill.rotation.x=-Math.PI/2; zoneFill.position.y=.02; scene.add(zoneFill);

const bots=[];
let kills=0;
let ammo=30,maxAmmo=30,reloading=false,reloadAt=0;
const botPositions=[[18,-8],[-22,-12],[25,18],[-28,22],[5,30],[-35,-30]];
function makeBot(i){
 const g=new THREE.Group();
 g.position.set(botPositions[i][0],0,botPositions[i][1]);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,1.0,5,8),new THREE.MeshStandardMaterial({color:0x8b2635}));
 body.position.y=1; body.castShadow=true; g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),new THREE.MeshStandardMaterial({color:0xc58d6d}));
 head.position.y=1.78; head.castShadow=true; g.add(head);
 const gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.72),new THREE.MeshStandardMaterial({color:0x222222}));
 gun.position.set(.38,1.18,-.32); gun.rotation.x=-.15; g.add(gun);
 g.userData={hp:100,alive:true,shootCd:1.2+i*.3,wander:i*.9};
 scene.add(g); bots.push(g);
}
for(let i=0;i<botPositions.length;i++)makeBot(i);

function hudExtra(){
 const h=document.getElementById("hud");
 if(!h)return;
 const add=(id,text)=>{let e=document.getElementById(id);if(!e){e=document.createElement("span");e.id=id;h.appendChild(e)}e.textContent=text};
 add("ammoHud",`AMMO: ${ammo}/${maxAmmo}`);
 add("zoneHud",`ZONE: ${Math.ceil(zoneTimer)}s`);
 add("killHud",`KILLS: ${kills}`);
 add("botHud",`ENEMIES: ${bots.filter(b=>b.userData.alive).length}`);
}
hudExtra();

function reload(){
 if(reloading||ammo===maxAmmo)return;
 reloading=true; reloadAt=performance.now()+1400;
 status("RELOADING…");
}
function damageMe(amount){
 me.hp=Math.max(0,me.hp-amount);
 const hp=document.getElementById("hp"); if(hp)hp.textContent=Math.ceil(me.hp);
 if(me.hp<=0){status("YOU DIED — PRESS R TO RESTART");locked=false}
}
function restartPlayer(){
 me.x=0;me.z=0;me.hp=100;kills=0;ammo=maxAmmo;reloading=false;
 bots.forEach((b,i)=>{b.visible=true;b.userData.alive=true;b.userData.hp=100;b.position.set(botPositions[i][0],0,botPositions[i][1])});
}
addEventListener("keydown",e=>{if(e.code==="KeyR"){if(me.hp<=0)restartPlayer();else reload()}});
function hitBots(){
 const origin=camera.getWorldPosition(new THREE.Vector3());
 const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
 let best=null,bestDist=Infinity;
 bots.forEach(b=>{
  if(!b.userData.alive)return;
  const target=new THREE.Vector3(b.position.x,1.15,b.position.z);
  const to=target.sub(origin); const dist=to.length();
  if(dist>65)return;
  const angle=dir.angleTo(to.normalize());
  if(angle<.065 && dist<bestDist){best=b;bestDist=dist}
 });
 if(best){
  best.userData.hp-=34;
  if(best.userData.hp<=0){
   best.userData.alive=false; best.visible=false; kills++;
   status("ENEMY ELIMINATED!");
  } else status("HIT!");
 }
}
const oldShoot=shoot;
shoot=function(){
 if(me.hp<=0||reloading)return;
 if(ammo<=0){reload();return}
 ammo--; oldShoot(); hitBots(); hudExtra();
};

function updateBattle(dt){
 if(me.hp<=0)return;
 if(reloading && performance.now()>=reloadAt){ammo=maxAmmo;reloading=false;status("READY");}
 // shrink the safe zone in stages
 zoneTimer-=dt;
 if(zoneTimer<=0 && zoneRadius>zoneMinRadius){
  zoneRadius=Math.max(zoneMinRadius,zoneRadius-8);
  zoneTimer=45; zonePhase++;
  zoneRing.geometry.dispose(); zoneRing.geometry=new THREE.RingGeometry(zoneRadius-.10,zoneRadius+.10,96);
  zoneFill.geometry.dispose(); zoneFill.geometry=new THREE.CircleGeometry(zoneRadius,96);
 }
 zoneRing.rotation.z+=dt*.12;
 zoneFill.scale.setScalar(1);
 zoneRing.position.set(arenaCenter.x,.035,arenaCenter.z);
 zoneFill.position.set(arenaCenter.x,.02,arenaCenter.z);

 const d=Math.hypot(me.x-arenaCenter.x,me.z-arenaCenter.z);
 if(d>zoneRadius)damageMe(7*dt);

 bots.forEach((b,i)=>{
  if(!b.userData.alive)return;
  const dx=me.x-b.position.x,dz=me.z-b.position.z,dist=Math.hypot(dx,dz);
  b.userData.wander+=dt;
  if(dist<34){
   const step=dt*(dist>11?1.8:0);
   b.position.x+=(dx/dist||0)*step;
   b.position.z+=(dz/dist||0)*step;
   b.rotation.y=Math.atan2(dx,dz);
   b.userData.shootCd-=dt;
   if(dist<28 && b.userData.shootCd<=0){
    b.userData.shootCd=1.4+i*.18;
    damageMe(4+Math.random()*4);
   }
  } else {
   b.position.x+=Math.sin(b.userData.wander+i)*dt*.7;
   b.position.z+=Math.cos(b.userData.wander*.8+i)*dt*.7;
  }
  b.position.x=THREE.MathUtils.clamp(b.position.x,-60,60);
  b.position.z=THREE.MathUtils.clamp(b.position.z,-60,60);
 });
 hudExtra();
}


// Start the render loop only after all battle variables/functions are initialized.
loop();
