import React,{useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {Search,ArrowUpRight,Boxes,Sparkles,Code2,Image,FileText,Calculator,Menu,X,Sun,Moon,Command,Star,ShieldCheck,Zap} from "lucide-react";
import "./styles.css";

const categories=[
 ["All Tools",Boxes,"Everything in one place"],
 ["AI & Smart",Sparkles,"Create, think, automate"],
 ["Developer",Code2,"Build faster"],
 ["Images",Image,"Edit & transform"],
 ["Documents",FileText,"Write & convert"],
 ["Calculators",Calculator,"Numbers made simple"]
];
const tools=[];
function App(){
 const [query,setQuery]=useState(""),[cat,setCat]=useState("All Tools"),[dark,setDark]=useState(true),[open,setOpen]=useState(false);
 const filtered=useMemo(()=>tools.filter(t=>(cat==="All Tools"||t.category===cat)&&t.name.toLowerCase().includes(query.toLowerCase())),[query,cat]);
 return <div className={dark?"app dark":"app"}>
  <div className="noise"/>
  <header className="header"><a className="brand" href="#"><span className="brandMark"><Zap size={17}/></span><b>tool</b><strong>loot</strong></a>
   <nav><a href="#tools">Tools</a><a href="#categories">Categories</a><a href="#about">About</a></nav>
   <div className="headerActions"><button className="iconBtn" onClick={()=>setDark(!dark)} aria-label="Theme">{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="menuBtn" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div>
  </header>
  {open&&<div className="mobileNav"><a href="#tools" onClick={()=>setOpen(false)}>Tools</a><a href="#categories" onClick={()=>setOpen(false)}>Categories</a><a href="#about" onClick={()=>setOpen(false)}>About</a></div>}
  <main>
   <section className="hero">
    <div className="orb orb1"/><div className="orb orb2"/><div className="gridGlow"/>
    <div className="heroInner"><div className="eyebrow"><span className="pulse"/><Sparkles size={13}/> THE INTERNET'S TOOLBOX</div>
     <h1>Useful tools.<br/><span>Zero clutter.</span></h1>
     <p>Discover fast, focused utilities for creating, converting, calculating and building — all in one clean workspace.</p>
     <div className="search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="What do you need to do?"/><kbd><Command size={11}/> K</kbd></div>
     <div className="trust"><span><Zap size={13}/> Fast in your browser</span><i/> <span><ShieldCheck size={13}/> Privacy-first</span><i/> <span><Star size={13}/> Free to start</span></div>
    </div>
   </section>
   <section id="categories" className="categories"><div className="sectionHead"><div><span className="label">EXPLORE</span><h2>Pick a category</h2></div><span className="sectionHint">New tools will land here</span></div>
    <div className="catGrid">{categories.map(([name,Icon,desc],i)=><button className={cat===name?"cat active":"cat"} key={name} onClick={()=>setCat(name)}><span className="catIcon"><Icon size={20}/></span><span className="catText"><b>{name}</b><small>{desc}</small></span><ArrowUpRight className="catArrow" size={16}/></button>)}</div>
   </section>
   <section id="tools" className="tools"><div className="sectionHead"><div><span className="label">TOOLBOX</span><h2>{cat}</h2></div><span className="count">{filtered.length} {filtered.length===1?"tool":"tools"}</span></div>
    {filtered.length===0?<div className="empty"><div className="emptyTop"><span className="emptyIcon"><Boxes size={25}/></span><span className="coming">FOUNDATION READY</span></div><h3>Your next tool starts here.</h3><p>The platform is ready for its first utilities. Every tool will plug into the same search, categories, responsive UI and install-ready experience.</p><button onClick={()=>setCat("All Tools")}>Browse all categories <ArrowUpRight size={16}/></button></div>:<div className="toolGrid">{filtered.map(t=><article className="toolCard" key={t.name}><h3>{t.name}</h3></article>)}</div>}
   </section>
   <section id="about" className="about"><div className="aboutCard"><div className="miniLogo"><Zap size={18}/></div><span className="label">BUILT TO GROW</span><h2>A smarter home for useful tools.</h2><p>ToolLoot is designed as a living platform: add a tool once, and the registry handles discovery, search and presentation.</p></div><div className="aboutList"><div><b>01</b><span><strong>Dynamic registry</strong><small>Tools can be added without rebuilding the whole experience.</small></span></div><div><b>02</b><span><strong>App-ready foundation</strong><small>Responsive, install-ready and built for the web.</small></span></div><div><b>03</b><span><strong>Ready for APIs</strong><small>Browser tools today, engines and services later.</small></span></div></div></section>
  </main>
  <footer><div className="brand"><span className="brandMark"><Zap size={13}/></span><b>tool</b><strong>loot</strong></div><span>Useful things, beautifully organized.</span><span>© 2026 ToolLoot</span></footer>
 </div>
}
createRoot(document.getElementById("root")).render(<App/>);
