import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function shipMesh(color=0x54d8ff, scale=1){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.28,emissive:color,emissiveIntensity:.08});
  const dark=new THREE.MeshStandardMaterial({color:0x18283a,metalness:.8,roughness:.25});
  const body=new THREE.Mesh(new THREE.ConeGeometry(.72,2.7,6),mat); body.rotation.x=-Math.PI/2; g.add(body);
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.38,10,8),new THREE.MeshStandardMaterial({color:0x9ff4ff,metalness:.2,roughness:.08,emissive:0x168cff,emissiveIntensity:.45})); cockpit.position.z=-.18; g.add(cockpit);
  for(const x of [-.72,.72]){const w=new THREE.Mesh(new THREE.BoxGeometry(1.45,.12,.8),dark);w.position.set(x*.75,0,.45);w.rotation.z=x<0?-.18:.18;g.add(w)}
  for(const x of [-.34,.34]){const e=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),new THREE.MeshBasicMaterial({color:0xff8b35}));e.position.set(x,.02,1.18);g.add(e)}
  g.scale.setScalar(scale); return g;
}
function SpaceGame({onBack}){
 const mount=useRef(null), keys=useRef({}), pointer=useRef({x:0,y:0}), fire=useRef(false);
 const [hud,setHud]=useState({score:0,wave:1,hp:100,shield:100,cam:"TPP"});
 useEffect(()=>{
  const el=mount.current, scene=new THREE.Scene(); scene.background=new THREE.Color(0x02030b); scene.fog=new THREE.FogExp2(0x02030b,.006);
  const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.05,1200);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);el.appendChild(renderer.domElement);
  scene.add(new THREE.AmbientLight(0x6688aa,1.2)); const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(8,12,4);scene.add(sun);
  const starGeo=new THREE.BufferGeometry(), pos=new Float32Array(5000*3); for(let i=0;i<5000;i++){pos[i*3]=(Math.random()-.5)*900;pos[i*3+1]=(Math.random()-.5)*500;pos[i*3+2]=(Math.random()-.5)*900} starGeo.setAttribute("position",new THREE.BufferAttribute(pos,3));scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xffffff,size:.65,sizeAttenuation:true})));
  for(let i=0;i<4;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(18+Math.random()*18,16,10),new THREE.MeshStandardMaterial({color:[0x4d376d,0x254f72,0x704638,0x315b45][i],roughness:1}));p.position.set((Math.random()-.5)*500,(Math.random()-.5)*180,-250-i*110);scene.add(p); if(i===1){const r=new THREE.Mesh(new THREE.TorusGeometry(26,2,8,40),new THREE.MeshBasicMaterial({color:0xb99b68,transparent:true,opacity:.55}));r.rotation.x=Math.PI/2.8;r.position.copy(p.position);scene.add(r)}}
  const player=shipMesh(); player.position.set(0,0,8);scene.add(player);
  const ast=[], enemies=[], shots=[], particles=[];
  const makeAst=()=>{const o=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0x56616c,roughness:1}));o.scale.setScalar(1+Math.random()*2.5);o.position.set((Math.random()-.5)*55,(Math.random()-.5)*32,-35-Math.random()*120);o.userData={speed:8+Math.random()*15};scene.add(o);ast.push(o)};
  const makeEnemy=()=>{const o=shipMesh(0xff4f72,.8);o.rotation.y=Math.PI;o.position.set((Math.random()-.5)*50,(Math.random()-.5)*25,-65-Math.random()*80);o.userData={hp:3,speed:8+Math.random()*8};scene.add(o);enemies.push(o)};
  for(let i=0;i<32;i++)makeAst(); for(let i=0;i<5;i++)makeEnemy();
  const boom=(p)=>{for(let i=0;i<14;i++){const q=new THREE.Mesh(new THREE.SphereGeometry(.08,5,5),new THREE.MeshBasicMaterial({color:Math.random()>.5?0xffb52e:0xff4b35}));q.position.copy(p);q.userData={v:new THREE.Vector3((Math.random()-.5)*15,(Math.random()-.5)*15,(Math.random()-.5)*15),life:.55};scene.add(q);particles.push(q)}};
  const shoot=()=>{const s=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,3,6),new THREE.MeshBasicMaterial({color:0x72efff}));s.rotation.x=Math.PI/2;s.position.copy(player.position);s.position.z-=2;scene.add(s);shots.push(s)};
  let camMode=1,score=0,hp=100,shield=100,wave=1,last=performance.now(),shotClock=0,spawnClock=0,raf;
  const down=e=>{keys.current[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==="v"){camMode=camMode?0:1;setHud(h=>({...h,cam:camMode?"TPP":"FPP"}))}if(e.code==="Space")fire.current=true};
  const up=e=>{keys.current[e.key.toLowerCase()]=false;if(e.code==="Space")fire.current=false};
  const move=e=>{pointer.current.x=(e.clientX/innerWidth-.5)*2;pointer.current.y=(e.clientY/innerHeight-.5)*2};
  const click=()=>fire.current=true, release=()=>fire.current=false;
  addEventListener("keydown",down);addEventListener("keyup",up);addEventListener("mousemove",move);addEventListener("mousedown",click);addEventListener("mouseup",release);
  const loop=now=>{const dt=Math.min(.035,(now-last)/1000);last=now;
    const k=keys.current; const mx=(k.d||k.arrowright?1:0)-(k.a||k.arrowleft?1:0), my=(k.s||k.arrowdown?1:0)-(k.w||k.arrowup?1:0);
    player.position.x=clamp(player.position.x+mx*24*dt,-24,24);player.position.y=clamp(player.position.y-my*18*dt,-13,13);
    player.rotation.z=THREE.MathUtils.lerp(player.rotation.z,-mx*.35,.1);player.rotation.x=THREE.MathUtils.lerp(player.rotation.x,my*.18,.1);
    if(fire.current&&now-shotClock>145){shoot();shotClock=now}
    shots.forEach(s=>s.position.z-=80*dt);
    ast.forEach(o=>{o.position.z+=o.userData.speed*dt;o.rotation.x+=dt;o.rotation.y+=dt*.7;if(o.position.z>18){o.position.z=-130-Math.random()*50;o.position.x=(Math.random()-.5)*55;o.position.y=(Math.random()-.5)*32}});
    enemies.forEach(o=>{o.position.z+=o.userData.speed*dt;o.position.x+=Math.sin(now*.001+o.id)*dt*2;if(o.position.z>20){o.position.z=-100-Math.random()*80;o.userData.hp=3}});
    for(let i=shots.length-1;i>=0;i--){let hit=false;for(let j=enemies.length-1;j>=0;j--){if(shots[i].position.distanceTo(enemies[j].position)<1.5){enemies[j].userData.hp--;scene.remove(shots[i]);shots.splice(i,1);hit=true;if(enemies[j].userData.hp<=0){score+=100;boom(enemies[j].position);enemies[j].position.z=-120-Math.random()*80;enemies[j].userData.hp=3}break}}if(!hit&&shots[i]&&shots[i].position.z<-150){scene.remove(shots[i]);shots.splice(i,1)}}
    enemies.forEach(o=>{if(o.position.distanceTo(player.position)<2.2){shield-=18;o.position.z=-110-Math.random()*70;boom(player.position)}});ast.forEach(o=>{if(o.position.distanceTo(player.position)<2.3){hp-=12;o.position.z=-100-Math.random()*70;boom(player.position)}});
    particles.forEach((p,i)=>{p.position.addScaledVector(p.userData.v,dt);p.userData.life-=dt;p.scale.multiplyScalar(.94);if(p.userData.life<=0){scene.remove(p);particles.splice(i,1)}});
    spawnClock+=dt;if(spawnClock>10){wave++;spawnClock=0;for(let i=0;i<2;i++)makeEnemy()}
    shield=clamp(shield+12*dt,0,100); if(hp<=0){hp=100;shield=100;score=Math.max(0,score-250);boom(player.position)}
    if(camMode){const target=new THREE.Vector3(player.position.x*.35,player.position.y*.3,player.position.z+10);camera.position.lerp(new THREE.Vector3(player.position.x,player.position.y+3,player.position.z+11),.08);camera.lookAt(target)}else{camera.position.lerp(new THREE.Vector3(player.position.x,player.position.y+.35,player.position.z-1.3),.16);camera.lookAt(new THREE.Vector3(player.position.x+pointer.current.x*8,player.position.y-pointer.current.y*5,player.position.z-30))}
    setHud(h=>({...h,score,wave,hp:Math.round(hp),shield:Math.round(shield)}));renderer.render(scene,camera);raf=requestAnimationFrame(loop)};
  raf=requestAnimationFrame(loop);
  const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};addEventListener("resize",resize);
  return()=>{cancelAnimationFrame(raf);removeEventListener("keydown",down);removeEventListener("keyup",up);removeEventListener("mousemove",move);removeEventListener("mousedown",click);removeEventListener("mouseup",release);removeEventListener("resize",resize);renderer.dispose();el.innerHTML=""};
 },[]);
 return <div className="spaceGame"><div ref={mount} className="spaceCanvas"/><div className="spaceHud"><div><b>STARFALL</b><span>SPACE COMBAT // WAVE {hud.wave}</span></div><div className="spaceStats"><b>SCORE {hud.score.toString().padStart(6,"0")}</b><button onClick={onBack}>EXIT</button></div></div><div className="bars"><label>HULL {hud.hp}%<i><em style={{width:hud.hp+"%"}}/></i></label><label>SHIELD {hud.shield}%<i><em className="shieldFill" style={{width:hud.shield+"%"}}/></i></label></div><div className="crosshair">+</div><div className="spaceHelp">WASD / ARROWS • MOUSE AIM • CLICK / SPACE FIRE • V CAMERA: {hud.cam}</div><div className="touchSpace"><div className="touchPad" onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();keys.current.a=e.clientX<r.left+r.width/2-10;keys.current.d=e.clientX>r.left+r.width/2+10;keys.current.w=e.clientY<r.top+r.height/2-10;keys.current.s=e.clientY>r.top+r.height/2+10}}/><button onPointerDown={()=>fire.current=true} onPointerUp={()=>fire.current=false}>FIRE</button></div></div>
}
export default SpaceGame;
