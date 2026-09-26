import React,{useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {Search,ArrowRight,Boxes,Sparkles,Zap,Code2,Image,FileText,Calculator,Menu,X,Sun,Moon} from "lucide-react";
import "./styles.css";
const categories=[["All Tools",Boxes],["AI & Smart",Sparkles],["Developer",Code2],["Images",Image],["Documents",FileText],["Calculators",Calculator]];
function App(){
 const [query,setQuery]=useState(""),[cat,setCat]=useState("All Tools"),[dark,setDark]=useState(true),[open,setOpen]=useState(false);
 const tools=[]; const filtered=useMemo(()=>tools.filter(t=>(cat==="All Tools"||t.category===cat)&&t.name.toLowerCase().includes(query.toLowerCase())),[query,cat]);
 return <div className={dark?"app dark":"app"}><header className="header">
  <a className="brand" href="#"><span className="brandMark"><Zap size={18}/></span>Tool<span>Loot</span></a>
  <nav><a href="#tools">Tools</a><a href="#categories">Categories</a><a href="#about">About</a></nav>
  <div className="headerActions"><button className="iconBtn" onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="menuBtn" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div>
 </header>{open&&<div className="mobileNav"><a href="#tools">Tools</a><a href="#categories">Categories</a><a href="#about">About</a></div>}
 <main><section className="hero"><div className="glow g1"/><div className="glow g2"/><div className="eyebrow"><Sparkles size={14}/> THE TOOLBOX FOR THE INTERNET</div>
  <h1>One place for <em>useful tools.</em></h1><p>Fast, focused and free-to-use utilities — built to help you create, convert, calculate and get things done.</p>
  <div className="search"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tools..."/><kbd>⌘ K</kbd></div>
  <div className="heroMeta"><span>⚡ Instant access</span><span>•</span><span>📱 PWA ready</span><span>•</span><span>🔒 Privacy first</span></div></section>
 <section id="categories" className="categories"><div className="sectionHead"><div><span className="label">EXPLORE</span><h2>Browse by category</h2></div></div>
  <div className="catGrid">{categories.map(([name,Icon])=><button className={cat===name?"cat active":"cat"} key={name} onClick={()=>setCat(name)}><Icon size={21}/><span>{name}</span></button>)}</div></section>
 <section id="tools" className="tools"><div className="sectionHead"><div><span className="label">TOOLBOX</span><h2>{cat}</h2></div><span className="count">{filtered.length} tools</span></div>
  {filtered.length===0?<div className="empty"><div className="emptyIcon"><Boxes size={30}/></div><h3>Tool space is ready</h3><p>The ToolLoot foundation is ready. New tools will appear here automatically as they are added to the registry.</p><button onClick={()=>setCat("All Tools")}>View all <ArrowRight size={16}/></button></div>:<div className="toolGrid">{filtered.map(t=><div className="toolCard" key={t.name}><h3>{t.name}</h3></div>)}</div>}</section>
 <section id="about" className="about"><div><span className="label">BUILT TO GROW</span><h2>A toolbox, not a cluttered directory.</h2></div><p>ToolLoot uses a dynamic tool registry so every new utility can plug into the same responsive shell, search, categories and PWA experience.</p></section></main>
 <footer><div className="brand">Tool<span>Loot</span></div><span>Built for useful things.</span></footer></div>}
createRoot(document.getElementById("root")).render(<App/>);