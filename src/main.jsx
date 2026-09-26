import React, { useEffect, useMemo, useState } from "react";
import {
  Search, Boxes, Sparkles, Code2, Image as ImageIcon, FileText, Calculator,
  Menu, X, Sun, Moon, Upload, Download, SlidersHorizontal, Shield,
  FileCheck, Mail, Layers3, Home as HomeIcon, RotateCw, FlipHorizontal2,
  Maximize2, Trash2, DownloadCloud, Target, Gauge
} from "lucide-react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { get, set } from "idb-keyval";
import "sweetalert2/dist/sweetalert2.min.css";
import "./styles.css";

const BASE = import.meta.env.BASE_URL;
const link = (path = "") => BASE + path.replace(/^\//, "");
const categories = [
  {name:"All Tools", icon:Boxes, path:"/"},
  {name:"AI & Smart", icon:Sparkles, path:"/categories/ai"},
  {name:"Developer", icon:Code2, path:"/categories/developer"},
  {name:"Images", icon:ImageIcon, path:"/categories/images"},
  {name:"Documents", icon:FileText, path:"/categories/documents"},
  {name:"Calculators", icon:Calculator, path:"/categories/calculators"}
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
const Toast = Swal.mixin({ toast:true, position:"bottom-end", showConfirmButton:false, timer:2200, timerProgressBar:true });
const notify = (icon,title) => Toast.fire({icon,title});

function Seo({ title, description }) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://wpguidexpro-hub.github.io/toolloot" + (window.location.pathname.split("/toolloot")[1] || "/");
    let schema = document.getElementById("toolloot-schema");
    if (!schema) { schema=document.createElement("script"); schema.id="toolloot-schema"; schema.type="application/ld+json"; document.head.appendChild(schema); }
    schema.textContent = JSON.stringify({"@context":"https://schema.org","@type":"WebSite","name":"ToolLoot","url":"https://wpguidexpro-hub.github.io/toolloot/","description":description});
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
    <small>(c) 2026 ToolLoot</small>
  </div></footer>;
}
function Layout({ children }) {
  const [dark,setDark] = useState(false);
  return <div className={dark ? "app dark" : "app"}><Header dark={dark} setDark={setDark}/>{children}<Footer/></div>;
}
function ToolCard({ tool }) {
  const openTool=async()=>{const recent=(await get("toolloot:recent-tools"))||[];const next=[tool.id,...recent.filter(id=>id!==tool.id)].slice(0,6);await set("toolloot:recent-tools",next)};
  return <a className="toolCard" href={link(tool.path)} onClick={openTool}>
    <div className="toolIcon"><ImageIcon size={20}/></div><h3>{tool.name}</h3>
    <p>{tool.description}</p><span className="toolLink">Open tool</span>
  </a>;
}
function Home() {
  const [query,setQuery]=useState(""); const [category,setCategory]=useState("All Tools"); const [recentIds,setRecentIds]=useState([]);
  useEffect(()=>{get("toolloot:recent-tools").then(v=>setRecentIds(v||[]))},[]);
  const filtered=useMemo(()=>tools.filter(t=>
    (category==="All Tools"||t.category===category) &&
    (t.name+" "+t.description).toLowerCase().includes(query.toLowerCase())
  ),[query,category]);
  const recentTools=recentIds.map(id=>tools.find(t=>t.id===id)).filter(Boolean);
  return <Layout><Seo title="ToolLoot - Free Online Tools" description="ToolLoot provides simple, fast and free online tools for images, documents, developers and everyday work."/>
    <main>
      <section className="hero"><div className="container heroInner">
        <div className="eyebrow">TOOLLOOT</div><h1>Simple tools that get things done.</h1>
        <p>Fast, free and easy-to-use browser tools.</p>
        <label className="searchBox"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tools..." aria-label="Search tools"/></label>
      </div></section>
      {recentTools.length>0&&<section className="container section recentSection"><div className="sectionHead"><div><h2>Recently used</h2><p>Your recent tools are stored only in this browser.</p></div></div><div className="toolGrid">{recentTools.map(t=><ToolCard tool={t} key={t.id}/>)}</div></section>}
      <section className="container section" id="categories"><div className="sectionHead"><div><h2>Categories</h2><p>Browse tools by category.</p></div></div>
        <div className="categoryRow">{categories.map(({name,icon:Icon})=><button key={name} className={category===name?"category active":"category"} onClick={()=>setCategory(name)}><Icon size={17}/>{name}</button>)}</div>
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
function CategoryPage({categoryName,slug}) {
  const matches=tools.filter(t=>t.category===categoryName);
  return <Page title={categoryName+" Tools ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ToolLoot"} description={"Free "+categoryName.toLowerCase()+" tools from ToolLoot. Simple browser-based utilities designed for everyday tasks."} icon={categories.find(c=>c.name===categoryName)?.icon||Layers3}>
    <div className="sectionHead"><div><h2>{categoryName} tools</h2><p>{matches.length} available</p></div></div>
    {matches.length?<div className="toolGrid">{matches.map(t=><ToolCard tool={t} key={t.id}/>)}</div>:<div className="empty"><strong>No tools in this category yet.</strong><p>New ToolLoot tools will appear here as they are added.</p></div>}
  </Page>;
}
function CategoriesPage() {
  return <Page title="Tool Categories - ToolLoot" description="Browse free online tool categories for images, documents, developers, calculators and AI." icon={Layers3}>
    <div className="pageCards">{categories.slice(1).map(({name,icon:Icon,path})=><a className="infoCard" key={name} href={link(path)}><Icon size={20}/><strong>{name}</strong><span>Browse {name.toLowerCase()} tools.</span></a>)}</div>
  </Page>;
}
function AboutPage() {
  return <Page title="About ToolLoot" description="Learn about ToolLoot, a simple collection of useful online browser tools." icon={HomeIcon}>
    <h2>What is ToolLoot?</h2><p>ToolLoot is a simple web toolbox for everyday tasks. The platform is built around small, focused tools that are easy to discover and use.</p>
    <h2>Built for the web</h2><p>Tools can run directly in your browser where practical, helping keep the interface fast and straightforward.</p>
  </Page>;
}
function PrivacyPage() {
  return <Page title="Privacy Policy - ToolLoot" description="Read the ToolLoot privacy policy and learn how browser-based tools handle your files and information." icon={Shield}>
    <h2>Browser processing</h2><p>When a tool says it runs locally in your browser, files are processed on your device and are not uploaded by that tool.</p>
    <h2>Data collection</h2><p>ToolLoot does not need an account to use its basic browser tools. Any future service that requires data will clearly describe what is collected and why.</p>
    <p>Do not upload sensitive files to any online service unless you understand how that service handles them.</p>
  </Page>;
}
function TermsPage() {
  return <Page title="Terms of Use - ToolLoot" description="Read the basic terms for using ToolLoot online tools." icon={FileCheck}>
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
  const [files,setFiles]=useState([]),[quality,setQuality]=useState(.72),[maxWidth,setMaxWidth]=useState(0),[format,setFormat]=useState("webp"),[targetKB,setTargetKB]=useState(0),[rotate,setRotate]=useState(0),[flip,setFlip]=useState(false),[results,setResults]=useState([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[drag,setDrag]=useState(false);
  useEffect(()=>()=>results.forEach(r=>{URL.revokeObjectURL(r.url);URL.revokeObjectURL(r.originalUrl)}),[results]);
  const addFiles=e=>{const picked=Array.from(e.target.files||[]).filter(f=>f.type.startsWith("image/"));setFiles(picked);setResults([]);setProgress(0);if(picked.length)notify("success",`${picked.length} image${picked.length>1?"s":""} ready`);};
  const removeFile=name=>setFiles(f=>f.filter(x=>x.name!==name));
  const encode=(canvas,type,q)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Encoding failed")),type,q));
  const outputType=()=>format==="jpg"?"image/jpeg":format==="png"?"image/png":format==="avif"?"image/avif":format==="original"?null:"image/webp";
  async function downloadZip(){
    if(!results.length)return; const zip=new JSZip(); results.forEach(item=>zip.file(item.name,item.blob));
    const blob=await zip.generateAsync({type:"blob"}); saveAs(blob,"toolloot-compressed-images.zip"); notify("success","ZIP download ready");
  }
  async function compress(){
    if(!files.length)return; setBusy(true); setProgress(0); const output=[];
    for(const file of files){
      const url=URL.createObjectURL(file),img=new Image(); img.src=url;
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});
      const scale=maxWidth&&img.width>maxWidth?maxWidth/img.width:1,w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),turn=rotate%360,canvas=document.createElement("canvas");
      canvas.width=turn%180?h:w;canvas.height=turn%180?w:h;
      const ctx=canvas.getContext("2d");ctx.imageSmoothingQuality="high";ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(turn*Math.PI/180);ctx.scale(flip?-1:1,1);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
      const type=outputType()||file.type||"image/webp";
      let blob=await encode(canvas,type,quality);if(targetKB>0&&/jpeg|webp|avif/.test(blob.type)&&blob.size>targetKB*1024){let lo=.1,hi=quality,best=blob;for(let n=0;n<8;n++){const mid=(lo+hi)/2,b=await encode(canvas,blob.type,mid);if(b.size<=targetKB*1024){best=b;lo=mid}else hi=mid}blob=best}
      const ext=type==="image/jpeg"?"jpg":type.split("/")[1];
      output.push({name:file.name.replace(/\.[^.]+$/,"")+"-compressed."+ext,blob,original:file.size,width:canvas.width,height:canvas.height,url:URL.createObjectURL(blob),originalUrl:url});setProgress(Math.round((output.length/files.length)*100));
      // Keep the original preview URL alive until results are cleared.
    }
    setResults(output);setBusy(false);notify("success",output.length+" image"+(output.length>1?"s":"")+" compressed successfully");
  }
  return <Layout><Seo title="Image Compressor - Free Online | ToolLoot" description="Compress JPG, PNG and WebP images online for free in your browser. Reduce image size without uploading files."/>
    <main className="toolPage"><div className="container toolPageInner"><a className="backLink" href={link("/")}>Back to ToolLoot</a>
      <div className="toolTitle"><div className="toolIcon large"><ImageIcon size={24}/></div><div><h1>Image Compressor</h1><p>Reduce image file size directly in your browser. Your images stay on your device.</p></div></div>
      <div className={"compressor "+(drag?"dragging":"")} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}}><div className="dropZone"><Upload size={28}/><strong>{files.length?files.length+" image(s) selected":"Drop images here or choose files"}</strong><span>JPG, PNG, WebP and other browser-supported images | Batch processing</span><label className="fileButton">Choose files<input type="file" accept="image/*" multiple onChange={addFiles}/></label></div>
        <div className="settings"><label>Output format<select value={format} onChange={e=>setFormat(e.target.value)}><option value="webp">WebP - smaller</option><option value="jpg">JPG - compatible</option><option value="png">PNG - lossless</option><option value="original">Original format</option></select></label>
          <label>Quality <b>{Math.round(quality*100)}%</b><input type="range" min=".1" max="1" step=".05" value={quality} onChange={e=>setQuality(Number(e.target.value))}/><small>Quality affects JPG/WebP. PNG is lossless.</small></label>
          <label>Max width <b>{maxWidth?maxWidth+" px":"Original"}</b><input type="range" min="0" max="6000" step="100" value={maxWidth} onChange={e=>setMaxWidth(Number(e.target.value))}/></label>          <label>Target size <b>{targetKB?targetKB+" KB":"Off"}</b><input type="range" min="0" max="5000" step="100" value={targetKB} onChange={e=>setTargetKB(Number(e.target.value))}/><small>Finds the highest quality that stays under the target.</small></label>
          <div className="advancedRow"><button type="button" className="smallControl" onClick={()=>setRotate((rotate+90)%360)}><RotateCw size={15}/> Rotate {rotate} deg</button><button type="button" className={"smallControl "+(flip?"selected":"")} onClick={()=>setFlip(!flip)}><FlipHorizontal2 size={15}/> Flip</button></div>          <button className="primaryButton" disabled={!files.length||busy} onClick={compress}>{busy?"Compressing "+progress+"%":"Compress images"}</button></div></div>
      {files.length>0&&<div className="selectedFiles"><div className="sectionHead"><div><h2>Selected images</h2><p>{files.length} ready to process</p></div><button className="textButton" onClick={()=>{setFiles([]);setResults([])}}>Clear all</button></div><div className="selectedGrid">{files.map(file=><div className="selectedItem" key={file.name}><img src={URL.createObjectURL(file)} alt=""/><div><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div><button onClick={()=>removeFile(file.name)} aria-label={"Remove "+file.name}><Trash2 size={15}/></button></div>)}</div></div>}      {results.length>0&&<div className="results"><div className="resultsHead"><h2>Preview & Comparison</h2><button className="secondaryButton" onClick={downloadZip}><DownloadCloud size={16}/> Download ZIP</button></div>{results.map(item=><div className="comparisonCard" key={item.name}><div className="previewGrid"><div><span className="previewLabel">Original</span><img src={item.originalUrl} alt={"Original "+item.name}/><b>{formatBytes(item.original)}</b></div><div><span className="previewLabel">Compressed</span><img src={item.url} alt={"Compressed "+item.name}/><b>{formatBytes(item.blob.size)}</b></div></div><div className="compareMeta"><strong>{item.name}</strong><span>{item.width} x {item.height} | {item.original>item.blob.size?Math.round((1-item.blob.size/item.original)*100)+"% smaller":"No size reduction"}</span><a className="downloadButton" href={item.url} download={item.name}><Download size={17}/>Download</a></div></div>)}</div>}
      <div className="privacyNote"><SlidersHorizontal size={17}/><span>Compression runs locally in your browser. No upload or server is required.</span></div>
    </div></main>
  </Layout>;
}
function Root(){
  const path=window.location.pathname.replace(/\/+$/,"")||"/";
  const local=path.replace(BASE.replace(/\/$/,""),"")||"/";
  if(local==="/tools/image-compressor")return <ImageCompressor/>;
  if(local==="/categories")return <CategoriesPage/>;
  if(local==="/categories/ai")return <CategoryPage categoryName="AI & Smart" slug="ai"/>;
  if(local==="/categories/developer")return <CategoryPage categoryName="Developer" slug="developer"/>;
  if(local==="/categories/images")return <CategoryPage categoryName="Images" slug="images"/>;
  if(local==="/categories/documents")return <CategoryPage categoryName="Documents" slug="documents"/>;
  if(local==="/categories/calculators")return <CategoryPage categoryName="Calculators" slug="calculators"/>;
  if(local==="/about")return <AboutPage/>;
  if(local==="/privacy")return <PrivacyPage/>;
  if(local==="/terms")return <TermsPage/>;
  if(local==="/contact")return <ContactPage/>;
  return <Home/>;
}
createRoot(document.getElementById("root")).render(<Root/>);
