import React from "react";
import { Download, Sparkles, Trash2 } from "lucide-react";

export function ToolPreview({item,busy=false,generation=0,progress=0,onRemove,showDownload=false}) {
  if(!item) return null;
  const result=item.result;
  return <div className="toolPreview">
    <div className="toolPreviewToolbar">
      <strong title={item.file.name}>{item.file.name}</strong>
      <span>{formatPreviewBytes(item.file.size)}</span>
      {onRemove&&<button className="iconOnly" onClick={()=>onRemove(item.id)} aria-label="Remove image"><Trash2 size={16}/></button>}
    </div>
    <div className="toolPreviewCanvas">
      <img className={result&&!busy?"compressedVisible":"originalVisible"} src={result&&!busy?result.url:item.preview} alt={result&&!busy?"Compressed "+item.file.name:item.file.name}/>
      {result&&!busy&&<div className="toolPreviewBadge"><Sparkles size={13}/> Compressed</div>}
      {busy&&<div className="toolPreviewGeneration">
        <div className="toolPreviewGenerationImage"><img src={item.preview} alt="Generating compressed preview"/><div className="toolPreviewSweep"/></div>
        <div className="generationDots"><span/><span/><span/></div>
        <strong>Generating compressed image…</strong>
        <small>Image {generation} • {progress}%</small>
        <div className="toolPreviewProgress"><i style={{width:progress+"%"}}/></div>
      </div>}
    </div>
    {result&&!busy&&showDownload&&<a className="downloadButton toolPreviewDownload" href={result.url} download={result.name}><Download size={15}/> Download</a>}
  </div>;
}
function formatPreviewBytes(bytes) {
  if(!bytes) return "0 B";
  const units=["B","KB","MB","GB"];
  const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  return (bytes/1024**i).toFixed(i?2:0)+" "+units[i];
}
