import React from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
export function ToolFileTimeline({items,activeIndex=0,onSelect,onRemove}) {
 if(!items?.length) return null;
 return <div className="toolFileTimeline"><button type="button" className="timelineArrow" onClick={()=>onSelect?.(Math.max(0,activeIndex-1))} disabled={activeIndex===0} aria-label="Previous image"><ChevronLeft size={20}/></button><div className="toolFileTimelineTrack">{items.map((item,i)=><button type="button" key={item.id||i} className={'toolFileTimelineItem '+(i===activeIndex?'active':'')} onClick={()=>onSelect?.(i)}><img src={item.preview||item.url} alt=""/><span>{i+1}</span>{item.result&&<b>✓</b>}{onRemove&&<i onClick={e=>{e.stopPropagation();onRemove(item.id??i)}}>×</i>}</button>)}</div><button type="button" className="timelineArrow" onClick={()=>onSelect?.(Math.min(items.length-1,activeIndex+1))} disabled={activeIndex===items.length-1} aria-label="Next image"><ChevronRight size={20}/></button></div>;
}
export function ToolAddBar({onAdd,onClear,disabled=false,addLabel="Add more files",clearLabel="Clear all"}) {
 return <div className="toolAddBar"><button type="button" className="secondaryButton" onClick={onAdd}><Plus size={14}/>{addLabel}</button><button type="button" className="textButton" onClick={onClear} disabled={disabled}><Trash2 size={14}/>{clearLabel}</button></div>;
}
