import React,{useRef,useState} from "react";
import Swal from "sweetalert2";
import {Camera,Clipboard,FileImage,FolderOpen,Link2,MonitorUp,FolderArchive,Plus,ChevronDown} from "lucide-react";

const imageOnly=files=>Array.from(files||[]).filter(f=>f.type.startsWith("image/")||/\.(heic|heif|avif|bmp|tif|tiff|gif)$/i.test(f.name));
const fromUrl=async url=>{const r=await fetch(url);if(!r.ok)throw new Error("Image could not be loaded");const b=await r.blob();if(!b.type.startsWith("image/"))throw new Error("URL is not an image");return new File([b],"remote-image."+((b.type.split("/")[1]||"jpg")),{type:b.type})};

export function ImageSourcePicker({onFiles,accept="image/*",multiple=true,label="Choose images"}){
 const [open,setOpen]=useState(false),[drag,setDrag]=useState(false);
 const input=useRef(null),camera=useRef(null),folder=useRef(null),zip=useRef(null);
 const add=files=>{const fs=imageOnly(files);if(fs.length)onFiles(fs)};
 const pick=e=>{add(e.target.files);e.target.value=""};
 const paste=async()=>{setOpen(false);try{if(!navigator.clipboard?.read)throw new Error("Clipboard image access is not supported");const items=await navigator.clipboard.read(),files=[];for(const item of items)for(const type of item.types)if(type.startsWith("image/")){files.push(new File([await item.getType(type)],"pasted-image."+type.split("/")[1],{type}));break}if(files.length)onFiles(files);else throw new Error("No image found in clipboard")}catch(e){Swal.fire({icon:"info",title:"Paste image",text:e?.message||"Copy an image and try again."})}};
 const url=async()=>{setOpen(false);const r=await Swal.fire({title:"Add image URL",input:"url",inputPlaceholder:"https://example.com/photo.jpg",showCancelButton:true,confirmButtonText:"Add image",inputValidator:v=>!v?"Enter an image URL":undefined});if(!r.isConfirmed)return;try{onFiles([await fromUrl(r.value)])}catch(e){Swal.fire({icon:"error",title:"Could not add image",text:"Use a direct image URL that permits browser CORS access."})}};
 const screenShot=async()=>{setOpen(false);try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false}),video=document.createElement("video");video.srcObject=stream;await video.play();await new Promise(r=>setTimeout(r,150));const c=document.createElement("canvas");c.width=video.videoWidth;c.height=video.videoHeight;c.getContext("2d").drawImage(video,0,0);stream.getTracks().forEach(t=>t.stop());c.toBlob(b=>b&&onFiles([new File([b],"screenshot.png",{type:"image/png"})]),"image/png")}catch(e){Swal.fire({icon:"info",title:"Screenshot",text:e?.message||"Screen capture cancelled."})}};
 const zipImport=async e=>{setOpen(false);const f=e.target.files?.[0];e.target.value="";if(!f)return;try{const JSZip=(await import("jszip")).default,z=await JSZip.loadAsync(f),files=[];for(const name of Object.keys(z.files)){const x=z.files[name];if(x.dir||!/\.(jpe?g|png|webp|avif|gif|bmp|tiff?|heic|heif)$/i.test(name))continue;const b=await x.async("blob");files.push(new File([b],name.split("/").pop(),{type:b.type||"application/octet-stream"}))}if(files.length)onFiles(files);else throw new Error("No supported images found in ZIP")}catch(e){Swal.fire({icon:"error",title:"ZIP import failed",text:e?.message||"Could not read ZIP"})}};
 const choose=(ref)=>{setOpen(false);ref.current?.click()};
 const onDrop=e=>{e.preventDefault();setDrag(false);add(e.dataTransfer.files)};
 return <div className={"sourcePicker "+(drag?"isDragging":"")} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>
  <div className="sourcePickerTitle"><FileImage size={18}/><div><strong>Drop images here or choose files</strong><span>Multiple images supported • No upload • Local processing</span></div></div>
  <div className="sourcePickerChoose"><button type="button" className="sourceChooseButton" onClick={()=>setOpen(x=>!x)}><FolderOpen size={18}/><span>{label}</span><ChevronDown size={16}/></button>
   {open&&<div className="sourceMenu">
    <button type="button" onClick={()=>choose(input)}><FolderOpen/><span>Device files</span><small>JPG, PNG, WebP, GIF, HEIC…</small></button>
    <button type="button" className="sourceMobileOnly" onClick={()=>choose(camera)}><Camera/><span>Camera</span><small>Take a new photo</small></button>
    <button type="button" onClick={paste}><Clipboard/><span>Clipboard / Paste</span><small>Paste copied images</small></button>
    <button type="button" onClick={url}><Link2/><span>Image URL</span><small>Direct CORS image URL</small></button>
    <button type="button" className="sourceDesktopOnly" onClick={()=>choose(folder)}><FolderOpen/><span>Folder</span><small>Import an image folder</small></button>
    <button type="button" onClick={()=>choose(zip)}><FolderArchive/><span>ZIP Import</span><small>Extract images locally</small></button>
    <button type="button" className="sourceDesktopOnly" onClick={screenShot}><MonitorUp/><span>Screenshot</span><small>Capture your screen</small></button>
    <button type="button" onClick={()=>choose(input)}><Plus/><span>Add more images</span><small>Append to current batch</small></button>
   </div>}
  </div>
  <input ref={input} hidden type="file" accept={accept} multiple={multiple} onChange={pick}/>
  <input ref={camera} hidden type="file" accept={accept} capture="environment" onChange={pick}/>
  <input ref={folder} hidden type="file" accept={accept} webkitdirectory="" directory="" multiple onChange={pick}/>
  <input ref={zip} hidden type="file" accept=".zip,application/zip" onChange={zipImport}/>
  <div className="sourcePickerHint">Drag & drop • Multiple images • Everything stays on your device</div>
 </div>
}