import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Browser, Controller } from "jsnes";
import { Gamepad2, Upload, Play, Library, Settings2, Volume2, VolumeX, RotateCcw, Maximize2, Keyboard, ChevronRight, CircleDot, Trophy, Save, FolderOpen, Fullscreen } from "lucide-react";
import "./chat.css";

const RECENT_KEY="toolloot_nes_recent", STATE_KEY="toolloot_nes_state:";
const POPULAR_GAMES=[
 {id:"mario",name:"Super Mario Bros.",genre:"PLATFORMER"},{id:"contra",name:"Contra",genre:"ACTION"},{id:"zelda",name:"The Legend of Zelda",genre:"ADVENTURE"},{id:"megaman2",name:"Mega Man 2",genre:"ACTION"},{id:"battlecity",name:"Battle City",genre:"ARCADE"},{id:"tetris",name:"Tetris",genre:"PUZZLE"},{id:"excitebike",name:"Excitebike",genre:"RACING"},{id:"castlevania",name:"Castlevania",genre:"ACTION"}
];
const BUILT_IN_GAMES=[
 {id:"tilt",name:"Super Tilt Bro.",author:"Sylvain Gadrat",license:"Homebrew",url:"https://raw.githubusercontent.com/sgadrat/super-tilt-bro/master/tilt_no_network_unrom_(E).nes",genre:"FIGHTING"},
 {id:"falling",name:"Falling",author:"xram64",license:"MIT",url:"https://raw.githubusercontent.com/xram64/falling-nes/master/falling.nes",genre:"ACTION"}
];
const readRecent=()=>{try{return JSON.parse(localStorage.getItem(RECENT_KEY)||"[]")}catch{return[]}};
const saveRecent=x=>localStorage.setItem(RECENT_KEY,JSON.stringify(x.slice(0,12)));

function TouchControls({browser}){
 const hold=button=>{const n=browser?.current?.nes;if(n)n.buttonDown(1,button)};
 const release=button=>{const n=browser?.current?.nes;if(n)n.buttonUp(1,button)};
 const pad=(label,button)=><button className="touchKey" aria-label={label} onPointerDown={e=>{e.preventDefault();hold(button)}} onPointerUp={e=>{e.preventDefault();release(button)}} onPointerCancel={()=>release(button)} onPointerLeave={()=>release(button)}>{label}</button>;
 return <div className="touchControls"><div className="touchDpad"><span/>{pad("▲",Controller.BUTTON_UP)}<span/>{pad("◀",Controller.BUTTON_LEFT)}<span/>{pad("●",Controller.BUTTON_START)}{pad("▶",Controller.BUTTON_RIGHT)}<span/>{pad("▼",Controller.BUTTON_DOWN)}<span/></div><div className="touchActions"><div className="touchAB">{pad("B",Controller.BUTTON_B)}{pad("A",Controller.BUTTON_A)}</div><div className="touchMeta">{pad("SELECT",Controller.BUTTON_SELECT)}{pad("START",Controller.BUTTON_START)}</div></div></div>;
}

function Emulator({rom,name,onBack}){
 const host=useRef(null),browser=useRef(null),[error,setError]=useState(""),[muted,setMuted]=useState(false),[slot,setSlot]=useState(1),[saved,setSaved]=useState("");
 useEffect(()=>{if(!host.current||!rom)return;setError("");const emu=new Browser({container:host.current,onError:e=>setError(e?.message||String(e))});browser.current=emu;try{emu.loadROM(rom)}catch(e){setError(e?.message||"ROM could not be loaded.")}return()=>{emu.destroy();browser.current=null}},[rom]);
 const key=()=>STATE_KEY+btoa(name).replace(/[^a-z0-9]/gi,"");
 const save=()=>{try{localStorage.setItem(key()+":"+slot,JSON.stringify(browser.current.nes.toJSON()));setSaved("SAVED")}catch{setSaved("SAVE FAILED")}};
 const load=()=>{try{const s=localStorage.getItem(key()+":"+slot);if(!s)return setSaved("EMPTY SLOT");browser.current.nes.fromJSON(JSON.parse(s));setSaved("LOADED")}catch{setSaved("LOAD FAILED")}};
 const reset=()=>{try{browser.current?.nes?.reset()}catch{}};
 const full=()=>document.querySelector(".screenPage")?.requestFullscreen?.();
 return <div className="screenPage"><div className="screenTop"><button className="pixelBtn ghost" onClick={onBack}>← LIBRARY</button><div className="cartName"><CircleDot size={14}/> {name}</div><div className="saveTools"><select value={slot} onChange={e=>setSlot(+e.target.value)}><option value="1">SLOT 1</option><option value="2">SLOT 2</option><option value="3">SLOT 3</option></select><button className="iconBtn" title="Save state" onClick={save}><Save/></button><button className="iconBtn" title="Load state" onClick={load}><FolderOpen/></button><button className="iconBtn" title="Reset" onClick={reset}><RotateCcw/></button><button className="iconBtn" title="Fullscreen" onClick={full}><Fullscreen/></button><button className="iconBtn" title="Mute" onClick={()=>setMuted(x=>!x)}>{muted?<VolumeX/>:<Volume2/>}</button></div></div>
 <div className="crtFrame"><div ref={host} className="nesHost"/>{error&&<div className="emuError">{error}</div>}</div>
 <div className="saveToast">{saved&&<>SLOT {slot}: {saved}</>}</div>
 <TouchControls browser={browser}/><div className="controls"><span><Keyboard/> Arrows <b>D-PAD</b></span><span><kbd>X</kbd> A</span><span><kbd>Z</kbd> B</span><span><kbd>Enter</kbd> START</span><span><kbd>Right Ctrl</kbd> SELECT</span></div>
 <div className="tinyNote">Save states are stored locally in this browser. Use ROMs you own or are legally permitted to use.</div></div>;
}

function DemoGame({onBack}){const canvas=useRef(null),keys=useRef({}),score=useRef(0),[ui,setUi]=useState(0);useEffect(()=>{const c=canvas.current,ctx=c.getContext("2d"),k=keys.current,d=e=>k[e.key.toLowerCase()]=1,u=e=>k[e.key.toLowerCase()]=0;addEventListener("keydown",d);addEventListener("keyup",u);let x=80,y=160,cx=220,cy=120,raf,last=performance.now();const loop=t=>{let dt=Math.min(.04,(t-last)/1000);last=t;if(k.arrowleft||k.a)x-=150*dt;if(k.arrowright||k.d)x+=150*dt;if(k.arrowup||k.w)y-=150*dt;if(k.arrowdown||k.s)y+=150*dt;x=Math.max(14,Math.min(242,x));y=Math.max(14,Math.min(226,y));if(Math.hypot(x-cx,y-cy)<16){score.current++;setUi(score.current);cx=20+Math.random()*216;cy=20+Math.random()*196}ctx.imageSmoothingEnabled=false;ctx.fillStyle="#101820";ctx.fillRect(0,0,256,240);ctx.fillStyle="#172d22";for(let i=0;i<16;i++)ctx.fillRect(0,i*15,256,1);ctx.fillStyle="#2ec4b6";ctx.fillRect(cx-5,cy-5,10,10);ctx.fillStyle="#f7d154";ctx.fillRect(x-7,y-7,14,14);ctx.fillRect(x-4,y-11,8,4);ctx.fillStyle="#e9f5db";ctx.font="10px monospace";ctx.fillText("TOOLLOOT 8-BIT",8,12);ctx.fillText("SCORE "+score.current,190,12);raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(raf);removeEventListener("keydown",d);removeEventListener("keyup",u)}},[]);return <div className="screenPage"><div className="screenTop"><button className="pixelBtn ghost" onClick={onBack}>← LIBRARY</button><div className="cartName"><CircleDot size={14}/> TOOLLOOT 8-BIT</div><div className="scoreBadge"><Trophy size={13}/> {ui}</div></div><div className="crtFrame demoFrame"><canvas ref={canvas} width="256" height="240"/></div><div className="controls"><span><Keyboard/> WASD / ARROWS MOVE</span><span>COLLECT THE CORES</span></div><div className="tinyNote">Original ToollooT demo cartridge — no third-party ROM required.</div></div>}


function BlockcraftGame({onBack}){
 const canvas=useRef(null),[tick,setTick]=useState(0),world=useRef(null),player=useRef({x:8,y:7}),selected=useRef(1),keys=useRef({});
 useEffect(()=>{
  const c=canvas.current,ctx=c.getContext("2d"),W=32,H=20,T=24;
  const w=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{
   if(y<7)return 0;
   if(y===7)return 1;
   if(y>14 && Math.random()<.28)return 3;
   if(y>8 && Math.random()<.16)return 2;
   return 1;
  }));
  for(let x=4;x<11;x++){w[6][x]=0;w[7][x]=0}
  world.current=w;
  const draw=()=>{
   ctx.imageSmoothingEnabled=false;ctx.fillStyle="#8bd3ff";ctx.fillRect(0,0,c.width,c.height);
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const b=w[y][x]; if(!b)continue;
    ctx.fillStyle=b===1?"#63a33b":b===2?"#8b5a2b":"#777";
    ctx.fillRect(x*T,y*T,T,T);
    ctx.strokeStyle="rgba(0,0,0,.18)";ctx.strokeRect(x*T,y*T,T,T);
    if(b===1){ctx.fillStyle="#4d7f2f";ctx.fillRect(x*T,y*T,T,5)}
    if(b===2){ctx.fillStyle="#b9783a";ctx.fillRect(x*T+4,y*T+7,4,4);ctx.fillRect(x*T+15,y*T+14,4,4)}
    if(b===3){ctx.fillStyle="#aaa";ctx.fillRect(x*T+5,y*T+5,5,5);ctx.fillRect(x*T+15,y*T+13,4,4)}
   }
   const p=player.current;ctx.fillStyle="#e8e8e8";ctx.fillRect(p.x*T+5,p.y*T+3,14,18);ctx.fillStyle="#d94b4b";ctx.fillRect(p.x*T+6,p.y*T+4,12,7);ctx.fillStyle="#222";ctx.fillRect(p.x*T+7,p.y*T+7,3,3);ctx.fillRect(p.x*T+14,p.y*T+7,3,3);
   ctx.fillStyle="#111";ctx.font="12px monospace";ctx.fillText("BLOCKCRAFT • NES STYLE",8,14);ctx.fillText("1 GRASS  2 DIRT  3 STONE",8,472);
  };
  const move=(dx,dy)=>{const p=player.current,nx=p.x+dx,ny=p.y+dy;if(nx>=0&&nx<W&&ny>=0&&ny<H&&!w[ny][nx]){p.x=nx;p.y=ny;setTick(x=>x+1)}};
  const down=e=>{keys.current[e.key.toLowerCase()]=1;if(["arrowup","arrowdown","arrowleft","arrowright"," ","w","a","s","d"].includes(e.key.toLowerCase()))e.preventDefault()};
  const up=e=>keys.current[e.key.toLowerCase()]=0;
  const timer=setInterval(()=>{const k=keys.current;if(k.arrowleft||k.a)move(-1,0);else if(k.arrowright||k.d)move(1,0);else if(k.arrowup||k.w)move(0,-1);else if(k.arrowdown||k.s)move(0,1)},130);
  const click=e=>{const r=c.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*W),y=Math.floor((e.clientY-r.top)/r.height*H);const p=player.current;if(Math.abs(x-p.x)<=1&&Math.abs(y-p.y)<=1){if(w[y]?.[x])w[y][x]=0;else if(selected.current&&!(x===p.x&&y===p.y))w[y][x]=selected.current;setTick(v=>v+1)}};
  addEventListener("keydown",down);addEventListener("keyup",up);c.addEventListener("pointerdown",click);
  let raf=requestAnimationFrame(function loop(){draw();raf=requestAnimationFrame(loop)});
  return()=>{clearInterval(timer);cancelAnimationFrame(raf);removeEventListener("keydown",down);removeEventListener("keyup",up);c.removeEventListener("pointerdown",click)};
 },[]);
 const moveBtn=(dx,dy)=>{const p=player.current,w=world.current;if(!w)return;const x=p.x+dx,y=p.y+dy;if(x>=0&&x<32&&y>=0&&y<20&&!w[y][x]){p.x=x;p.y=y;setTick(v=>v+1)}};
 return <div className="screenPage"><div className="screenTop"><button className="pixelBtn ghost" onClick={onBack}>← LIBRARY</button><div className="cartName"><Gamepad2 size={14}/> BLOCKCRAFT • NES STYLE</div><div className="scoreBadge">SANDBOX</div></div><div className="crtFrame demoFrame"><canvas ref={canvas} width="768" height="480" style={{width:"100%",height:"auto",imageRendering:"pixelated",touchAction:"none"}}/></div><div className="touchControls"><div className="touchDpad"><span/ ><button className="touchKey" onClick={()=>moveBtn(0,-1)}>▲</button><span/><button className="touchKey" onClick={()=>moveBtn(-1,0)}>◀</button><button className="touchKey" onClick={()=>moveBtn(0,1)}>▼</button><button className="touchKey" onClick={()=>moveBtn(1,0)}>▶</button><span/></div><div className="touchActions"><button className="touchKey" onClick={()=>{selected.current=1;setTick(v=>v+1)}}>GRASS</button><button className="touchKey" onClick={()=>{selected.current=2;setTick(v=>v+1)}}>DIRT</button><button className="touchKey" onClick={()=>{selected.current=3;setTick(v=>v+1)}}>STONE</button></div></div><div className="controls"><span><Keyboard/> WASD / ARROWS MOVE</span><span>CLICK NEXT TO PLAYER = BREAK / PLACE</span></div><div className="tinyNote">Original ToollooT sandbox — Minecraft-inspired mechanics, NES-style graphics, no third-party ROM.</div></div>
}

function App(){const[view,setView]=useState("library"),[rom,setRom]=useState(null),[romName,setRomName]=useState(""),[recent,setRecent]=useState(readRecent()),[loading,setLoading]=useState("");const input=useRef(null);
 const loadRemote=async game=>{try{setLoading(game.id);const res=await fetch(game.url,{cache:"no-store"});if(!res.ok)throw new Error("Game ROM could not be fetched.");const data=new Uint8Array(await res.arrayBuffer());setRom(data);setRomName(game.name);setView("emulator");const n=[{name:game.name,size:data.byteLength,at:Date.now()},...recent.filter(x=>x.name!==game.name)];setRecent(n);saveRecent(n)}catch(e){alert(e.message||"Unable to load game.")}finally{setLoading("")}};
 const loadFile=file=>{if(!file)return;if(!file.name.toLowerCase().endsWith(".nes"))return alert("Please choose a .NES ROM file.");const r=new FileReader();r.onload=()=>{const data=new Uint8Array(r.result);setRom(data);setRomName(file.name);setView("emulator");const n=[{name:file.name,size:file.size,at:Date.now()},...recent.filter(x=>x.name!==file.name)];setRecent(n);saveRecent(n)};r.readAsArrayBuffer(file)};
 if(view==="emulator")return <Emulator rom={rom} name={romName} onBack={()=>setView("library")}/>;if(view==="demo")return <DemoGame onBack={()=>setView("library")}/>;if(view==="blockcraft")return <BlockcraftGame onBack={()=>setView("library")}/>;
 return <div className="nesApp"><header className="nesHeader"><div className="brand"><div className="brandMark"><Gamepad2/></div><div><b>TOOLLOOT</b><span>8-BIT ARCADE</span></div></div><div className="headerRight"><span className="statusDot"/> LOCAL MODE</div></header><main className="launcher"><section className="hero"><div><p className="eyebrow">ORIGINAL RETRO CONSOLE</p><h1>INSERT<br/><em>CARTRIDGE.</em></h1><p className="heroText">Popular NES classics + free homebrew, with support for your own legal .NES cartridges.</p><div className="heroActions"><button className="pixelBtn primary" onClick={()=>input.current?.click()}><Upload/> LOAD .NES</button><button className="pixelBtn" onClick={()=>setView("demo")}><Play/> PLAY DEMO</button><button className="pixelBtn" onClick={()=>setView("blockcraft")}><Gamepad2/> BLOCKCRAFT</button></div><input ref={input} hidden type="file" accept=".nes,application/octet-stream" onChange={e=>loadFile(e.target.files?.[0])}/></div><div className="consoleArt"><div className="console"><div className="slot"/><div className="led"/><div className="label">TOOLLOOT<br/><small>8-BIT SYSTEM</small></div><div className="vent">{Array.from({length:18},(_,i)=><i key={i}/>)}</div></div><div className="cartridge"><div>NES</div><span>TOOLLOOT</span></div></div></section><section className="librarySection"><div className="sectionTitle"><div><p className="eyebrow">GAME LIBRARY</p><h2><Library/> CARTRIDGES</h2></div><button className="smallBtn" onClick={()=>input.current?.click()}>+ ADD ROM</button></div><div className="gameGrid"><button className="gameCard featured" onClick={()=>setView("demo")}><div className="boxArt"><span>TL</span><b>8-BIT</b></div><div className="cardInfo"><strong>ToollooT 8-Bit</strong><small>ORIGINAL DEMO</small></div></button><button className="gameCard featured" onClick={()=>setView("blockcraft")}><div className="boxArt"><span>BC</span><b>BLOCKS</b></div><div className="cardInfo"><strong>Blockcraft • NES Style</strong><small>SANDBOX • PLAY NOW</small></div><ChevronRight/></button>{POPULAR_GAMES.map(game=><button className="gameCard popularCard" key={game.id} onClick={()=>input.current?.click()}><div className="romArt popularArt">{game.name.split(" ")[0].slice(0,6).toUpperCase()}</div><div className="cardInfo"><strong>{game.name}</strong><small>{game.genre} • LOAD YOUR ROM</small></div><ChevronRight/></button>)}{POPULAR_GAMES.map(game=>)}{BUILT_IN_GAMES.map(game=><button className="gameCard" key={game.id} onClick={()=>loadRemote(game)} disabled={!!loading}><div className="romArt">{loading===game.id?"LOAD…":"HOME"}</div><div className="cardInfo"><strong>{game.name}</strong><small>{game.genre} • FREE HOMEBREW</small></div><ChevronRight/></button>)}{recent.map((g,i)=><button className="gameCard" key={g.name+i} onClick={()=>input.current?.click()}><div className="romArt">NES</div><div className="cardInfo"><strong>{g.name}</strong><small>{Math.round(g.size/1024)} KB • RECENT</small></div><ChevronRight/></button>)}<button className="emptyCard" onClick={()=>input.current?.click()}><Upload/><strong>LOAD YOUR ROM</strong><small>Only .NES cartridges</small></button></div></section><section className="infoStrip"><div><Settings2/><b>LOCAL-FIRST</b><span>No account or cloud required.</span></div><div><Gamepad2/><b>CONTROLLER READY</b><span>Keyboard and gamepad friendly.</span></div><div><Maximize2/><b>SAVE STATES</b><span>Three local quick-save slots.</span></div></section></main><footer>TOOLLOOT 8-BIT • ORIGINAL UI • Powered by JSNES emulator core</footer></div>}
createRoot(document.getElementById("root")).render(<App/>);