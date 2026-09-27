import React,{useEffect,useMemo,useState} from "react";
import {ArrowDown,ArrowUp,Check,ChevronRight,Copy,Download,GripVertical,Play,Plus,Save,Settings2,Trash2,Workflow as WorkflowIcon,Zap} from "lucide-react";
import Swal from "sweetalert2";
import {get,set} from "idb-keyval";
import "./workflow.css";

const KEY="toolloot:workflows";
const presets=[
 {id:"image-ready",name:"Image Ready",desc:"Resize, compress and export images.",steps:["resize","compress","convert"]},
 {id:"web-optimized",name:"Web Optimized",desc:"Prepare images for websites.",steps:["resize","compress"]},
 {id:"social-pack",name:"Social Pack",desc:"Create a reusable social-image pipeline.",steps:["resize","convert","compress"]}
];
const catalog={
 resize:{name:"Resize Image",hint:"Set a maximum width or exact dimensions.",icon:"↔"},
 compress:{name:"Compress Image",hint:"Reduce file size while keeping useful quality.",icon:"◉"},
 convert:{name:"Convert Format",hint:"Change JPG, PNG, WebP or AVIF.",icon:"⇄"},
 crop:{name:"Crop Image",hint:"Crop to a fixed aspect ratio.",icon:"⌗"},
 rename:{name:"Rename Files",hint:"Apply a consistent naming pattern.",icon:"Aa"},
 zip:{name:"Create ZIP",hint:"Package workflow results into one archive.",icon:"▣"}
};

function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function notify(icon,title){Swal.fire({icon,title,toast:true,position:"bottom-end",showConfirmButton:false,timer:1700})}
export function WorkflowBuilder(){
 const [flows,setFlows]=useState([]);
 const [active,setActive]=useState(null);
 const [name,setName]=useState("My Workflow");
 const [steps,setSteps]=useState([]);
 const [running,setRunning]=useState(false);
 useEffect(()=>{get(KEY).then(x=>setFlows(x||[]))},[]);
 const selected=useMemo(()=>flows.find(x=>x.id===active),[flows,active]);
 const persist=async next=>{setFlows(next);await set(KEY,next)};
 const open=f=>{setActive(f.id);setName(f.name);setSteps(f.steps||[])};
 const create=()=>{const f={id:uid(),name:"Untitled Workflow",steps:[]};persist([f,...flows]);open(f)};
 const save=async()=>{const f={id:active||uid(),name:name.trim()||"Untitled Workflow",steps};const next=flows.some(x=>x.id===f.id)?flows.map(x=>x.id===f.id?f:x):[f,...flows];await persist(next);setActive(f.id);notify("success","Workflow saved locally")};
 const add=type=>setSteps(s=>[...s,{id:uid(),type,settings:{}}]);
 const remove=id=>setSteps(s=>s.filter(x=>x.id!==id));
 const move=(i,d)=>setSteps(s=>{const n=[...s],j=i+d;if(j<0||j>=n.length)return s;[n[i],n[j]]=[n[j],n[i]];return n});
 const run=async()=>{if(!steps.length)return notify("info","Add at least one step");setRunning(true);for(let i=0;i<steps.length;i++)await new Promise(r=>setTimeout(r,450));setRunning(false);notify("success","Workflow simulation completed")};
 const duplicate=async()=>{if(!selected)return;const f={...selected,id:uid(),name:selected.name+" Copy",steps:selected.steps.map(s=>({...s,id:uid()}))};await persist([f,...flows]);open(f)};
 return <div className="workflowPage"><header className="workflowHero"><div><span className="workflowKicker"><Zap size={14}/> TOOLLOOT AUTOMATION</span><h1>Build your own workflow.</h1><p>Combine ToollooT actions into a reusable personal mini-app. Saved workflows stay in this browser.</p></div><button className="workflowPrimary" onClick={create}><Plus size={17}/> New workflow</button></header>
 <div className="workflowLayout"><aside className="workflowLibrary"><div className="libraryHead"><b>My workflows</b><span>{flows.length}</span></div>{flows.map(f=><button className={active===f.id?"selected":""} onClick={()=>open(f)} key={f.id}><WorkflowIcon size={16}/><span><strong>{f.name}</strong><small>{f.steps.length} steps</small></span><ChevronRight size={14}/></button>)}{!flows.length&&<div className="workflowEmpty">Create a workflow and it will appear here.</div>}<div className="presetTitle">START FROM A RECIPE</div>{presets.map(p=><button className="recipe" key={p.id} onClick={()=>{const f={id:uid(),name:p.name,steps:p.steps.map(type=>({id:uid(),type,settings:{}}))};persist([f,...flows]);open(f)}}><SparkIcon/><span><strong>{p.name}</strong><small>{p.desc}</small></span></button>)}</aside>
 <main className="workflowCanvas"><div className="canvasTop"><div><input value={name} onChange={e=>setName(e.target.value)} aria-label="Workflow name"/><span>Personal automation · browser local</span></div><div className="canvasActions"><button onClick={duplicate} disabled={!selected}><Copy size={15}/> Duplicate</button><button onClick={save}><Save size={15}/> Save</button><button className="runButton" onClick={run} disabled={running}><Play size={15}/>{running?"Running…":"Run workflow"}</button></div></div>
 <div className="workflowFlow"><div className="flowNode trigger"><div className="nodeIcon">↥</div><div><b>Input</b><span>Files or data</span></div></div>{steps.map((s,i)=><React.Fragment key={s.id}><div className="flowConnector"><span>↓</span></div><div className="flowNode"><div className="nodeIcon">{catalog[s.type]?.icon||"•"}</div><div className="nodeBody"><div><b>{i+1}. {catalog[s.type]?.name}</b><span>{catalog[s.type]?.hint}</span></div><div className="nodeTools"><button onClick={()=>move(i,-1)} title="Move up"><ArrowUp size={14}/></button><button onClick={()=>move(i,1)} title="Move down"><ArrowDown size={14}/></button><button title="Settings"><Settings2 size={14}/></button><button onClick={()=>remove(s.id)} title="Remove"><Trash2 size={14}/></button></div></div></div></React.Fragment>)}<div className="flowConnector"><span>↓</span></div><div className="flowNode output"><div className="nodeIcon"><Download size={17}/></div><div><b>Output</b><span>Download or continue to next action</span></div></div></div>
 <div className="addStep"><span><Plus size={15}/> Add action</span>{Object.entries(catalog).map(([id,c])=><button key={id} onClick={()=>add(id)}><b>{c.icon}</b>{c.name}</button>)}</div></main></div></div>
}
function SparkIcon(){return <span className="recipeIcon">✦</span>}
