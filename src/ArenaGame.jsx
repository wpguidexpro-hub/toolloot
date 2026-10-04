import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const A="/assets/arena/";
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function normalize(obj,targetHeight=2){
  const box=new THREE.Box3().setFromObject(obj), size=box.getSize(new THREE.Vector3());
  const s=targetHeight/Math.max(size.y,.001); obj.scale.multiplyScalar(s);
  const b2=new THREE.Box3().setFromObject(obj); obj.position.y-=b2.min.y;
  return obj;
}

function ArenaGame({onBack}){
  const host=useRef(null), [cameraMode,setCameraMode]=useState("FPP"), [hp,setHp]=useState(100), [bossHp,setBossHp]=useState(100), [score,setScore]=useState(0), [started,setStarted]=useState(false);
  const state=useRef({mode:0,keys:{},yaw:0,pitch:-.08,pos:new THREE.Vector3(0,1.05,8),vel:new THREE.Vector3(),boss:new THREE.Vector3(0,1,0),shots:[],lastShot:0,lastHit:0,mobile:{x:0,y:0}});
  useEffect(()=>{
    const el=host.current;if(!el)return;
    const s=state.current, scene=new THREE.Scene();
    scene.background=new THREE.Color(0x151a22);
    scene.fog=new THREE.Fog(0x151a22,18,48);
    const camera=new THREE.PerspectiveCamera(68,1,.05,100);
    const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.shadowMap.enabled=false;
    el.replaceChildren(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xcfe7ff,0x33241c,2));
    const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(8,14,6);scene.add(sun);
    const fill=new THREE.PointLight(0xff5b35,18,20);fill.position.set(0,3,0);scene.add(fill);

    const loader=new GLTFLoader(), assets={};
    const load=(name,scale=1)=>new Promise((resolve,reject)=>loader.load(A+name,g=>{const o=normalize(g.scene,2);o.scale.multiplyScalar(scale);resolve(o)},undefined,reject));
    const arena=new THREE.Group();scene.add(arena);
    const clone=(o,p,rot=0,scale=1)=>{const x=o.clone(true);x.position.copy(p);x.rotation.y=rot;x.scale.multiplyScalar(scale);arena.add(x);return x};
    Promise.all(["floor.glb","wall.glb","wall-gate.glb","column.glb","tree.glb","soldier.glb","sword.glb","trophy.glb"].map((x,i)=>load(x,i===5?1:1))).then(([floor,wall,gate,column,tree,soldier,sword,trophy])=>{
      assets.soldier=soldier;assets.sword=sword;
      clone(floor,new THREE.Vector3(0,0,0),0,7);
      for(let x=-14;x<=14;x+=7){clone(wall,new THREE.Vector3(x,0,-13),0,3.2);clone(wall,new THREE.Vector3(x,0,13),Math.PI,3.2)}
      clone(gate,new THREE.Vector3(0,0,-13),0,3.2);
      for(const p of [[-12,0,-9],[12,0,-9],[-12,0,9],[12,0,9]]) clone(column,new THREE.Vector3(...p),0,2.2);
      for(const p of [[-10,0,-5],[10,0,-5],[-10,0,5],[10,0,5]]) clone(tree,new THREE.Vector3(...p),Math.random()*6,1.8);
      for(const p of [[-5,0,-9],[5,0,-9],[-7,0,8],[7,0,8]]) clone(trophy,new THREE.Vector3(...p),Math.random()*6,1.1);
      const player=clone(soldier,new THREE.Vector3(0,0,8),Math.PI,1);
      player.userData.player=true;
      const boss=clone(soldier,new THREE.Vector3(0,0,0),0,1.8);
      boss.userData.boss=true;
      const bossMat=[];boss.traverse(o=>{if(o.isMesh){o.material=o.material.clone();bossMat.push(o.material);}});
      boss.userData.mats=bossMat;
      const swordObj=clone(sword,new THREE.Vector3(0,1.2,7.2),0,1.2);
      swordObj.userData.weapon=true;
      scene.userData.player=player;scene.userData.boss=boss;scene.userData.sword=swordObj;
    }).catch(e=>console.error("Arena assets:",e));

    const floor=new THREE.Mesh(new THREE.CircleGeometry(11,48),new THREE.MeshBasicMaterial({color:0x27303a,transparent:true,opacity:.35}));
    floor.rotation.x=-Math.PI/2;floor.position.y=.02;scene.add(floor);

    const keys=s.keys, onKey=e=>{keys[e.code]=true;if(e.code==="KeyV"){s.mode=s.mode?0:1;setCameraMode(s.mode?"TPP":"FPP")}if(e.code==="Escape")document.exitPointerLock?.()}, offKey=e=>keys[e.code]=false;
    const onMouse=e=>{if(document.pointerLockElement===renderer.domElement){s.yaw-=e.movementX*.0025;s.pitch=clamp(s.pitch-e.movementY*.002,-1.15,1.15)}};
    const fire=()=>{if(!scene.userData.player||!started)return;const now=performance.now();if(now-s.lastShot<250)return;s.lastShot=now;const origin=s.pos.clone();origin.y+=.25;const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(s.pitch,s.yaw,0,"YXZ"));const m=new THREE.Mesh(new THREE.SphereGeometry(.11,8,8),new THREE.MeshBasicMaterial({color:0xffd34e}));m.position.copy(origin);scene.add(m);s.shots.push({m,dir,life:0})};
    const onPointer=()=>{setStarted(true);if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();else fire()};
    renderer.domElement.addEventListener("click",onPointer);
    renderer.domElement.addEventListener("mousedown",e=>{if(e.button===0)fire()});
    window.addEventListener("keydown",onKey);window.addEventListener("keyup",offKey);window.addEventListener("mousemove",onMouse);

    let raf,last=performance.now(),alive=true;
    const tick=now=>{
      if(!alive)return; const dt=Math.min((now-last)/1000,.033);last=now;
      if(started){
        const f=(keys.KeyW?1:0)-(keys.KeyS?1:0), r=(keys.KeyD?1:0)-(keys.KeyA?1:0);
        let mx=r+ s.mobile.x, mz=f- s.mobile.y;const len=Math.hypot(mx,mz);if(len){mx/=len;mz/=len;const sp=5.2;const sy=Math.sin(s.yaw),cy=Math.cos(s.yaw);s.pos.x+=(mx*cy-mz*sy)*sp*dt;s.pos.z+=(mx*sy+mz*cy)*sp*dt}
        s.pos.x=clamp(s.pos.x,-10.5,10.5);s.pos.z=clamp(s.pos.z,-10.5,10.5);
        const boss=scene.userData.boss;if(boss){const dx=s.pos.x-boss.position.x,dz=s.pos.z-boss.position.z,d=Math.hypot(dx,dz);if(d>.1){boss.position.x+=(dx/d)*1.5*dt;boss.position.z+=(dz/d)*1.5*dt;boss.rotation.y=Math.atan2(dx,dz)}
          if(d<1.8&&now-s.lastHit>800){s.lastHit=now;setHp(v=>Math.max(0,v-8))}
        }
        for(let i=s.shots.length-1;i>=0;i--){const q=s.shots[i];q.m.position.addScaledVector(q.dir,15*dt);q.life+=dt;const b=scene.userData.boss;if(b&&q.m.position.distanceTo(b.position)<1.8){setBossHp(v=>Math.max(0,v-10));setScore(v=>v+10);scene.remove(q.m);s.shots.splice(i,1);continue}if(q.life>2){scene.remove(q.m);s.shots.splice(i,1)}}
        const p=scene.userData.player;if(p){p.position.copy(s.pos);p.rotation.y=s.yaw}
        const sword=scene.userData.sword;if(sword){sword.visible=true;sword.rotation.y=s.yaw; sword.position.set(s.pos.x+.55,s.pos.y+.2,s.pos.z-.35)}
        const b=scene.userData.boss;if(b&&b.userData.mats){const rage=bossHp<45;for(const m of b.userData.mats)m.emissive?.setHex(rage?0x661100:0x220000)}
        if(s.mode===0){camera.position.set(s.pos.x,s.pos.y+1.05,s.pos.z);camera.rotation.order="YXZ";camera.rotation.y=s.yaw;camera.rotation.x=s.pitch}
        else{const target=s.pos.clone();target.y+=1.1;const d=5.5;const back=new THREE.Vector3(Math.sin(s.yaw)*d,2.1,Math.cos(s.yaw)*d);camera.position.lerp(target.clone().add(back),.18);camera.lookAt(target)}
      }
      renderer.render(scene,camera);raf=requestAnimationFrame(tick)
    };
    raf=requestAnimationFrame(tick);
    const resize=()=>{const w=el.clientWidth||800,h=el.clientHeight||500;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};window.addEventListener("resize",resize);resize();
    return()=>{alive=false;cancelAnimationFrame(raf);renderer.dispose();window.removeEventListener("keydown",onKey);window.removeEventListener("keyup",offKey);window.removeEventListener("mousemove",onMouse);el.replaceChildren()};
  },[started]);

  const joystickStart=e=>{e.preventDefault();const t=e.touches?.[0];if(!t)return;const move=e2=>{const q=e2.touches[0],r=e.currentTarget.getBoundingClientRect(),x=clamp((q.clientX-(r.left+r.width/2))/(r.width/2),-1,1),y=clamp((q.clientY-(r.top+r.height/2))/(r.height/2),-1,1);state.current.mobile.x=x;state.current.mobile.y=y};const end=()=>{state.current.mobile.x=0;state.current.mobile.y=0;window.removeEventListener("touchmove",move);window.removeEventListener("touchend",end)};window.addEventListener("touchmove",move,{passive:false});window.addEventListener("touchend",end)};
  return <div className="arenaGame"><div ref={host} className="arenaCanvas"/><div className="arenaHud"><div><b>ASTRA ARENA</b><span>3D BOSS BATTLE</span></div><button onClick={onBack}>EXIT</button></div><div className="bossBar"><span>BOSS • IRON GUARDIAN</span><div><i style={{width:bossHp+"%"}}/></div></div><div className="playerBar"><span>HP {hp}</span><div><i style={{width:hp+"%"}}/></div><b>SCORE {score}</b></div><div className="reticle">+</div><div className="arenaHelp">{started?"WASD MOVE • MOUSE AIM • CLICK ATTACK • V CAMERA":"CLICK / TAP TO START • WASD + MOUSE • V = TPP"}</div><div className="touchControls"><div className="joy" onTouchStart={joystickStart}><span/></div><button className="fire" onTouchStart={e=>{e.preventDefault();setStarted(true)}}>⚔</button><button className="camBtn" onClick={()=>{state.current.mode=state.current.mode?0:1;setCameraMode(state.current.mode?"TPP":"FPP")}}>{cameraMode}</button></div></div>;
}
export default ArenaGame;
