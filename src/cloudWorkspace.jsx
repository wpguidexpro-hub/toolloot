import React,{useEffect,useState} from "react";
import {Users,UserPlus,Copy,Shield,MessageSquare,Brain,RefreshCw,Plus,Send,Trash2,CheckCircle2,Activity,Database,Menu} from "lucide-react";
import Swal from "sweetalert2";
import {api,getAccount,cloudEnabled,saveAccount} from "./cloudWorkspace.js";
import "./cloudWorkspace.css";
import "./cloudWorkspaceViews.css";

const notify=(icon,title)=>Swal.fire({icon,title,toast:true,position:"bottom-end",showConfirmButton:false,timer:1800});
const copy=async text=>{await navigator.clipboard?.writeText(text);notify("success","Invite link copied");};

export function CloudWorkspace(){
 const [account,setAccount]=useState(getAccount()),[teams,setTeams]=useState([]),[team,setTeam]=useState(null),[members,setMembers]=useState([]),[chats,setChats]=useState([]),[chat,setChat]=useState(null),[messages,setMessages]=useState([]),[memory,setMemory]=useState([]),[busy,setBusy]=useState(false),[draft,setDraft]=useState(""),[invite,setInvite]=useState(null);
 const [teamName,setTeamName]=useState(""),[memoryKey,setMemoryKey]=useState(""),[memoryValue,setMemoryValue]=useState(""),[view,setView]=useState("overview"),[mobileOpen,setMobileOpen]=useState(false);
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
 return <div className="cloudWorkspace cloudApp">
  <aside className={"cloudSidebar "+(mobileOpen?"open":"")}>
    <div className="cloudBrand"><span>TT</span><div><b>ToollooT</b><small>Cloud Workspace</small></div></div>
    <div className="cloudWorkspaceName"><small>WORKSPACE</small><b>{team?.name||"Select a team"}</b></div>
    <nav>
      {[["overview","Overview",Users],["chats","Team chats",MessageSquare],["memory","Shared memory",Brain],["members","Members",UserPlus]].map(([id,label,I])=><button className={view===id?"active":""} onClick={()=>{setView(id);setMobileOpen(false)}} key={id}><I size={17}/>{label}</button>)}
    </nav>
    <div className="cloudTeamArea"><small>TEAMS</small>{teams.map(t=><button className={team?.id===t.id?"selected":""} key={t.id} onClick={()=>setTeam(t)}><span>{t.name.slice(0,1).toUpperCase()}</span><b>{t.name}</b><em>{t.role}</em></button>)}
      <div className="cloudNewTeam"><input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="New team" onKeyDown={e=>e.key==="Enter"&&createTeam()}/><button onClick={createTeam}><Plus size={15}/></button></div>
    </div>
    <div className="cloudSideBottom"><a href="/toolloot/account"><Shield size={16}/>Account</a><button onClick={()=>{saveAccount(null);location.href="/toolloot/account"}}><Trash2 size={16}/>Sign out</button></div>
  </aside>
  <main className="cloudMain"><button className="cloudMobileMenu" onClick={()=>setMobileOpen(true)}><Menu size={19}/></button>
    <header className="cloudTop"><div><small>TOOLLOOT CLOUD</small><h1>{title}</h1><p>{team?.name||"Team workspace"}</p></div><div className="cloudTopRight"><button onClick={()=>loadTeams()}><RefreshCw size={16}/>Refresh</button><span className="cloudAvatar">{(account.name||account.email||"U").slice(0,1).toUpperCase()}</span></div></header>
    <section className="cloudContent">
      {!team?<div className="cloudEmpty"><Users size={40}/><h2>Create your first team</h2><p>Teams keep shared chats, members and server-side memory together.</p></div>:<>
      {view==="overview"&&<div className="cloudDashboard">
        <div className="cloudStats"><Stat I={Users} n="Members" v={members.length}/><Stat I={MessageSquare} n="Chats" v={chats.length}/><Stat I={Brain} n="Memories" v={memory.length}/><Stat I={Shield} n="Your role" v={team.role}/></div>
        <div className="cloudColumns"><Panel title="Workspace overview" icon={Activity}><div className="cloudRows"><p><span>Team access</span><b>{team.role}</b></p><p><span>Members</span><b>{members.length}</b></p><p><span>Shared memory</span><b>{memory.length} items</b></p></div></Panel><Panel title="Invite teammates" icon={UserPlus}><p className="muted">Create a shareable invite for your team.</p><div className="cloudActions"><button onClick={()=>createInvite("member")}><UserPlus size={15}/>Member</button>{["owner","admin"].includes(team.role)&&<button onClick={()=>createInvite("admin")}><Shield size={15}/>Admin</button>}</div>{invite&&<div className="cloudInvite"><input readOnly value={invite}/><button onClick={()=>copy(invite)}><Copy size={15}/></button></div>}</Panel></div>
        <div className="cloudQuick"><button onClick={()=>setView("chats")}><MessageSquare/><b>Team chats</b><span>{chats.length} conversations</span></button><button onClick={()=>setView("memory")}><Brain/><b>Shared memory</b><span>{memory.length} saved facts</span></button><button onClick={()=>setView("members")}><Users/><b>Members</b><span>Manage permissions</span></button></div>
      </div>}
      {view==="chats"&&<section className="cloudPanel cloudChat"><div className="chatRooms"><div className="panelTitle"><b>Conversations</b><button onClick={createChat}><Plus size={15}/></button></div>{chats.map(c=><button className={chat?.id===c.id?"active":""} key={c.id} onClick={()=>openChat(c)}><MessageSquare size={14}/>{c.title}</button>)}</div><div className="chatWindow">{chat?<><div className="chatWindowHead"><b>{chat.title}</b><small>Shared team conversation</small></div><div className="messages">{messages.length?messages.map(m=><article key={m.id}><span>{(m.name||"U").slice(0,1).toUpperCase()}</span><div><b>{m.name||"Team member"}</b><small>{new Date(m.created_at).toLocaleString()}</small><p>{m.content}</p></div></article>):<div className="chatBlank">No messages yet. Start the conversation.</div>}</div><div className="composer"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Message the team…"/><button onClick={send}><Send size={16}/></button></div></>:<div className="chatBlank">Select a chat or create a new conversation.</div>}</div></section>}
      {view==="memory"&&<div className="cloudMemory"><Panel title="Add shared memory" icon={Brain}><div className="memoryForm"><input value={memoryKey} onChange={e=>setMemoryKey(e.target.value)} placeholder="Memory key"/><input value={memoryValue} onChange={e=>setMemoryValue(e.target.value)} placeholder="What should the team remember?"/><button onClick={saveMemory}><CheckCircle2 size={15}/>Save</button></div></Panel><Panel title="Saved team memory" icon={Database}>{memory.length?<div className="memoryList">{memory.map(m=><article key={m.id}><b>{m.memory_key}</b><p>{m.memory_value}</p></article>)}</div>:<div className="chatBlank">No shared memory yet.</div>}</Panel></div>}
      {view==="members"&&<Panel title="Members & permissions" icon={Users}><div className="members">{members.map(m=><div className="member"><span>{(m.name||m.email||"U").slice(0,1).toUpperCase()}</span><div><b>{m.name||"Unnamed user"}</b><small>{m.email}</small></div><strong>{m.role}</strong>{team.role==="owner"&&m.id!==account.id&&<><select value={m.role} onChange={e=>changeRole(m.id,e.target.value)}><option value="member">Member</option><option value="admin">Admin</option><option value="owner">Owner</option></select><button onClick={()=>removeMember(m.id)}><Trash2 size={14}/></button></>}</div>)}</div></Panel>}
      </>}
    </section>
  </main>
 </div>;
}
function Stat({I,n,v}){return <div className="cloudStat"><span><I size={17}/></span><div><small>{n}</small><b>{v}</b></div></div>}
function Panel({title,icon:I,children}){return <section className="cloudPanel"><div className="panelTitle"><h2><I size={17}/>{title}</h2></div>{children}</section>}
function CloudIcon(){return <Users size={38}/>;}
