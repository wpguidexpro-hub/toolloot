import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Gamepad2, Keyboard, Trophy, Play, CircleDot } from "lucide-react";
import "./chat.css";

function DemoGame({onBack}){
 const canvas=useRef(null),keys=useRef({}),score=useRef(0),[ui,setUi]=useState(0);
 useEffect(()=>{
  const c=canvas.current,ctx=c.getContext("2d"),k=keys.current;
  const down=e=>{k[e.key.toLowerCase()]=1};
  const up=e=>{k[e.key.toLowerCase()]=0};
  addEventListener("keydown",down);addEventListener("keyup",up);
  let x=80,y=160,cx=220,cy=120,raf,last=performance.now();
  const loop=t=>{
   const dt=Math.min(.04,(t-last)/1000);last=t;
   if(k.arrowleft||k.a)x-=150*dt;if(k.arrowright||k.d)x+=150*dt;
   if(k.arrowup||k.w)y-=150*dt;if(k.arrowdown||k.s)y+=150*dt;
   x=Math.max(14,Math.min(242,x));y=Math.max(14,Math.min(226,y));
   if(Math.hypot(x-cx,y-cy)<16){score.current++;setUi(score.current);cx=20+Math.random()*216;cy=20+Math.random()*196}
   ctx.imageSmoothingEnabled=false;ctx.fillStyle="#101820";ctx.fillRect(0,0,256,240);
   ctx.fillStyle="#172d22";for(let i=0;i<16;i++)ctx.fillRect(0,i*15,256,1);
   ctx.fillStyle="#2ec4b6";ctx.fillRect(cx-5,cy-5,10,10);
   ctx.fillStyle="#f7d154";ctx.fillRect(x-7,y-7,14,14);ctx.fillRect(x-4,y-11,8,4);
   ctx.fillStyle="#e9f5db";ctx.font="10px monospace";ctx.fillText("TOOLLOOT 8-BIT",8,12);ctx.fillText("SCORE "+score.current,190,12);
   raf=requestAnimationFrame(loop)
  };
  raf=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(raf);removeEventListener("keydown",down);removeEventListener("keyup",up)};
 },[]);
 return <div className="screenPage">
  <div className="screenTop"><button className="pixelBtn ghost" onClick={onBack}>← MENU</button><div className="cartName"><CircleDot size={14}/> TOOLLOOT 8-BIT</div><div className="scoreBadge"><Trophy size={13}/> {ui}</div></div>
  <div className="crtFrame demoFrame"><canvas ref={canvas} width="256" height="240"/></div>
  <div className="controls"><span><Keyboard/> WASD / ARROWS MOVE</span><span>COLLECT THE CORES</span></div>
  <div className="tinyNote">Original ToollooT 8-Bit game — no third-party ROM required.</div>
 </div>
}

function App(){
 const[view,setView]=useState("menu");
 if(view==="game")return <DemoGame onBack={()=>setView("menu")}/>;
 return <div className="nesApp">
  <header className="nesHeader"><div className="brand"><div className="brandMark"><Gamepad2/></div><div><b>TOOLLOOT</b><span>8-BIT ARCADE</span></div></div><div className="headerRight"><span className="statusDot"/> LOCAL MODE</div></header>
  <main className="launcher">
   <section className="hero"><div><p className="eyebrow">ORIGINAL TOOLLOOT GAME</p><h1>TOOLLOOT<br/><em>8-BIT.</em></h1><p className="heroText">A simple original retro game made for ToollooT. Play instantly on PC and mobile.</p><div className="heroActions"><button className="pixelBtn primary" onClick={()=>setView("game")}><Play/> PLAY GAME</button></div></div>
    <div className="consoleArt"><div className="console"><div className="slot"/><div className="led"/><div className="label">TOOLLOOT<br/><small>8-BIT SYSTEM</small></div><div className="vent">{Array.from({length:18},(_,i)=><i key={i}/>)}</div></div><div className="cartridge"><div>8-BIT</div><span>TOOLLOOT</span></div></div>
   </section>
   <section className="librarySection"><div className="sectionTitle"><div><p className="eyebrow">GAME LIBRARY</p><h2><Gamepad2/> ONLY GAME</h2></div></div>
    <div className="gameGrid"><button className="gameCard featured" onClick={()=>setView("game")}><div className="boxArt"><span>TL</span><b>8-BIT</b></div><div className="cardInfo"><strong>ToollooT 8-Bit</strong><small>ORIGINAL • PLAY NOW</small></div></button></div>
   </section>
   <section className="infoStrip"><div><Gamepad2/><b>PC + MOBILE</b><span>Keyboard and touch friendly.</span></div><div><Trophy/><b>HIGH SCORE</b><span>Collect cores and beat your score.</span></div></section>
  </main>
  <footer>TOOLLOOT 8-BIT • ORIGINAL GAME</footer>
 </div>
}
createRoot(document.getElementById("root")).render(<App/>);