export const MODEL_KEY="toolloot:ai:model";
export const MODEL_REGISTRY=[{id:"smollm2-1.7b-asi-core",name:"SmolLM2 1.7B Instruct • Local PC",size:"~1.06 GB Q4_K_M",license:"Apache-2.0",speed:"Local CPU",default:true}];
export const DATASET_REGISTRY=[
{id:"OpenRL/daily_dialog",name:"DailyDialog",size:"4.28 MB",license:"CC BY-NC-SA 4.0",file:"data/train-00000-of-00001-f151c79abb2c1fd5.parquet"},
{id:"HuggingFaceTB/smoltalk",name:"SmolTalk",size:"946 KB",license:"Apache-2.0",file:"data/everyday-conversations/train-00000-of-00001.parquet"}];

const apiBase=()=>String(import.meta.env.VITE_AI_API_URL||"https://align-separated-gst-updates.trycloudflare.com").replace(/\/$/,"");
export const recommendedModel=()=>MODEL_REGISTRY[0];
export const runtimeInfo=()=>({mobile:/Android|iPhone|iPad|iPod/i.test(navigator.userAgent),device:"local-pc",deviceLabel:"ASI-Core Local PC",cores:navigator.hardwareConcurrency||1,memory:navigator.deviceMemory||0});
export function modelUrl(id,file=""){return file?"https://huggingface.co/"+id+"/resolve/main/"+file:"https://huggingface.co/"+id}
export function datasetUrl(id,file=""){return "https://huggingface.co/datasets/"+id+"/resolve/main/"+file}
export async function getDtypes(){return["Q4_K_M"]}
export async function aiHealth(){const r=await fetch(apiBase()+"/api/ai/health");if(!r.ok)throw new Error("AI server unavailable");return r.json()}
export async function loadLocalLLM(_id=recommendedModel().id,onProgress){const h=await aiHealth();onProgress?.({status:h.ready?"ready":"server",progress:h.ready?100:20});return h}
export async function generateLocal(prompt,{max_new_tokens=256,history=[],memory={}}={}){const r=await fetch(apiBase()+"/api/ai/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt,max_new_tokens,history,memory})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"AI server unavailable");return String(d.answer||"").trim()}
export function preloadRecommendedModel(onProgress){if(typeof window==="undefined")return Promise.resolve(null);return aiHealth().then(h=>{onProgress?.({status:h.ready?"ready":"server",progress:h.ready?100:20});return h}).catch(()=>null)}
