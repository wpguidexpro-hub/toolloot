import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Gamepad2, Keyboard, Play, Maximize2 } from "lucide-react";
import "./chat.css";

function DemoGame(){
 const canvas=useRef(null),keys=useRef({}),state=useRef(null),[score,setScore]=useState(0),[balls,setBalls]=useState(0);
 useEffect(()=>{
  const c=canvas.current,ctx=c.getContext("2d"),k=keys.current;
  const resize=()=>{c.width=innerWidth;c.height=innerHeight}; resize();addEventListener("resize",resize);
  state.current={player:{x:innerWidth/2,y:innerHeight-70,w:64,h:30,speed:260},bullets:[],balls:[],powerups:[],particles:[],next:0,score:0,spawn:10,over:false,elapsed:0,level:1,drop:0,bulletPower:1,playerSpeedPower:1,ballSpeedPower:1};
  const s=state.current,colors=["#ff4d6d","#ffd166","#06d6a0","#4cc9f0","#a855f7","#ff7b00","#f72585","#90be6d"];
  const shoot=()=>{if(s.over)return;const count=s.bulletPower||1;for(let n=0;n<count;n++){const spread=(n-(count-1)/2)*14;s.bullets.push({x:s.player.x+spread,y:s.player.y-18,r:4,vy:-820,vx:spread*3})}};
  const down=e=>{if(["ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();k[e.key.toLowerCase()]=true;if(e.code==="Space"&&!e.repeat)shoot()};
  const up=e=>{k[e.key.toLowerCase()]=false};addEventListener("keydown",down);addEventListener("keyup",up);
  const touchStart=d=>k[d]=true,touchEnd=d=>k[d]=false;
  const spawnBall=()=>{const r=72+Math.random()*18,x=r+Math.random()*(c.width-r*2);s.balls.push({x,y:-r-8,r,color:colors[Math.floor(Math.random()*colors.length)],stage:5,vy:30+Math.random()*25,vx:(Math.random()-.5)*70,bounces:0,drop:2,special:s.next%3===2});s.next++};
  const spawnPower=(b)=>{const types=["B+","P+","SLOW","FAST"];const type=types[Math.floor(Math.random()*types.length)];s.powerups.push({x:b.x,y:b.y,r:13,type,vy:90,vx:(Math.random()-.5)*35,life:10})};
  const splitBall=(b,i)=>{
   if(b.r>24){
    const nr=b.r*.55,dx=160+b.r*1.5;
    s.balls.splice(i,1,{x:b.x-nr*.7,y:b.y,r:nr,color:b.color,vy:-Math.max(170,b.r*4),vx:-dx,bounces:0},{x:b.x+nr*.7,y:b.y,r:nr,color:b.color,vy:-Math.max(150,b.r*3.6),vx:dx,bounces:0});
    return 2;
   }
   s.balls.splice(i,1);return 0;
  };
  const restart=()=>{s.player.x=c.width/2;s.bullets=[];s.balls=[];s.powerups=[];s.particles=[];s.next=0;s.score=0;s.bulletPower=1;s.playerSpeedPower=1;s.ballSpeedPower=1;s.spawn=10;s.over=false;s.elapsed=0;s.level=1;s.drop=0;setScore(0);setBalls(0)};
  const full=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.()};
  let raf,last=performance.now();
  const loop=t=>{
   const dt=Math.min(.033,(t-last)/1000);last=t;
   if(!s.over){
    s.elapsed+=dt;
    s.level=1+Math.floor(s.elapsed/60);
    const speedScale=1+(s.level-1)*0.14;
    const moveSpeed=s.player.speed*(s.playerSpeedPower||1);if(k.arrowleft)s.player.x-=moveSpeed*dt;if(k.arrowright)s.player.x+=moveSpeed*dt;
    s.player.x=Math.max(s.player.w/2+10,Math.min(c.width-s.player.w/2-10,s.player.x));
    s.spawn-=dt;if(s.spawn<=0){spawnBall();s.spawn=10}
    s.bullets.forEach(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt});s.bullets=s.bullets.filter(b=>b.y>-30);
    s.balls.forEach(b=>{const bs=s.ballSpeedPower||1;if(b.drop>0){b.drop-=dt;b.vy=65*speedScale*bs}else b.vy+=210*speedScale*bs*dt;b.x+=b.vx*speedScale*bs*dt;b.y+=b.vy*dt;if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx)}if(b.x+b.r>c.width){b.x=c.width-b.r;b.vx=-Math.abs(b.vx)}if(b.y-b.r<70){b.y=70+b.r;b.vy=Math.abs(b.vy)}if(b.y+b.r>c.height-16){b.y=c.height-16-b.r;b.vy=-Math.max(420,Math.min(760,Math.abs(b.vy)*1.08*speedScale*bs));b.bounces++}});
    for(let i=s.balls.length-1;i>=0;i--){const b=s.balls[i];for(let j=s.bullets.length-1;j>=0;j--){const q=s.bullets[j];if(Math.hypot(q.x-b.x,q.y-b.y)<b.r+q.r){s.bullets.splice(j,1);const oldR=b.r, special=b.special, made=splitBall(b,i);if(special)spawnPower(b);s.score+=Math.round(oldR*2)+(made?20:60);setScore(s.score);for(let n=0;n<16;n++)s.particles.push({x:b.x,y:b.y,vx:(Math.random()-.5)*(180+oldR*3),vy:(Math.random()-.5)*(180+oldR*3),life:.5,color:b.color});break}}}
    s.powerups.forEach(pw=>{pw.x+=pw.vx*dt;pw.y+=pw.vy*dt;pw.life-=dt});s.powerups=s.powerups.filter(pw=>pw.life>0&&pw.y<c.height+30);const pp=s.player;for(let i=s.powerups.length-1;i>=0;i--){const pw=s.powerups[i];if(pw.x>pp.x-pp.w/2&&pw.x<pp.x+pp.w/2&&pw.y+pw.r>pp.y-pp.h/2&&pw.y-pw.r<pp.y+pp.h/2){if(pw.type==="B+")s.bulletPower=Math.min(4,(s.bulletPower||1)+1);if(pw.type==="P+")s.playerSpeedPower=Math.min(1.8,(s.playerSpeedPower||1)+0.25);if(pw.type==="SLOW")s.ballSpeedPower=Math.max(0.55,(s.ballSpeedPower||1)-0.2);if(pw.type==="FAST")s.ballSpeedPower=Math.min(1.7,(s.ballSpeedPower||1)+0.2);s.score+=100;setScore(s.score);s.powerups.splice(i,1)}}
   const p=s.player;for(const b of s.balls)if(b.x>p.x-p.w/2&&b.x<p.x+p.w/2&&b.y+b.r>p.y-p.h/2&&b.y-b.r<p.y+p.h/2){s.over=true;break}
   }
   s.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});s.particles=s.particles.filter(p=>p.life>0);
   ctx.imageSmoothingEnabled=false;ctx.fillStyle="#070b16";ctx.fillRect(0,0,c.width,c.height);const g=ctx.createLinearGradient(0,0,0,c.height);g.addColorStop(0,"#111a38");g.addColorStop(1,"#050711");ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);
   ctx.strokeStyle="rgba(90,120,190,.12)";for(let y=0;y<c.height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}
   for(let i=0;i<55;i++){const sx=(i*173)%c.width,sy=(i*97)%Math.max(120,c.height);ctx.fillStyle=i%4===0?"#ffffff":"#5f78a8";ctx.fillRect(sx,sy,2,2)}
   s.powerups.forEach(pw=>{ctx.save();ctx.translate(Math.round(pw.x),Math.round(pw.y));ctx.fillStyle="#111827";ctx.fillRect(-16,-16,32,32);ctx.strokeStyle=pw.type==="SLOW"?"#4cc9f0":pw.type==="FAST"?"#ff4d6d":"#ffd166";ctx.lineWidth=4;ctx.strokeRect(-14,-14,28,28);ctx.fillStyle="#fff";ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.fillText(pw.type,0,3);ctx.restore()});s.balls.forEach(b=>{ctx.save();ctx.translate(Math.round(b.x),Math.round(b.y));ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fillStyle="#0b1020";ctx.fill();ctx.lineWidth=7;ctx.strokeStyle=b.color;ctx.stroke();ctx.beginPath();ctx.arc(0,0,b.r*.68,0,Math.PI*2);ctx.lineWidth=3;ctx.strokeStyle="rgba(255,255,255,.38)";ctx.stroke();ctx.fillStyle="rgba(255,255,255,.55)";ctx.fillRect(-b.r*.38,-b.r*.42,Math.max(5,b.r*.18),Math.max(5,b.r*.12));ctx.fillStyle=b.color;ctx.fillRect(-b.r*.12,-b.r*.1,Math.max(4,b.r*.22),Math.max(4,b.r*.22));ctx.restore()});
   s.bullets.forEach(b=>{ctx.fillStyle="#fff7a8";ctx.fillRect(b.x-2,b.y-12,4,18)});s.particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/.5);ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,5,5)});ctx.globalAlpha=1;
   const p=s.player;ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.fillStyle="#111827";ctx.fillRect(-34,-16,68,32);ctx.fillStyle="#22d3ee";ctx.fillRect(-29,-12,58,24);ctx.fillStyle="#67e8f9";ctx.fillRect(-20,-8,40,8);ctx.fillStyle="#0f172a";ctx.fillRect(-8,-5,16,6);ctx.fillStyle="#facc15";ctx.fillRect(-25,11,14,5);ctx.fillRect(11,11,14,5);ctx.fillStyle="#fb7185";ctx.fillRect(-5,-16,10,6);ctx.restore();
   ctx.fillStyle="#fff";ctx.font="bold 18px monospace";ctx.fillText("TOOLLOOT 8-BIT",24,34);ctx.fillText("SCORE "+s.score,24,60);ctx.textAlign="right";ctx.fillText("BALLS "+s.balls.length,c.width-24,34);ctx.fillText("LEVEL "+s.level,c.width-24,60);ctx.textAlign="left";ctx.fillStyle="#ffd166";ctx.font="bold 14px monospace";ctx.fillText("POWERS: B+ BULLETS • P+ PLAYER • SLOW/FAST BALL",24,84);ctx.textAlign="left";
   if(s.over){ctx.fillStyle="rgba(0,0,0,.72)";ctx.fillRect(0,0,c.width,c.height);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="bold 42px monospace";ctx.fillText("GAME OVER",c.width/2,c.height/2-25);ctx.font="18px monospace";ctx.fillText("SPACE = SHOOT",c.width/2,c.height/2+15);ctx.fillText("PRESS RESTART",c.width/2,c.height/2+45);ctx.textAlign="left"}
   raf=requestAnimationFrame(loop)
  };
  raf=requestAnimationFrame(loop);window.toollootGame={touchStart,touchEnd,shoot,restart,full};
  return()=>{cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("keydown",down);removeEventListener("keyup",up);delete window.toollootGame};
 },[]);
 const btn=(label,dir)=><button className="gameTouch" onPointerDown={e=>{e.preventDefault();window.toollootGame?.touchStart(dir)}} onPointerUp={()=>window.toollootGame?.touchEnd(dir)} onPointerCancel={()=>window.toollootGame?.touchEnd(dir)}>{label}</button>;
 return <div className="gameFullscreen" onPointerDown={e=>{if(e.target===e.currentTarget)window.toollootGame?.shoot()}}><canvas ref={canvas}/><div className="gameUI"><button className="gameIcon" onClick={()=>window.toollootGame?.full()}><Maximize2/></button><button className="gameRestart" onClick={()=>window.toollootGame?.restart()}>RESTART</button></div><div className="mobileControls"><div>{btn("◀","arrowleft")}{btn("▶","arrowright")}</div><button className="shootBtn" onPointerDown={e=>{e.preventDefault();window.toollootGame?.shoot()}}>SHOOT<br/><small>SPACE</small></button></div><div className="gameHelp"><Keyboard/> ← LEFT &nbsp; → RIGHT &nbsp; <b>SPACE</b> SHOOT</div></div>;
}
function App(){const[view,setView]=useState("menu");if(view==="game")return <DemoGame/>;return <div className="nesApp"><header className="nesHeader"><div className="brand"><div className="brandMark"><Gamepad2/></div><div><b>TOOLLOOT</b><span>8-BIT ARCADE</span></div></div><div className="headerRight"><span className="statusDot"/> LOCAL MODE</div></header><main className="launcher"><section className="hero"><div><p className="eyebrow">ORIGINAL TOOLLOOT GAME</p><h1>TOOLLOOT<br/><em>8-BIT.</em></h1><p className="heroText">Fullscreen arcade shooter. Move only left and right, shoot with SPACE, and destroy colorful bouncing spheres.</p><div className="heroActions"><button className="pixelBtn primary" onClick={()=>setView("game")}><Play/> PLAY GAME</button></div></div><div className="consoleArt"><div className="console"><div className="slot"/><div className="led"/><div className="label">TOOLLOOT<br/><small>8-BIT SYSTEM</small></div><div className="vent">{Array.from({length:18},(_,i)=><i key={i}/>)}</div></div><div className="cartridge"><div>8-BIT</div><span>TOOLLOOT</span></div></div></section><section className="librarySection"><div className="sectionTitle"><div><p className="eyebrow">GAME LIBRARY</p><h2><Gamepad2/> ONLY GAME</h2></div></div><div className="gameGrid"><button className="gameCard featured" onClick={()=>setView("game")}><div className="boxArt"><span>TL</span><b>8-BIT</b></div><div className="cardInfo"><strong>ToollooT 8-Bit</strong><small>ORIGINAL • PLAY NOW</small></div></button></div></section></main><footer>TOOLLOOT 8-BIT • ORIGINAL GAME</footer></div>}
createRoot(document.getElementById("root")).render(<App/>);