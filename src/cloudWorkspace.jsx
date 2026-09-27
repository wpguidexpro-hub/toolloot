import React,{useEffect,useState} from "react";
import {Users,UserPlus,Copy,Shield,MessageSquare,Brain,RefreshCw,Plus,Send,Trash2,CheckCircle2} from "lucide-react";
import Swal from "sweetalert2";
import {api,getAccount,cloudEnabled} from "./cloudWorkspace.js";
import "./cloudWorkspace.css";

const notify=(icon,title)=>Swal.fire({icon,title,toast:true,position:"bottom-end",showConfirmButton:false,timer:1800});
const copy=async text=>{await navigator.clipboard?.writeText(text);notify("success","Invite link copied");};

export function CloudWorkspace(){
 const [account,setAccount]=useState(getAccount()),[teams,setTeams]=useState([]),[team,setTeam]=useState(null),[members,setMembers]=useState([]),[chats,setChats]=useState([]),[chat,setChat]=useState(null),[messages,setMessages]=useState([]),[memory,setMemory]=useState([]),[busy,setBusy]=useState(false),[draft,setDraft]=useState(""),[invite,setInvite]=useState(null);
 const [teamName,setTeamName]=useState(""),[memoryKey,setMemoryKey]=useState(""),[memoryValue,setMemoryValue]=useState("");
 const loadTeams=async()=>{const d=await api("/api/teams");setTeams(d.teams||[]);if(!team&&d.teams?.[0])setTeam(d.teams[0])};
 const loadTeam=async t=>{if(!t)return;const d=await api("/api/teams/"+t.id);setTeam({...t,...d.team});setMembers(d.members||[]);const c=await api("/api/teams/"+t.id+"/chats");setChats(c.chats||[]);const m=await api("/api/memory?teamId="+encodeURIComponent(t.id));setMemory(m.memories||[])};
 useEffect(()=>{if(!account?.token||!cloudEnabled())return;loadTeams().catch(e=>notify("error",e.message))},[]);
 useEffect(()=>{if(team?.id)loadTeam(team).catch(e=>notify("error",e.message))},[team?.id]);
 const createTeam=async()=>{if(!teamName.trim())return;setBusy(true);try{const d=await api("/api/teams",{method:"POST",body:JSON.stringify({name:teamName})});setTeamName("");const t={...d,member_count:1};setTeams(x=>[t,...x]);setTeam(t);notify("success","Team created")}catch(e){notify("error",e.message)}finally{setBusy(false)}};
 const createInvite=async role=>{try{const d=await api("/api/teams/"+team.id+"/invites",{method:"POST",body:JSON.stringify({role})});const link=location.origin+location.pathname+"?invite="+d.token;setInvite(link);await copy(link)}catch(e){notify("error",e.message)}};
 const createChat=async()=>{try{const d=await api("/api/teams/"+team.id+"/chats",{method:"POST",body:JSON.stringify({title:"Team chat"})});setChats(c=>[d,...c]);setChat(d);setMessages([])}catch(e){notify("error",e.message)}};
 const openChat=async c=>{try{const d=await api("/api/chats/"+c.id);setChat(c);setMessages(d.messages||[])}catch(e){notify("error",e.message)}};
 const send=async()=>{if(!chat||!draft.trim())return;const text=draft.trim();setDraft("");try{await api("/api/chats/"+chat.id+"/messages",{method:"POST",body:JSON.stringify({content:text,role:"user"})});const d=await api("/api/chats/"+chat.id);setMessages(d.messages||[])}catch(e){setDraft(text);notify("error",e.message)}};
 const saveMemory=async()=>{if(!memoryKey.trim())return;try{await api("/api/memory",{method:"POST",body:JSON.stringify({teamId:team.id,key:memoryKey,value:memoryValue})});const d=await api("/api/memory?teamId="+team.id);setMemory(d.memories||[]);setMemoryKey("");setMemoryValue("");notify("success","Team memory saved")}catch(e){notify("error",e.message)}};
 const changeRole=async(userId,role)=>{try{await api("/api/teams/"+team.id+"/members/"+userId,{method:"PATCH",body:JSON.stringify({role})});loadTeam(team)}catch(e){notify("error",e.message)}};
 const removeMember=async userId=>{try{await api("/api/teams/"+team.id+"/members/"+userId,{method:"DELETE"});loadTeam(team)}catch(e){notify("error",e.message)}};
 if(!cloudEnabled())return <div className="cloudEmpty"><CloudIcon/><h2>Cloud workspace is not connected</h2><p>Set <code>VITE_TOOLLOOT_API</code> to your deployed ToollooT API to enable real multi-user storage.</p></div>;
 if(!account?.token)return <div className="cloudEmpty"><Shield/><h2>Sign in to use Cloud Workspace</h2><a href="/toolloot/account" className="cloudPrimary">Open Account</a></div>;
 return <div className="cloudWorkspace">
  <header className="cloudHead"><div><span>TOOLLOOT CLOUD</span><h1>Workspace</h1><p>Shared chats, team permissions and server-side memory.</p></div><button onClick={()=>loadTeams()}><RefreshCw size={16}/>Refresh</button></header>
  <div className="cloudGrid">
   <aside className="cloudSide">
    <div className="cloudPanel"><h3><Users size={17}/> Teams</h3><div className="teamCreate"><input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="New team"/><button onClick={createTeam} disabled={busy}><Plus size={16}/></button></div><div className="teamList">{teams.map(t=><button className={team?.id===t.id?"active":""} key={t.id} onClick={()=>setTeam(t)}><Users size={15}/><span>{t.name}</span><small>{t.role}</small></button>)}</div></div>
    {team&&<div className="cloudPanel"><h3><UserPlus size={17}/> Invite</h3><p className="muted">Create a shareable invite. Owner/Admin can invite.</p><div className="inviteBtns"><button onClick={()=>createInvite("member")}><UserPlus size={15}/> Member link</button>{["owner","admin"].includes(team.role)&&<button onClick={()=>createInvite("admin")}><Shield size={15}/> Admin link</button>}</div>{invite&&<div className="inviteBox"><input readOnly value={invite}/><button onClick={()=>copy(invite)}><Copy size={15}/></button></div>}</div>}
   </aside>
   <main className="cloudMain">
    {!team?<div className="cloudEmpty"><Users size={34}/><h2>Create your first team</h2><p>Teams keep shared chats and team memory separate from personal work.</p></div>:<>
      <div className="teamHero"><div><span>TEAM</span><h2>{team.name}</h2><p><Shield size={14}/> Your role: <b>{team.role}</b> · {members.length} members</p></div></div>
      <section className="cloudPanel"><div className="panelHead"><h3><MessageSquare size={17}/> Shared team chats</h3><button onClick={createChat}><Plus size={15}/> New chat</button></div><div className="chatLayout"><div className="chatList">{chats.map(c=><button className={chat?.id===c.id?"active":""} key={c.id} onClick={()=>openChat(c)}><MessageSquare size={14}/><span>{c.title}</span></button>)}</div><div className="sharedChat"><div className="messageScroll">{messages.length?messages.map(m=><div className={"sharedMessage "+m.role} key={m.id}><b>{m.name}</b><p>{m.content}</p><small>{new Date(m.created_at).toLocaleString()}</small></div>):<div className="chatBlank">Select or create a shared chat.</div>}</div>{chat&&<div className="chatComposer"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message the team…"/><button onClick={send}><Send size={16}/></button></div>}</div></div></section>
      <section className="cloudPanel"><div className="panelHead"><h3><Brain size={17}/> Server-side team memory</h3></div><div className="memoryForm"><input value={memoryKey} onChange={e=>setMemoryKey(e.target.value)} placeholder="Memory key"/><input value={memoryValue} onChange={e=>setMemoryValue(e.target.value)} placeholder="What should the team remember?"/><button onClick={saveMemory}><CheckCircle2 size={15}/> Save</button></div><div className="memoryList">{memory.map(m=><div key={m.id}><b>{m.memory_key}</b><span>{m.memory_value}</span></div>)}</div></section>
      <section className="cloudPanel"><div className="panelHead"><h3><Users size={17}/> Members & permissions</h3><span className="muted">Owner / Admin / Member</span></div><div className="memberList">{members.map(m=><div className="memberRow" key={m.id}><div><b>{m.name}</b><small>{m.email}</small></div><strong>{m.role}</strong>{team.role==="owner"&&m.id!==account.id&&<><select value={m.role} onChange={e=>changeRole(m.id,e.target.value)}><option value="member">Member</option><option value="admin">Admin</option></select><button className="danger" onClick={()=>removeMember(m.id)}><Trash2 size={14}/></button></>}</div>)}</div></section>
    </>}
   </main>
  </div>
 </div>;
}
function CloudIcon(){return <Users size={38}/>;}
