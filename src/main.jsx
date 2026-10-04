import React,{useEffect,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
import{Gamepad2,Coins,Volume2,VolumeX,RotateCcw,ChevronRight,Plus,Minus}from"lucide-react";
import"./chat.css";

const SAVE="mobrush-v01";const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function App(){const canvas=useRef(null),raf=useRef(0),state=useRef(null),drag=useRef(false);const[coins,setCoins]=useState(()=>+localStorage.getItem(SAVE+"c")||0),[level,setLevel]=useState(()=>+localStorage.getItem(SAVE+"l")||1),[cannon,setCannon]=useState(()=>+localStorage.getItem(SAVE+"u")||1),[muted,setMuted]=useState(false),[running,setRunning]=useState(false),[result,setResult]=useState(null),[angle,setAngle]=useState(.5);
const start=()=>{state.current={crowd:12+level*2,enemy:24+level*4,shots:0,gate:1,enemySpeed:.65+level*.04,particles:[],projectiles:[],x:.5};setResult(null);setRunning(true)};
const shoot=()=>{if(!state.current||result)return;const s=state.current;s.shots++;s.projectiles.push({x:.5,y:.82,vx:(angle-.5)*2.5,vy:-1.8,life:0})};
const upgrade=()=>{const cost=cannon*120;if(coins>=cost){setCoins(coins-cost);setCannon(cannon+1);localStorage.setItem(SAVE+"u",cannon+1)}};
useEffect(()=>{localStorage.setItem(SAVE+"c",coins);localStorage.setItem(SAVE+"l",level)},[coins,level]);
useEffect(()=>{const cv=canvas.current,ctx=cv.getContext("2d");function resize(){const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)}resize();addEventListener("resize",resize);
function loop(){const w=cv.clientWidth,h=cv.clientHeight,s=state.current;ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#151a35");bg.addColorStop(1,"#070910");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
ctx.strokeStyle="#ffffff10";ctx.lineWidth=1;for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(w*.1+i*w*.1,0);ctx.lineTo(w*.1+i*w*.1,h);ctx.stroke()}for(let y=.12;y<.85;y+=.12){ctx.beginPath();ctx.moveTo(0,h*y);ctx.lineTo(w,h*y);ctx.stroke()}
if(s){const gateY=h*.42;ctx.fillStyle="#11182a";ctx.fillRect(w*.13,gateY-34,w*.74,68);ctx.fillStyle="#7d74ff";ctx.fillRect(w*.46,gateY-34,w*.08,68);ctx.fillStyle="#fff";ctx.font="900 19px system-ui";ctx.textAlign="center";ctx.fillText("× "+s.gate,w*.5,gateY+7);
const cx=w*(s.x),cy=h*.82;ctx.fillStyle="#151b2d";ctx.beginPath();ctx.arc(cx,cy,38,0,7);ctx.fill();ctx.strokeStyle="#8278ff";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#8d83ff";ctx.beginPath();ctx.moveTo(cx-13,cy+8);ctx.lineTo(cx,cy-23);ctx.lineTo(cx+13,cy+8);ctx.closePath();ctx.fill();
for(let i=0;i<s.crowd;i++){const row=Math.floor(i/9),col=i%9;const spread=Math.min(w*.055,w/18);const xx=w*.5+(col-4)*spread+(row%2)*spread*.5;const yy=h*.72-row*18;ctx.fillStyle="#5e8cff";ctx.beginPath();ctx.arc(xx,yy,6,0,7);ctx.fill()}
for(let i=0;i<s.enemy;i++){const row=Math.floor(i/10),col=i%10;const xx=w*.5+(col-4.5)*Math.min(w*.05,w/20);const yy=h*.2+row*15;ctx.fillStyle="#ff536d";ctx.beginPath();ctx.arc(xx,yy,6,0,7);ctx.fill()}
s.projectiles.forEach(p=>{p.life+=.022;p.x+=p.vx*.022;p.y+=p.vy*.022;p.vy+=.025;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(w*p.x,h*p.y,7,0,7);ctx.fill()});s.projectiles=s.projectiles.filter(p=>p.life<1);
if(s.projectiles.length&&s.projectiles.some(p=>p.y<.45)){const mult=s.gate;s.crowd+=Math.floor((2+cannon)*mult);s.projectiles=[]}
if(s.shots>0&&Math.random()<.035){const power=1+cannon*.18;s.enemy=Math.max(0,s.enemy-Math.ceil(s.crowd*.025*power));s.crowd=Math.max(0,s.crowd-Math.ceil(s.enemy*.012))}
if(s.enemy<=0){const reward=100+level*35;s.reward=reward;setCoins(v=>v+reward);setResult("win");setRunning(false)}
else if(s.crowd<=0){setResult("lose");setRunning(false)}
}
raf.current=requestAnimationFrame(loop)}raf.current=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(raf.current);removeEventListener("resize",resize)}},[level,cannon,angle,result]);
const pointer=e=>{const r=canvas.current.getBoundingClientRect();setAngle(clamp((e.clientX-r.left)/r.width,.12,.88))};
return <div className="rush"><header><div className="logo"><Gamepad2/><span>MOB <b>RUSH</b></span><small>v0.1</small></div><div className="wallet"><Coins/> {coins}</div><button onClick={()=>setMuted(!muted)}>{muted?<VolumeX/>:<Volume2/>}</button></header>
<main><div className="topline"><div><small>LEVEL</small><strong>{level}</strong></div><div className="bar"><span style={{width:Math.min(100,level*7)+"%"}}/></div><div><small>UPGRADE</small><strong>{cannon}</strong></div></div>
<div className="arena"><canvas ref={canvas} onPointerMove={e=>drag.current&&pointer(e)} onPointerDown={e=>{drag.current=true;pointer(e)}} onPointerUp={()=>drag.current=false} onPointerLeave={()=>drag.current=false}/><div className="enemyTag">ENEMY BASE</div><div className="youTag">YOUR CROWD</div><div className="aimHint">DRAG TO AIM • RELEASE TO FIRE</div></div>
<div className="actions"><button className="upgrade" onClick={upgrade} disabled={coins<cannon*120}><Plus/> UPGRADE CANNON <span>{cannon*120} 🪙</span></button><button className="fire" onClick={shoot} disabled={!running}>FIRE</button></div>
<div className="bottom"><button onClick={start}><RotateCcw/> {running?"RESTART":"PLAY LEVEL "+level}</button><button onClick={upgrade} disabled={coins<cannon*120}><Plus/> POWER {cannon}</button></div>
{result&&<div className="result"><div className={result==="win"?"trophy":"skull"}>{result==="win"?"🏆":"💥"}</div><small>{result==="win"?"BASE DESTROYED":"CROWD DEFEATED"}</small><h2>{result==="win"?"+ "+state.current?.reward+" COINS":"TRY AGAIN"}</h2>{result==="win"&&<p>Level {level} complete.</p>}<button onClick={()=>{if(result==="win")setLevel(level+1);start()}}>{result==="win"?"NEXT LEVEL":"RETRY"} <ChevronRight/></button></div>}
</main><footer>ToollooT Game Lab • MOB RUSH <span>Progress saved locally</span></footer></div>}
createRoot(document.getElementById("root")).render(<App/>);