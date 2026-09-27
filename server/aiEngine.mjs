const ASI_CORE_URL = String(process.env.ASI_CORE_URL || "http://127.0.0.1:5181");

async function call(path, options = {}) {
  const response = await fetch(ASI_CORE_URL + path, options);
  const body = await response.text();
  let data = {};
  try { data = body ? JSON.parse(body) : {}; } catch { data = { raw: body }; }
  if (!response.ok) throw new Error(data.error || data.detail || "ASI-Core unavailable");
  return data;
}

export async function getAIHealth() {
  try {
    const s = await call("/api/status");
    return { ok:true, ready:s.llm === "READY", online:s.status === "ONLINE", model:s.model, backend:"ASI-Core local PC", uptime:s.uptime, memoryCount:s.memory_count, learning:s.learning, stage:s.stage, reasoning:s.reasoning };
  } catch (e) {
    return { ok:false, ready:false, online:false, model:"SmolLM2-1.7B-Instruct.Q4_K_M.gguf", backend:"ASI-Core local PC", error:e.message };
  }
}

export async function generateAI({ prompt="", history=[], memory={} } = {}) {
  const context = [];
  if (Array.isArray(history) && history.length) context.push("Recent conversation:\n" + history.slice(-8).map(x => (x.role || "user") + ": " + (x.content || "")).join("\n"));
  if (memory && Object.keys(memory).length) context.push("ToollooT memory:\n" + JSON.stringify(memory).slice(0,5000));
  const message = context.length ? context.join("\n\n") + "\n\nUser request:\n" + prompt : prompt;
  const result = await call("/api/chat", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({message}) });
  return String(result.response || "").trim();
}
