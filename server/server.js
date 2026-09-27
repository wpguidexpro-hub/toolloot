import crypto from "node:crypto";
import express from "express";
import http from "node:http";
import cors from "cors";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mariadb from "mariadb";
import "dotenv/config";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(cors());
app.use(express.json());

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "toolloot",
  connectionLimit: 5
});

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const memoryMessages = new Map();

app.get("/api/health", async (_req, res) => {
  try {
    const rows = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, database: rows[0].ok === 1 });
  } catch (e) {
    res.status(503).json({ ok: false, database: false, error: "Database unavailable" });
  }
});

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: "Name, email and password (6+ chars) are required" });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)",
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    const token = jwt.sign({ userId: Number(result.insertId), email: email.trim().toLowerCase() }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: Number(result.insertId), name: name.trim(), email: email.trim().toLowerCase() } });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const rows = await pool.query("SELECT id,name,email,password_hash FROM users WHERE email=? LIMIT 1", [String(email || "").trim().toLowerCase()]);
    if (!rows.length || !(await bcrypt.compare(password || "", rows[0].password_hash)))
      return res.status(401).json({ error: "Invalid email or password" });
    const user = { id: Number(rows[0].id), name: rows[0].name, email: rows[0].email };
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/api/me", auth, async (req, res) => {
  const rows = await pool.query("SELECT id,name,email,avatar_url,status,last_seen,created_at FROM users WHERE id=? LIMIT 1", [req.user.userId]);
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  res.json({ user: rows[0] });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", socket => {
  socket.on("conversation:join", conversationId => socket.join(String(conversationId)));
  socket.on("typing", data => socket.to(String(data.conversationId)).emit("typing", { userId: socket.user.userId, isTyping: !!data.isTyping }));
  socket.on("message:send", async data => {
    if (!data?.conversationId || !data?.text) return;
    try {
      const result = await pool.query(
        "INSERT INTO messages (conversation_id,sender_id,text) VALUES (?,?,?)",
        [data.conversationId, socket.user.userId, String(data.text).slice(0, 10000)]
      );
      const message = { id: Number(result.insertId), conversationId: data.conversationId, senderId: socket.user.userId, text: String(data.text), createdAt: new Date().toISOString() };
      io.to(String(data.conversationId)).emit("message:new", message);
    } catch {
      socket.emit("message:error", { error: "Message could not be saved" });
    }
  });
});

const port = Number(process.env.PORT || 5186);
server.listen(port, () => console.log(`ToollooT chat server listening on :${port}`));
