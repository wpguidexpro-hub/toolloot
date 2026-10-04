import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mariadb from "mariadb";
import { v4 as uuid } from "uuid";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "toolloot-dev-change-this";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "toolloot",
  connectionLimit: 5,
  bigIntAsNumber: true,
  connectTimeout: 5000,
  acquireTimeout: 5000
});

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN === "*" ? "*" : CLIENT_ORIGIN.split(",").map(x => x.trim()), methods: ["GET", "POST"] }
});

app.use(cors({ origin: CLIENT_ORIGIN === "*" ? "*" : CLIENT_ORIGIN.split(",").map(x => x.trim()) }));
app.use(express.json({ limit: "256kb" }));

const publicUser = u => ({ id: u.id, name: u.name, email: u.email });
const signToken = u => jwt.sign({ id: u.id, email: u.email }, JWT_SECRET, { expiresIn: "30d" });

async function query(sql, params = []) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

async function getUser(id) {
  const rows = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    req.user = jwt.verify(header.startsWith("Bearer ") ? header.slice(7) : "", JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1 AS ok");
    res.json({ ok: true, database: "mariadb", game: "ToollooT Mining Master" });
  } catch (error) {
    console.error("health", error);
    res.status(503).json({ ok: false, database: "unavailable", error: error.message });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const cleanName = String(name || "").trim().slice(0, 24);
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanName || !cleanEmail || !password || String(password).length < 6)
      return res.status(400).json({ error: "Name, email and 6+ character password required" });

    const existing = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [cleanEmail]);
    if (existing.length) return res.status(409).json({ error: "Email already registered" });

    const user = { id: uuid(), name: cleanName, email: cleanEmail, password: await bcrypt.hash(String(password), 10) };
    await query(
      `INSERT INTO users
       (id,name,email,password,cash,ore,zone,bulldozer_level,tool_level,workers,score,wins,kills)
       VALUES (?,?,?,?,0,0,1,1,1,0,0,0,0)`,
      [user.id, user.name, user.email, user.password]
    );
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("register", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = (await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]))[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("login", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/me", auth, async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password, ...safe } = user;
    res.json(safe);
  } catch { res.status(500).json({ error: "Could not load profile" }); }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const rows = await query(`SELECT id,name,cash,ore,zone,bulldozer_level AS bulldozerLevel,
      tool_level AS toolLevel,workers,score,wins,kills FROM users ORDER BY score DESC LIMIT 100`);
    res.json(rows);
  } catch { res.status(500).json({ error: "Could not load leaderboard" }); }
});

app.post("/api/save", auth, async (req, res) => {
  try {
    const p = req.body || {};
    const fields = ["cash", "ore", "zone", "bulldozerLevel", "toolLevel", "workers", "score"];
    const values = fields.map(k => Number.isFinite(Number(p[k])) ? Math.max(0, Math.floor(Number(p[k]))) : null);
    await query(
      `UPDATE users SET cash=COALESCE(?,cash), ore=COALESCE(?,ore), zone=COALESCE(?,zone),
       bulldozer_level=COALESCE(?,bulldozer_level), tool_level=COALESCE(?,tool_level),
       workers=COALESCE(?,workers), score=COALESCE(?,score) WHERE id=?`,
      [...values, req.user.id]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Save failed" }); }
});

app.post("/api/match-result", auth, async (req, res) => {
  try {
    const score = Math.max(0, Math.floor(Number(req.body?.score) || 0));
    const win = req.body?.win ? 1 : 0;
    await query("UPDATE users SET score=score+?, wins=wins+? WHERE id=?", [score, win, req.user.id]);
    const user = await getUser(req.user.id);
    res.json({ ok: true, score: user.score });
  } catch { res.status(500).json({ error: "Match result failed" }); }
});

const rooms = new Map();
const makeRocks = () => Array.from({length:90}, (_,i) => ({
  id:i, x:40+(i%10)*100+Math.random()*25, y:55+Math.floor(i/10)*62+Math.random()*20,
  type:Math.random()<.1?"gold":Math.random()<.25?"iron":"stone", hp:30
}));
const safePlayer = s => ({ id: s.id, userId: s.userId, name: s.name, x: s.x, y: s.y, ore: s.ore, score: s.score });
async function addPlayer(socket, room) {
  const user = await getUser(socket.userId);
  if (!user) throw new Error("User not found");
  room.players.set(socket.id, { id: socket.id, userId: user.id, name: user.name, x: 500, y: 300, ore: 0, score: 0 });
}
const roomPlayers = room => [...room.players.values()].map(safePlayer);
const roomState = room => ({ players: roomPlayers(room), rocks: room.rocks.map(r => ({id:r.id,x:r.x,y:r.y,type:r.type,hp:r.hp})) });
const roomFor = socket => [...rooms.values()].find(r => r.players.has(socket.id));

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || "";
    const p = jwt.verify(token, JWT_SECRET);
    socket.userId = p.id;
    next();
  } catch { next(new Error("Unauthorized")); }
});

io.on("connection", socket => {
  socket.on("room:create", async cb => {
    try {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      const room = { players: new Map(), rocks: makeRocks(), started: false };
      rooms.set(code, room);
      await addPlayer(socket, room);
      socket.join(code);
      cb?.({ code });
      io.to(code).emit("room:players", roomPlayers(room));
      io.to(code).emit("room:state", roomState(room));
    } catch { cb?.({ error: "Could not create room" }); }
  });

  socket.on("room:join", async (rawCode, cb) => {
    try {
      const code = String(rawCode || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return cb?.({ error: "Room not found" });
      if (room.players.size >= 10) return cb?.({ error: "Room full" });
      await addPlayer(socket, room);
      socket.join(code);
      cb?.({ code });
      io.to(code).emit("room:players", roomPlayers(room)); io.to(code).emit("room:state", roomState(room));
    } catch { cb?.({ error: "Could not join room" }); }
  });

  socket.on("room:quick", async cb => {
    try {
      let code = [...rooms.keys()].find(k => rooms.get(k).players.size < 10 && !rooms.get(k).started);
      if (!code) {
        code = Math.random().toString(36).slice(2, 7).toUpperCase();
        rooms.set(code, { players: new Map(), rocks: makeRocks(), started: false });
      }
      const room = rooms.get(code);
      await addPlayer(socket, room);
      socket.join(code);
      cb?.({ code });
      io.to(code).emit("room:players", roomPlayers(room)); io.to(code).emit("room:state", roomState(room));
    } catch { cb?.({ error: "Quick join failed" }); }
  });

  socket.on("player:move", p => {
    const room = roomFor(socket);
    if (!room) return;
    const player = room.players.get(socket.id);
    player.x = Math.max(20, Math.min(980, Number(p?.x) || 500));
    player.y = Math.max(20, Math.min(580, Number(p?.y) || 300));
    const code = [...socket.rooms].find(x => x !== socket.id);
    if (code) io.to(code).emit("room:players", roomPlayers(room)); io.to(code).emit("room:state", roomState(room));
  });

  socket.on("player:mine", () => {
    const room = roomFor(socket);
    if (!room) return;
    const player = room.players.get(socket.id);
    let hit = null, best = 999;
    for (const r of room.rocks) {
      if (r.hp <= 0) continue;
      const dist = Math.hypot(r.x-player.x, r.y-player.y);
      if (dist < 55 && dist < best) { hit = r; best = dist; }
    }
    if (!hit) return socket.emit("mine:result", {error:"Drive closer to an ore block"});
    hit.hp = Math.max(0, hit.hp - 17);
    const gain = hit.type==="gold" ? 35 : hit.type==="iron" ? 12 : 4;
    if (hit.hp === 0) {
      player.ore += gain;
      player.score += gain * 2;
      socket.emit("mine:result", {gain, type:hit.type, ore:player.ore, score:player.score, destroyed:true});
    } else {
      socket.emit("mine:result", {gain:0, type:hit.type, hp:hit.hp, ore:player.ore, score:player.score, destroyed:false});
    }
    const code = [...socket.rooms].find(x => x !== socket.id);
    if (code) io.to(code).emit("room:state", roomState(room));
  });

  socket.on("game:start", rawCode => {
    const code = String(rawCode || "").toUpperCase();
    const room = rooms.get(code);
    if (room) { room.started = true; io.to(code).emit("game:start"); }
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      if (room.players.delete(socket.id)) {
        io.to(code).emit("room:players", roomPlayers(room)); io.to(code).emit("room:state", roomState(room));
        if (!room.players.size) rooms.delete(code);
      }
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`ToollooT backend listening on http://0.0.0.0:${PORT}`);
});
