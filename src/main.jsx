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
  const defaults={quality:0.8,maxWidth:0,format:"webp",targetKB:0,rotate:0,flip:false};
  const [items,setItems]=useState([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[drag,setDrag]=useState(false),[active,setActive]=useState(0);
  const item=items[active]||null;
  const keyFor=file=>"toolloot:image-settings:"+file.name+":"+file.size+":"+file.lastModified;
  const remembered=file=>{try{return {...defaults,...JSON.parse(localStorage.getItem(keyFor(file))||"{}")}}catch{return {...defaults}}};
  const makeItem=file=>({id:crypto.randomUUID(),file,preview:URL.createObjectURL(file),settings:remembered(file),result:null});
  const addFiles=input=>{const picked=Array.from(input||[]).filter(f=>f.type.startsWith("image/"));if(!picked.length)return;setItems(prev=>[...prev,...picked.map(makeItem)]);setProgress(0);notify("success",picked.length+" image"+(picked.length>1?"s":"")+" added");};
  const removeItem=id=>setItems(prev=>{const x=prev.find(i=>i.id===id);if(x)URL.revokeObjectURL(x.preview);if(x?.result?.url)URL.revokeObjectURL(x.result.url);return prev.filter(i=>i.id!==id)});
  const clearAll=()=>{items.forEach(x=>{URL.revokeObjectURL(x.preview);if(x.result?.url)URL.revokeObjectURL(x.result.url)});setItems([]);setProgress(0);};
  const update=(id,key,value)=>setItems(prev=>prev.map(x=>{if(x.id!==id)return x;const settings={...x.settings,[key]:value};try{localStorage.setItem(keyFor(x.file),JSON.stringify(settings))}catch{}return {...x,settings,result:null}}));
  const applyAll=key=>{const source=items[0]?.settings;if(!source)return;setItems(prev=>prev.map(x=>({...x,settings:{...x.settings,[key]:source[key]},result:null})));notify("success","Applied "+key+" to all images");};
  const applySettingsToAll=source=>{if(!source)return;setItems(prev=>prev.map(x=>{try{localStorage.setItem(keyFor(x.file),JSON.stringify(source))}catch{}return {...x,settings:{...source},result:null}}));notify("success","First image settings applied to all");};
  const encode=(canvas,type,q)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Encoding failed")),type,q));
  const typeFor=(item)=>item.settings.format==="jpg"?"image/jpeg":item.settings.format==="png"?"image/png":item.settings.format==="avif"?"image/avif":item.settings.format==="original"?item.file.type||"image/webp":"image/webp";
  const compressOne=async item=>{
    const s=item.settings,url=item.preview,img=new Image();img.src=url;
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});
    const scale=s.maxWidth&&img.width>s.maxWidth?s.maxWidth/img.width:1,w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),turn=s.rotate%360,canvas=document.createElement("canvas");
    canvas.width=turn%180?h:w;canvas.height=turn%180?w:h;const ctx=canvas.getContext("2d");ctx.imageSmoothingQuality="high";ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(turn*Math.PI/180);ctx.scale(s.flip?-1:1,1);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
    const type=typeFor(item);let blob=await encode(canvas,type,s.quality);
    if(s.targetKB>0&&/jpeg|webp|avif/.test(blob.type)&&blob.size>s.targetKB*1024){let lo=.1,hi=s.quality,best=blob;for(let n=0;n<9;n++){const mid=(lo+hi)/2,b=await encode(canvas,type,mid);if(b.size<=s.targetKB*1024){best=b;lo=mid}else hi=mid}blob=best;}
    const ext=type==="image/jpeg"?"jpg":type.split("/")[1]||"bin",name=item.file.name.replace(/\.[^.]+$/,"")+"-compressed."+ext;
    return {name,blob,width:canvas.width,height:canvas.height,url:URL.createObjectURL(blob),original:item.file.size,originalUrl:item.preview,settings:{...s}};
  };
  const compressAll=async()=>{if(!items.length||busy)return;setBusy(true);setProgress(0);const next=[];for(let i=0;i<items.length;i++){try{next.push(await compressOne(items[i]));}catch(e){notify("error","Could not compress "+items[i].file.name)}setProgress(Math.round(((i+1)/items.length)*100));}setItems(prev=>prev.map(x=>{const r=next.find(n=>n.originalUrl===x.preview);return r?{...x,result:r}:x}));setBusy(false);notify("success","Batch compression complete");};
  const compressSingle=async id=>{const item=items.find(x=>x.id===id);if(!item)return;try{const r=await compressOne(item);setItems(prev=>prev.map(x=>x.id===id?{...x,result:r}:x));notify("success","Image compressed");}catch(e){notify("error","Compression failed");}};
  const downloadZip=async()=>{const ready=items.filter(x=>x.result);if(!ready.length)return;const zip=new JSZip();ready.forEach(x=>zip.file(x.result.name,x.result.blob));saveAs(await zip.generateAsync({type:"blob"}),"toolloot-compressed-images.zip");notify("success","ZIP download ready");};
  return <Layout><Seo title="Image Compressor - Free Online | ToolLoot" description="Compress multiple images with individual settings directly in your browser."/>
    <main className="toolPage"><div className="container toolPageInner"><a className="backLink" href={link("/")}>Back to ToolLoot</a>
      <div className="toolTitle"><div className="toolIcon large"><ImageIcon size={24}/></div><div><h1>Image Compressor</h1><p>Select an image from the horizontal timeline. Its controls appear below only when needed.</p></div></div>
      <div className={"compressor compactCompressor "+(drag?"dragging":"")} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}}><div className="dropZone"><Upload size={25}/><strong>{items.length?"Add more images":"Drop images here or choose files"}</strong><span>JPG, PNG, WebP, AVIF • Processing stays in your browser</span><label className="fileButton">Choose images<input type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)}/></label></div></div>
      {items.length>0&&<div className="compressWorkspace">
        <div className="imageTimeline"><button className="timelineArrow" onClick={()=>setActive(Math.max(0,active-1))} disabled={active===0}>‹</button><div className="timelineTrack">{items.map((x,i)=><button key={x.id} className={"timelineThumb "+(i===active?"active":"")} onClick={()=>setActive(i)}><img src={x.preview} alt={x.file.name}/><span>{i+1}</span>{x.result&&<b>✓</b>}</button>)}</div><button className="timelineArrow" onClick={()=>setActive(Math.min(items.length-1,active+1))} disabled={active===items.length-1}>›</button></div>
        {item&&<div className="editorPanel"><div className="editorPreview"><div className="previewToolbar"><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size)}</span><button className="iconOnly" onClick={()=>removeItem(item.id)}><Trash2 size={16}/></button></div><div className="canvasPreview"><img src={item.result?.url||item.preview} alt={item.file.name}/></div>{item.result&&<div className="resultSummary"><span>{item.result.width} × {item.result.height}</span><strong>{formatBytes(item.file.size)} → {formatBytes(item.result.blob.size)}</strong><span>{item.file.size>item.result.blob.size?Math.round((1-item.result.blob.size/item.file.size)*100)+"% smaller":"No size reduction"}</span><a className="downloadButton" href={item.result.url} download={item.result.name}><Download size={15}/> Download</a></div>}</div>
          <div className="contextSettings"><div className="settingsTitle"><div><strong>Image settings</strong><span>Only this selected image</span></div><button className="secondaryButton" onClick={()=>applySettingsToAll(item.settings)} disabled={items.length<2}>Apply to all</button></div>
            <label>Format<select value={item.settings.format} onChange={e=>update(item.id,"format",e.target.value)}><option value="webp">WebP</option><option value="jpg">JPG</option><option value="png">PNG</option><option value="avif">AVIF</option><option value="original">Original</option></select></label>
            {item.settings.format!=="png"&&<label>Quality <b>{Math.round(item.settings.quality*100)}%</b><input type="range" min=".1" max="1" step=".05" value={item.settings.quality} onChange={e=>update(item.id,"quality",Number(e.target.value))}/></label>}
            {item.settings.format==="png"&&<div className="settingHint">Quality is hidden because PNG uses lossless encoding.</div>}
            <label>Width <b>{item.settings.maxWidth?item.settings.maxWidth+" px":"Original"}</b><input type="range" min="0" max="8000" step="100" value={item.settings.maxWidth} onChange={e=>update(item.id,"maxWidth",Number(e.target.value))}/></label>
            {item.settings.format!=="png"&&<label>Target size <b>{item.settings.targetKB?item.settings.targetKB+" KB":"Off"}</b><input type="range" min="0" max="5000" step="100" value={item.settings.targetKB} onChange={e=>update(item.id,"targetKB",Number(e.target.value))}/></label>}
            <div className="advancedRow"><button className={"smallControl "+(item.settings.rotate?"selected":"")} onClick={()=>update(item.id,"rotate",(item.settings.rotate+90)%360)}><RotateCw size={15}/> Rotate</button><button className={"smallControl "+(item.settings.flip?"selected":"")} onClick={()=>update(item.id,"flip",!item.settings.flip)}><FlipHorizontal2 size={15}/> Flip</button><button className="smallControl" onClick={()=>{Object.entries(defaults).forEach(([k,v])=>update(item.id,k,v))}}>Reset</button></div>
            <button className="primaryButton compressSelected" disabled={busy} onClick={()=>compressSingle(item.id)}><Gauge size={16}/> {busy?"Compressing "+progress+"%":item.result?"Re-compress":"Compress image"}</button>
          </div></div>}
        <div className="workspaceFooter"><span>{active+1} / {items.length} selected</span><div><button className="secondaryButton" onClick={compressAll} disabled={busy}>{busy?"Compressing "+progress+"%":"Compress all"}</button><button className="secondaryButton" onClick={downloadZip} disabled={!items.some(x=>x.result)}><DownloadCloud size={16}/> Download ZIP</button><button className="textButton" onClick={clearAll}>Clear all</button></div></div>
      </div>}
      <div className="privacyNote"><Shield size={17}/><span>Everything is processed locally in your browser. Your images are not uploaded.</span></div>
    </div></main>
  </Layout>;
}
function ImageItem({item,index,busy,update,applyAll,compressSingle,removeItem}) {
  const s=item.settings,r=item.result;
  return <article className="imageItem"><div className="imageItemTop"><div className="imageIdentity"><span className="imageNumber">{index+1}</span><div><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size)}</span></div></div><button className="iconOnly" onClick={()=>removeItem(item.id)} aria-label={"Remove "+item.file.name}><Trash2 size={16}/></button></div>
    <div className="imageWorkGrid"><div className="imagePreviewPane"><span className="previewLabel">Original preview</span><img src={item.preview} alt={item.file.name}/><div className="previewStats">{item.file.type||"image"} • {item.file.size?formatBytes(item.file.size):"0 B"}</div></div>
      <div className="imageSettingsPane"><div className="settingsHeader"><strong>Individual settings</strong><button className="smallControl" onClick={()=>applyAll("format")}>Use first format</button></div>
        <label>Format<select value={s.format} onChange={e=>update(item.id,"format",e.target.value)}><option value="webp">WebP</option><option value="jpg">JPG</option><option value="png">PNG</option><option value="avif">AVIF</option><option value="original">Original</option></select></label>
        <label>Quality <b>{Math.round(s.quality*100)}%</b><input type="range" min=".1" max="1" step=".05" value={s.quality} onChange={e=>update(item.id,"quality",Number(e.target.value))}/><small>For JPG/WebP/AVIF. PNG uses lossless encoding.</small></label>
        <label>Width <b>{s.maxWidth?s.maxWidth+" px":"Original"}</b><input type="range" min="0" max="8000" step="100" value={s.maxWidth} onChange={e=>update(item.id,"maxWidth",Number(e.target.value))}/></label>
        <label>Target size <b>{s.targetKB?s.targetKB+" KB":"Off"}</b><input type="range" min="0" max="5000" step="100" value={s.targetKB} onChange={e=>update(item.id,"targetKB",Number(e.target.value))}/></label>
        <div className="advancedRow"><button className={"smallControl "+(s.rotate?"selected":"")} onClick={()=>update(item.id,"rotate",(s.rotate+90)%360)}><RotateCw size={15}/> {s.rotate}°</button><button className={"smallControl "+(s.flip?"selected":"")} onClick={()=>update(item.id,"flip",!s.flip)}><FlipHorizontal2 size={15}/> Flip</button><button className="smallControl" onClick={()=>{update(item.id,"quality",.8);update(item.id,"maxWidth",0);update(item.id,"format","webp");update(item.id,"targetKB",0);update(item.id,"rotate",0);update(item.id,"flip",false)}}>Reset</button></div>
        <div className="imageActions"><button className="primaryButton" disabled={busy} onClick={()=>compressSingle(item.id)}><Gauge size={16}/> {r?"Re-compress":"Compress"}</button>{r&&<a className="downloadButton" href={r.url} download={r.name}><Download size={16}/> Download</a>}</div>
      </div></div>
    {r&&<div className="itemResult"><div className="miniResultPreview"><span className="previewLabel">Compressed preview</span><img src={r.url} alt={"Compressed "+item.file.name}/></div><div className="resultInfo"><strong>{r.name}</strong><span>{r.width} × {r.height} • {formatBytes(r.original)} → {formatBytes(r.blob.size)} • {r.original>r.blob.size?Math.round((1-r.blob.size/r.original)*100)+"% smaller":"No size reduction"}</span><button className="textButton" onClick={()=>{}}>Settings stay with this image</button></div></div>}
  </article>;
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
