import { env, pipeline } from "@huggingface/transformers";

export const MODEL_KEY="toolloot:ai:model";
export const MODEL_REGISTRY=[{id:"onnx-community/Qwen3-0.6B-ONNX",name:"Qwen3 0.6B • GitHub",size:"~570 MB WebGPU / ~919 MB CPU",license:"Apache-2.0",speed:"WebGPU / WASM",default:true}];
export const DATASET_REGISTRY=[
{id:"OpenRL/daily_dialog",name:"DailyDialog",size:"4.28 MB",license:"CC BY-NC-SA 4.0",file:"data/train-00000-of-00001-f151c79abb2c1fd5.parquet"},
{id:"HuggingFaceTB/smoltalk",name:"SmolTalk • everyday conversations",size:"946 KB",license:"Apache-2.0",file:"data/everyday-conversations/train-00000-of-00001.parquet"}];

const RELEASE_ROOT="https://github.com/wpguidexpro-hub/toolloot/releases/download/toolloot-ai-v1";
let generator=null,generatorMode="",loading=null;
env.allowLocalModels=false;env.allowRemoteModels=true;env.remoteHost=RELEASE_ROOT;env.remotePathTemplate="{file}";env.useBrowserCache=true;env.useFSCache=false;
env.fetch=async(input,init)=>{const source=input instanceof Request?input.url:String(input);if(source.startsWith(RELEASE_ROOT+"/")){const name=decodeURIComponent(new URL(source).pathname.split("/").pop()||"");return fetch(RELEASE_ROOT+"/"+name,init)}return fetch(input,init)};
export const recommendedModel=()=>MODEL_REGISTRY[0];
export const runtimeInfo=()=>({mobile:/Android|iPhone|iPad|iPod/i.test(navigator.userAgent),device:generatorMode||"browser",deviceLabel:generatorMode==="webgpu"?"WebGPU":generatorMode==="wasm"?"CPU/WASM":"GitHub browser AI",cores:navigator.hardwareConcurrency||1,memory:navigator.deviceMemory||0});
export function modelUrl(_id,file=""){return RELEASE_ROOT+"/"+file.split("/").pop()}
export function datasetUrl(id,file=""){return "https://huggingface.co/datasets/"+id+"/resolve/main/"+file}
export async function getDtypes(){return["q4f16","q4"]}

async function canUseFloat16WebGPU(){try{if(!navigator.gpu)return false;const adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});return!!adapter&&!!adapter.features?.has?.("shader-f16")}catch{return false}}
async function createGenerator(onProgress){const webgpu=await canUseFloat16WebGPU(),device=webgpu?"webgpu":"wasm",dtype=webgpu?"q4f16":"q4";onProgress?.({status:"loading",progress:5,device,dtype});const pipe=await pipeline("text-generation",recommendedModel().id,{device,dtype,progress_callback:p=>{const loaded=Number(p?.progress);onProgress?.({status:"loading",progress:Number.isFinite(loaded)?Math.min(95,Math.max(5,loaded)):10,device,dtype})}});generatorMode=device;onProgress?.({status:"ready",progress:100,device,dtype});return pipe}
export async function loadLocalLLM(_id=recommendedModel().id,onProgress){if(generator){onProgress?.({status:"ready",progress:100,device:generatorMode});return generator}if(loading)return loading;loading=createGenerator(onProgress).finally(()=>{loading=null});generator=await loading;return generator}
const clean=text=>String(text||"").replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/^assistant\s*[:：-]\s*/i,"").trim();
function buildMessages(prompt,history=[],memory={}){const facts=(memory.facts||[]).map(f=>f?.type+": "+f?.value).join("\n"),memories=(memory.items||[]).map(x=>x?.text).filter(Boolean).slice(-8).join("\n---\n"),memoryText=[facts,memories].filter(Boolean).join("\n"),context=(history||[]).filter(m=>m?.role&&m?.content).slice(-16).map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content).slice(0,6000)}));return[{role:"system",content:"You are ToollooT AI. Be intelligent, accurate, natural and concise. Reply in Hindi, English or Hinglish matching the user. Use the conversation and memory as context. Never claim an action, tool, internet access or learning event that did not happen. Do not claim that your model weights changed."},...(memoryText?[{role:"system",content:"Relevant long-term memory:\n"+memoryText}]:[]),...context,{role:"user",content:String(prompt||"")+"\n/no_think"}]}
export async function generateLocal(prompt,{max_new_tokens,history=[],memory={}}={}){if(!String(prompt||"").trim())throw new Error("Prompt required");const pipe=await loadLocalLLM(),output=await pipe(buildMessages(prompt,history,memory),{max_new_tokens:Math.max(32,Math.min(Number(max_new_tokens)||256,768)),do_sample:true,temperature:.55,top_p:.9,repetition_penalty:1.08,chat_template_kwargs:{enable_thinking:false}}),generated=output?.[0]?.generated_text,raw=Array.isArray(generated)?generated.at(-1)?.content:generated;return clean(raw)}
export function preloadRecommendedModel(onProgress){if(typeof window==="undefined")return Promise.resolve(null);return loadLocalLLM(recommendedModel().id,onProgress).catch(()=>null)}
