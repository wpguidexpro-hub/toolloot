import { pipeline, ModelRegistry } from "@huggingface/transformers";

export const MODEL_KEY="toolloot:ai:model";
export const MODEL_REGISTRY=[
 {id:"onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",name:"SmolLM2 135M Instruct",size:"~182 MB q4",dtypes:["q4","q8","fp16"],license:"Apache-2.0"},
 {id:"onnx-community/Qwen2.5-0.5B-Instruct",name:"Qwen2.5 0.5B Instruct",size:"~400 MB q4",dtypes:["q4","q8","fp16"],license:"Apache-2.0"},
];
export const DATASET_REGISTRY=[
 {id:"OpenRL/daily_dialog",name:"DailyDialog",size:"4.28 MB",license:"CC BY-NC-SA 4.0",file:"data/train-00000-of-00001-f151c79abb2c1fd5.parquet"},
 {id:"HuggingFaceTB/smoltalk",name:"SmolTalk • everyday conversations",size:"946 KB",license:"Apache-2.0",file:"data/everyday-conversations/train-00000-of-00001.parquet"},
];
let generator=null,loadedId="";
export function modelUrl(id,file=""){return `https://huggingface.co/${id}/resolve/main/${file}`}
export async function getDtypes(id){try{return await ModelRegistry.get_available_dtypes(id)}catch{return []}}
export async function loadLocalLLM(id,onProgress){
 if(generator&&loadedId===id)return generator;
 const device=navigator.gpu?"webgpu":"wasm";
 const dtype=device==="webgpu"?"q4":"q8";
 generator=await pipeline("text-generation",id,{device,dtype,progress_callback:onProgress});
 loadedId=id;return generator;
}
export async function generateLocal(prompt,{id=MODEL_REGISTRY[0].id,max_new_tokens=160,onProgress}={}){
 const pipe=await loadLocalLLM(id,onProgress);
 const messages=[{role:"system",content:"You are ToollooT AI, a concise helpful local assistant. Answer in the user's language when possible. Never claim to have internet access."},{role:"user",content:prompt}];
 const out=await pipe(messages,{max_new_tokens,temperature:.7,do_sample:true});
 const text=out?.[0]?.generated_text;
 return Array.isArray(text)?text.at(-1)?.content||"":String(text||"");
}
