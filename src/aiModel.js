export const MODEL_KEY="toolloot:ai:model";
export const MODEL_REGISTRY=[
 {id:"onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",name:"SmolLM2 135M • Fast",size:"~182 MB q4",license:"Apache-2.0",speed:"mobile + PC",default:true},
 {id:"onnx-community/Qwen2.5-0.5B-Instruct",name:"Qwen2.5 0.5B • Quality",size:"~786 MB q4",license:"Apache-2.0",speed:"PC / powerful devices"}
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
export const runtimeInfo=()=>({
 mobile:isMobile(),
 device:navigator.gpu?"webgpu":"wasm",
 deviceLabel:navigator.gpu?"WebGPU":"WASM",
 cores:navigator.hardwareConcurrency||1,
 memory:navigator.deviceMemory||0
});
export function modelUrl(id,file=""){return `https://huggingface.co/${id}/resolve/main/${file}`}
export async function getDtypes(id){
 try{
  const {AutoConfig}=await getTransformers();
  await AutoConfig.from_pretrained(id);
  return ["q4"];
 }catch{return ["q4"]}
}
export async function loadLocalLLM(id=recommendedModel().id,onProgress){
 if(generator&&loadedId===id)return generator;
 const {pipeline,env}=await getTransformers();
 env.allowLocalModels=false;
 env.useBrowserCache=true;
 const info=runtimeInfo();
 try{
  generator=await pipeline("text-generation",id,{
   device:info.device,
   dtype:"q4",
   progress_callback:onProgress
  });
 }catch(first){
  // Some browsers/devices reject WebGPU/q4. Fall back to WASM automatically.
  if(info.device!=="wasm"){
   generator=await pipeline("text-generation",id,{
    device:"wasm",
    dtype:"q4",
    progress_callback:onProgress
   });
  }else{
   generator=null;
   throw first;
  }
 }
 loadedId=id;
 return generator;
}
export async function generateLocal(prompt,{id=recommendedModel().id,max_new_tokens,onProgress}={}){
 const pipe=await loadLocalLLM(id,onProgress);
 const mobile=runtimeInfo().mobile;
 const tokens=max_new_tokens??(mobile?96:160);
 const messages=[
  {role:"system",content:"You are ToollooT AI. Be helpful, concise and natural. Reply in the user's language. Do not claim internet access."},
  {role:"user",content:prompt}
 ];
 const out=await pipe(messages,{max_new_tokens:tokens,temperature:.65,do_sample:true,top_p:.9});
 const text=out?.[0]?.generated_text;
 return Array.isArray(text)?text.at(-1)?.content||"":String(text||"");
}

// Background warm-up: no model button is required for the normal user.
// The browser cache keeps the model for later chats after the first site visit.
export function preloadRecommendedModel(onProgress){
 if(typeof window==="undefined")return Promise.resolve(null);
 const start=()=>loadLocalLLM(recommendedModel().id,onProgress).catch(()=>null);
 if("requestIdleCallback" in window)return new Promise(resolve=>window.requestIdleCallback(()=>resolve(start()),{timeout:2500}));
 return new Promise(resolve=>setTimeout(()=>resolve(start()),1800));
}
