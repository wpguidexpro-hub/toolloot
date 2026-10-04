import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Gamepad2, Keyboard, Trophy, Play, CircleDot, Maximize2 } from "lucide-react";
import "./chat.css";

function DemoGame(){
 const canvas=useRef(null), keys=useRef({}), state=useRef(null), [score,setScore]=useState(0), [balls,setBalls]=useState(0), [gameOver,setGameOver]=useState(false);
 useEffect(()=>{
  const c=canvas.current,ctx=c.getContext("2d"),k=keys.current;
  const resize=()=>{c.width=innerWidth;c.height=innerHeight};
  resize(); addEventListener("resize",resize);
  state.current={player:{x:innerWidth/2,y:innerHeight-70,w:54,h:26,speed:430},bullets:[],balls:[],particles:[],next:0,score:0,spawn:0,over:false};
  const s=state.current;
  const colors=["#ff4d6d","#ffd166","#06d6a0","#4cc9f0","#a855f7","#ff7b00","#f72585","#90be6d"];
  const down=e=>{if(["ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();k[e.key.toLowerCase()]=true;if(e.code==="Space"&&!s.over)shoot()};
  const up=e=>{k[e.key.toLowerCase()]=false};
  const shoot=()=>{if(s.over)return;s.bullets.push({x:s.player.x,y:s.player.y-18,r:4,vy:-720});};
  addEventListener("keydown",down);addEventListener("keyup",up);
  const touchStart=dir=>{k[dir]=true}; const touchEnd=dir=>{k[dir]=false};
  const spawnBall=()=>{
   const r=14+Math.random()*34;
   const x=r+Math.random()*(c.width-r*2);
   s.balls.push({x,y:-r-4,r,color:colors[Math.floor(Math.random()*colors.length)],vy:80+Math.random()*100,vx:(Math.random()-.5)*120,bounces:0});
   s.next++;
   setBalls(s.next);
  };
  const restart=()=>{s.player.x=c.width/2;s.bullets=[];s.balls=[];s.particles=[];s.next=0;s.score=0;s.spawn=0;s.over=false;setScore(0);setBalls(0);setGameOver(false)};
  const full=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.()};
  let raf,last=performance.now();
  const loop=t=>{
   const dt=Math.min(.033,(t-last)/1000);last=t;
   if(!s.over){
    if(k.arrowleft)s.player.x-=s.player.speed*dt;
    if(k.arrowright)s.player.x+=s.player.speed*dt;
    s.player.x=Math.max(s.player.w/2+10,Math.min(c.width-s.player.w/2-10,s.player.x));
    s.spawn-=dt;if(s.spawn<=0){spawnBall();s.spawn=Math.max(.45,1.05-s.next*.012)}
    s.bullets.forEach(b=>b.y+=b.vy*dt);s.bullets=s.bullets.filter(b=>b.y>-20);
    s.balls.forEach(b=>{
      b.vy+=360*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx)}
      if(b.x+b.r>c.width){b.x=c.width-b.r;b.vx=-Math.abs(b.vx)}
      if(b.y+b.r>c.height-16){b.y=c.height-16-b.r;b.vy=-Math.abs(b.vy)*.88;b.bounces++;if(b.bounces>12)b.vy=-Math.abs(180+Math.random()*100)}
      if(b.y-b.r>c.height+50)s.over=true;
    });
    for(let i=s.balls.length-1;i>=0;i--){
     const b=s.balls[i];
     for(let j=s.bullets.length-1;j>=0;j--){
      const q=s.bullets[j],d=Math.hypot(q.x-b.x,q.y-b.y);
      if(d<b.r+q.r){
       s.balls.splice(i,1);s.bullets.splice(j,1);s.score+=Math.round(10+b.r);setScore(s.score);
       for(let n=0;n<10;n++)s.particles.push({x:b.x,y:b.y,vx:(Math.random()-.5)*260,vy:(Math.random()-.5)*260,life:.45,color:b.color});
       break;
      }
     }
    }
    const p=s.player;
    for(const b of s.balls){if(b.x>p.x-p.w/2&&b.x<p.x+p.w/2&&b.y+b.r>p.y-p.h/2&&b.y-b.r<p.y+p.h/2){s.over=true;break}}
   }
   s.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});s.particles=s.particles.filter(p=>p.life>0);
   ctx.imageSmoothingEnabled=false;
   ctx.fillStyle="#070b16";ctx.fillRect(0,0,c.width,c.height);
   const g=ctx.createLinearGradient(0,0,0,c.height);g.addColorStop(0,"#111a38");g.addColorStop(1,"#050711");ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);
   ctx.strokeStyle="rgba(90,120,190,.12)";ctx.lineWidth=1;for(let y=0;y<c.height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}
   s.balls.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fillStyle=b.color;ctx.fill();ctx.fillStyle="rgba(255,255,255,.35)";ctx.beginPath();ctx.arc(b.x-b.r*.32,b.y-b.r*.35,b.r*.22,0,Math.PI*2);ctx.fill();});
   s.bullets.forEach(b=>{ctx.fillStyle="#fff7a8";ctx.fillRect(b.x-2,b.y-12,4,18)});
   s.particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/.45);ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,5,5)});ctx.globalAlpha=1;
   const p=s.player;ctx.fillStyle="#2ec4b6";ctx.fillRect(p.x-p.w/2,p.y-p.h/2,p.w,p.h);ctx.fillStyle="#eaffff";ctx.fillRect(p.x-10,p.y-8,20,6);ctx.fillStyle="#10242a";ctx.fillRect(p.x-5,p.y-5,10,3);
   ctx.fillStyle="#fff";ctx.font="bold 18px monospace";ctx.fillText("TOOLLOOT 8-BIT",24,34);ctx.fillText("SCORE "+s.score,24,60);ctx.textAlign="right";ctx.fillText("BALLS "+s.next,c.width-24,34);ctx.textAlign="left";
   if(s.over){ctx.fillStyle="rgba(0,0,0,.72)";ctx.fillRect(0,0,c.width,c.height);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="bold 42px monospace";ctx.fillText("GAME OVER",c.width/2,c.height/2-25);ctx.font="18px monospace";ctx.fillText("SPACE = SHOOT",c.width/2,c.height/2+15);ctx.fillText("PRESS RESTART",c.width/2,c.height/2+45);ctx.textAlign="left"}
   raf=requestAnimationFrame(loop);
  };
  raf=requestAnimationFrame(loop);
  window.toollootGame={touchStart,touchEnd,shoot,restart,full};
  return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("keydown",down);removeEventListener("keyup",up);delete window.toollootGame};
 },[]);
 const btn=(label,dir)=> <button className="gameTouch" onPointerDown={e=>{e.preventDefault();window.toollootGame?.touchStart(dir)}} onPointerUp={()=>window.toollootGame?.touchEnd(dir)} onPointerCancel={()=>window.toollootGame?.touchEnd(dir)}>{label}</button>;
 return <div className="gameFullscreen">
  <canvas ref={canvas}/>
  <div className="gameUI"><button className="gameIcon" onClick={()=>window.toollootGame?.full()}><Maximize2/></button><button className="gameRestart" onClick={()=>window.toollootGame?.restart()}>RESTART</button></div>
  <div className="mobileControls"><div>{btn("◀","arrowleft")}{btn("▶","arrowright")}</div><button className="shootBtn" onPointerDown={e=>{e.preventDefault();window.toollootGame?.shoot()}}>SHOOT<br/><small>SPACE</small></button></div>
  <div className="gameHelp"><Keyboard/> ← LEFT &nbsp; → RIGHT &nbsp; <b>SPACE</b> SHOOT</div>
 </div>;
}

function App(){
 const[view,setView]=useState("menu");
 if(view==="game")return <DemoGame/>;
 return <div className="nesApp">
  <header className="nesHeader"><div className="brand"><div className="brandMark"><Gamepad2/></div><div><b>TOOLLOOT</b><span>8-BIT ARCADE</span></div></div><div className="headerRight"><span className="statusDot"/> LOCAL MODE</div></header>
  <main className="launcher">
   <section className="hero"><div><p className="eyebrow">ORIGINAL TOOLLOOT GAME</p><h1>TOOLLOOT<br/><em>8-BIT.</em></h1><p className="heroText">Fullscreen arcade shooter. Move only left and right, shoot with SPACE, and destroy colorful bouncing spheres.</p><div className="heroActions"><button className="pixelBtn primary" onClick={()=>setView("game")}><Play/> PLAY GAME</button></div></div>
    <div className="consoleArt"><div className="console"><div className="slot"/><div className="led"/><div className="label">TOOLLOOT<br/><small>8-BIT SYSTEM</small></div><div className="vent">{Array.from({length:18},(_,i)=><i key={i}/>)}</div></div><div className="cartridge"><div>8-BIT</div><span>TOOLLOOT</span></div></div>
   </section>
   <section className="librarySection"><div className="sectionTitle"><div><p className="eyebrow">GAME LIBRARY</p><h2><Gamepad2/> ONLY GAME</h2></div></div>
    <div className="gameGrid"><button className="gameCard featured" onClick={()=>setView("game")}><div className="boxArt"><span>TL</span><b>8-BIT</b></div><div className="cardInfo"><strong>ToollooT 8-Bit</strong><small>ORIGINAL • PLAY NOW</small></div></button></div>
   </section>
  </main><footer>TOOLLOOT 8-BIT • ORIGINAL GAME</footer>
 </div>
}
createRoot(document.getElementById("root")).render(<App/>);