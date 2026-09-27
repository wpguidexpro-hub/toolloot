import React from "react";
import { CheckCircle2, Clock3, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

export function CompressorGuide({count=0,hasResult=false,onClear}){
 const added=count>0?(count+" image"+(count>1?"s":"")+" added"):"Add your images";
 return <aside className="compressorGuide">
  <div className="compressorGuideHead"><div className="aiGuideIcon"><Sparkles size={16}/></div><div><strong>Smart guide</strong><span>I'll keep the workflow simple.</span></div></div>
  <div className="guideStepsMini">
   <div className={count?"done":""}><b>{count?<CheckCircle2 size={14}/>:1}</b><span>{added}</span></div>
   <div className={hasResult?"done":""}><b>{hasResult?<CheckCircle2 size={14}/>:2}</b><span>{hasResult?"Compression ready":"Pick quality and preview the size"}</span></div>
   <div><b>3</b><span>Compress, review and download</span></div>
  </div>
  <div className="guideTrust"><ShieldCheck size={14}/><span>Files stay in this browser.</span></div>
  <div className="guideExpiry"><Clock3 size={14}/><span>Saved locally for up to 1 hour after your last change.</span></div>
  {count>0&&<button className="guideClear" type="button" onClick={onClear}><Trash2 size={13}/> Delete saved images</button>}
 </aside>
}
