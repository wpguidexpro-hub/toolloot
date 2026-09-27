import {get,set} from "idb-keyval";
const KEY="toolloot:analytics:events";
const sid=()=>{let s=sessionStorage.getItem("tl-session");if(!s){s=crypto.randomUUID();sessionStorage.setItem("tl-session",s)}return s};
export async function analyticsEvent(event,data={}){try{const a=(await get(KEY))||[];a.push({id:crypto.randomUUID(),event,ts:Date.now(),session:sid(),path:location.pathname,referrer:document.referrer,...data});await set(KEY,a.slice(-10000))}catch{}}
export async function analyticsSummary(){const a=(await get(KEY))||[];const sessions=new Set(a.map(x=>x.session));const byEvent={};a.forEach(x=>byEvent[x.event]=(byEvent[x.event]||0)+1);return {events:a.length,sessions:sessions.size,byEvent,recent:a.slice(-100)}}
export async function clearAnalytics(){await set(KEY,[])}
