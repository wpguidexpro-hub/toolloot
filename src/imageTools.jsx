import React, { useState } from "react";
import { Upload, Download, DownloadCloud, Gauge, Image as ImageIcon, Shield, Trash2, SlidersHorizontal, Check, Eye, EyeOff } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ChooseImage } from "./components/ChooseImage.jsx";

export const imageToolMeta = {
  "image-resizer":{title:"Image Resizer",description:"Resize multiple images by pixels, percentage or presets.",kind:"resize"},
  "image-converter":{title:"Image Converter",description:"Convert multiple images between JPG, PNG, WebP and AVIF.",kind:"convert"},
  "jpg-to-png":{title:"JPG to PNG",description:"Convert JPG images to PNG locally in your browser.",kind:"jpgpng"},
  "jpg-to-webp":{title:"JPG to WebP",description:"Convert JPG images to WebP locally in your browser.",kind:"jpgwebp"},
  "webp-to-jpg":{title:"WebP to JPG",description:"Convert WebP images to JPG locally in your browser.",kind:"webpjpg"},
  "heic-to-jpg":{title:"HEIC to JPG",description:"Convert iPhone HEIC photos to JPG without uploading them.",kind:"heic"},
  "image-cropper":{title:"Image Cropper",description:"Crop images with freeform or common aspect ratios.",kind:"crop"},
  "background-remover":{title:"Background Remover",description:"Remove backgrounds with an on-device AI model.",kind:"background"},
  "compress-to-size":{title:"Compress to Exact KB/MB",description:"Compress images toward a precise target file size.",kind:"target"}
};
const outputTypeForKind=k=>k==="jpgpng"?"image/png":k==="jpgwebp"?"image/webp":k==="webpjpg"?"image/jpeg":"image/webp";
const outputExt=t=>t==="image/jpeg"?"jpg":t==="image/png"?"png":t==="image/webp"?"webp":t==="image/avif"?"avif":"bin";
const loadImage=file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{URL.revokeObjectURL(img.src);resolve(img)};img.onerror=reject;img.src=URL.createObjectURL(file)});
const canvasBlob=(c,t,q)=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("Encoding failed")),t,q));
const nameFor=(file,type,suffix="")=>file.name.replace(/\.[^.]+$/i,"")+suffix+"."+outputExt(type);
function getResizePreviewSize(img,s){let w=img.width,h=img.height;if(s?.preset&&s.preset!=="custom"){[w,h]=s.preset.split("x").map(Number)}else if(s?.percent!==100){w=Math.max(1,Math.round(img.width*s.percent/100));h=Math.max(1,Math.round(img.height*s.percent/100))}else if(s?.width){w=Math.max(1,s.width);h=s.lock?Math.max(1,Math.round(img.height*s.width/img.width)):(s.height||img.height)}else if(s?.height){h=Math.max(1,s.height);w=s.lock?Math.max(1,Math.round(img.width*s.height/img.height)):img.width}return[w,h]}
function ResizeLivePreview({item,settings}){const [info,setInfo]=useState(null);React.useEffect(()=>{if(!item)return;let alive=true;const img=new Image();img.onload=()=>{if(alive)setInfo({src:item.url,original:[img.width,img.height],output:getResizePreviewSize(img,settings)})};img.src=item.url;return()=>{alive=false}},[item?.id,settings?.preset,settings?.width,settings?.height,settings?.percent,settings?.lock]);if(!item||!info)return null;const[w,h]=info.output;return <div className="resizeLivePreview"><div className="resizeLivePreviewHead"><div><strong>Live Preview</strong><span>Selected output size</span></div><b>{w} × {h} px</b></div><div className="resizeLivePreviewStage" style={{aspectRatio:`${w}/${h}`}}><img src={info.src} alt="Resize preview"/></div><div className="resizeLivePreviewMeta"><span>Original: {info.original[0]} × {info.original[1]} px</span><span>Output: {w} × {h} px</span></div></div>}

function BatchItem({item,onRemove}){
  return <div className="batchItem"><img src={item.resultUrl||item.url} alt=""/><div><strong>{item.file.name}</strong><span>{item.file.size?formatBytesLocal(item.file.size):""}{item.result&&" → "+formatBytesLocal(item.result.size)}</span>{item.error&&<em>{item.error}</em>}</div>{item.result&&<a className="downloadButton" href={item.resultUrl} download={item.outputName}><Download size={14}/></a>}<button className="iconOnly" onClick={()=>onRemove(item.id)} aria-label="Remove"><Trash2 size={16}/></button></div>
}
function formatBytesLocal(bytes){if(!bytes)return"0 B";const u=["B","KB","MB","GB"],i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),3);return(bytes/1024**i).toFixed(i?2:0)+" "+u[i]}

export function LegacyImageBatchTool({toolId,link,Layout,Seo}){
  const m=imageToolMeta[toolId], [files,setFiles]=useState([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
  const [s,setS]=useState({width:0,height:0,percent:100,lock:true,preset:"custom",format:"image/webp",quality:.86,ratio:"free"});
  const set=(k,v)=>setS(x=>({...x,[k]:v}));
  const add=e=>setFiles(p=>[...p,...Array.from(e||[]).filter(f=>f.type.startsWith("image/")||m.kind==="heic").map(f=>({id:crypto.randomUUID(),file:f,url:URL.createObjectURL(f)}))]);
  const remove=id=>setFiles(p=>p.filter(x=>x.id!==id));
  const process=async item=>{
    if(m.kind==="heic"){const {default:heic2any}=await import("heic2any");const b=await heic2any({blob:item.file,toType:"image/jpeg",quality:s.quality});return{blob:Array.isArray(b)?b[0]:b,type:"image/jpeg"}}
    if(m.kind==="background"){const {removeBackground}=await import("@imgly/background-removal");const b=await removeBackground(item.file,{output:{format:"image/png",type:"blob"}});return{blob:b,type:"image/png"}}
    const img=await loadImage(item.file);let w=img.width,h=img.height;
    if(m.kind==="resize"){
      if(s.preset!=="custom"){[w,h]=s.preset.split("x").map(Number)}
      else if(s.percent!==100){w=Math.max(1,Math.round(w*s.percent/100));h=Math.max(1,Math.round(h*s.percent/100))}
      else if(s.width){w=s.width;h=s.lock?Math.max(1,Math.round(img.height*s.width/img.width)):(s.height||img.height)}
    }
    if(m.kind==="crop"){
      const ratio=s.ratio==="free"?null:Number(s.ratio);let cw=img.width,ch=img.height;
      if(ratio){if(cw/ch>ratio)cw=Math.round(ch*ratio);else ch=Math.round(cw/ratio)}
      const sx=Math.round((img.width-cw)/2),sy=Math.round((img.height-ch)/2),c=document.createElement("canvas");
      c.width=cw;c.height=ch;c.getContext("2d").drawImage(img,sx,sy,cw,ch,0,0,cw,ch);
      return{blob:await canvasBlob(c,"image/png",1),type:"image/png"}
    }
    const type=m.kind==="convert"?s.format:outputTypeForKind(m.kind),c=document.createElement("canvas");
    c.width=w;c.height=h;const ctx=c.getContext("2d");
    if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h)}
    ctx.drawImage(img,0,0,w,h);return{blob:await canvasBlob(c,type,s.quality),type}
  };
  const run=async()=>{if(!files.length||busy)return;setBusy(true);const out=[];
    for(let i=0;i<files.length;i++){try{const r=await process(files[i]);out.push({...files[i],result:r,resultUrl:URL.createObjectURL(r.blob),outputName:nameFor(files[i].file,r.type)});}catch(e){out.push({...files[i],error:e?.message||"Processing failed"})}setProgress(Math.round((i+1)/files.length*100))}
    setFiles(out);setBusy(false)
  };
  const downloadZip=async()=>{const ready=files.filter(x=>x.result);if(!ready.length)return;const z=JSZip();ready.forEach(x=>z.file(x.outputName,x.result.blob));saveAs(await z.generateAsync({type:"blob"}),"toolloot-"+m.kind+"-images.zip")};
  const accept=m.kind==="heic"?".heic,.heif":"image/*";
  return <Layout><Seo title={m.title+" - Free Online | ToollooT"} description={m.description}/>
    <main className="toolPage"><div className="container toolPageInner"><a className="backLink" href={link("/")}>Back to ToollooT</a>
      <div className="toolTitle"><div className="toolIcon large"><ImageIcon size={24}/></div><div><h1>{m.title}</h1><p>{m.description} Everything is processed locally in your browser.</p></div></div>
      <div className="imageToolShell"><ChooseImage accept={m.kind==="heic"?".heic,.heif,image/*":"image/*"} onFiles={fs=>add(fs)} />
      {m.kind==="resize"&&<div className="toolControls"><label>Preset<select value={s.preset} onChange={e=>set("preset",e.target.value)}><option value="custom">Custom</option><option value="1080x1080">1080 × 1080</option><option value="1920x1080">1920 × 1080</option><option value="1080x1920">1080 × 1920</option><option value="1280x720">1280 × 720</option></select></label><label>Width<input type="number" min="1" value={s.width||""} onChange={e=>set("width",Number(e.target.value))}/></label><label>Height<input type="number" min="1" value={s.height||""} onChange={e=>set("height",Number(e.target.value))}/></label><label>Scale %<input type="number" min="1" max="1000" value={s.percent} onChange={e=>set("percent",Number(e.target.value))}/></label><label className="checkLine"><input type="checkbox" checked={s.lock} onChange={e=>set("lock",e.target.checked)}/> Keep ratio</label></div>}
      {m.kind==="convert"&&<div className="toolControls"><label>Output format<select value={s.format} onChange={e=>set("format",e.target.value)}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/avif">AVIF</option></select></label><label>Quality<input type="range" min=".1" max="1" step=".05" value={s.quality} onChange={e=>set("quality",Number(e.target.value))}/></label></div>}
      {m.kind==="crop"&&<div className="toolControls"><label>Aspect ratio<select value={s.ratio} onChange={e=>set("ratio",e.target.value)}><option value="free">Free</option><option value="1">1 : 1</option><option value="1.7777778">16 : 9</option><option value=".5625">9 : 16</option><option value="1.3333333">4 : 3</option><option value=".75">3 : 4</option></select></label></div>}
      {files.length>0&&<div className="batchActions"><button className="primaryButton" onClick={run} disabled={busy}><Gauge size={16}/>{busy?"Processing "+progress+"%":"Process all"}</button><button className="secondaryButton" onClick={downloadZip} disabled={!files.some(x=>x.result)}><DownloadCloud size={16}/> Download ZIP</button><button className="textButton" onClick={()=>setFiles([])}>Clear all</button></div>}
      {files.length>0&&<div className="batchList">{files.map(x=><BatchItem key={x.id} item={x} onRemove={remove}/>)}</div>}
      <div className="privacyNote"><Shield size={17}/><span>Local browser processing. Your images are not uploaded to ToollooT.</span></div></div>
      <div className="toolHelpLink"><a href={link("/how-to-use/"+toolId)}>How to use {m.title} <span>→</span></a></div></div></main></Layout>
}
export function ImageBatchTool({toolId,link,Layout,Seo}){
  const m=imageToolMeta[toolId];
  const base={width:0,height:0,percent:100,lock:true,preset:"custom",format:toolId==="jpgpng"?"image/png":toolId==="jpgwebp"||toolId==="image-converter"?"image/webp":toolId==="webpjpg"?"image/jpeg":"image/webp",quality:.86,ratio:"free"};
  const [files,setFiles]=useState([]),[selected,setSelected]=useState(null),[showTimeline,setShowTimeline]=useState(true),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[batch,setBatch]=useState(base);
  const add=e=>{const added=Array.from(e||[]).filter(f=>f.type.startsWith("image/")||m.kind==="heic").map(f=>({id:crypto.randomUUID(),file:f,url:URL.createObjectURL(f),settings:{...batch}}));setFiles(p=>[...p,...added]);if(!selected&&added[0])setSelected(added[0].id)};
  const remove=id=>{setFiles(p=>p.filter(x=>x.id!==id));if(selected===id)setSelected(null)};
  const updateItem=(id,k,v)=>setFiles(p=>p.map(x=>x.id===id?{...x,settings:{...x.settings,[k]:v}}:x));
  const applyAll=()=>setFiles(p=>p.map(x=>({...x,settings:{...batch}})));
  const current=files.find(x=>x.id===selected);
  const updateBatch=(k,v)=>setBatch(x=>({...x,[k]:v}));
  const process=async item=>{
    const s=item.settings||batch;
    if(m.kind==="heic"){const {default:heic2any}=await import("heic2any");const b=await heic2any({blob:item.file,toType:"image/jpeg",quality:s.quality});return{blob:Array.isArray(b)?b[0]:b,type:"image/jpeg"}}
    if(m.kind==="background"){const {removeBackground}=await import("@imgly/background-removal");const b=await removeBackground(item.file,{output:{format:"image/png",type:"blob"}});return{blob:b,type:"image/png"}}
    const img=await loadImage(item.file);let w=img.width,h=img.height;
    if(m.kind==="resize"){if(s.preset!=="custom"){[w,h]=s.preset.split("x").map(Number)}else if(s.percent!==100){w=Math.max(1,Math.round(w*s.percent/100));h=Math.max(1,Math.round(h*s.percent/100))}else if(s.width){w=s.width;h=s.lock?Math.max(1,Math.round(img.height*s.width/img.width)):(s.height||img.height)}}
    if(m.kind==="crop"){const ratio=s.ratio==="free"?null:Number(s.ratio);let cw=img.width,ch=img.height;if(ratio){if(cw/ch>ratio)cw=Math.round(ch*ratio);else ch=Math.round(cw/ratio)}const sx=Math.round((img.width-cw)/2),sy=Math.round((img.height-ch)/2),c=document.createElement("canvas");c.width=cw;c.height=ch;c.getContext("2d").drawImage(img,sx,sy,cw,ch,0,0,cw,ch);return{blob:await canvasBlob(c,"image/png",1),type:"image/png"}}
    const type=m.kind==="convert"?s.format:outputTypeForKind(m.kind),c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d");if(type==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h)}ctx.drawImage(img,0,0,w,h);return{blob:await canvasBlob(c,type,s.quality),type}
  };
  const run=async()=>{if(!files.length||busy)return;setBusy(true);const out=[];for(let i=0;i<files.length;i++){try{const r=await process(files[i]);out.push({...files[i],result:r,resultUrl:URL.createObjectURL(r.blob),outputName:nameFor(files[i].file,r.type)})}catch(e){out.push({...files[i],error:e?.message||"Processing failed"})}setProgress(Math.round((i+1)/files.length*100))}setFiles(out);setBusy(false)};
  const downloadZip=async()=>{const ready=files.filter(x=>x.result);if(!ready.length)return;const z=JSZip();ready.forEach(x=>z.file(x.outputName,x.result.blob));saveAs(await z.generateAsync({type:"blob"}),"toolloot-"+m.kind+"-images.zip")};
  const controls=(s,setter)=>m.kind==="resize"?<div className="toolControls"><label>Preset<select value={s.preset} onChange={e=>setter("preset",e.target.value)}><option value="custom">Custom</option><option value="1080x1080">1080 × 1080</option><option value="1920x1080">1920 × 1080</option><option value="1080x1920">1080 × 1920</option><option value="1280x720">1280 × 720</option></select></label><label>Width<input type="number" min="1" value={s.width||""} onChange={e=>setter("width",Number(e.target.value))}/></label><label>Height<input type="number" min="1" value={s.height||""} onChange={e=>setter("height",Number(e.target.value))}/></label><label>Scale %<input type="number" min="1" max="1000" value={s.percent} onChange={e=>setter("percent",Number(e.target.value))}/></label><label className="checkLine"><input type="checkbox" checked={s.lock} onChange={e=>setter("lock",e.target.checked)}/> Keep ratio</label></div>:m.kind==="convert"?<div className="toolControls"><label>Output format<select value={s.format} onChange={e=>setter("format",e.target.value)}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/avif">AVIF</option></select></label><label>Quality<input type="range" min=".1" max="1" step=".05" value={s.quality} onChange={e=>setter("quality",Number(e.target.value))}/></label></div>:m.kind==="crop"?<div className="toolControls"><label>Aspect ratio<select value={s.ratio} onChange={e=>setter("ratio",e.target.value)}><option value="free">Free</option><option value="1">1 : 1</option><option value="1.7777778">16 : 9</option><option value=".5625">9 : 16</option><option value="1.3333333">4 : 3</option><option value=".75">3 : 4</option></select></label></div>:m.kind==="heic"?<div className="toolControls"><label>Quality<input type="range" min=".4" max="1" step=".05" value={s.quality} onChange={e=>setter("quality",Number(e.target.value))}/></label></div>:null;
  return <Layout><Seo title={m.title+" - Free Online | ToollooT"} description={m.description}/><main className="toolPage"><div className="container toolPageInner"><a className="backLink" href={link("/")}>Back to ToollooT</a><div className="toolTitle"><div className="toolIcon large"><ImageIcon size={24}/></div><div><h1>{m.title}</h1><p>{m.description} Everything is processed locally in your browser.</p></div></div>
    <div className="imageToolShell"><ChooseImage accept={m.kind==="heic"?".heic,.heif,image/*":"image/*"} onFiles={fs=>add(fs)} />
    {files.length>0&&<div className="timelineHeader"><div><strong>Images</strong><span>{files.length} selected</span></div><button className="secondaryButton" onClick={()=>setShowTimeline(x=>!x)}>{showTimeline?<EyeOff size={15}/>:<Eye size={15}/>} {showTimeline?"Hide timeline":"Show timeline"}</button></div>}
    {files.length>0&&showTimeline&&<div className="imageTimeline imageTimelineTools">{files.map((x,i)=><button className={"timelineThumb "+(selected===x.id?"active":"")} key={x.id} onClick={()=>setSelected(x.id)}><img src={x.resultUrl||x.url} alt=""/><span>{i+1}</span></button>)}</div>}
    {files.length>0&&<div className="settingsMode"><div><strong>Batch settings</strong><span>Set once and apply to all images</span></div><button className="secondaryButton" onClick={applyAll}><Check size={15}/> Apply to all</button></div>}
    {files.length>0&&<div className="batchSettingsPanel">{controls(batch,updateBatch)}</div>}
    {current&&m.kind==="resize"&&<ResizeLivePreview item={current} settings={current.settings}/>} {current&&<div className="individualSettings"><div className="individualSettingsHead"><div><strong>Individual settings</strong><span>{current.file.name}</span></div><button className="secondaryButton" onClick={()=>setSelected(null)}><SlidersHorizontal size={15}/> Close</button></div>{controls(current.settings,(k,v)=>updateItem(current.id,k,v))}</div>}
    {files.length>0&&<div className="batchActions"><button className="primaryButton" onClick={run} disabled={busy}><Gauge size={16}/>{busy?"Processing "+progress+"%":"Process all"}</button><button className="secondaryButton" onClick={downloadZip} disabled={!files.some(x=>x.result)}><DownloadCloud size={16}/> Download ZIP</button><button className="textButton" onClick={()=>setFiles([])}>Clear all</button></div>}
    {files.length>0&&<div className="batchList">{files.map(x=><BatchItem key={x.id} item={x} onRemove={remove}/>)}</div>}<div className="privacyNote"><Shield size={17}/><span>Local browser processing. Your images are not uploaded to ToollooT.</span></div></div><div className="toolHelpLink"><a href={link("/how-to-use/"+toolId)}>How to use {m.title} <span>→</span></a></div></div></main></Layout>
}
export function ImageToolGuide({toolId,link,Layout,Page}){
  const m=toolId==="compress-to-size"?{title:"Compress to Exact KB/MB",kind:"target"}:imageToolMeta[toolId];
  const steps={resize:["Add images.","Choose preset or dimensions.","Keep aspect ratio if needed.","Process all images.","Download results or ZIP."],convert:["Add images.","Choose JPG, PNG, WebP or AVIF.","Adjust quality.","Process all.","Download results or ZIP."],jpgpng:["Choose JPG images.","Start conversion.","Review PNG results.","Download results."],jpgwebp:["Choose JPG images.","Start conversion to WebP.","Review results.","Download results."],webpjpg:["Choose WebP images.","Start conversion to JPG.","Review results.","Download results."],heic:["Choose HEIC/HEIF photos.","Let the local converter load.","Convert to JPG.","Download results."],crop:["Add images.","Choose freeform or aspect ratio.","Batch crop is centered.","Process and download."],background:["Add photos.","On-device AI loads when processing starts.","Wait for the cutout.","Download transparent PNGs."],target:["Add images.","Enter target KB or MB.","Quality is searched toward the target.","Download and verify size."]};
  const list=steps[m.kind]||steps.target; const path=toolId==="compress-to-size"?"/tools/compress-to-size":"/tools/"+toolId;
  return <Page title={"How to Use "+m.title} description={"Step-by-step instructions for "+m.title+" in ToollooT."} icon={ImageIcon}><div className="guideAction"><a className="primaryButton" href={link(path)}><ImageIcon size={16}/> Use {m.title}</a></div><div className="guideSteps">{list.map((s,i)=><div key={s}><b>{i+1}</b><h2>{s}</h2><p>Follow the control shown on the tool page. Processing stays on your device.</p></div>)}</div><div className="guideSection"><h2>Mobile and PC</h2><p>The same responsive page works on phones, tablets and desktop screens with touch controls and batch file selection.</p></div><div className="guideSection"><h2>Privacy</h2><p>These tools are designed for local browser processing. Your selected image pixels are not uploaded to ToollooT.</p></div></Page>
}export function ExactSizeCompressor({link,Layout,Seo}){
  const [files,setFiles]=useState([]),[target,setTarget]=useState(200),[unit,setUnit]=useState("KB"),[quality,setQuality]=useState(.85),[busy,setBusy]=useState(false);
  const add=e=>setFiles(p=>[...p,...Array.from(e||[]).filter(f=>f.type.startsWith("image/")).map(f=>({file:f,id:crypto.randomUUID(),url:URL.createObjectURL(f)}))]);
  const run=async()=>{setBusy(true);const max=(unit==="MB"?target*1048576:target*1024),out=[];for(const x of files){try{const img=await loadImage(x.file),c=document.createElement("canvas");c.width=img.width;c.height=img.height;c.getContext("2d").drawImage(img,0,0);let lo=.05,hi=quality,best=await canvasBlob(c,"image/jpeg",hi);for(let n=0;n<12;n++){const q=(lo+hi)/2,b=await canvasBlob(c,"image/jpeg",q);if(b.size>max)hi=q;else{best=b;lo=q}}out.push({...x,result:best,resultUrl:URL.createObjectURL(best),name:x.file.name.replace(/\.[^.]+$/,"")+"-target.jpg"})}catch{out.push(x)}}setFiles(out);setBusy(false)};
  return <Layout><Seo title="Compress to Exact KB/MB - ToollooT" description="Compress images toward a precise target file size in your browser."/><main className="toolPage"><div className="container toolPageInner"><a className="backLink" href={link("/")}>Back to ToollooT</a><div className="toolTitle"><div className="toolIcon large"><Gauge size={24}/></div><div><h1>Compress to Exact KB/MB</h1><p>Set a target size and adjust JPEG quality toward it.</p></div></div><div className="imageToolShell"><ChooseImage onFiles={add}/><div className="toolControls"><label>Target<input type="number" min="1" value={target} onChange={e=>setTarget(Number(e.target.value))}/></label><label>Unit<select value={unit} onChange={e=>setUnit(e.target.value)}><option>KB</option><option>MB</option></select></label><label>Max quality<input type="range" min=".2" max="1" step=".05" value={quality} onChange={e=>setQuality(Number(e.target.value))}/></label></div><div className="batchActions"><button className="primaryButton" onClick={run} disabled={!files.length||busy}><Gauge size={16}/>{busy?"Compressing...":"Compress to target"}</button></div>{files.length>0&&<div className="batchList">{files.map(x=><BatchItem key={x.id} item={{...x,outputName:x.name}} onRemove={id=>setFiles(p=>p.filter(a=>a.id!==id))}/>)}</div>}<div className="privacyNote"><Shield size={17}/><span>Everything runs locally in your browser.</span></div></div><div className="toolHelpLink"><a href={link("/how-to-use/compress-to-size")}>How to use Compress to Exact KB/MB →</a></div></div></main></Layout>
}