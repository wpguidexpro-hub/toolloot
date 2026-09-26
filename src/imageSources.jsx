import React, { useRef } from "react";
import Swal from "sweetalert2";
import { Camera, Clipboard, Cloud, FileImage, FolderOpen, Link2 } from "lucide-react";

const cfg={
  googleClientId:import.meta.env.VITE_GOOGLE_CLIENT_ID||"",
  googleDeveloperKey:import.meta.env.VITE_GOOGLE_DEVELOPER_KEY||"",
  dropboxAppKey:import.meta.env.VITE_DROPBOX_APP_KEY||"",
  oneDriveClientId:import.meta.env.VITE_ONEDRIVE_CLIENT_ID||""
};

const imageOnly=files=>Array.from(files||[]).filter(f=>f.type.startsWith("image/"));
const fromUrl=async url=>{const r=await fetch(url);if(!r.ok)throw new Error("Image could not be loaded");const b=await r.blob();if(!b.type.startsWith("image/"))throw new Error("URL is not an image");return new File([b],"remote-image."+((b.type.split("/")[1]||"jpg")), {type:b.type})};

export function ImageSourcePicker({onFiles,accept="image/*",multiple=true,label="Add images"}) {
  const input=useRef(null),camera=useRef(null);
  const pick=e=>onFiles(imageOnly(e.target.files));
  const paste=async()=>{try{const items=await navigator.clipboard.read();const files=[];for(const item of items){for(const type of item.types){if(type.startsWith("image/")){files.push(new File([await item.getType(type)],"pasted-image."+type.split("/")[1],{type}));break}}}if(files.length)onFiles(files);else throw new Error("No image found in clipboard")}catch(e){Swal.fire({icon:"info",title:"Paste image",text:e?.message||"Browser permission denied. Copy an image and try again."})}};
  const url=async()=>{const r=await Swal.fire({title:"Add image URL",input:"url",inputPlaceholder:"https://example.com/photo.jpg",showCancelButton:true,confirmButtonText:"Add image",inputValidator:v=>!v?"Enter an image URL":undefined});if(!r.isConfirmed)return;try{onFiles([await fromUrl(r.value)])}catch(e){Swal.fire({icon:"error",title:"Could not add image",text:"The server may block browser access (CORS), or the URL is not a direct image."})}};
  const unavailable=(name)=>Swal.fire({icon:"info",title:name+" setup required",html:"This picker is free for users, but the provider requires a free developer app/client ID. Add the corresponding <b>VITE_*</b> value to ToollooT before publishing."});
  const cloud=async name=>unavailable(name);
  return <div className="sourcePicker"><div className="sourcePickerTitle"><FileImage size={17}/><strong>{label}</strong><span>Device, cloud or clipboard</span></div><div className="sourcePickerGrid">
    <button className="sourceButton" onClick={()=>input.current?.click()}><FolderOpen size={18}/><span>Device</span></button>
    <button className="sourceButton" onClick={()=>camera.current?.click()}><Camera size={18}/><span>Camera</span></button>
    <button className="sourceButton" onClick={paste}><Clipboard size={18}/><span>Paste</span></button>
    <button className="sourceButton" onClick={url}><Link2 size={18}/><span>Image URL</span></button>
    <button className="sourceButton cloudSource" onClick={()=>cloud("Google Drive")}><Cloud size={18}/><span>Google Drive</span></button>
    <button className="sourceButton cloudSource" onClick={()=>cloud("Dropbox")}><Cloud size={18}/><span>Dropbox</span></button>
    <button className="sourceButton cloudSource" onClick={()=>cloud("OneDrive")}><Cloud size={18}/><span>OneDrive</span></button>
  </div><input ref={input} hidden type="file" accept={accept} multiple={multiple} onChange={pick}/><input ref={camera} hidden type="file" accept={accept} capture="environment" multiple={multiple} onChange={pick}/></div>
}
export const imageSourceConfig=cfg;
