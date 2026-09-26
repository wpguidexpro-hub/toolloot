import React, { useRef } from "react";
import Swal from "sweetalert2";
import { Camera, Clipboard, FileImage, FolderOpen, Link2, MonitorUp, FolderArchive, Plus, GripVertical } from "lucide-react";

const imageOnly=files=>Array.from(files||[]).filter(f=>f.type.startsWith("image/")||/\.(heic|heif|avif|bmp|tif|tiff|gif)$/i.test(f.name));
const fromUrl=async url=>{const r=await fetch(url);if(!r.ok)throw new Error("Image could not be loaded");const b=await r.blob();if(!b.type.startsWith("image/"))throw new Error("URL is not an image");return new File([b],"remote-image."+((b.type.split("/")[1]||"jpg")),{type:b.type})};

export function ImageSourcePicker({onFiles,accept="image/*",multiple=true,label="Add images"}) {
  const input=useRef(null),camera=useRef(null),folder=useRef(null),zip=useRef(null),screen=useRef(null);
  const pick=e=>{onFiles(imageOnly(e.target.files));e.target.value=""};
  const paste=async()=>{try{if(!navigator.clipboard?.read)throw new Error("Clipboard image access is not supported in this browser");const items=await navigator.clipboard.read();const files=[];for(const item of items){for(const type of item.types){if(type.startsWith("image/")){files.push(new File([await item.getType(type)],"pasted-image."+type.split("/")[1],{type}));break}}}if(files.length)onFiles(files);else throw new Error("No image found in clipboard")}catch(e){Swal.fire({icon:"info",title:"Paste image",text:e?.message||"Copy an image and try again."})}};
  const url=async()=>{const r=await Swal.fire({title:"Add image URL",input:"url",inputPlaceholder:"https://example.com/photo.jpg",showCancelButton:true,confirmButtonText:"Add image",inputValidator:v=>!v?"Enter an image URL":undefined});if(!r.isConfirmed)return;try{onFiles([await fromUrl(r.value)])}catch(e){Swal.fire({icon:"error",title:"Could not add image",text:"The URL must be a direct image and allow browser CORS access."})}};
  const screenShot=async()=>{try{if(!navigator.mediaDevices?.getDisplayMedia)throw new Error("Screen capture is not supported");const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const video=document.createElement("video");video.srcObject=stream;await video.play();await new Promise(r=>setTimeout(r,150));const c=document.createElement("canvas");c.width=video.videoWidth;c.height=video.videoHeight;c.getContext("2d").drawImage(video,0,0);stream.getTracks().forEach(t=>t.stop());c.toBlob(b=>b&&onFiles([new File([b],"screenshot.png",{type:"image/png"})]),"image/png")}catch(e){Swal.fire({icon:"info",title:"Screen capture",text:e?.message||"Screen capture cancelled."})}};
  const zipImport=async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{const JSZip=(await import("jszip")).default;const z=await JSZip.loadAsync(f);const files=[];for(const name of Object.keys(z.files)){const x=z.files[name];if(x.dir||!/\.(jpe?g|png|webp|avif|gif|bmp|tiff?|heic|heif)$/i.test(name))continue;const b=await x.async("blob");files.push(new File([b],name.split("/").pop(),{type:b.type||"application/octet-stream"}))}if(files.length)onFiles(files);else throw new Error("No supported images found in ZIP")}catch(e){Swal.fire({icon:"error",title:"ZIP import failed",text:e?.message||"Could not read ZIP"})}};
  return <div className="sourcePicker"><div className="sourcePickerTitle"><FileImage size={17}/><strong>{label}</strong><span>Local-first • no server upload</span></div><div className="sourcePickerGrid">
    <button type="button" className="sourceButton" onClick={()=>input.current?.click()}><FolderOpen size={18}/><span>Device</span></button>
    <button type="button" className="sourceButton" onClick={()=>camera.current?.click()}><Camera size={18}/><span>Camera</span></button>
    <button type="button" className="sourceButton" onClick={paste}><Clipboard size={18}/><span>Paste</span></button>
    <button type="button" className="sourceButton" onClick={url}><Link2 size={18}/><span>Image URL</span></button>
    <button type="button" className="sourceButton" onClick={()=>folder.current?.click()}><FolderOpen size={18}/><span>Folder</span></button>
    <button type="button" className="sourceButton" onClick={()=>zip.current?.click()}><FolderArchive size={18}/><span>ZIP Import</span></button>
    <button type="button" className="sourceButton" onClick={screenShot}><MonitorUp size={18}/><span>Screenshot</span></button>
    <button type="button" className="sourceButton" onClick={()=>input.current?.click()}><Plus size={18}/><span>Add More</span></button>
  </div><input ref={input} hidden type="file" accept={accept} multiple={multiple} onChange={pick}/><input ref={camera} hidden type="file" accept={accept} capture="environment" onChange={pick}/><input ref={folder} hidden type="file" accept={accept} webkitdirectory="" directory="" multiple onChange={pick}/><input ref={zip} hidden type="file" accept=".zip,application/zip" onChange={zipImport}/><div className="sourcePickerHint"><GripVertical size={14}/> Drag & drop files into the tool • select multiple images • reorder/remove in the batch list</div></div>
}

