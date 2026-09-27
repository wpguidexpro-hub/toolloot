import { get, set, del } from "idb-keyval";

const KEY="toolloot:image-compressor:session";
const TTL=60*60*1000;

const fileKey=f=>f.name+":"+f.size+":"+f.lastModified;

export async function loadImageSession(){
  try{
    const saved=await get(KEY);
    if(!saved||Date.now()-saved.savedAt>TTL){if(saved)await del(KEY);return []}
    return saved.items.map(x=>{
      const file=new File([x.fileBlob],x.fileName,{type:x.fileType||"image/*",lastModified:x.lastModified||Date.now()});
      const preview=URL.createObjectURL(file);
      let result=null;
      if(x.resultBlob){
        const blob=x.resultBlob;
        result={name:x.resultName||file.name,blob,width:x.resultWidth||0,height:x.resultHeight||0,url:URL.createObjectURL(blob),original:file.size,originalUrl:preview,settings:x.settings||{}};
      }
      return {id:x.id||crypto.randomUUID(),file,preview,settings:x.settings||{quality:.8},result};
    });
  }catch{return []}
}

export async function saveImageSession(items){
  if(!items?.length){await del(KEY);return}
  const payload={savedAt:Date.now(),items:await Promise.all(items.map(async x=>({
    id:x.id,fileBlob:x.file.slice(0,x.file.size,x.file.type),fileName:x.file.name,fileType:x.file.type,lastModified:x.file.lastModified,
    settings:x.settings||{},
    resultBlob:x.result?.blob instanceof Blob?x.result.blob:null,resultName:x.result?.name||null,resultWidth:x.result?.width||null,resultHeight:x.result?.height||null
  })))};
  await set(KEY,payload);
}

export async function clearImageSession(){
  try{await del(KEY)}catch{}
}

export function imageSessionKey(items){return (items||[]).map(x=>fileKey(x.file)).join("|")}
