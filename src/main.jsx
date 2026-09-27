import React, { useEffect, useMemo, useState } from "react";
import {
  Search, Boxes, Sparkles, Code2, Image as ImageIcon, FileText, Calculator,
  Menu, X, Sun, Moon, Upload, Download, SlidersHorizontal, Shield,
  FileCheck, Mail, Layers3, Home as HomeIcon, RotateCw, FlipHorizontal2,
  Maximize2, Trash2, Target, Gauge
} from "lucide-react";
import { createRoot } from "react-dom/client";
import Swal from "sweetalert2";
import { get, set } from "idb-keyval";
import "sweetalert2/dist/sweetalert2.min.css";
import "./styles.css";
import "./styles.mobile-shell.css";
import "./generation.css";
import "./ai-minimal.css";
import "./future-ui.css";
import "./brand.css";
import "./components/CompressorGuide.css";
import { ToollooTAI } from "./aiWorkspace.jsx";
import { AnalyticsPage } from "./analyticsPage.jsx";
import { imageToolMeta, ImageBatchTool, ExactSizeCompressor, ImageToolGuide } from "./imageTools.jsx";
import { ChooseImage } from "./components/ChooseImage.jsx";
import { ToolFileTimeline } from "./components/ToolTimeline.jsx";
import { ToolPreview } from "./components/ToolPreview.jsx";
import { CompressorGuide } from "./components/CompressorGuide.jsx";
import { loadImageSession, saveImageSession, clearImageSession, imageSessionKey } from "./hooks/usePersistentImageSession.js";

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
  {id:"image-compressor",name:"Image Compressor",description:"Compress JPG, PNG and WebP images in your browser.",category:"Images",path:"/tools/image-compressor"},
  ...Object.entries(imageToolMeta).map(([id,m])=>({id,name:m.title,description:m.description,category:"Images",path:"/tools/"+id}))
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
    schema.textContent = JSON.stringify({"@context":"https://schema.org","@type":"WebSite","name":"ToollooT","url":"https://wpguidexpro-hub.github.io/toolloot/","description":description});
  }, [title, description]);
  return null;
}
function ToollooTIcon({ className="" }) {
  return <img className={className} src={link("/favicon.png")} alt="ToollooT" aria-hidden="true" />;
}
function Header({ dark, setDark, canInstall, installApp }) {
  const [menu,setMenu] = useState(false);
  const nav = [["Tools","/"],["Categories","/categories"],["How to Use","/how-to-use"],["About","/about"]];
  return <header className="header">
    <a className="brand" href={link("/")} onClick={()=>setMenu(false)}>
      <span className="brandMark" aria-hidden="true"><i>T</i><b>•</b><i>T</i></span><span className="brandWord">ToollooT</span>
    </a>
    <nav className={menu ? "nav open" : "nav"}>
      {nav.map(([name,path])=><a key={name} href={link(path)} onClick={()=>setMenu(false)}>{name}</a>)}
    </nav>
    <div className="headerActions">
      {canInstall && <button className="installButton" onClick={installApp} aria-label="Install ToollooT"> <Download size={16}/> Install App</button>}
      <button className="iconButton" onClick={()=>setDark(!dark)} aria-label="Toggle theme">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button className="iconButton mobileMenu" onClick={()=>setMenu(!menu)} aria-label="Menu">{menu?<X size={19}/>:<Menu size={19}/>}</button>
    </div>
  </header>;
}
function Footer() {
  return <footer><div className="container footerInner">
    <div><strong>ToollooT</strong><span>Make it. Fix it. Ship it.</span></div>
    <nav><a href={link("/about")}>About</a><a href={link("/privacy")}>Privacy</a><a href={link("/terms")}>Terms</a><a href={link("/contact")}>Contact</a></nav>
    <small>(c) 2026 ToollooT</small>
  </div></footer>;
}
function Layout({ children }) {
  const [installPrompt,setInstallPrompt] = useState(null);
  const [dark,setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("toolloot:theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("toolloot:theme", dark ? "dark" : "light"); } catch {}
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(link("/sw.js")).catch(()=>{});
    const handler = e => { setInstallPrompt(e); };
    const installedHandler = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);
  const installApp = async () => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      notify("info","ToollooT is already installed"); return;
    }
    if (!installPrompt) {
      notify("info","Use your browser's Install App option to install ToollooT"); return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  return <div className={dark ? "app dark" : "app"}><Header dark={dark} setDark={setDark} canInstall={!!installPrompt} installApp={installApp}/>{children}<Footer/><nav className="mobileBottomNav" aria-label="Mobile navigation"><a href={link("/")}><HomeIcon size={19}/><span>Home</span></a><a href={link("/categories")}><Boxes size={19}/><span>Categories</span></a><a href={link("/how-to-use")}><FileText size={19}/><span>How to Use</span></a><a href={link("/about")}><HomeIcon size={19}/><span>About</span></a></nav></div>;
}
function ToolCard({ tool }) {
  const openTool=async()=>{const recent=(await get("toolloot:recent-tools"))||[];const next=[tool.id,...recent.filter(id=>id!==tool.id)].slice(0,6);await set("toolloot:recent-tools",next)};
  return <a className="toolCard" href={link(tool.path)} onClick={openTool}>
    <div className="toolIcon"><ImageIcon size={20}/></div><h3>{tool.name}</h3>
    <p>{tool.description}</p><span className="toolLink">Open tool</span>
  </a>;
}
function Home() {
  return <Layout><Seo title="ToollooT AI - Free AI Utility Workspace" description="ToollooT AI is a free multi-user utility workspace where natural-language commands run local tools for images, PDFs and files."/><main className="aiRoute"><ToollooTAI/></main></Layout>;
}
function Page({ title,description,icon:Icon,children }) {
  return <Layout><Seo title={title} description={description}/><main className="staticPage container">
    <div className="pageIcon"><ToollooTIcon /></div><h1>{title}</h1><p className="pageLead">{description}</p><div className="pageContent">{children}</div>
  </main></Layout>;
}
function CategoryPage({categoryName,slug}) {
  const matches=tools.filter(t=>t.category===categoryName);
  return <Page title={categoryName+" Tools"} description={"Free "+categoryName.toLowerCase()+" tools from ToollooT. Simple browser-based utilities designed for everyday tasks."} icon={categories.find(c=>c.name===categoryName)?.icon||Layers3}>
    <div className="sectionHead"><div><h2>{categoryName} tools</h2><p>{matches.length} available</p></div></div>
    {matches.length?<div className="toolGrid">{matches.map(t=><ToolCard tool={t} key={t.id}/>)}</div>:<div className="empty"><strong>No tools in this category yet.</strong><p>New ToollooT tools will appear here as they are added.</p></div>}
  </Page>;
}
function HowToUsePage() {
  const guides = [{id:"image-compressor",title:"Image Compressor",icon:ImageIcon,desc:"Compress and resize multiple images with individual settings, previews and ZIP download."},...Object.entries(imageToolMeta).map(([id,m])=>({id,title:m.title,icon:ImageIcon,desc:m.description}))];
  return <Page title="How to Use ToollooT" description="Getting started guide for ToollooT and step-by-step instructions for every tool." icon={FileText}>
    <div className="pageCards">
      <a className="infoCard" href="#getting-started"><Sparkles size={20}/><strong>Getting Started</strong><span>Learn the basic ToollooT workflow from choosing a tool to downloading your result.</span></a>
      <a className="infoCard" href="#privacy"><Shield size={20}/><strong>Privacy & Browser Processing</strong><span>Understand which tools process files directly in your browser.</span></a>
      <a className="infoCard" href="#troubleshooting"><Target size={20}/><strong>Troubleshooting</strong><span>Quick fixes for common upload, processing and download problems.</span></a>
    </div>
    <section id="getting-started" className="guideSection"><h2>Getting Started</h2><ol><li>Open a tool from the Tools page or a category.</li><li>Follow the instructions shown inside that tool.</li><li>Choose your files or enter the required information.</li><li>Adjust settings when available.</li><li>Run the tool and review the result.</li><li>Download or export your finished result.</li></ol></section>
    <section id="privacy" className="guideSection"><h2>Privacy & Browser Processing</h2><p>When a ToollooT tool says processing happens in your browser, the work is performed locally on your device. Your files are not uploaded by that browser-based tool.</p></section>
    <section id="troubleshooting" className="guideSection"><h2>Troubleshooting</h2><ul><li>Refresh the page if a tool becomes unresponsive.</li><li>Use a modern browser and allow file access when prompted.</li><li>For large files, wait for processing to finish before closing the tab.</li><li>If a download does not start, try the download button again.</li></ul></section>
    <section className="guideSection"><h2>Tool Guides</h2><div className="pageCards">{guides.map(g=>{const Icon=g.icon;return <a className="infoCard" key={g.id} href={link("/how-to-use/"+g.id)}><Icon size={20}/><strong>{g.title}</strong><span>{g.desc}</span><em>Use Image Compressor →</em></a>})}</div></section>
  </Page>;
}
function ImageCompressorGuide() {
  return <Page title="How to Use Image Compressor" description="Step-by-step guide to compressing, resizing and downloading images with ToollooT." icon={ImageIcon}>
    <div className="guideAction"><a className="primaryButton" href={link("/tools/image-compressor")}><ImageIcon size={16}/> Use Image Compressor Now</a></div>
    <div className="guideSteps"><div><b>1</b><h2>Add images</h2><p>Drop images into the upload area or choose multiple image files. JPG, PNG, WebP and other browser-supported image formats can be selected.</p></div><div><b>2</b><h2>Select an image</h2><p>Use the horizontal timeline to select the image you want to edit. Each image has its own independent settings.</p></div><div><b>3</b><h2>Choose format</h2><p>Select WebP, JPG, PNG, AVIF or Original. The available compression controls change according to the selected format.</p></div><div><b>4</b><h2>Adjust quality and width</h2><p>Set quality for lossy formats and optionally choose a maximum width. These settings apply only to the selected image.</p></div><div><b>5</b><h2>Set target size</h2><p>For supported lossy formats, set a target size in KB. ToollooT will try to reduce quality to reach that target.</p></div><div><b>6</b><h2>Rotate or flip</h2><p>Use Rotate or Flip when needed. Reset returns the selected image to its default settings.</p></div><div><b>7</b><h2>Compress</h2><p>Click Compress image. You can re-compress the same image after changing its settings.</p></div><div><b>8</b><h2>Download</h2><p>Download an individual result or use Compress all followed by Download ZIP for a batch.</p></div></div>
    <div className="guideSection"><h2>Multiple images</h2><p>Settings are stored separately for each image. Select another thumbnail to configure it independently. Use <strong>Apply to all</strong> only when you want the current image's complete settings copied to every image.</p></div>
    <div className="guideSection"><h2>Browser privacy</h2><p>Image compression is performed locally in your browser, so the selected images are not uploaded by ToollooT.</p></div>
    <div className="guideAction"><a className="primaryButton" href={link("/tools/image-compressor")}><ImageIcon size={16}/> Use Image Compressor Now</a></div>
  </Page>;
}
function CategoriesPage() {
  return <Page title="Tool Categories - ToollooT" description="Browse free online tool categories for images, documents, developers, calculators and AI." icon={Layers3}>
    <div className="pageCards">{categories.slice(1).map(({name,icon:Icon,path})=><a className="infoCard" key={name} href={link(path)}><Icon size={20}/><strong>{name}</strong><span>Browse {name.toLowerCase()} tools.</span></a>)}</div>
  </Page>;
}
function AboutPage() {
  return <Page title="About ToollooT" description="Learn about ToollooT, a simple collection of useful online browser tools." icon={HomeIcon}>
    <h2>What is ToollooT?</h2><p>ToollooT is a simple web toolbox for everyday tasks. The platform is built around small, focused tools that are easy to discover and use.</p>
    <h2>Built for the web</h2><p>Tools can run directly in your browser where practical, helping keep the interface fast and straightforward.</p>
  </Page>;
}
function PrivacyPage() {
  return <Page title="Privacy Policy - ToollooT" description="Read the ToollooT privacy policy and learn how browser-based tools handle your files and information." icon={Shield}>
    <h2>Browser processing</h2><p>When a tool says it runs locally in your browser, files are processed on your device and are not uploaded by that tool.</p>
    <h2>Data collection</h2><p>ToollooT does not need an account to use its basic browser tools. Any future service that requires data will clearly describe what is collected and why.</p>
    <p>Do not upload sensitive files to any online service unless you understand how that service handles them.</p>
  </Page>;
}
function TermsPage() {
  return <Page title="Terms of Use - ToollooT" description="Read the basic terms for using ToollooT online tools." icon={FileCheck}>
    <h2>Use of tools</h2><p>ToollooT tools are provided for general-purpose use. Check the result before relying on it for important work.</p>
    <h2>Availability</h2><p>Tools may be updated, changed or temporarily unavailable as the platform develops.</p>
  </Page>;
}
function ContactPage() {
  return <Page title="Contact ToollooT" description="Contact ToollooT for feedback, bug reports and suggestions for new tools." icon={Mail}>
    <h2>Feedback and tool requests</h2><p>ToollooT is designed to grow one useful tool at a time. Suggestions and bug reports can help improve the platform.</p>
    <p>For now, use the public ToollooT GitHub repository to report issues or suggest improvements.</p>
  </Page>;
}
function ImageCompressor() {
  const defaults={quality:0.8};
  const [items,setItems]=useState([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[generation,setGeneration]=useState(0);
  const [active,setActive]=useState(0);
  const [estimatedSize,setEstimatedSize]=useState(null),[estimating,setEstimating]=useState(false);
  const item=items[active]||null;
  const [sessionReady,setSessionReady]=useState(false);
  useEffect(()=>{let alive=true;(async()=>{const restored=await loadImageSession();if(alive&&restored.length){setItems(restored);setActive(0)}if(alive)setSessionReady(true)})();return()=>{alive=false}},[]);
  useEffect(()=>{if(!sessionReady)return;const t=setTimeout(()=>saveImageSession(items).catch(()=>{}),250);return()=>clearTimeout(t)},[sessionReady,imageSessionKey(items)]);
  useEffect(()=>()=>{items.forEach(x=>{if(x.preview)URL.revokeObjectURL(x.preview);if(x.result?.url&&x.result.url!==x.preview)URL.revokeObjectURL(x.result.url)})},[]);
  const keyFor=file=>"toolloot:image-quality:"+file.name+":"+file.size+":"+file.lastModified;
  const remembered=file=>{try{return {...defaults,...JSON.parse(localStorage.getItem(keyFor(file))||"{}")}}catch{return {...defaults}}};
  const makeItem=file=>({id:crypto.randomUUID(),file,preview:URL.createObjectURL(file),settings:remembered(file),result:null});
  const addFiles=input=>{const picked=Array.from(input||[]).filter(f=>f.type.startsWith("image/"));if(!picked.length)return;setItems(prev=>{const existing=new Set(prev.map(x=>x.file.name+":"+x.file.size+":"+x.file.lastModified));const fresh=picked.filter(f=>!existing.has(f.name+":"+f.size+":"+f.lastModified));if(!prev.length)setActive(0);return [...prev,...fresh.map(makeItem)]});setProgress(0);notify("success",picked.length+" image"+(picked.length>1?"s":"")+" added");};
  const removeItem=id=>setItems(prev=>{const index=prev.findIndex(i=>i.id===id);const x=prev[index];if(x)URL.revokeObjectURL(x.preview);if(x?.result?.url&&x.result.url!==x.preview)URL.revokeObjectURL(x.result.url);const next=prev.filter(i=>i.id!==id);setActive(a=>Math.max(0,Math.min(index<a?a:a-1,next.length-1)));return next});
  const clearAll=()=>{items.forEach(x=>{URL.revokeObjectURL(x.preview);if(x.result?.url)URL.revokeObjectURL(x.result.url)});setItems([]);setProgress(0);clearImageSession();};
  const updateQuality=value=>setItems(prev=>prev.map(x=>{const settings={...x.settings,quality:value};try{localStorage.setItem(keyFor(x.file),JSON.stringify({quality:value}))}catch{}return {...x,settings,result:null}}));
  useEffect(()=>{let cancelled=false;const run=async()=>{if(!item||busy){if(!item)setEstimatedSize(null);return}setEstimating(true);try{const r=await compressOne(item);if(!cancelled)setEstimatedSize(r.blob.size)}catch{if(!cancelled)setEstimatedSize(null)}finally{if(!cancelled)setEstimating(false)}};const t=setTimeout(run,120);return()=>{cancelled=true;clearTimeout(t)}},[item?.id,item?.settings?.quality]);
  const applyAll=key=>{const source=items[0]?.settings;if(!source)return;setItems(prev=>prev.map(x=>({...x,settings:{...x.settings,[key]:source[key]},result:null})));notify("success","Applied "+key+" to all images");};
  const applySettingsToAll=source=>{if(!source)return;setItems(prev=>prev.map(x=>{try{localStorage.setItem(keyFor(x.file),JSON.stringify(source))}catch{}return {...x,settings:{...source},result:null}}));notify("success","First image settings applied to all");};
  const encode=(canvas,type,q)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Encoding failed")),type,q));
  const typeFor=item=>{const t=(item.file.type||"").toLowerCase();if(t==="image/jpeg"||t==="image/jpg")return "image/jpeg";if(t==="image/png")return "image/png";if(t==="image/webp")return "image/webp";if(t==="image/avif")return "image/avif";if(t==="image/gif")return "image/png";return "image/png";};
  const compressOne=async item=>{
    const s=item.settings,url=item.preview,img=new Image();img.src=url;
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});
    const scale=s.maxWidth&&img.width>s.maxWidth?s.maxWidth/img.width:1,w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),turn=s.rotate%360,canvas=document.createElement("canvas");
    canvas.width=turn%180?h:w;canvas.height=turn%180?w:h;const ctx=canvas.getContext("2d");ctx.imageSmoothingQuality="high";ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(turn*Math.PI/180);ctx.scale(s.flip?-1:1,1);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
    if((item.file.type||"").toLowerCase()==="image/gif"){return {name:item.file.name,blob:item.file,width:img.width,height:img.height,url:item.preview,original:item.file.size,originalUrl:item.preview,settings:{...s},unchanged:true};}
    const type=typeFor(item);let blob=await encode(canvas,type,type==="image/png"?undefined:s.quality);
    if(blob.type!==type){return {name:item.file.name,blob:item.file,width:img.width,height:img.height,url:item.preview,original:item.file.size,originalUrl:item.preview,settings:{...s},unchanged:true};}
    if(s.targetKB>0&&/jpeg|webp|avif/.test(blob.type)&&blob.size>s.targetKB*1024){let lo=.1,hi=s.quality,best=blob;for(let n=0;n<9;n++){const mid=(lo+hi)/2,b=await encode(canvas,type,mid);if(b.size<=s.targetKB*1024){best=b;lo=mid}else hi=mid}blob=best;}
    if(blob.size>=item.file.size){
      return {name:item.file.name,blob:item.file,width:img.width,height:img.height,url:item.preview,original:item.file.size,originalUrl:item.preview,settings:{...s},unchanged:true};
    }
    const ext=type==="image/jpeg"?"jpg":type.split("/")[1]||"bin",name=item.file.name.replace(/\.[^.]+$/,"")+"-compressed."+ext;
    return {name,blob,width:canvas.width,height:canvas.height,url:URL.createObjectURL(blob),original:item.file.size,originalUrl:item.preview,settings:{...s},unchanged:false};
  };
  const waitGeneration=async()=>{setProgress(0);return new Promise(resolve=>{const started=Date.now();const timer=setInterval(()=>{const pct=Math.min(100,Math.round(((Date.now()-started)/5000)*100));setProgress(pct);if(pct>=100){clearInterval(timer);resolve();}},80);});};
  const compressSingle=async id=>{const selected=items.find(x=>x.id===id);if(!selected||busy)return;setBusy(true);setGeneration(1);await waitGeneration();try{const r=await compressOne(selected);setItems(prev=>prev.map(x=>x.id===id?{...x,result:r}:x));notify("success","Smart compression complete");}catch(e){notify("error","Compression failed");}finally{setBusy(false);}};
  return <Layout><Seo title="Image Compressor - Free Online | ToollooT" description="Compress multiple images with individual settings directly in your browser."/>
    <main className="toolPage"><div className="container toolPageInner"><a className="backLink" href={link("/")}>Back to ToollooT</a>
      <div className="toolTitle compactToolTitle"><div className="toolIcon large"><Sparkles size={22}/></div><div><h1>Image Compressor</h1><p>Choose → quality → compress → download.</p></div></div>
      {items.length===0&&<ChooseImage accept="image/*" multiple={true} onFiles={addFiles} label="Choose images"/>}
      {items.length>0&&<div className="compressWorkspace">
        <div className="compressorFixedTimeline"><ToolFileTimeline items={items} activeIndex={active} onSelect={setActive} onRemove={removeItem}/></div>
        <div className="timelineAddBar"><ChooseImage className="compactAddPicker" accept="image/*" multiple={true} onFiles={addFiles} label="Add more images"/><button type="button" className="timelineClearButton" onClick={clearAll} disabled={busy}><Trash2 size={13}/> Clear all</button></div>
        {item&&<div className="editorPanel"><ToolPreview item={item} busy={busy} generation={generation+" of "+items.length} progress={progress} onRemove={removeItem}/>
          <div className="contextSettings aiCompressorControls"><div className="aiSettingsIntro"><div className="aiBadge"><Sparkles size={14}/> Smart compression</div><strong>One setting for all images</strong><span>Choose quality once. ToollooT applies it to every selected image automatically.</span></div>
            <label className="qualityControl"><div><span>Quality</span><b>{Math.round(item.settings.quality*100)}%</b></div><input type="range" min=".1" max="1" step=".05" value={item.settings.quality} onChange={e=>updateQuality(Number(e.target.value))}/><div className="realtimeSize"><span>Estimated size</span><strong>{estimating?"Calculating…":estimatedSize!=null?formatBytes(estimatedSize):"—"}</strong>{estimatedSize!=null&&<em>{item.file.size>estimatedSize?Math.round((1-estimatedSize/item.file.size)*100)+"% smaller":"No size reduction"}</em>}</div><small>Lower = smaller file Â· Higher = more detail</small></label>
            <button className="primaryButton compressSelected aiCompressButton" disabled={busy} onClick={()=>compressSingle(item.id)}><Gauge size={17}/> {busy?"Generating…":item.result?"Compress again":"Compress image"}</button>
          </div>
          {item.result&&!busy&&<div className="resultSummary"><span>{item.result.width} Ã— {item.result.height}</span><strong>{formatBytes(item.file.size)} → {formatBytes(item.result.blob.size)}</strong><span>{item.file.size>item.result.blob.size?Math.round((1-item.result.blob.size/item.file.size)*100)+"% smaller":"No size reduction"}</span><a className="downloadButton" href={item.result.url} download={item.result.name}><Download size={15}/> Download</a></div>}
        </div>}
        <div className="compressorGuideDock"><CompressorGuide count={items.length} hasResult={!!items.some(x=>x.result)} onClear={()=>{clearAll();clearImageSession()}}/></div>
        <div className="workspaceMiniFooter"><span><strong>{items.length}</strong> image{items.length>1?"s":""} selected</span><span className="workspaceReadyHint"><Sparkles size={12}/> Individual processing • local only</span></div>
      </div>}
      <div className="privacyNote"><Shield size={17}/><span>Everything is processed locally in your browser. Your images are not uploaded.</span></div>
      <div className="toolHelpLink"><a href={link("/how-to-use/image-compressor")}>How to use Image Compressor <span>→</span></a></div>
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
    {r&&<div className="itemResult"><div className="miniResultPreview"><span className="previewLabel">Compressed preview</span><img src={r.url} alt={"Compressed "+item.file.name}/></div><div className="resultInfo"><strong>{r.name}</strong><span>{r.width} Ã— {r.height} • {formatBytes(r.original)} → {formatBytes(r.blob.size)} • {r.original>r.blob.size?Math.round((1-r.blob.size/r.original)*100)+"% smaller":"No size reduction"}</span><button className="textButton" onClick={()=>{}}>Settings stay with this image</button></div></div>}
  </article>;
}
function App(){
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ const t=setTimeout(()=>setLoading(false),450); return ()=>clearTimeout(t); },[]);
  return <>{loading&&<div className="pageLoader" role="status" aria-label="Loading"><div className="pageLoaderSpinner"/><span>Loading ToollooT…</span></div>}<Root/></>;
}
function Root(){
  const path=window.location.pathname.replace(/\/+$/,"")||"/";
  const local=path.replace(BASE.replace(/\/$/,""),"")||"/";
  if(local==="/tools/image-compressor")return <ImageCompressor/>;
  if(local==="/tools/compress-to-size")return <ExactSizeCompressor link={link} Layout={Layout} Seo={Seo}/>;
  if(local.startsWith("/tools/")){const id=local.split("/").pop();if(imageToolMeta[id])return <ImageBatchTool toolId={id} link={link} Layout={Layout} Seo={Seo}/>;}
  if(local==="/how-to-use")return <HowToUsePage/>;
  if(local==="/how-to-use/image-compressor")return <ImageCompressorGuide/>;
  if(local.startsWith("/how-to-use/")){const id=local.split("/").pop();if(id==="compress-to-size"||imageToolMeta[id])return <ImageToolGuide toolId={id} link={link} Layout={Layout} Page={Page}/>;}
  if(local==="/categories")return <CategoriesPage/>;
  if(local==="/categories/ai")return <CategoryPage categoryName="AI & Smart" slug="ai"/>;
  if(local==="/categories/developer")return <CategoryPage categoryName="Developer" slug="developer"/>;
  if(local==="/categories/images")return <CategoryPage categoryName="Images" slug="images"/>;
  if(local==="/categories/documents")return <CategoryPage categoryName="Documents" slug="documents"/>;
  if(local==="/categories/calculators")return <CategoryPage categoryName="Calculators" slug="calculators"/>;
  if(local==="/analytics")return <Layout><Seo title="ToollooT Analytics" description="ToollooT site analytics dashboard."/><main className="staticPage"><AnalyticsPage/></main></Layout>;
  if(local==="/about")return <AboutPage/>;
  if(local==="/privacy")return <PrivacyPage/>;
  if(local==="/terms")return <TermsPage/>;
  if(local==="/contact")return <ContactPage/>;
  return <Home/>;
}
createRoot(document.getElementById("root")).render(<App/>);
