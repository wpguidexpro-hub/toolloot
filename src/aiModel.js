import { env, pipeline } from "@huggingface/transformers";

export const MODEL_KEY="toolloot:ai:model";
export const MODEL_REGISTRY=[{id:"onnx-community/Qwen3-0.6B-ONNX",name:"Qwen3 0.6B • GitHub",size:"~919 MB q4",license:"Apache-2.0",speed:"WebGPU / WASM",default:true}];
export const DATASET_REGISTRY=[
{id:"OpenRL/daily_dialog",name:"DailyDialog",size:"4.28 MB",license:"CC BY-NC-SA 4.0",file:"data/train-00000-of-00001-f151c79abb2c1fd5.parquet"},
{id:"HuggingFaceTB/smoltalk",name:"SmolTalk • everyday conversations",size:"946 KB",license:"Apache-2.0",file:"data/everyday-conversations/train-00000-of-00001.parquet"}];

const RAW_ROOT="https://raw.githubusercontent.com/wpguidexpro-hub/toolloot/main/models/github-ai/q4";
const PART_COUNT=15;
let generator=null,generatorMode="",loading=null,modelBlobPromise=null;

env.allowLocalModels=false;
env.allowRemoteModels=true;
env.remoteHost=RAW_ROOT;
env.remotePathTemplate="{file}";
env.useBrowserCache=true;
env.useFSCache=false;

async function fetchChunkedModel(init){
 if(modelBlobPromise)return modelBlobPromise;
 modelBlobPromise=(async()=>{
  const urls=Array.from({length:PART_COUNT},(_,i)=>RAW_ROOT+"/model_q4.part-"+String(i).padStart(3,"0"));
  const parts=new Array(urls.length);
  let next=0;
  const worker=async()=>{while(true){const i=next++;if(i>=PART_COUNT)return;const r=await fetch(urls[i],init);if(!r.ok)throw new Error("AI model chunk "+(i+1)+" failed ("+r.status+")");parts[i]=await r.blob()}};
  await Promise.all([worker(),worker(),worker(),worker()]);
  return new Blob(parts,{type:"application/octet-stream"});
 })().catch(e=>{modelBlobPromise=null;throw e});
 return modelBlobPromise;
}

env.fetch=async(input,init)=>{
 const source=input instanceof Request?input.url:String(input);
 if(source.endsWith("/onnx/model_q4.onnx"))return new Response(await fetchChunkedModel(init),{status:200,headers:{"content-type":"application/octet-stream"}});
 return fetch(input,init);
};

export const recommendedModel=()=>MODEL_REGISTRY[0];
export const runtimeInfo=()=>({mobile:/Android|iPhone|iPad|iPod/i.test(navigator.userAgent),device:generatorMode||"browser",deviceLabel:generatorMode==="webgpu"?"WebGPU":generatorMode==="wasm"?"CPU/WASM":"GitHub browser AI",cores:navigator.hardwareConcurrency||1,memory:navigator.deviceMemory||0});
export function modelUrl(_id,file=""){return RAW_ROOT+"/"+file.split("/").pop()}
export function datasetUrl(id,file=""){return "https://huggingface.co/datasets/"+id+"/resolve/main/"+file}
export async function getDtypes(){return["q4"]}

async function createGenerator(onProgress){
 const hasGpu=typeof navigator!=="undefined"&&!!navigator.gpu;
 if(hasGpu){
  try{
   onProgress?.({status:"loading",progress:5,device:"webgpu",dtype:"q4"});
   const pipe=await pipeline("text-generation",recommendedModel().id,{device:"webgpu",dtype:"q4",progress_callback:p=>{
    const loaded=Number(p?.progress);onProgress?.({status:"loading",progress:Number.isFinite(loaded)?Math.min(95,Math.max(5,loaded)):10,device:"webgpu",dtype:"q4"});
   }});
   generatorMode="webgpu";onProgress?.({status:"ready",progress:100,device:"webgpu",dtype:"q4"});return pipe;
  }catch(e){console.warn("WebGPU q4 unavailable; falling back to CPU/WASM.",e)}
 }
 onProgress?.({status:"loading",progress:5,device:"wasm",dtype:"q4"});
 const pipe=await pipeline("text-generation",recommendedModel().id,{device:"wasm",dtype:"q4",progress_callback:p=>{
  const loaded=Number(p?.progress);onProgress?.({status:"loading",progress:Number.isFinite(loaded)?Math.min(95,Math.max(5,loaded)):10,device:"wasm",dtype:"q4"});
 }});
 generatorMode="wasm";onProgress?.({status:"ready",progress:100,device:"wasm",dtype:"q4"});return pipe;
}

export async function loadLocalLLM(_id=recommendedModel().id,onProgress){if(generator){onProgress?.({status:"ready",progress:100,device:generatorMode});return generator}if(loading)return loading;loading=createGenerator(onProgress).finally(()=>{loading=null});generator=await loading;return generator}
const clean=text=>String(text||"").replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^assistant\s*[:：-]\s*/i,"").trim();
function buildMessages(prompt,history=[],memory={}){const facts=(memory.facts||[]).map(f=>f?.type+": "+f?.value).join("\n"),memories=(memory.items||[]).map(x=>x?.text).filter(Boolean).slice(-8).join("\n---\n"),memoryText=[facts,memories].filter(Boolean).join("\n"),context=(history||[]).filter(m=>m?.role&&m?.content).slice(-16).map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content).slice(0,6000)}));return[{role:"system",content:"You are ToollooT AI. Be intelligent, accurate, natural and concise. Reply in Hindi, English or Hinglish matching the user. Use the conversation and memory as context. Never claim an action, tool, internet access or learning event that did not happen. Do not claim that your model weights changed."},...(memoryText?[{role:"system",content:"Relevant long-term memory:\n"+memoryText}]:[]),...context,{role:"user",content:String(prompt||"")+"\n/no_think"}]}
export async function generateLocal(prompt,{max_new_tokens,history=[],memory={}}={}){if(!String(prompt||"").trim())throw new Error("Prompt required");const pipe=await loadLocalLLM(),output=await pipe(buildMessages(prompt,history,memory),{max_new_tokens:Math.max(32,Math.min(Number(max_new_tokens)||256,768)),do_sample:true,temperature:.55,top_p:.9,repetition_penalty:1.08,chat_template_kwargs:{enable_thinking:false}}),generated=output?.[0]?.generated_text,raw=Array.isArray(generated)?generated.at(-1)?.content:generated;return clean(raw)}
export function preloadRecommendedModel(onProgress){if(typeof window==="undefined")return Promise.resolve(null);return loadLocalLLM(recommendedModel().id,onProgress).catch(()=>null)}
