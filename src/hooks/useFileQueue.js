import { useCallback, useEffect, useState } from "react";
export function useFileQueue({ multiple=true, accept }={}) {
  const [files,setFiles]=useState([]), [active,setActive]=useState(0);
  const addFiles=useCallback(input=>{const picked=Array.from(input||[]).filter(f=>!accept||f.type.match(accept)); if(!picked.length)return; setFiles(prev=>{const seen=new Set(prev.map(f=>f.name+":"+f.size+":"+f.lastModified)); const fresh=picked.filter(f=>!seen.has(f.name+":"+f.size+":"+f.lastModified)); return multiple?[...prev,...fresh]:fresh.slice(0,1)});},[multiple,accept]);
  const removeFile=useCallback(index=>setFiles(prev=>prev.filter((_,i)=>i!==index)),[]);
  const clearAll=useCallback(()=>setFiles([]),[]);
  useEffect(()=>{setActive(a=>Math.max(0,Math.min(a,files.length-1)))},[files.length]);
  return {files,activeFile:files[active]||null,activeIndex:active,setActive,addFiles,removeFile,clearAll};
}
