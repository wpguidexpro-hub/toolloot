import React,{useEffect,useState} from "react";
import {get,set} from "idb-keyval";
import {BarChart3,Users,Activity,Trash2,RefreshCw,Eye,MessageSquare,MousePointerClick} from "lucide-react";
import {analyticsSummary,clearAnalytics} from "./analytics.js";
import {AdSlot} from "./ads.jsx";
import "./analyticsPage.css";

export function AnalyticsPage(){
 const [data,setData]=useState(null);
 const load=()=>analyticsSummary().then(setData);
 useEffect(()=>{load()},[]);
 const clear=async()=>{if(confirm("Clear local analytics data?")){await clearAnalytics();load()}};
 if(!data)return <div className="analyticsPage"><div className="analyticsLoading">Loading analytics…</div></div>;
 const events=data.byEvent||{};
 const cards=[
  ["Events",data.events,Activity],
  ["Sessions",data.sessions,Users],
  ["Messages",events.message_sent||0,MessageSquare],
  ["Attachments",events.attachment_added||0,MousePointerClick]
 ];
 return <div className="analyticsPage">
  <header className="analyticsHead"><div><span className="analyticsKicker">TOOLLOOT INTELLIGENCE</span><h1>Site Analytics</h1><p>Privacy-first analytics stored locally in this browser. Connect a server analytics endpoint later for platform-wide reporting.</p></div><div className="analyticsActions"><button onClick={load}><RefreshCw size={16}/>Refresh</button><button onClick={clear}><Trash2 size={16}/>Clear local data</button></div></header>
  <AdSlot slot="analytics-top"/>
  <div className="analyticsCards">{cards.map(([name,value,Icon])=><div className="analyticsCard" key={name}><Icon size={18}/><span>{name}</span><strong>{value}</strong></div>)}</div>
  <section className="analyticsPanel"><div className="panelTitle"><div><h2>Events</h2><p>What users are doing inside this browser session store.</p></div><BarChart3 size={20}/></div>
   <div className="eventRows">{Object.entries(events).sort((a,b)=>b[1]-a[1]).map(([name,value])=><div className="eventRow" key={name}><span>{name}</span><div><i style={{width:Math.min(100,(value/Math.max(1,data.events))*100)+"%"}}/></div><b>{value}</b></div>)}</div>
  </section>
  <section className="analyticsPanel"><div className="panelTitle"><div><h2>Monetization</h2><p>Ad placements are prepared without hard-coding a publisher ID.</p></div></div><div className="adGrid"><AdSlot slot="analytics-square-1"/><AdSlot slot="analytics-square-2"/><AdSlot slot="analytics-wide"/></div></section>  <section className="analyticsPanel privacyNote"><Eye size={18}/><div><h2>Privacy model</h2><p>Current dashboard keeps raw analytics in IndexedDB on this device. No third-party analytics service is required. For a live multi-user platform, the same event schema can be sent to your own API and aggregated per user, team, page, tool and campaign.</p></div></section>
 </div>
}
