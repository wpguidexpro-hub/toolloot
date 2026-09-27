export function parseToolCommand(text="",file=null){
 const s=text.toLowerCase();
 const m=s.match(/(?:to|under|below|less than|maximum|max)\s*(\d+(?:\.\d+)?)\s*(kb|mb|b)\b/i);
 let targetBytes=null;if(m){const n=Number(m[1]),u=m[2].toLowerCase();targetBytes=u==="mb"?n*1048576:u==="kb"?n*1024:n}
 if((/compress|reduce|smaller|size/.test(s))&&file?.type?.startsWith("image/"))return {tool:"image.compress",targetBytes};
 if(/resize|dimension|\d+x\d+|square/.test(s)&&file?.type?.startsWith("image/"))return {tool:"image.resize"};
 if(/webp|jpg|jpeg|png|convert/.test(s)&&file?.type?.startsWith("image/"))return {tool:"image.convert"};
 if(/merge.*pdf|combine.*pdf/.test(s))return {tool:"pdf.merge"};
 if(/split.*pdf/.test(s))return {tool:"pdf.split"};
 return {tool:"general"};
}
async function canvasBlob(file,q){const bmp=await createImageBitmap(file),c=document.createElement("canvas");const scale=Math.min(1,4000/bmp.width,4000/bmp.height);c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,"image/jpeg",q))}
export async function imageCompressLocal(file,targetBytes){
 if(!targetBytes)return {blob:await canvasBlob(file,.8),name:file.name.replace(/\.[^.]+$/,"")+".jpg"};
 let lo=.02,hi=.95,best=null;
 for(let i=0;i<14;i++){const q=(lo+hi)/2,b=await canvasBlob(file,q);if(!best||Math.abs(b.size-targetBytes)<Math.abs(best.size-targetBytes))best=b;if(b.size>targetBytes)hi=q;else lo=q}
 return {blob:best,name:file.name.replace(/\.[^.]+$/,"")+".jpg"};
}
