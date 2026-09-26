import React, { useEffect, useMemo, useState } from "react";
import {
  Search, Boxes, Sparkles, Code2, Image as ImageIcon, FileText, Calculator,
  Menu, X, Sun, Moon, Upload, Download, SlidersHorizontal, Shield,
  FileCheck, Mail, Layers3, Home as HomeIcon
} from "lucide-react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const BASE = import.meta.env.BASE_URL;
const link = (path = "") => BASE + path.replace(/^\//, "");
const categories = [
  ["All Tools", Boxes], ["AI & Smart", Sparkles], ["Developer", Code2],
  ["Images", ImageIcon], ["Documents", FileText], ["Calculators", Calculator]
];
const tools = [
  { id:"image-compressor", name:"Image Compressor", description:"Compress JPG, PNG and WebP images in your browser.", category:"Images", path:"/tools/image-compressor" }
];

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B","KB","MB","GB"];
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)), units.length-1);
  return (bytes/1024**i).toFixed(i ? 2 : 0) + " " + units[i];
}
function Seo({ title, description }) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://wpguidexpro-hub.github.io/toolloot" + (window.location.pathname.split("/toolloot")[1] || "/");
  }, [title, description]);
  return null;
}
function Header({ dark, setDark }) {
  const [menu,setMenu] = useState(false);
  const nav = [["Tools","/"],["Categories","/categories"],["About","/about"]];
  return <header className="header">
    <a className="brand" href={link("/")} onClick={()=>setMenu(false)}>
      <span className="brandIcon"><Boxes size={18}/></span>ToolLoot
    </a>
    <nav className={menu ? "nav open" : "nav"}>
      {nav.map(([name,path])=><a key={name} href={link(path)} onClick={()=>setMenu(false)}>{name}</a>)}
    </nav>
    <div className="headerActions">
      <button className="iconButton" onClick={()=>setDark(!dark)} aria-label="Toggle theme">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button className="iconButton mobileMenu" onClick={()=>setMenu(!menu)} aria-label="Menu">{menu?<X size={19}/>:<Menu size={19}/>}</button>
    </div>
  </header>;
}
function Footer() {
  return <footer><div className="container footerInner">
    <div><strong>ToolLoot</strong><span>Simple tools for everyday work.</span></div>
    <nav><a href={link("/about")}>About</a><a href={link("/privacy")}>Privacy</a><a href={link("/terms")}>Terms</a><a href={link("/contact")}>Contact</a></nav>
    <small>© 2026 ToolLoot</small>
  </div></footer>;
}
function Layout({ children }) {
  const [dark,setDark] = useState(false);
  return <div className={dark ? "app dark" : "app"}><Header dark={dark} setDark={setDark}/>{children}<Footer/></div>;
}
function ToolCard({ tool }) {
  return <a className="toolCard" href={link(tool.path)}>
    <div className="toolIcon"><ImageIcon size={20}/></div><h3>{tool.name}</h3>
    <p>{tool.description}</p><span className="toolLink">Open tool →</span>
  </a>;
}
function Home() {
  const [query,setQuery]=useState(""); const [category,setCategory]=useState("All Tools");
  const filtered=useMemo(()=>tools.filter(t=>
    (category==="All Tools"||t.category===category) &&
    (t.name+" "+t.description).toLowerCase().includes(query.toLowerCase())
  ),[query,category]);
  return <Layout><Seo title="ToolLoot — Free Online Tools" description="ToolLoot provides simple, fast and free online tools for images, documents, developers and everyday work."/>
    <main>
      <section className="hero"><div className="container heroInner">
        <div className="eyebrow">TOOLLOOT</div><h1>Simple tools that get things done.</h1>
        <p>Fast, free and easy-to-use browser tools.</p>
        <label className="searchBox"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tools..." aria-label="Search tools"/></label>
      </div></section>
      <section className="container section" id="categories"><div className="sectionHead"><div><h2>Categories</h2><p>Browse tools by category.</p></div></div>
        <div className="categoryRow">{categories.map(([name,Icon])=><button key={name} className={category===name?"category active":"category"} onClick={()=>setCategory(name)}><Icon size={17}/>{name}</button>)}</div>
      </section>
      <section className="container section" id="tools"><div className="sectionHead"><div><h2>Tools</h2><p>{filtered.length} available</p></div></div>
        <div className="toolGrid">{filtered.map(t=><ToolCard tool={t} key={t.id}/>)}</div>
      </section>
      <section className="container section about"><h2>Free online tools, kept simple</h2>
        <p>ToolLoot is a lightweight toolbox designed for useful browser-based utilities. More tools can be added without changing the site structure.</p>
      </section>
    </main>
  </Layout>;
}
function Page({ title,description,icon:Icon,children }) {
  return <Layout><Seo title={title} description={description}/><main className="staticPage container">
    <div className="pageIcon"><Icon size={24}/></div><h1>{title}</h1><p className="pageLead">{description}</p><div className="pageContent">{children}</div>
  </main></Layout>;
}
function CategoriesPage() {
  return <Page title="Tool Categories — ToolLoot" description="Browse ToolLoot categories for image, document, developer, calculator and AI tools." icon={Layers3}>
    <div className="pageCards">{categories.slice(1).map(([name,Icon])=><a className="infoCard" key={name} href={link("/")}><Icon size={20}/><strong>{name}</strong><span>Browse {name.toLowerCase()} tools.</span></a>)}</div>
  </Page>;
}
function AboutPage() {
  return <Page title="About ToolLoot" description="Learn about ToolLoot, a simple collection of useful online browser tools." icon={HomeIcon}>
    <h2>What is ToolLoot?</h2><p>ToolLoot is a simple web toolbox for everyday tasks. The platform is built around small, focused tools that are easy to discover and use.</p>
    <h2>Built for the web</h2><p>Tools can run directly in your browser where practical, helping keep the interface fast and straightforward.</p>
  </Page>;
}
function PrivacyPage() {
  return <Page title="Privacy Policy — ToolLoot" description="Read the ToolLoot privacy policy and learn how browser-based tools handle your files and information." icon={Shield}>
    <h2>Browser processing</h2><p>When a tool says it runs locally in your browser, files are processed on your device and are not uploaded by that tool.</p>
    <h2>Data collection</h2><p>ToolLoot does not need an account to use its basic browser tools. Any future service that requires data will clearly describe what is collected and why.</p>
    <p>Do not upload sensitive files to any online service unless you understand how that service handles them.</p>
  </Page>;
}
function TermsPage() {
  return <Page title="Terms of Use — ToolLoot" description="Read the basic terms for using ToolLoot online tools." icon={FileCheck}>
    <h2>Use of tools</h2><p>ToolLoot tools are provided for general-purpose use. Check the result before relying on it for important work.</p>
    <h2>Availability</h2><p>Tools may be updated, changed or temporarily unavailable as the platform develops.</p>
  </Page>;
}
function ContactPage() {
  return <Page title="Contact ToolLoot" description="Contact ToolLoot for feedback, bug reports and suggestions for new tools." icon={Mail}>
    <h2>Feedback and tool requests</h2><p>ToolLoot is designed to grow one useful tool at a time. Suggestions and bug reports can help improve the platform.</p>
    <p>For now, use the public ToolLoot GitHub repository to report issues or suggest improvements.</p>
  </Page>;
}
function ImageCompressor() {
  const [files,setFiles]=useState([]),[quality,setQuality]=useState(.7),[maxWidth,setMaxWidth]=useState(0),[results,setResults]=useState([]),[busy,setBusy]=useState(false);
  const addFiles=e=>{setFiles(Array.from(e.target.files||[]));setResults([]);};
  async function compress(){
    if(!files.length)return; setBusy(true); const output=[];
    for(const file of files){
      const url=URL.createObjectURL(file),img=new Image(); img.src=url;
      await new Promise(resolve=>{img.onload=resolve;});
      const scale=maxWidth&&img.width>maxWidth?maxWidth/img.width:1,canvas=document.createElement("canvas");
      canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      const type=file.type==="image/png"?"image/png":"image/jpeg";
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));
      output.push({name:file.name.replace(/\.[^.]+$/,"")+"-compressed."+(type==="image/png"?"png":"jpg"),blob,original:file.size});
      URL.revokeObjectURL(url);
    }
    setResults(output);setBusy(false);
  }
  return <Layout><Seo title="Image Compressor — Free Online | ToolLoot" description="Compress JPG, PNG and WebP images online for free in your browser. Reduce image size without uploading files."/>
    <main className="toolPage"><div className="container toolPageInner"><a className="backLink" href={link("/")}>← Back to ToolLoot</a>
      <div className="toolTitle"><div className="toolIcon large"><ImageIcon size={24}/></div><div><h1>Image Compressor</h1><p>Reduce image file size directly in your browser. Your images stay on your device.</p></div></div>
      <div className="compressor"><label className="dropZone"><Upload size={28}/><strong>{files.length?files.length+" image(s) selected":"Choose images"}</strong><span>JPG, PNG or WebP</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addFiles}/></label>
        <div className="settings"><label>Quality <b>{Math.round(quality*100)}%</b><input type="range" min=".1" max="1" step=".05" value={quality} onChange={e=>setQuality(Number(e.target.value))}/></label>
          <label>Max width <b>{maxWidth?maxWidth+" px":"Original"}</b><input type="range" min="0" max="3000" step="100" value={maxWidth} onChange={e=>setMaxWidth(Number(e.target.value))}/></label>
          <button className="primaryButton" disabled={!files.length||busy} onClick={compress}>{busy?"Compressing...":"Compress images"}</button></div></div>
      {results.length>0&&<div className="results"><h2>Compressed images</h2>{results.map(item=><div className="resultRow" key={item.name}><div><strong>{item.name}</strong><span>{formatBytes(item.original)} → {formatBytes(item.blob.size)}</span></div><a className="downloadButton" href={URL.createObjectURL(item.blob)} download={item.name}><Download size={17}/>Download</a></div>)}</div>}
      <div className="privacyNote"><SlidersHorizontal size={17}/><span>Compression runs locally in your browser. No upload or server is required.</span></div>
    </div></main>
  </Layout>;
}
function Root(){
  const path=window.location.pathname.replace(/\/+$/,"")||"/";
  const local=path.replace(BASE.replace(/\/$/,""),"")||"/";
  if(local==="/tools/image-compressor")return <ImageCompressor/>;
  if(local==="/categories")return <CategoriesPage/>;
  if(local==="/about")return <AboutPage/>;
  if(local==="/privacy")return <PrivacyPage/>;
  if(local==="/terms")return <TermsPage/>;
  if(local==="/contact")return <ContactPage/>;
  return <Home/>;
}
createRoot(document.getElementById("root")).render(<Root/>);
