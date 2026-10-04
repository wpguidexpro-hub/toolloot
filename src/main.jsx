import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Browser, Controller } from "jsnes";
import { Gamepad2, Upload, Play, Library, Settings2, Volume2, VolumeX, RotateCcw, Maximize2, Keyboard, ChevronRight, CircleDot, Trophy } from "lucide-react";
import "./chat.css";

const RECENT_KEY = "toolloot_nes_recent";
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } };
const saveRecent = x => localStorage.setItem(RECENT_KEY, JSON.stringify(x.slice(0, 12)));

function Emulator({ rom, name, onBack }) {
  const host = useRef(null);
  const browser = useRef(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!host.current || !rom) return;
    setError("");
    const emu = new Browser({
      container: host.current,
      onError: e => setError(e?.message || String(e)),
    });
    browser.current = emu;
    try { emu.loadROM(rom); } catch (e) { setError(e?.message || "ROM could not be loaded."); }
    return () => { emu.destroy(); browser.current = null; };
  }, [rom]);

  const reset = () => {
    try { browser.current?.nes?.reset(); } catch {}
  };

  return <div className="screenPage">
    <div className="screenTop">
      <button className="pixelBtn ghost" onClick={onBack}>← LIBRARY</button>
      <div className="cartName"><CircleDot size={14}/> {name}</div>
      <div className="screenTools">
        <button className="iconBtn" title="Reset" onClick={reset}><RotateCcw/></button>
        <button className="iconBtn" title="Mute" onClick={() => setMuted(x => !x)}><>{muted ? <VolumeX/> : <Volume2/>}</></button>
      </div>
    </div>
    <div className="crtFrame">
      <div ref={host} className="nesHost"/>
      {error && <div className="emuError">{error}</div>}
    </div>
    <div className="controls">
      <span><Keyboard/> Arrows <b>D-PAD</b></span>
      <span><kbd>X</kbd> A</span><span><kbd>Z</kbd> B</span>
      <span><kbd>Enter</kbd> START</span><span><kbd>Shift</kbd> SELECT</span>
    </div>
    <div className="tinyNote">Runs your selected .NES cartridge locally in the browser. Use ROMs you own or are legally permitted to use.</div>
  </div>;
}

function DemoGame({ onBack }) {
  const canvas = useRef(null);
  const keys = useRef({});
  const score = useRef(0);
  const [scoreUi, setScoreUi] = useState(0);

  useEffect(() => {
    const c = canvas.current, ctx = c.getContext("2d"), k = keys.current;
    const onDown = e => { k[e.key.toLowerCase()] = true; };
    const onUp = e => { k[e.key.toLowerCase()] = false; };
    addEventListener("keydown", onDown); addEventListener("keyup", onUp);
    let x = 80, y = 160, coinX = 220, coinY = 120, raf, last = performance.now();
    const loop = t => {
      const dt = Math.min(.04, (t-last)/1000); last=t;
      if (k.arrowleft || k.a) x -= 150*dt;
      if (k.arrowright || k.d) x += 150*dt;
      if (k.arrowup || k.w) y -= 150*dt;
      if (k.arrowdown || k.s) y += 150*dt;
      x=Math.max(14,Math.min(242,x)); y=Math.max(14,Math.min(226,y));
      if(Math.hypot(x-coinX,y-coinY)<16){score.current++;setScoreUi(score.current);coinX=20+Math.random()*216;coinY=20+Math.random()*196;}
      ctx.imageSmoothingEnabled=false;
      ctx.fillStyle="#101820";ctx.fillRect(0,0,256,240);
      ctx.fillStyle="#172d22";for(let i=0;i<16;i++)ctx.fillRect(0,i*15,256,1);
      ctx.fillStyle="#2ec4b6";ctx.fillRect(coinX-5,coinY-5,10,10);
      ctx.fillStyle="#f7d154";ctx.fillRect(x-7,y-7,14,14);
      ctx.fillStyle="#f7d154";ctx.fillRect(x-4,y-11,8,4);
      ctx.fillStyle="#e9f5db";ctx.font="10px monospace";ctx.fillText("TOOLLOOT 8-BIT",8,12);ctx.fillText("SCORE "+score.current,190,12);
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);removeEventListener("keydown",onDown);removeEventListener("keyup",onUp);};
  }, []);

  return <div className="screenPage">
    <div className="screenTop"><button className="pixelBtn ghost" onClick={onBack}>← LIBRARY</button><div className="cartName"><CircleDot size={14}/> TOOLLOOT 8-BIT</div><div className="scoreBadge"><Trophy size={13}/> {scoreUi}</div></div>
    <div className="crtFrame demoFrame"><canvas ref={canvas} width="256" height="240"/></div>
    <div className="controls"><span><Keyboard/> WASD / ARROWS MOVE</span><span>COLLECT THE CORES</span></div>
    <div className="tinyNote">Original ToollooT demo cartridge — no third-party ROM required.</div>
  </div>;
}

function App() {
  const [view,setView] = useState("library");
  const [rom,setRom] = useState(null);
  const [romName,setRomName] = useState("");
  const [recent,setRecent] = useState(readRecent());
  const input = useRef(null);

  const loadFile = file => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".nes")) return alert("Please choose a .NES ROM file.");
    const reader = new FileReader();
    reader.onload = () => {
      const data = new Uint8Array(reader.result);
      setRom(data); setRomName(file.name); setView("emulator");
      const next=[{name:file.name,size:file.size,at:Date.now()},...recent.filter(x=>x.name!==file.name)];
      setRecent(next); saveRecent(next);
    };
    reader.readAsArrayBuffer(file);
  };

  if(view==="emulator") return <Emulator rom={rom} name={romName} onBack={()=>setView("library")}/>;
  if(view==="demo") return <DemoGame onBack={()=>setView("library")}/>;

  return <div className="nesApp">
    <header className="nesHeader">
      <div className="brand"><div className="brandMark"><Gamepad2/></div><div><b>TOOLLOOT</b><span>8-BIT ARCADE</span></div></div>
      <div className="headerRight"><span className="statusDot"/> LOCAL MODE</div>
    </header>
    <main className="launcher">
      <section className="hero">
        <div><p className="eyebrow">ORIGINAL RETRO CONSOLE</p><h1>INSERT<br/><em>CARTRIDGE.</em></h1><p className="heroText">A clean NES-style launcher for your own cartridges, with a built-in original demo.</p><div className="heroActions"><button className="pixelBtn primary" onClick={()=>input.current?.click()}><Upload/> LOAD .NES</button><button className="pixelBtn" onClick={()=>setView("demo")}><Play/> PLAY DEMO</button></div><input ref={input} hidden type="file" accept=".nes,application/octet-stream" onChange={e=>loadFile(e.target.files?.[0])}/></div>
        <div className="consoleArt"><div className="console"><div className="slot"/><div className="led"/><div className="label">TOOLLOOT<br/><small>8-BIT SYSTEM</small></div><div className="vent">{Array.from({length:18},(_,i)=><i key={i}/>)}</div></div><div className="cartridge"><div>NES</div><span>TOOLLOOT</span></div></div>
      </section>
      <section className="librarySection">
        <div className="sectionTitle"><div><p className="eyebrow">GAME LIBRARY</p><h2><Library/> CARTRIDGES</h2></div><button className="smallBtn" onClick={()=>input.current?.click()}>+ ADD ROM</button></div>
        <div className="gameGrid">
          <button className="gameCard featured" onClick={()=>setView("demo")}><div className="boxArt"><span>TL</span><b>8-BIT</b></div><div className="cardInfo"><strong>ToollooT 8-Bit</strong><small>ORIGINAL DEMO</small></div><ChevronRight/></button>
          {recent.map((g,i)=><button className="gameCard" key={g.name+i} onClick={()=>{setRomName(g.name);alert("For security, select the ROM file again to load it.");input.current?.click();}}><div className="romArt">NES</div><div className="cardInfo"><strong>{g.name}</strong><small>{Math.round(g.size/1024)} KB • RECENT</small></div><ChevronRight/></button>)}
          <button className="emptyCard" onClick={()=>input.current?.click()}><Upload/><strong>LOAD YOUR ROM</strong><small>Only .NES cartridges</small></button>
        </div>
      </section>
      <section className="infoStrip"><div><Settings2/><b>LOCAL-FIRST</b><span>No account or cloud required.</span></div><div><Gamepad2/><b>CONTROLLER READY</b><span>Keyboard and gamepad friendly.</span></div><div><Maximize2/><b>PIXEL PERFECT</b><span>Original 256×240 output.</span></div></section>
    </main>
    <footer>TOOLLOOT 8-BIT • ORIGINAL UI • Powered by JSNES emulator core</footer>
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
