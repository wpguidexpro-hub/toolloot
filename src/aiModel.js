import { env, pipeline } from "@huggingface/transformers";

export const MODEL_KEY="toolloot:ai:model";
export const MODEL_REGISTRY=[{id:"onnx-community/SmolLM2-360M-ONNX",name:"SmolLM2 360M • Local Browser AI",size:"~386 MB q4",license:"Apache-2.0",speed:"WebGPU / WASM",default:true}];
export const DATASET_REGISTRY=[
{id:"OpenRL/daily_dialog",name:"DailyDialog",size:"4.28 MB",license:"CC BY-NC-SA 4.0",file:"data/train-00000-of-00001-f151c79abb2c1fd5.parquet"},
{id:"HuggingFaceTB/smoltalk",name:"SmolTalk • everyday conversations",size:"946 KB",license:"Apache-2.0",file:"data/everyday-conversations/train-00000-of-00001.parquet"}];

let generator=null,generatorMode="",loading=null;

env.allowLocalModels=false;
env.allowRemoteModels=true;
env.useBrowserCache=true;
env.useFSCache=false;
// Bump this whenever the model/runtime changes so an old or partial ONNX cache can never be reused.
env.cacheKey="toolloot-ai-smollm2-official-v5";

export const recommendedModel=()=>MODEL_REGISTRY[0];
export const runtimeInfo=()=>({mobile:/Android|iPhone|iPad|iPod/i.test(navigator.userAgent),device:generatorMode||"browser",deviceLabel:generatorMode==="webgpu"?"WebGPU":generatorMode==="wasm"?"CPU/WASM":"Browser AI",cores:navigator.hardwareConcurrency||1,memory:navigator.deviceMemory||0});
export function modelUrl(id=recommendedModel().id,file=""){return "https://huggingface.co/"+id+"/resolve/main/"+file}
export function datasetUrl(id,file=""){return "https://huggingface.co/datasets/"+id+"/resolve/main/"+file}
export async function getDtypes(){return["q4"]}

async function createGenerator(onProgress){
 const model=recommendedModel().id;
 const hasGpu=typeof navigator!=="undefined"&&!!navigator.gpu;
 if(hasGpu){
  try{
   onProgress?.({status:"loading",progress:5,device:"webgpu",dtype:"q4"});
   const pipe=await pipeline("text-generation",model,{device:"webgpu",dtype:"q4",progress_callback:p=>{
    const loaded=Number(p?.progress);
    onProgress?.({status:"loading",progress:Number.isFinite(loaded)?Math.min(95,Math.max(5,loaded)):10,device:"webgpu",dtype:"q4"});
   }});
   generatorMode="webgpu";
   onProgress?.({status:"ready",progress:100,device:"webgpu",dtype:"q4"});
   return pipe;
  }catch(e){
   console.warn("WebGPU q4 unavailable; falling back to CPU/WASM.",e);
  }
 }
 onProgress?.({status:"loading",progress:5,device:"wasm",dtype:"q4"});
 const pipe=await pipeline("text-generation",model,{device:"wasm",dtype:"q4",progress_callback:p=>{
  const loaded=Number(p?.progress);
  onProgress?.({status:"loading",progress:Number.isFinite(loaded)?Math.min(95,Math.max(5,loaded)):10,device:"wasm",dtype:"q4"});
 }});
 generatorMode="wasm";
 onProgress?.({status:"ready",progress:100,device:"wasm",dtype:"q4"});
 return pipe;
}

export async function loadLocalLLM(_id=recommendedModel().id,onProgress){
 if(generator){onProgress?.({status:"ready",progress:100,device:generatorMode});return generator}
 if(loading)return loading;
 loading=createGenerator(onProgress).finally(()=>{loading=null});
 generator=await loading;
 return generator;
}

const clean=text=>String(text||"").replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^assistant\s*[:：-]\s*/i,"").trim();

function buildMessages(prompt,history=[],memory={}){
 const facts=(memory.facts||[]).map(f=>f?.type+": "+f?.value).join("\\n");
 const memories=(memory.items||[]).map(x=>x?.text).filter(Boolean).slice(-8).join("\\n---\\n");
 const memoryText=[facts,memories].filter(Boolean).join("\\n");
 const context=(history||[]).filter(m=>m?.role&&m?.content).slice(-12).map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content).slice(0,4000)}));
 return[{role:"system",content:"You are ToollooT AI. Be intelligent, accurate, natural and concise. Reply in Hindi, English or Hinglish matching the user. Use conversation and memory as context. Never claim an action, tool, internet access or learning event that did not happen."},...(memoryText?[{role:"system",content:"Relevant memory:\\n"+memoryText}]:[]),...context,{role:"user",content:String(prompt||"")+"\\n/no_think"}];
}

export async function generateLocal(prompt,{max_new_tokens,history=[],memory={}}={}){
 if(!String(prompt||"").trim())throw new Error("Prompt required");
 const pipe=await loadLocalLLM();
 const output=await pipe(buildMessages(prompt,history,memory),{max_new_tokens:Math.max(32,Math.min(Number(max_new_tokens)||128,256)),do_sample:true,temperature:.5,top_p:.9,repetition_penalty:1.08,chat_template_kwargs:{enable_thinking:false}});
 const generated=output?.[0]?.generated_text;
 const raw=Array.isArray(generated)?generated.at(-1)?.content:generated;
 return clean(raw);
}

export function preloadRecommendedModel(onProgress){
 if(typeof window==="undefined")return Promise.resolve(null);
 return loadLocalLLM(recommendedModel().id,onProgress).catch(()=>null);
}
