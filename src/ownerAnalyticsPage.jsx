import React,{useEffect,useState}from"react";
import {BarChart3,Users,Activity,MousePointerClick,DollarSign,RefreshCw,ShieldCheck}from"lucide-react";
import Swal from"sweetalert2";
import {api,getAccount,cloudEnabled}from"./cloudWorkspace.js";
import"./ownerAnalyticsPage.css";

export function OwnerAnalyticsPage(){
 const [data,setData]=useState(null),[days,setDays]=useState(30),[form,setForm]=useState({source:"Ad network",periodStart:"",periodEnd:"",amount:"",currency:"INR",notes:""}),[account]=useState(getAccount());
 const load=()=>api("/api/owner/analytics?days="+days).then(setData).catch(e=>setData({error:e.message}));
 useEffect(()=>{if(account?.token&&cloudEnabled())load()},[days]);
 const addRevenue=async e=>{e.preventDefault();try{await api("/api/owner/ad-revenue",{method:"POST",body:JSON.stringify(form)});setForm({...form,amount:"",notes:""});await load();Swal.fire({icon:"success",title:"Revenue entry added",toast:true,position:"bottom-end",showConfirmButton:false,timer:1500})}catch(e){Swal.fire({icon:"error",title:e.message})}};
 if(!cloudEnabled()||!account?.token)return <div className="ownerEmpty"><ShieldCheck/><h2>Owner sign-in required</h2><p>Connect the cloud API and sign in to view platform analytics.</p></div>;
 if(data?.error)return <div className="ownerEmpty"><ShieldCheck/><h2>Owner-only dashboard</h2><p>{data.error}</p></div>;
 if(!data)return <div className="ownerEmpty"><RefreshCw className="spin"/><p>Loading owner analytics…</p></div>;
 const o=data.overview||{},a=data.ads||{};
 return <div className="ownerAnalytics">
  <header className="ownerHead"><div><span>TOOLLOOT OWNER CONSOLE</span><h1>Complete Analytics</h1><p>Platform-wide usage, tools, teams and tracked advertising revenue. Visible only to the platform owner.</p></div><div><select value={days}onChange={e=>setDays(Number(e.target.value))}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option></select><button onClick={load}><RefreshCw size={16}/>Refresh</button></div></header>
  <div className="ownerCards">{[[Activity,"Events",o.events],[Users,"Users",o.users],[Users,"Active users",o.activeUsers],[Users,"Teams",o.teams],[MousePointerClick,"Ad impressions",a.impressions],[DollarSign,"Ad revenue","₹"+Number(a.totalRevenue||0).toFixed(2)]].map(([I,n,v])=><div key={n}><I size={17}/><span>{n}</span><b>{v}</b></div>)}</div>
  <div className="ownerTwo"><section className="ownerPanel"><h2><BarChart3 size={18}/> Daily activity</h2><div className="dailyRows">{(data.daily||[]).map(x=><div key={x.day}><span>{x.day}</span><i><em style={{width:Math.min(100,(Number(x.events)/Math.max(1,o.events))*100)+"%"}}/></i><b>{x.events}</b><small>{x.users} users</small></div>)}</div></section>
  <section className="ownerPanel"><h2><Activity size={18}/> Top events</h2><div className="rankRows">{(data.events||[]).map(x=><div key={x.name}><span>{x.name}</span><b>{x.n}</b></div>)}</div></section></div>
  <div className="ownerTwo"><section className="ownerPanel"><h2>Tool usage</h2><div className="rankRows">{(data.tools||[]).map(x=><div key={String(x.tool)}><span>{x.tool}</span><b>{x.n}</b></div>)}</div></section>
  <section className="ownerPanel"><h2>Advertising</h2><div className="adMetrics"><div><span>CTR</span><b>{(Number(a.ctr||0)*100).toFixed(2)}%</b></div><div><span>Impressions</span><b>{a.impressions}</b></div><div><span>Clicks</span><b>{a.clicks}</b></div><div><span>Tracked amount</span><b>₹{Number(a.trackedAmount||0).toFixed(2)}</b></div></div></section></div>
  <section className="ownerPanel"><h2>Ad revenue ledger</h2><form className="revenueForm" onSubmit={addRevenue}><input placeholder="Source" value={form.source}onChange={e=>setForm({...form,source:e.target.value})}/><input type="date" value={form.periodStart}onChange={e=>setForm({...form,periodStart:e.target.value})}required/><input type="date" value={form.periodEnd}onChange={e=>setForm({...form,periodEnd:e.target.value})}required/><input type="number" min="0" step=".01" placeholder="Amount" value={form.amount}onChange={e=>setForm({...form,amount:e.target.value})}required/><input placeholder="Notes" value={form.notes}onChange={e=>setForm({...form,notes:e.target.value})}/><button><DollarSign size={15}/>Add revenue</button></form><div className="ledger">{(data.revenue||[]).map(x=><div key={x.id}><span>{x.source}</span><small>{x.period_start} → {x.period_end}</small><b>{x.currency} {Number(x.amount).toFixed(2)}</b></div>)}</div></section>
 </div>;
}