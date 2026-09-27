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

function auth(req,res,next){
  try {
    const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    req.user=jwt.verify(token,JWT_SECRET); next();
  } catch { res.status(401).json({error:"Unauthorized"}); }
}

app.get("/api/health",async(_req,res)=>{
  try { const rows=await pool.query("SELECT 1 AS ok"); res.json({ok:true,database:rows[0].ok===1}); }
  catch { res.status(503).json({ok:false,database:false,error:"Database unavailable"}); }
});

app.post("/api/register",async(req,res)=>{
  const {name,email,password}=req.body||{};
  if(!name||!email||!password||password.length<6) return res.status(400).json({error:"Name, email and password (6+ chars) are required"});
  try {
    const cleanEmail=email.trim().toLowerCase(), cleanName=name.trim();
    const result=await pool.query("INSERT INTO users (name,email,password_hash,status,last_seen) VALUES (?,?,?,?,NOW())",[cleanName,cleanEmail,await bcrypt.hash(password,12),"Available"]);
    const user={id:Number(result.insertId),name:cleanName,email:cleanEmail};
    const token=jwt.sign({userId:user.id,email:user.email},JWT_SECRET,{expiresIn:"7d"});
    res.json({token,user});
  } catch(e) { if(e?.code==="ER_DUP_ENTRY") return res.status(409).json({error:"Email already registered"}); res.status(500).json({error:"Registration failed"}); }
});

app.post("/api/login",async(req,res)=>{
  const {email,password}=req.body||{};
  try {
    const rows=await pool.query("SELECT id,name,email,password_hash FROM users WHERE email=? LIMIT 1",[String(email||"").trim().toLowerCase()]);
    if(!rows.length||!(await bcrypt.compare(password||"",rows[0].password_hash))) return res.status(401).json({error:"Invalid email or password"});
    await pool.query("UPDATE users SET last_seen=NOW() WHERE id=?",[rows[0].id]);
    const user={id:Number(rows[0].id),name:rows[0].name,email:rows[0].email};
    res.json({token:jwt.sign({userId:user.id,email:user.email},JWT_SECRET,{expiresIn:"7d"}),user});
  } catch { res.status(500).json({error:"Login failed"}); }
});

app.get("/api/me",auth,async(req,res)=>{
  const rows=await pool.query("SELECT id,name,email,avatar_url,status,last_seen,created_at FROM users WHERE id=? LIMIT 1",[req.user.userId]);
  if(!rows.length) return res.status(404).json({error:"User not found"});
  res.json({user:rows[0]});
});

app.get("/api/users/search",auth,async(req,res)=>{
  const q=String(req.query.q||"").trim();
  if(q.length<1) return res.json({users:[]});
  const like=`%${q.slice(0,80)}%`;
  const rows=await pool.query("SELECT id,name,email,avatar_url,status,last_seen FROM users WHERE id<>? AND (name LIKE ? OR email LIKE ?) ORDER BY name LIMIT 30",[req.user.userId,like,like]);
  res.json({users:rows.map(u=>({...u,id:Number(u.id)}))});
});

app.post("/api/conversations/direct",auth,async(req,res)=>{
  const targetId=Number(req.body?.userId);
  if(!targetId||targetId===Number(req.user.userId)) return res.status(400).json({error:"Choose another user"});
  const target=await pool.query("SELECT id,name,email,avatar_url,status,last_seen FROM users WHERE id=? LIMIT 1",[targetId]);
  if(!target.length) return res.status(404).json({error:"User not found"});
  const existing=await pool.query(`SELECT c.id FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE c.type='direct' AND cm.user_id IN (?,?)
    GROUP BY c.id HAVING COUNT(DISTINCT cm.user_id)=2
    AND (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2
    LIMIT 1`,[req.user.userId,targetId]);
  let conversationId;
  if(existing.length) conversationId=Number(existing[0].id);
  else {
    const conn=await pool.getConnection();
    try {
      await conn.beginTransaction();
      const r=await conn.query("INSERT INTO conversations (type) VALUES ('direct')");
      conversationId=Number(r.insertId);
      await conn.query("INSERT INTO conversation_members (conversation_id,user_id,role) VALUES (?,?, 'member'),(?,?, 'member')",[conversationId,req.user.userId,conversationId,targetId]);
      await conn.commit();
    } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }
  res.json({conversation:{id:conversationId,type:"direct"},user:{...target[0],id:Number(target[0].id)}});
});

app.get("/api/conversations",auth,async(req,res)=>{
  const rows=await pool.query(`SELECT c.id,c.type,c.name,
    m.id AS member_id,m.name AS member_name,m.email AS member_email,m.avatar_url AS member_avatar,m.status AS member_status,m.last_seen AS member_last_seen,
    lm.text AS last_text,lm.created_at AS last_created
    FROM conversations c
    JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=?
    LEFT JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>?
    LEFT JOIN users m ON m.id=other.user_id
    LEFT JOIN messages lm ON lm.id=(SELECT MAX(x.id) FROM messages x WHERE x.conversation_id=c.id)
    ORDER BY COALESCE(lm.created_at,c.created_at) DESC`,[req.user.userId,req.user.userId]);
  const seen=new Set(), out=[];
  for(const r of rows){
    if(seen.has(String(r.id))) continue; seen.add(String(r.id));
    const isGroup=r.type==="group";
    out.push({id:Number(r.id),group:isGroup,name:isGroup?(r.name||"Group"):(r.member_name||"Unknown user"),initial:(isGroup?"G":(r.member_name||"?")[0]).toUpperCase(),online:r.member_status==="online",last:r.last_text||"No messages yet",time:r.last_created?new Date(r.last_created).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"Now",unread:0,messages:[],userId:r.member_id?Number(r.member_id):null,email:r.member_email||"",avatarUrl:r.member_avatar||null});
  }
  res.json({conversations:out});
});

async function memberOf(conversationId,userId){
  const rows=await pool.query("SELECT 1 AS ok FROM conversation_members WHERE conversation_id=? AND user_id=? LIMIT 1",[conversationId,userId]);
  return rows.length>0;
}

app.get("/api/conversations/:id/messages",auth,async(req,res)=>{
  const id=Number(req.params.id);
  if(!id||!(await memberOf(id,req.user.userId))) return res.status(403).json({error:"Conversation access denied"});
  const rows=await pool.query("SELECT id,conversation_id,sender_id,text,attachment_url,attachment_name,attachment_type,reply_to,created_at,edited_at,deleted_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC,id ASC",[id]);
  res.json({messages:rows.map(m=>({id:Number(m.id),conversationId:Number(m.conversation_id),senderId:Number(m.sender_id),text:m.deleted_at?"This message was deleted":(m.text||""),file:m.attachment_name||null,replyTo:m.reply_to?Number(m.reply_to):null,time:new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),me:Number(m.sender_id)===Number(req.user.userId)}))});
});

io.use((socket,next)=>{
  try { socket.user=jwt.verify(socket.handshake.auth?.token,JWT_SECRET); next(); }
  catch { next(new Error("Unauthorized")); }
});
io.on("connection",socket=>{
  socket.on("conversation:join",async conversationId=>{if(await memberOf(Number(conversationId),socket.user.userId)) socket.join(String(conversationId));});
  socket.on("typing",async data=>{
    const id=Number(data?.conversationId);
    if(id&&await memberOf(id,socket.user.userId)) socket.to(String(id)).emit("typing",{userId:socket.user.userId,isTyping:!!data.isTyping});
  });
  socket.on("message:send",async data=>{
    const conversationId=Number(data?.conversationId), body=String(data?.text||"").trim();
    if(!conversationId||!body||body.length>10000||!(await memberOf(conversationId,socket.user.userId))) return;
    try {
      const result=await pool.query("INSERT INTO messages (conversation_id,sender_id,text) VALUES (?,?,?)",[conversationId,socket.user.userId,body]);
      const message={id:Number(result.insertId),conversationId,senderId:Number(socket.user.userId),text:body,createdAt:new Date().toISOString()};
      io.to(String(conversationId)).emit("message:new",message);
    } catch { socket.emit("message:error",{error:"Message could not be saved"}); }
  });
});
const port=Number(process.env.PORT||5186);
server.listen(port,()=>console.log(`ToollooT chat server listening on :${port}`));
