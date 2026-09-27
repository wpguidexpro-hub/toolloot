import http from "node:http";
import crypto from "node:crypto";
import mariadb from "mariadb";

const port = Number(process.env.PORT || 5186);
const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "toolloot",
  connectionLimit: 10
});

const cors = {
  "access-control-allow-origin": process.env.CORS_ORIGIN || "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS"
};
const json = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...cors });
  res.end(JSON.stringify(data));
};
const read = async req => {
  let s = "";
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
};
const id = () => crypto.randomUUID();
const token = bytes => crypto.randomBytes(bytes).toString("hex");
const now = () => new Date();
const hash = p => {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(p, salt, 64).toString("hex");
};
const verify = (p, h) => {
  try {
    const [salt, key] = String(h).split(":");
    if (!salt || !key) return false;
    return crypto.timingSafeEqual(Buffer.from(key, "hex"), crypto.scryptSync(p, salt, 64));
  } catch {
    return false;
  }
};
const parseUrl = req => new URL(req.url, "http://toolloot.local");
const route = (req, pattern) => {
  const m = parseUrl(req).pathname.match(pattern);
  return m?.slice(1);
};
const isOwner = u => !!u?.is_platform_owner;

async function init() {
  const c = await pool.getConnection();
  try {
    const statements = [
      "CREATE TABLE IF NOT EXISTS users(id CHAR(36) PRIMARY KEY,name VARCHAR(120) NOT NULL,email VARCHAR(190) NOT NULL UNIQUE,password_hash TEXT NOT NULL,is_platform_owner TINYINT(1) NOT NULL DEFAULT 0,created_at DATETIME NOT NULL)",
      "CREATE TABLE IF NOT EXISTS sessions(token CHAR(64) PRIMARY KEY,user_id CHAR(36) NOT NULL,created_at DATETIME NOT NULL,index(user_id))",
      "CREATE TABLE IF NOT EXISTS teams(id CHAR(36) PRIMARY KEY,name VARCHAR(160) NOT NULL,owner_id CHAR(36) NOT NULL,created_at DATETIME NOT NULL,index(owner_id))",
      "CREATE TABLE IF NOT EXISTS team_members(team_id CHAR(36) NOT NULL,user_id CHAR(36) NOT NULL,role VARCHAR(30) NOT NULL,joined_at DATETIME NOT NULL,PRIMARY KEY(team_id,user_id),index(user_id))",
      "CREATE TABLE IF NOT EXISTS team_invites(id CHAR(36) PRIMARY KEY,team_id CHAR(36) NOT NULL,token CHAR(64) NOT NULL UNIQUE,role VARCHAR(30) NOT NULL DEFAULT 'member',created_by CHAR(36) NOT NULL,expires_at DATETIME NOT NULL,used_at DATETIME NULL,used_by CHAR(36) NULL,index(team_id),index(token))",
      "CREATE TABLE IF NOT EXISTS chats(id CHAR(36) PRIMARY KEY,owner_id CHAR(36) NOT NULL,team_id CHAR(36) NULL,title VARCHAR(180) NOT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,index(owner_id),index(team_id))",
      "CREATE TABLE IF NOT EXISTS chat_messages(id CHAR(36) PRIMARY KEY,chat_id CHAR(36) NOT NULL,user_id CHAR(36) NOT NULL,role VARCHAR(30) NOT NULL,content MEDIUMTEXT NOT NULL,meta JSON NULL,created_at DATETIME NOT NULL,index(chat_id),index(user_id))",
      "CREATE TABLE IF NOT EXISTS memories(id CHAR(36) PRIMARY KEY,user_id CHAR(36) NOT NULL,team_id CHAR(36) NULL,memory_key VARCHAR(160) NOT NULL,memory_value MEDIUMTEXT NOT NULL,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,index(user_id),index(team_id),unique key memory_scope_key(user_id,team_id,memory_key))",
      "CREATE TABLE IF NOT EXISTS analytics_events(id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id CHAR(36) NULL,event_name VARCHAR(100) NOT NULL,path VARCHAR(500),session_id VARCHAR(120),meta JSON NULL,created_at DATETIME NOT NULL,index(event_name),index(created_at),index(user_id))",
      "CREATE TABLE IF NOT EXISTS ad_events(id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id CHAR(36) NULL,slot VARCHAR(160) NOT NULL,event_type VARCHAR(30) NOT NULL,amount DECIMAL(12,4) NOT NULL DEFAULT 0,meta JSON NULL,created_at DATETIME NOT NULL,index(slot),index(event_type),index(created_at))",
      "CREATE TABLE IF NOT EXISTS ad_revenue(id BIGINT AUTO_INCREMENT PRIMARY KEY,source VARCHAR(100) NOT NULL,period_start DATE NOT NULL,period_end DATE NOT NULL,amount DECIMAL(12,4) NOT NULL,currency CHAR(3) NOT NULL DEFAULT 'INR',notes VARCHAR(500),created_by CHAR(36) NOT NULL,created_at DATETIME NOT NULL,index(period_start),index(source))"
    ];
    for (const s of statements) await c.query(s);
    try { await c.query("ALTER TABLE users ADD COLUMN is_platform_owner TINYINT(1) NOT NULL DEFAULT 0"); } catch {}
    try { await c.query("ALTER TABLE team_members ADD COLUMN joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"); } catch {}
    const owners = await c.query("SELECT id FROM users WHERE is_platform_owner=1 LIMIT 1");
    if (!owners.length) {
      const first = await c.query("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");
      if (first[0]) await c.query("UPDATE users SET is_platform_owner=1 WHERE id=?", [first[0].id]);
    }
  } finally { c.release(); }
}

async function auth(req) {
  const t = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const rows = await pool.query(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? LIMIT 1",
    [t]
  );
  return rows[0] || null;
}
async function requireTeamMember(userId, teamId) {
  const rows = await pool.query(
    "SELECT tm.role,t.id,t.name,t.owner_id FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.team_id=? AND tm.user_id=? LIMIT 1",
    [teamId, userId]
  );
  return rows[0] || null;
}
const canManageTeam = m => m && (m.role === "owner" || m.role === "admin");

async function main(req, res) {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  try {
    const u = await auth(req);
    const url = parseUrl(req);
    const p = url.pathname;

    if (p === "/api/health") return json(res, 200, { ok: true, service: "toolloot-api", workspace: "cloud" });

    if (p === "/api/auth/register" && req.method === "POST") {
      const b = await read(req);
      if (!b.email || !b.password || !b.name) return json(res, 400, { error: "name,email,password required" });
      if (String(b.password).length < 6) return json(res, 400, { error: "Password must be at least 6 characters" });
      const email = String(b.email).trim().toLowerCase();
      const exists = await pool.query("SELECT id FROM users WHERE email=? LIMIT 1", [email]);
      if (exists[0]) return json(res, 409, { error: "Email already registered" });
      const userId = id();
      const count = (await pool.query("SELECT COUNT(*) n FROM users"))[0].n;
      await pool.query("INSERT INTO users(id,name,email,password_hash,is_platform_owner,created_at) VALUES(?,?,?,?,?,?)",
        [userId, String(b.name).trim(), email, hash(b.password), Number(count) === 0 ? 1 : 0, now()]);
      const session = token(32);
      await pool.query("INSERT INTO sessions VALUES(?,?,?)", [session, userId, now()]);
      return json(res, 201, { user: { id: userId, name: String(b.name).trim(), email, isPlatformOwner: Number(count) === 0 }, token: session });
    }

    if (p === "/api/auth/login" && req.method === "POST") {
      const b = await read(req);
      const rows = await pool.query("SELECT * FROM users WHERE email=? LIMIT 1", [String(b.email || "").trim().toLowerCase()]);
      if (!rows[0] || !verify(b.password || "", rows[0].password_hash)) return json(res, 401, { error: "Invalid credentials" });
      const session = token(32);
      await pool.query("INSERT INTO sessions VALUES(?,?,?)", [session, rows[0].id, now()]);
      return json(res, 200, { user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, isPlatformOwner: !!rows[0].is_platform_owner }, token: session });
    }

    if (p === "/api/auth/logout" && req.method === "POST") {
      const t = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (t) await pool.query("DELETE FROM sessions WHERE token=?", [t]);
      return json(res, 200, { ok: true });
    }

    if (p === "/api/me" && req.method === "GET") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      return json(res, 200, { user: { id: u.id, name: u.name, email: u.email, isPlatformOwner: !!u.is_platform_owner } });
    }

    if (p === "/api/teams" && req.method === "GET") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const rows = await pool.query(
        "SELECT t.id,t.name,t.owner_id,t.created_at,tm.role,(SELECT COUNT(*) FROM team_members x WHERE x.team_id=t.id) member_count FROM teams t JOIN team_members tm ON tm.team_id=t.id AND tm.user_id=? ORDER BY t.created_at DESC",
        [u.id]
      );
      return json(res, 200, { teams: rows });
    }

    if (p === "/api/teams" && req.method === "POST") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const b = await read(req);
      const name = String(b.name || "").trim();
      if (!name) return json(res, 400, { error: "Team name required" });
      const teamId = id();
      await pool.query("INSERT INTO teams VALUES(?,?,?,?)", [teamId, name, u.id, now()]);
      await pool.query("INSERT INTO team_members(team_id,user_id,role,joined_at) VALUES(?,?,?,?)", [teamId, u.id, "owner", now()]);
      return json(res, 201, { id: teamId, name, role: "owner" });
    }

    const teamMatch = route(req, /^\/api\/teams\/([^/]+)$/);
    if (teamMatch && req.method === "GET") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const member = await requireTeamMember(u.id, teamMatch[0]);
      if (!member) return json(res, 403, { error: "Team access denied" });
      const members = await pool.query(
        "SELECT u.id,u.name,u.email,tm.role,tm.joined_at FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? ORDER BY FIELD(tm.role,'owner','admin','member'),tm.joined_at",
        [teamMatch[0]]
      );
      return json(res, 200, { team: { id: member.id, name: member.name, ownerId: member.owner_id, role: member.role }, members });
    }

    const inviteCreate = route(req, /^\/api\/teams\/([^/]+)\/invites$/);
    if (inviteCreate && req.method === "POST") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const member = await requireTeamMember(u.id, inviteCreate[0]);
      if (!canManageTeam(member)) return json(res, 403, { error: "Only Owner/Admin can invite members" });
      const b = await read(req);
      const role = ["member","admin"].includes(b.role) ? b.role : "member";
      const days = Math.max(1, Math.min(Number(b.expiresInDays || 7), 30));
      const inviteToken = token(32);
      const inviteId = id();
      await pool.query(
        "INSERT INTO team_invites(id,team_id,token,role,created_by,expires_at) VALUES(?,?,?,?,?,?)",
        [inviteId, inviteCreate[0], inviteToken, role, u.id, new Date(Date.now() + days * 86400000)]
      );
      return json(res, 201, { id: inviteId, token: inviteToken, role, expiresAt: new Date(Date.now() + days * 86400000).toISOString() });
    }

    const redeem = route(req, /^\/api\/invites\/([^/]+)\/redeem$/);
    if (redeem && req.method === "POST") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const rows = await pool.query("SELECT * FROM team_invites WHERE token=? AND used_at IS NULL LIMIT 1", [redeem[0]]);
      const invite = rows[0];
      if (!invite || new Date(invite.expires_at).getTime() < Date.now()) return json(res, 410, { error: "Invite expired or invalid" });
      const existing = await requireTeamMember(u.id, invite.team_id);
      if (!existing) await pool.query("INSERT INTO team_members(team_id,user_id,role,joined_at) VALUES(?,?,?,?)", [invite.team_id, u.id, invite.role, now()]);
      await pool.query("UPDATE team_invites SET used_at=?,used_by=? WHERE id=?", [now(), u.id, invite.id]);
      return json(res, 200, { ok: true, teamId: invite.team_id, role: existing?.role || invite.role });
    }

    const memberRole = route(req, /^\/api\/teams\/([^/]+)\/members\/([^/]+)$/);
    if (memberRole && (req.method === "PATCH" || req.method === "DELETE")) {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const member = await requireTeamMember(u.id, memberRole[0]);
      if (!member || member.role !== "owner") return json(res, 403, { error: "Only the team owner can change roles" });
      if (memberRole[1] === u.id) return json(res, 400, { error: "Owner cannot remove or demote self" });
      if (req.method === "DELETE") {
        await pool.query("DELETE FROM team_members WHERE team_id=? AND user_id=?", [memberRole[0], memberRole[1]]);
        return json(res, 200, { ok: true });
      }
      const b = await read(req);
      const role = ["admin","member"].includes(b.role) ? b.role : "member";
      await pool.query("UPDATE team_members SET role=? WHERE team_id=? AND user_id=?", [role, memberRole[0], memberRole[1]]);
      return json(res, 200, { ok: true, role });
    }

    const teamChats = route(req, /^\/api\/teams\/([^/]+)\/chats$/);
    if (teamChats && req.method === "GET") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const member = await requireTeamMember(u.id, teamChats[0]);
      if (!member) return json(res, 403, { error: "Team access denied" });
      const chats = await pool.query(
        "SELECT c.id,c.title,c.owner_id,c.created_at,c.updated_at,(SELECT COUNT(*) FROM chat_messages m WHERE m.chat_id=c.id) message_count FROM chats c WHERE c.team_id=? ORDER BY c.updated_at DESC",
        [teamChats[0]]
      );
      return json(res, 200, { chats });
    }

    if (teamChats && req.method === "POST") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const member = await requireTeamMember(u.id, teamChats[0]);
      if (!member) return json(res, 403, { error: "Team access denied" });
      const b = await read(req);
      const chatId = id();
      const title = String(b.title || "Team chat").trim().slice(0, 180);
      await pool.query("INSERT INTO chats(id,owner_id,team_id,title,created_at,updated_at) VALUES(?,?,?,?,?,?)", [chatId,u.id,teamChats[0],title,now(),now()]);
      return json(res, 201, { id: chatId, title, teamId: teamChats[0] });
    }

    const chatMatch = route(req, /^\/api\/chats\/([^/]+)$/);
    if (chatMatch && req.method === "GET") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const rows = await pool.query("SELECT * FROM chats WHERE id=? LIMIT 1", [chatMatch[0]]);
      const chat = rows[0];
      if (!chat) return json(res, 404, { error: "Chat not found" });
      if (chat.team_id) {
        if (!(await requireTeamMember(u.id, chat.team_id))) return json(res, 403, { error: "Chat access denied" });
      } else if (chat.owner_id !== u.id) return json(res, 403, { error: "Chat access denied" });
      const messages = await pool.query(
        "SELECT m.id,m.user_id,m.role,m.content,m.meta,m.created_at,u.name FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.chat_id=? ORDER BY m.created_at ASC",
        [chat.id]
      );
      return json(res, 200, { chat, messages });
    }

    const chatMessages = route(req, /^\/api\/chats\/([^/]+)\/messages$/);
    if (chatMessages && req.method === "POST") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const rows = await pool.query("SELECT * FROM chats WHERE id=? LIMIT 1", [chatMessages[0]]);
      const chat = rows[0];
      if (!chat) return json(res, 404, { error: "Chat not found" });
      if (chat.team_id) {
        if (!(await requireTeamMember(u.id, chat.team_id))) return json(res, 403, { error: "Chat access denied" });
      } else if (chat.owner_id !== u.id) return json(res, 403, { error: "Chat access denied" });
      const b = await read(req);
      if (!String(b.content || "").trim()) return json(res, 400, { error: "Message content required" });
      const messageId = id();
      await pool.query("INSERT INTO chat_messages(id,chat_id,user_id,role,content,meta,created_at) VALUES(?,?,?,?,?,?,?)",
        [messageId,chat.id,u.id,b.role || "user",String(b.content),JSON.stringify(b.meta || {}),now()]);
      await pool.query("UPDATE chats SET updated_at=? WHERE id=?", [now(),chat.id]);
      return json(res, 201, { id: messageId, ok: true });
    }

    const memoryRoute = route(req, /^\/api\/memory$/);
    if (memoryRoute && req.method === "GET") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const teamId = url.searchParams.get("teamId");
      if (teamId && !(await requireTeamMember(u.id, teamId))) return json(res, 403, { error: "Team access denied" });
      const rows = teamId
        ? await pool.query("SELECT m.id,m.memory_key,m.memory_value,m.team_id,m.created_at,m.updated_at,u.name AS created_by FROM memories m JOIN users u ON u.id=m.user_id WHERE m.team_id=? ORDER BY m.updated_at DESC",[teamId])
        : await pool.query("SELECT id,memory_key,memory_value,team_id,created_at,updated_at FROM memories WHERE user_id=? AND team_id IS NULL ORDER BY updated_at DESC",[u.id]);
      return json(res, 200, { memories: rows });
    }
    if (memoryRoute && req.method === "POST") {
      if (!u) return json(res, 401, { error: "Unauthorized" });
      const b = await read(req);
      const teamId = b.teamId || null;
      if (teamId && !(await requireTeamMember(u.id, teamId))) return json(res, 403, { error: "Team access denied" });
      const key = String(b.key || "").trim().slice(0,160);
      if (!key) return json(res,400,{error:"Memory key required"});
      const value = String(b.value ?? "");
      const existing = teamId
        ? await pool.query("SELECT id FROM memories WHERE team_id=? AND memory_key=? LIMIT 1",[teamId,key])
        : await pool.query("SELECT id FROM memories WHERE user_id=? AND team_id IS NULL AND memory_key=? LIMIT 1",[u.id,key]);
      if (existing[0]) await pool.query("UPDATE memories SET memory_value=?,updated_at=? WHERE id=?",[value,now(),existing[0].id]);
      else await pool.query("INSERT INTO memories(id,user_id,team_id,memory_key,memory_value,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",[id(),u.id,teamId,key,value,now(),now()]);
      return json(res,200,{ok:true});
    }

    if (p === "/api/analytics/event" && req.method === "POST") {
      const b = await read(req);
      await pool.query("INSERT INTO analytics_events(user_id,event_name,path,session_id,meta,created_at) VALUES(?,?,?,?,?,?)",
        [u?.id || null,b.event || "unknown",b.path || "",b.sessionId || "",JSON.stringify(b.data || {}),now()]);
      if (b.adSlot && b.adEvent) {
        const amount = Number(b.amount || 0);
        await pool.query("INSERT INTO ad_events(user_id,slot,event_type,amount,meta,created_at) VALUES(?,?,?,?,?,?)",
          [u?.id || null,String(b.adSlot),String(b.adEvent),Number.isFinite(amount)?amount:0,JSON.stringify(b.data || {}),now()]);
      }
      return json(res, 201, { ok: true });
    }

    if (p === "/api/owner/analytics" && req.method === "GET") {
      if (!isOwner(u)) return json(res, 403, { error: "Owner-only dashboard" });
      const days = Math.max(1, Math.min(Number(url.searchParams.get("days") || 30), 365));
      const since = new Date(Date.now() - days * 86400000);
      const [events,users,teams,activeUsers,topEvents,tools,ads,manual] = await Promise.all([
        pool.query("SELECT COUNT(*) n FROM analytics_events WHERE created_at>=?",[since]),
        pool.query("SELECT COUNT(*) n FROM users"),
        pool.query("SELECT COUNT(*) n FROM teams"),
        pool.query("SELECT COUNT(DISTINCT user_id) n FROM analytics_events WHERE created_at>=? AND user_id IS NOT NULL",[since]),
        pool.query("SELECT event_name name,COUNT(*) n FROM analytics_events WHERE created_at>=? GROUP BY event_name ORDER BY n DESC LIMIT 25",[since]),
        pool.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(meta,'$.tool')) tool,COUNT(*) n FROM analytics_events WHERE created_at>=? AND JSON_EXTRACT(meta,'$.tool') IS NOT NULL GROUP BY tool ORDER BY n DESC LIMIT 25",[since]),
        pool.query("SELECT event_type,COUNT(*) n,COALESCE(SUM(amount),0) amount FROM ad_events WHERE created_at>=? GROUP BY event_type",[since]),
        pool.query("SELECT COALESCE(SUM(amount),0) amount,currency FROM ad_revenue WHERE period_end>=? GROUP BY currency",[since])
      ]);
      const daily = await pool.query(
        "SELECT DATE(created_at) day,COUNT(*) events,COUNT(DISTINCT user_id) users FROM analytics_events WHERE created_at>=? GROUP BY DATE(created_at) ORDER BY day ASC",
        [since]
      );
      const revenueRows = await pool.query(
        "SELECT id,source,period_start,period_end,amount,currency,notes,created_at FROM ad_revenue WHERE period_end>=? ORDER BY period_end DESC LIMIT 100",
        [since]
      );
      const impressions = ads.filter(x=>x.event_type==="impression").reduce((n,x)=>n+Number(x.n),0);
      const clicks = ads.filter(x=>x.event_type==="click").reduce((n,x)=>n+Number(x.n),0);
      const trackedAdAmount = ads.reduce((n,x)=>n+Number(x.amount||0),0);
      const manualAmount = manual.reduce((n,x)=>n+Number(x.amount||0),0);
      return json(res,200,{
        range:{days,since:since.toISOString()},
        overview:{events:Number(events[0].n),users:Number(users[0].n),teams:Number(teams[0].n),activeUsers:Number(activeUsers[0].n)},
        events:topEvents,
        tools,
        daily,
        ads:{impressions,clicks,trackedAmount:trackedAdAmount,manualRevenue:manualAmount,totalRevenue:trackedAdAmount+manualAmount,ctr:impressions?clicks/impressions:0},
        revenue:revenueRows
      });
    }

    if (p === "/api/owner/ad-revenue" && req.method === "POST") {
      if (!isOwner(u)) return json(res,403,{error:"Owner-only dashboard"});
      const b = await read(req);
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount < 0) return json(res,400,{error:"Valid revenue amount required"});
      const start = new Date(String(b.periodStart || now().toISOString()).slice(0,10));
      const end = new Date(String(b.periodEnd || b.periodStart || now().toISOString()).slice(0,10));
      await pool.query("INSERT INTO ad_revenue(source,period_start,period_end,amount,currency,notes,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)",
        [String(b.source || "Ad network"),start,end,amount,String(b.currency || "INR").slice(0,3).toUpperCase(),String(b.notes || "").slice(0,500),u.id,now()]);
      return json(res,201,{ok:true});
    }

    return json(res,404,{error:"Not found"});
  } catch (e) {
    console.error(e);
    return json(res,500,{error:"Server error",detail:process.env.NODE_ENV==="production"?"Request failed":e.message});
  }
}

init().then(()=>http.createServer(main).listen(port,()=>console.log("ToollooT cloud API listening on "+port)))
  .catch(e=>{console.error(e);process.exit(1)});
