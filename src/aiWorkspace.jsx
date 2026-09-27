import React, { useEffect, useMemo, useRef, useState } from "react";
import { get, set, del } from "idb-keyval";
import Swal from "sweetalert2";
import { Plus, Search, Menu, X, Send, Paperclip, Image as ImageIcon, FileText, Download, Sparkles, Brain, Users, Settings, MessageSquare, Shield, UserPlus, BarChart3, Loader2 } from "lucide-react";
import { imageCompressLocal, parseToolCommand } from "./aiTools.js";
import "./aiWorkspace.css";

const CHAT_KEY="toolloot:ai:chats", USER_KEY="toolloot:ai:user", TEAM_KEY="toolloot:ai:teams", MEMORY_KEY="toolloot:ai:memory", ANALYTICS_KEY="toolloot:analytics:events";
const uid=()=>crypto.randomUUID(), now=()=>new Date().toISOString();
const emptyChat=()=>({id:uid(),title:"New chat",createdAt:now(),updatedAt:now(),messages:[]});
async function load(k,f){try{return (await get(k))??f}catch{return f}}
async function save(k,v){try{await set(k,v)}catch{}}
async function track(event,data={}){const a=await load(ANALYTICS_KEY,[]);a.push({id:uid(),event,ts:Date.now(),path:location.pathname,session:sessionStorage.getItem("tl-session")||uid(),...data});await save(ANALYTICS_KEY,a.slice(-5000))}
const bytes=n=>{if(!n)return"0 B";const u=["B","KB","MB","GB"],i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),3);return(n/1024**i).toFixed(i?2:0)+" "+u[i]};
function Logo(){return <span className="tlAiLogo"><b>T</b><i>AI</i><b>T</b></span>}

export function ToollooTAI(){
 const [user,setUser]=useState(null),[chats,setChats]=useState([]),[activeId,setActiveId]=useState(null),[memory,setMemory]=useState({facts:[]}),[teams,setTeams]=useState([]);
 const [search,setSearch]=useState(""),[text,setText]=useState(""),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[mobile,setMobile]=useState(false);
 const input=useRef(null),fileInput=useRef(null);
 useEffect(()=>{(async()=>{let u=await load(USER_KEY,null);if(!u){u={id:uid(),name:"Guest User",email:"local@toolloot.app",mode:"guest"};await save(USER_KEY,u)}
   let c=await load(CHAT_KEY,[]);if(!c.length)c=[emptyChat()];setUser(u);setChats(c);setActiveId(c[0].id);setMemory(await load(MEMORY_KEY,{facts:[]}));setTeams(await load(TEAM_KEY,[]));sessionStorage.setItem("tl-session",sessionStorage.getItem("tl-session")||uid());track("app_open")})()},[]);
 useEffect(()=>{if(chats.length)save(CHAT_KEY,chats)},[chats]);
 const active=chats.find(c=>c.id===activeId)||chats[0];
 const visible=useMemo(()=>chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase())),[chats,search]);
 const update=fn=>setChats(p=>p.map(c=>c.id===activeId?fn(c):c));
 const newChat=()=>{const c=emptyChat();setChats(p=>[c,...p]);setActiveId(c.id);setMobile(false);track("chat_created")};
 const chooseFile=e=>{const f=e.target.files?.[0];if(f){setFile(f);track("attachment_added",{type:f.type,size:f.size})}e.target.value=""};
 const send=async()=>{if(busy||(!text.trim()&&!file))return;const promptText=text.trim(),f=file;setText("");setFile(null);setBusy(true);
   const um={id:uid(),role:"user",content:promptText||"Process this file",attachment:f?{name:f.name,type:f.type,size:f.size,blob:f}:null,createdAt:now()};
   update(c=>({...c,messages:[...c.messages,um],title:c.messages.length?c.title:(promptText||f?.name||"New task").slice(0,42),updatedAt:now()}));await track("message_sent",{hasAttachment:!!f,command:promptText});
   try{const cmd=parseToolCommand(promptText,f);let result=null;if(cmd.tool==="image.compress"&&f)result=await imageCompressLocal(f,cmd.targetBytes);
     const msg={id:uid(),role:"assistant",content:result?"Done. "+bytes(f.size)+" -> "+bytes(result.blob.size):"I understood: "+(promptText||"file task")+". The local tool engine is ready for this command.",tool:cmd.tool,result,createdAt:now()};
     update(c=>({...c,messages:[...c.messages,msg],updatedAt:now()}));await track("tool_completed",{tool:cmd.tool,success:!!result});
   }catch(e){update(c=>({...c,messages:[...c.messages,{id:uid(),role:"assistant",content:"I couldn't finish that task locally. Please try again.",createdAt:now()}],updatedAt:now()}));await track("tool_failed")}
   setBusy(false)
 };
 const createTeam=async()=>{const name=window.prompt("Team name");if(!name?.trim())return;const t={id:uid(),name:name.trim(),owner:user.id,members:[{userId:user.id,role:"owner"}],createdAt:now()};const n=[...teams,t];setTeams(n);await save(TEAM_KEY,n);track("team_created");Swal.fire({icon:"success",title:"Team created",text:name,confirmButtonColor:"#111827"})};
 const clearMemory=async()=>{await del(MEMORY_KEY);setMemory({facts:[]});Swal.fire({icon:"success",title:"Memory cleared",toast:true,position:"bottom-end",showConfirmButton:false,timer:1400});track("memory_cleared")};
 return <div className="tlAiShell">
  <aside className={"tlAiSidebar "+(mobile?"open":"")}>
   <div className="tlAiSideTop"><a href="#" className="tlAiBrand"><Logo/><span>ToollooT <small>AI</small></span></a><button className="tlIconBtn mobileOnly" onClick={()=>setMobile(false)}><X size={18}/></button></div>
   <button className="tlNewChat" onClick={newChat}><Plus size={17}/>New chat</button>
   <label className="tlChatSearch"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats"/></label>
   <div className="tlSideLabel">Chats</div>
   <div className="tlChatList">{visible.map(c=><button key={c.id} className={"tlChatItem "+(c.id===activeId?"active":"")} onClick={()=>{setActiveId(c.id);setMobile(false)}}><MessageSquare size={14}/><span>{c.title}</span></button>)}</div>
   <div className="tlSideBottom">
    <button onClick={createTeam}><Users size={16}/>Teams <span>{teams.length}</span></button><button onClick={()=>track("analytics_open")}><BarChart3 size={16}/>Analytics</button><button onClick={clearMemory}><Brain size={16}/>Memory <span>{memory.facts.length}</span></button><button><Settings size={16}/>Settings</button>
    <div className="tlUserMini"><div className="tlAvatar">{user?.name?.[0]||"U"}</div><div><b>{user?.name||"Guest User"}</b><small>Free workspace</small></div></div>
   </div>
  </aside>
  <section className="tlAiMain">
   <header className="tlAiHeader"><button className="tlIconBtn mobileOnly" onClick={()=>setMobile(true)}><Menu size={19}/></button><div><strong>{active?.title||"ToollooT AI"}</strong><span>Free • local-first workspace</span></div><div className="tlHeaderRight"><button className="tlIconBtn" onClick={createTeam}><UserPlus size={18}/></button><button className="tlIconBtn"><Shield size={18}/></button></div></header>
   <main className="tlMessages">{active?.messages.length?active.messages.map(m=><Message key={m.id} message={m}/>):<Welcome onExample={v=>{setText(v);input.current?.focus()}}/>}{busy&&<div className="tlThinking"><Sparkles size={16}/><span>ToollooT is processing locally…</span><Loader2 size={15} className="spin"/></div>}</main>
   <div className="tlComposerWrap">
    <div className="tlSuggestions"><button onClick={()=>setText("Compress this image to 10 KB")}>Compress image</button><button onClick={()=>setText("Resize this image to 1080x1080")}>Resize image</button><button onClick={()=>setText("Convert this image to WebP")}>Convert image</button><button onClick={()=>setText("Merge these PDFs")}>Merge PDFs</button></div>
    {file&&<div className="tlAttachment">{file.type?.startsWith("image/")?<img className="tlAttachmentPreview" src={URL.createObjectURL(file)} alt={file.name}/>:<div className="tlAttachmentFileIcon"><FileText size={17}/></div>}<span><b>{file.name}</b><small>{bytes(file.size)} • {file.type||"file"}</small></span><button onClick={()=>setFile(null)} aria-label="Remove attachment"><X size={15}/></button></div>}
    <div className="tlComposer"><button className="tlIconBtn" onClick={()=>fileInput.current?.click()}><Paperclip size={19}/></button><input ref={fileInput} hidden type="file" accept="image/*,.pdf,.csv,.txt,.doc,.docx" onChange={chooseFile}/><textarea ref={input} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask ToollooT to do something…" rows="1"/><button className="tlSend" onClick={send} disabled={busy||(!text.trim()&&!file)}><Send size={17}/></button></div>
    <div className="tlComposerMeta"><span>Browser-local processing when supported.</span><span>ToollooT AI • Free</span></div>
   </div>
  </section>
 </div>
}

function Welcome({onExample}){return <div className="tlWelcome"><div className="tlWelcomeIcon"><Logo/></div><h1>What can ToollooT do for you?</h1><p>Write the task normally. Attach an image or file and ToollooT will choose the matching utility engine.</p><div className="tlPromptGrid"><button onClick={()=>onExample("Compress this image to 10 KB")}><ImageIcon/><b>Compress an image</b><span>“Make this image 10 KB.”</span></button><button onClick={()=>onExample("Resize this image to 1080x1080")}><ImageIcon/><b>Resize an image</b><span>“Make it square.”</span></button><button onClick={()=>onExample("Convert this image to WebP")}><FileText/><b>Convert a file</b><span>“Turn this into WebP.”</span></button><button onClick={()=>onExample("Create a team workspace")}><Users/><b>Work with a team</b><span>Shared chats and files.</span></button></div></div>}

function Message({message:m}){
 const [attachmentUrl]=useState(()=>m.attachment?.blob&&m.attachment?.type?.startsWith("image/")?URL.createObjectURL(m.attachment.blob):null);
 useEffect(()=>()=>{if(attachmentUrl)URL.revokeObjectURL(attachmentUrl)},[attachmentUrl]);
 return <article className={"tlMsg "+m.role}><div className="tlMsgAvatar">{m.role==="user"?"U":<Logo/>}</div><div className="tlMsgBody"><div className="tlMsgRole">{m.role==="user"?"You":"ToollooT AI"}</div>{m.attachment&&<div className={"tlInlineFile "+(attachmentUrl?"hasPreview":"")}>{attachmentUrl?<img src={attachmentUrl} alt={m.attachment.name}/>:<div className="tlInlineFileIcon"><FileText size={17}/></div>}<div><b>{m.attachment.name}</b><small>{bytes(m.attachment.size)} • {m.attachment.type||"file"}</small></div></div>}<p>{m.content}</p>{m.result&&<ToolResult result={m.result}/>}<time>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time></div></article>
}

function ToolResult({result}){const [url]=useState(()=>URL.createObjectURL(result.blob));useEffect(()=>()=>URL.revokeObjectURL(url),[url]);return <div className="tlResult"><div className="tlResultHead"><Sparkles size={15}/><b>Local tool result</b><span>Ready</span></div><img src={url} alt="Processed result"/><div className="tlResultActions"><a href={url} download={result.name}><Download size={15}/>Download</a><span>{bytes(result.blob.size)}</span></div></div>}
