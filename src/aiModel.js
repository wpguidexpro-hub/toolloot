export const MODEL_KEY="toolloot:ai:model";
export const MODEL_REGISTRY=[
 {id:"onnx-community/Qwen3-0.6B-ONNX",name:"Qwen3 0.6B • Smart",size:"~570 MB q4f16",license:"Apache-2.0",speed:"PC + capable mobile",default:true},
 {id:"onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",name:"SmolLM2 135M • Fast",size:"~182 MB q4",license:"Apache-2.0",speed:"mobile + PC"}
];
export const DATASET_REGISTRY=[
 {id:"OpenRL/daily_dialog",name:"DailyDialog",size:"4.28 MB",license:"CC BY-NC-SA 4.0",file:"data/train-00000-of-00001-f151c79abb2c1fd5.parquet"},
 {id:"HuggingFaceTB/smoltalk",name:"SmolTalk • everyday conversations",size:"946 KB",license:"Apache-2.0",file:"data/everyday-conversations/train-00000-of-00001.parquet"},
];
let generator=null,loadedId="";
let transformersPromise=null;
const getTransformers=()=>transformersPromise||(transformersPromise=import("@huggingface/transformers"));
const isMobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<700;
export const recommendedModel=()=>MODEL_REGISTRY[0];
export const runtimeInfo=()=>({mobile:isMobile(),device:navigator.gpu?"webgpu":"wasm",deviceLabel:navigator.gpu?"WebGPU":"WASM",cores:navigator.hardwareConcurrency||1,memory:navigator.deviceMemory||0});
export function modelUrl(id,file=""){return `https://huggingface.co/${id}/resolve/main/${file}`}
export async function getDtypes(id){try{const {ModelRegistry}=await getTransformers();return await ModelRegistry.get_available_dtypes(id)}catch{return ["q4"]}}
export async function loadLocalLLM(id=recommendedModel().id,onProgress){
 if(generator&&loadedId===id)return generator;
 const {pipeline,env}=await getTransformers();
 env.allowLocalModels=false;env.useBrowserCache=true;
 const info=runtimeInfo();
 const dtype=id==="onnx-community/Qwen3-0.6B-ONNX"?"q4f16":"q4";
 try{generator=await pipeline("text-generation",id,{device:info.device,dtype,progress_callback:onProgress})}
 catch(first){
  if(info.device!=="wasm")generator=await pipeline("text-generation",id,{device:"wasm",dtype,progress_callback:onProgress});
  else{generator=null;throw first}
 }
 loadedId=id;return generator;
}
export async function generateLocal(prompt,{id=recommendedModel().id,max_new_tokens,onProgress,history=[]}={}){
 const pipe=await loadLocalLLM(id,onProgress),tokens=max_new_tokens??(runtimeInfo().mobile?128:256);
 const context=history.filter(m=>m?.role&&m?.content).slice(-10).map(m=>({role:m.role,content:String(m.content).slice(0,4000)}));
 const messages=[
  {role:"system",content:"You are ToollooT AI, a capable general-purpose assistant. Be accurate, natural, helpful and concise. Reply in the user's language (Hindi, English or Hinglish). Use the conversation context. Never invent a shopping/business context unless the user asks about it. For simple greetings, respond naturally. Do not claim internet access or actions you did not perform. If uncertain, say so and explain what information is needed."},
  ...context,
  {role:"user",content:prompt}
 ];
 const out=await pipe(messages,{max_new_tokens:tokens,temperature:.55,do_sample:true,top_p:.9,repetition_penalty:1.08}),text=out?.[0]?.generated_text;
 const answer=Array.isArray(text)?text.at(-1)?.content||"":String(text||"");
 return answer.replace(/^assistant\\s*[:：-]\\s*/i,"").trim();
}
export function preloadRecommendedModel(onProgress){
 if(typeof window==="undefined")return Promise.resolve(null);
 const warm=()=>{
  try{if("serviceWorker" in navigator){const base=import.meta.env.BASE_URL||"/";navigator.serviceWorker.register(base+"sw.js",{scope:base}).catch(()=>{})}}catch{}
  return loadLocalLLM(recommendedModel().id,onProgress).catch(()=>null);
 };
 if("requestIdleCallback" in window)return new Promise(resolve=>window.requestIdleCallback(()=>resolve(warm()),{timeout:2500}));
 return new Promise(resolve=>setTimeout(()=>resolve(warm()),1800));
}
