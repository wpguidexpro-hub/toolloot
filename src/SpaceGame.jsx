import {useEffect,useRef,useState} from "react";
import * as THREE from "three";

const rnd=(a,b)=>a+Math.random()*(b-a);

export default function SpaceGame({onBack}){
  const ref=useRef(null), keys=useRef({});
  const [ui,setUi]=useState({score:0,best:+localStorage.getItem("slab_best")||0,over:false});
  useEffect(()=>{
    const el=ref.current, scene=new THREE.Scene();
    scene.background=new THREE.Color(0x050816);
    scene.fog=new THREE.Fog(0x050816,35,150);
    const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,300);
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight); el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0x8bdcff,0x16102b,2));
    const sun=new THREE.DirectionalLight(0xffffff,2.2); sun.position.set(4,10,8); scene.add(sun);

    const starsGeo=new THREE.BufferGeometry(), a=new Float32Array(3000);
    for(let i=0;i<1000;i++){a[i*3]=rnd(-80,80);a[i*3+1]=rnd(-45,55);a[i*3+2]=rnd(-150,40)}
    starsGeo.setAttribute("position",new THREE.BufferAttribute(a,3));
    scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xffffff,size:.55})));

    const player=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.48,1.05,5,10),new THREE.MeshStandardMaterial({color:0x42d9ff,metalness:.55,roughness:.25}));
    player.add(body);
    const visor=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),new THREE.MeshStandardMaterial({color:0x071b3b,emissive:0x168cff,emissiveIntensity:.8}));
    visor.position.set(0,.25,-.35); player.add(visor);
    for(const x of[-.34,.34]){const wing=new THREE.Mesh(new THREE.BoxGeometry(.55,.1,.7),new THREE.MeshStandardMaterial({color:0x8cf3ff,emissive:0x126b8c,emissiveIntensity:.35}));wing.position.set(x,-.15,.1);wing.rotation.z=x<0?-.35:.35;player.add(wing)}
    scene.add(player);

    const platforms=[];
    const makePlatform=(x,y,z,scale=1)=>{
      const g=new THREE.Group();
      const slab=new THREE.Mesh(new THREE.BoxGeometry(7*scale,.55,5*scale),new THREE.MeshStandardMaterial({color:0x253f62,metalness:.35,roughness:.55}));
      g.add(slab);
      const top=new THREE.Mesh(new THREE.BoxGeometry(6.5*scale,.08,4.5*scale),new THREE.MeshStandardMaterial({color:0x37c9e8,emissive:0x087b9a,emissiveIntensity:.45}));
      top.position.y=.31; g.add(top);
      g.position.set(x,y,z); scene.add(g); platforms.push(g); return g;
    };
    let px=0,py=0,pz=0;
    for(let i=0;i<18;i++){px=THREE.MathUtils.clamp(px+rnd(-5,5),-10,10);py=THREE.MathUtils.clamp(py+rnd(-2.5,2.8),-4,8);pz=-i*8;makePlatform(px,py,pz,i<2?1.15:1)}
    let nextZ=-144;

    const rings=[];
    const addRing=(p)=>{
      const r=new THREE.Mesh(new THREE.TorusGeometry(1.15,.13,8,24),new THREE.MeshStandardMaterial({color:0xffd34d,emissive:0xff9800,emissiveIntensity:.7}));
      r.position.set(p.position.x,p.position.y+1.5,p.position.z); scene.add(r); rings.push(r);
    };
    platforms.forEach((p,i)=>{if(i%2===0)addRing(p)});

    let vx=0,vy=0,vz=0,grounded=true,alive=true,score=0,camY=5;
    player.position.set(0,1.3,2.5);
    const kd=e=>{keys.current[e.key.toLowerCase()]=true;if(e.key===" "||e.key==="arrowup")e.preventDefault();};
    const ku=e=>keys.current[e.key.toLowerCase()]=false;
    addEventListener("keydown",kd);addEventListener("keyup",ku);

    const jump=()=>{if(grounded){vy=10.8;grounded=false}};
    const reset=()=>{location.reload()};

    let last=performance.now(),raf;
    const loop=t=>{
      const dt=Math.min(.033,(t-last)/1000);last=t;
      if(alive){
        const k=keys.current;
        const left=k.a||k.arrowleft,right=k.d||k.arrowright;
        if(left)vx-=22*dt;if(right)vx+=22*dt;vx*=Math.pow(.08,dt);
        if((k[" "]||k.w||k.arrowup)&&grounded)jump();
        player.position.x+=vx*dt;
        player.position.x=THREE.MathUtils.clamp(player.position.x,-15,15);
        vy-=22*dt; player.position.y+=vy*dt;
        const forward=28; player.position.z-=forward*dt;
        // recycle platforms behind the player to create an endless route
        platforms.forEach(p=>{
          if(p.position.z>player.position.z+18){
            p.position.z=nextZ; nextZ-=rnd(7,11);
            p.position.x=THREE.MathUtils.clamp(player.position.x+rnd(-7,7),-11,11);
            p.position.y=THREE.MathUtils.clamp(player.position.y+rnd(-3.5,3.5),-5,10);
            score+=10;
            if(Math.random()<.7)addRing(p);
          }
        });
        grounded=false;
        platforms.forEach(p=>{
          const dx=Math.abs(player.position.x-p.position.x),dz=Math.abs(player.position.z-p.position.z);
          const top=p.position.y+.58;
          if(dx<3.25 && dz<2.25 && vy<=0 && player.position.y>=top-.4 && player.position.y<=top+1.1){
            player.position.y=top;vy=0;grounded=true;
          }
        });
        rings.forEach(r=>{
          r.rotation.y+=dt*4;
          if(r.position.z>player.position.z+20){scene.remove(r);return}
          if(r.position.distanceTo(player.position)<1.5){score+=100;scene.remove(r);r.position.z=9999}
        });
        if(player.position.y<-12){alive=false;const best=Math.max(score,ui.best);localStorage.setItem("slab_best",best);setUi({score,best,over:true})}
        player.rotation.z=THREE.MathUtils.lerp(player.rotation.z,-vx*.045,.12);
        player.rotation.x=THREE.MathUtils.lerp(player.rotation.x,-vy*.025,.1);
        camera.position.x=THREE.MathUtils.lerp(camera.position.x,player.position.x*.55,.08);
        camera.position.y=THREE.MathUtils.lerp(camera.position.y,player.position.y+5,.08);
        camera.position.z=THREE.MathUtils.lerp(camera.position.z,player.position.z+17,.1);
        camera.lookAt(player.position.x,player.position.y,player.position.z-12);
        setUi(u=>({...u,score}));
      }
      renderer.render(scene,camera);raf=requestAnimationFrame(loop)
    };
    raf=requestAnimationFrame(loop);
    const rs=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)};
    addEventListener("resize",rs);
    return()=>{cancelAnimationFrame(raf);removeEventListener("keydown",kd);removeEventListener("keyup",ku);removeEventListener("resize",rs);renderer.dispose();el.innerHTML=""}
  },[]);
  return <div className="spaceGame">
    <div ref={ref} className="spaceCanvas"/>
    <div className="runnerTop"><div><b>SLAB FLY</b><span>JUMP • FLY • LAND • SURVIVE</span></div><button onClick={onBack}>EXIT</button></div>
    <div className="runnerStats"><strong>{ui.score.toString().padStart(6,"0")}</strong><span>BEST {ui.best}</span></div>
    <div className="runnerHint">A / D or ← / → MOVE &nbsp; • &nbsp; SPACE / ↑ JUMP</div>
    <div className="mobileRun">
      <button onPointerDown={()=>keys.current.a=true} onPointerUp={()=>keys.current.a=false} onPointerCancel={()=>keys.current.a=false}>◀</button>
      <button onPointerDown={()=>{keys.current[" "]=true}} onPointerUp={()=>{keys.current[" "]=false}}>JUMP</button>
      <button onPointerDown={()=>keys.current.d=true} onPointerUp={()=>keys.current.d=false}>▶</button>
    </div>
    {ui.over&&<div className="gameOver"><small>YOU FELL</small><h1>GAME OVER</h1><p>SCORE {ui.score} • BEST {ui.best}</p><button onClick={reset}>JUMP AGAIN</button></div>}
  </div>
}