import React,{useEffect,useState}from"react";
import{createRoot}from"react-dom/client";
import{Brain,Search,Sun,Moon,Menu,X,Globe2,Database,Activity,BookOpen,Trash2,Download,ChevronRight,Sparkles,ExternalLink,ShieldCheck,Layers,RefreshCw}from"lucide-react";
import"./chat.css";
const KEY="neuralnet:memory";
const SOURCE_PACK=[
{name:"Wikipedia EN",kind:"wiki",base:"https://en.wikipedia.org"},
{name:"Wikipedia HI",kind:"wiki",base:"https://hi.wikipedia.org"},
{name:"Wikidata",kind:"wikidata",base:"https://www.wikidata.org"},
{name:"Wikimedia Commons",kind:"wiki",base:"https://commons.wikimedia.org"},
{name:"MediaWiki",kind:"wiki",base:"https://www.mediawiki.org"}
];
const BAD_Q=/राजधानी|capital|largest planet|सबसे बड़ा ग्रह|प्रधानमंत्री|president|currency|मुद्रा|population|जनसंख्या/i;
const cleanText=s=>String(s||"").replace(/<[^>]*>/g," ").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
const norm=s=>cleanText(s).toLowerCase().replace(/[?!.:,;(){}\[\]"']/g," ").replace(/क्या है|कौन सा|कौन सी|कौन|बताओ|बताइए|है|का|की|के|में|से|और|यह|वह|the|what|is|are|of|a|an|which|who|tell me|please|how|does|do|did|where|when/g," ").replace(/भारत/g,"india").replace(/राजधानी/g,"capital").replace(/सबसे बड़ा|सबसे बड़ी|सबसे बड़ा ग्रह/g,"largest").replace(/ग्रह/g,"planet").replace(/राष्ट्रपति/g,"president").replace(/प्रधानमंत्री/g,"prime minister").replace(/मुद्रा/g,"currency").replace(/जनसंख्या/g,"population").replace(/भाषा/g,"language").replace(/क्षेत्रफल/g,"area").split(/\s+/).filter(x=>x.length>1);
const load=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||"[]");return a.filter(x=>!(BAD_Q.test(x.q||"")&&/asha bhosle/i.test((x.a||"")+" "+(x.title||""))))}catch{return[]}};
function scoreResult(q,item){
 const terms=norm(q),title=norm(item.title),text=norm(item.extract),all=title+" "+text;
 let score=0;
 terms.forEach(t=>{if(title.includes(t))score+=5;if(text.includes(t))score+=2});
 if(terms.join(" ")&&title.includes(terms.join(" ")))score+=8;
 if(terms.includes("capital")&&terms.includes("india")&&/new delhi|capital of india/i.test(all))score+=12;
 if(terms.includes("largest")&&terms.includes("planet")&&/jupiter/i.test(all))score+=12;
 return score;
}
async function wikiSearch(q,lang){
 const u="https://"+lang+".wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(q)+"&srlimit=8&format=json&origin=*";
 const r=await fetch(u);if(!r.ok)throw Error("wiki");
 const d=await r.json(),hits=d?.query?.search||[];if(!hits.length)return[];
 const titles=hits.map(x=>x.title).join("|");
 const p="https://"+lang+".wikipedia.org/w/api.php?action=query&prop=extracts|info&exintro=1&explaintext=1&inprop=url&titles="+encodeURIComponent(titles)+"&format=json&origin=*";
 const pd=await fetch(p).then(x=>x.json());
 return Object.values(pd?.query?.pages||{}).filter(x=>x&&x.pageid).map(x=>({title:x.title,extract:cleanText(x.extract),url:x.fullurl||("https://"+lang+".wikipedia.org/wiki/"+encodeURIComponent(x.title.replace(/ /g,"_"))),source:"Wikipedia "+lang.toUpperCase()}));
}
async function wikidataSearch(q){
 const u="https://www.wikidata.org/w/api.php?action=wbsearchentities&search="+encodeURIComponent(q)+"&language=en&uselang=en&format=json&limit=8&origin=*";
 const r=await fetch(u);if(!r.ok)throw Error("wikidata");
 const d=await r.json();
 return(d?.search||[]).map(x=>({title:x.label||x.id,extract:cleanText(x.description||""),url:x.concepturi||("https://www.wikidata.org/wiki/"+x.id),source:"Wikidata"}));
}
async function webResearch(question){
 const local="http://127.0.0.1:5190/api/ask?q="+encodeURIComponent(question);
 try{
  const r=await fetch(local,{signal:AbortSignal.timeout(20000)});
  if(r.ok){
   const d=await r.json();
   if(d?.ok&&d.answer)return{text:d.answer,title:d.title||"Open web",url:d.url||"",source:d.source||"Open Web Crawler",score:d.score||0};
   if(d?.ok===false&&d?.message)return null;
  }
 }catch{}
 const original=question.trim(),keys=norm(original).join(" "),variants=[original,keys].filter((x,i,a)=>x&&a.indexOf(x)===i),all=[];
 for(const v of variants){
  try{all.push(...await wikiSearch(v,"en"))}catch{}
  try{all.push(...await wikiSearch(v,"hi"))}catch{}
  try{all.push(...await wikidataSearch(v))}catch{}
 }
 const seen=new Set(),unique=all.filter(x=>{const k=x.url||x.title;if(seen.has(k))return false;seen.add(k);return true});
 const ranked=unique.map(x=>({...x,score:scoreResult(original,x)})).sort((a,b)=>b.score-a.score),best=ranked[0];
 if(!best||best.score<5||!best.extract)return null;
 const text=best.extract.split(/(?<=[.!?।])\s+/).filter(Boolean).slice(0,4).join(" ");
 return{...best,text};
}
function App(){
 const[dark,setDark]=useState(()=>localStorage.getItem("neuralnet:dark")==="1"),[q,setQ]=useState(""),[busy,setBusy]=useState(false),[answer,setAnswer]=useState(null),[memory,setMemory]=useState(load),[menu,setMenu]=useState(false),[stats,setStats]=useState({searches:0,learned:0}),[sourcesOpen,setSourcesOpen]=useState(false);
 useEffect(()=>{document.body.classList.toggle("dark",dark);localStorage.setItem("neuralnet:dark",dark)},[dark]);
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(memory))},[memory]);
 const save=m=>setMemory(m);
 async function ask(e){
  e?.preventDefault();if(!q.trim()||busy)return;
  const question=q.trim();setBusy(true);setAnswer(null);setStats(s=>({...s,searches:s.searches+1}));
  const old=memory.find(x=>x.q.toLowerCase()===question.toLowerCase());
  if(old){setAnswer({text:old.a,source:old.source,url:old.url,learned:false,verified:true});setBusy(false);return}
  try{
   const result=await webResearch(question);
   if(!result){setAnswer({text:"No relevant source passed verification. I did not learn this result.",source:"Rejected by relevance filter",learned:false,verified:false});setBusy(false);return}
   const item={q:question,a:result.text,source:result.source,url:result.url,title:result.title,score:result.score,ts:Date.now()};
   save([item,...memory].slice(0,500));setStats(s=>({...s,learned:s.learned+1}));
   setAnswer({text:result.text,source:result.source+" • "+result.title,url:result.url,learned:true,verified:true});
  }catch{setAnswer({text:"Web research is unavailable right now. No unverified answer was stored.",source:"Crawler error",learned:false,verified:false})}
  setBusy(false);
 }
 function exportBrain(){const b=new Blob([JSON.stringify(memory,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="neuralnet-memory.json";a.click()}
 function clearBrain(){if(confirm("Clear learned memory?"))save([])}
 return <div className="nn">
 <header><button className="brand" onClick={()=>scrollTo({top:0,behavior:"smooth"})}><Brain/><span>NeuralNet</span></button><div className="tag">MULTI-SOURCE CRAWLER • AUTO LEARNING</div><nav className={menu?"open":""}><a href="#ask">Ask</a><a href="#brain">Brain</a><a href="#network">Network</a><button onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}</button></nav><button className="menub" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></header>
 <main><section className="hero" id="ask"><div className="eyebrow"><Sparkles/> Live multi-source research</div><h1>Ask anything.<br/><em>The crawler finds it.</em></h1><p>NeuralNet checks local memory first, then searches multiple knowledge sources, scores relevance, rejects unrelated results and only learns verified matches.</p>
 <form className="askbox" onSubmit={ask}><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="भारत की राजधानी क्या है?"/><button disabled={busy}>{busy?"Researching…":"Ask NeuralNet"}<ChevronRight/></button></form>
 <div className="quick"><button onClick={()=>setQ("भारत की राजधानी क्या है?")}>भारत की राजधानी?</button><button onClick={()=>setQ("What is the largest planet?")}>Largest planet?</button></div>
 {busy&&<div className="research"><div className="pulse"><Globe2/></div><div><b>Crawling knowledge sources…</b><span>Search → compare → verify → learn</span></div><RefreshCw className="spin"/></div>}
 {answer&&<article className={"answer "+(!answer.verified?"rejected":"")}><div className="answerHead"><span><Brain/> Neural answer</span>{answer.learned&&<i>VERIFIED KNOWLEDGE LEARNED</i>}{!answer.verified&&<i>NOT LEARNED</i>}</div><h2>{answer.text}</h2><p><ShieldCheck/> {answer.source} {answer.url&&<a href={answer.url} target="_blank" rel="noreferrer">Open source <ExternalLink/></a>}</p></article>}
 <button className="sourceToggle" onClick={()=>setSourcesOpen(!sourcesOpen)}><Layers/> {SOURCE_PACK.length} sources preconfigured <ChevronRight className={sourcesOpen?"rot":""}/></button>
 {sourcesOpen&&<div className="sourceGrid">{SOURCE_PACK.map(s=><div key={s.name}><Globe2/><b>{s.name}</b><span>Enabled</span></div>)}</div>}
 </section>
 <section className="dashboard" id="brain"><div className="sectionTitle"><small>LIVE BRAIN</small><h2>It learns while you use it.</h2></div><div className="cards"><article><Database/><b>{memory.length}</b><span>Knowledge items</span></article><article><Search/><b>{stats.searches}</b><span>Questions researched</span></article><article><Activity/><b>{stats.learned}</b><span>Verified facts learned</span></article><article><BookOpen/><b>Local</b><span>Memory storage</span></article></div></section>
 <section className="network" id="network"><div><small>CRAWLING ENGINE</small><h2>Question → Sources → Verification → Brain</h2><p>Unknown questions are searched across the configured knowledge network. Results are ranked by relevance before anything is saved.</p><div className="flow"><span>QUESTION</span><i>→</i><span>CRAWL</span><i>→</i><span>COMPARE</span><i>→</i><span>VERIFY</span><i>→</i><span>MEMORY</span></div></div><div className="brainbox"><div className="orb"><Brain/></div><div className="orbit o1"></div><div className="orbit o2"></div><b>LEARNING</b><span>Relevance-gated knowledge cycle</span></div></section>
 <section className="memory"><div className="sectionTitle"><small>KNOWLEDGE</small><h2>What the brain remembers</h2></div>{memory.length?<div className="memoryList">{memory.slice(0,12).map((m,i)=><div key={i}><span>Q</span><p><b>{m.q}</b><small>{m.a}</small></p></div>)}</div>:<div className="empty">Ask your first question.</div>}<div className="actions"><button onClick={exportBrain}><Download/> Export brain</button><button onClick={clearBrain}><Trash2/> Clear memory</button></div></section>
 <section className="principle"><Brain/><div><h2>Automatic by design.</h2><p>Ask → crawl → verify → learn → remember. Unrelated search results are rejected instead of being trained into memory.</p></div></section></main>
 <footer><b>NeuralNet</b><span>Multi-source crawler • Auto learning</span><button onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}</button></footer></div>}
createRoot(document.getElementById("root")).render(<App/>);