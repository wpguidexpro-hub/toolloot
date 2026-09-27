import http from "node:http";
import { generateAI, getAIHealth } from "./aiEngine.mjs";

const port = Number(process.env.AI_PORT || 5186);
const cors = {"access-control-allow-origin":"*","access-control-allow-headers":"content-type","access-control-allow-methods":"GET,POST,OPTIONS"};
const json = (res,status,data) => { res.writeHead(status,{"content-type":"application/json; charset=utf-8",...cors}); res.end(JSON.stringify(data)); };
const read = async req => { let s=""; for await (const c of req) s+=c; return s ? JSON.parse(s) : {}; };

const server = http.createServer(async (req,res) => {
  if (req.method === "OPTIONS") { res.writeHead(204,cors); return res.end(); }
  try {
    const path = new URL(req.url,"http://toolloot.local").pathname;
    if (path === "/api/ai/health" && req.method === "GET") return json(res,200,await getAIHealth());
    if (path === "/api/ai/chat" && req.method === "POST") {
      const body = await read(req);
      const answer = await generateAI({prompt:body.prompt,history:body.history || [],memory:body.memory || {}});
      return json(res,200,{ok:true,answer,model:"SmolLM2-1.7B-Instruct.Q4_K_M.gguf",local:true});
    }
    return json(res,404,{error:"Not found"});
  } catch (e) {
    return json(res,503,{error:"Local AI failed",detail:e.message});
  }
});
server.listen(port,"127.0.0.1",()=>console.log("ToollooT AI proxy listening on 127.0.0.1:"+port));
