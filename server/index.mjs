import http from "node:http";
import crypto from "node:crypto";
import mariadb from "mariadb";

const port=Number(process.env.PORT||5186);
const pool=mariadb.createPool({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME||"toolloot",connectionLimit:5});
const json=(res,status,data)=>{res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"content-type,authorization","access-control-allow-methods":"GET,POST,OPTIONS"});res.end(JSON.stringify(data))};
const read=async req=>{let s="";for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const hash=p=>{const salt=crypto.randomBytes(16).toString("hex");return salt+":"+crypto.scryptSync(p,salt,64).toString("hex")};
const verify=(p,h)=>{const [salt,key]=String(h).split(":");if(!salt||!key)return false;return crypto.timingSafeEqual(Buffer.from(key,"hex"),crypto.scryptSync(p,salt,64))};
async function init(){const c=await pool.getConnection();try{
await c.query("CREATE TABLE IF NOT EXISTS users(id CHAR(36) PRIMARY KEY,name VARCHAR(120) NOT NULL,email VARCHAR(190) NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at DATETIME NOT NULL)");
await c.query("CREATE TABLE IF NOT EXISTS sessions(token CHAR(64) PRIMARY KEY,user_id CHAR(36) NOT NULL,created_at DATETIME NOT NULL,index(user_id))");
await c.query("CREATE TABLE IF NOT EXISTS teams(id CHAR(36) PRIMARY KEY,name VARCHAR(160) NOT NULL,owner_id CHAR(36) NOT NULL,created_at DATETIME NOT NULL)");
await c.query("CREATE TABLE IF NOT EXISTS team_members(team_id CHAR(36) NOT NULL,user_id CHAR(36) NOT NULL,role VARCHAR(30) NOT NULL,PRIMARY KEY(team_id,user_id))");
await c.query("CREATE TABLE IF NOT EXISTS analytics_events(id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id CHAR(36) NULL,event_name VARCHAR(100) NOT NULL,path VARCHAR(500),session_id VARCHAR(120),meta JSON,created_at DATETIME NOT NULL,index(event_name),index(created_at))");
}finally{c.release()}}
async function auth(req){const t=req.headers.authorization?.replace(/^Bearer\s+/i,"");if(!t)return null;const rows=await pool.query("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? LIMIT 1",[t]);return rows[0]||null}
async function main(req,res){
if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type,authorization"});return res.end()}
try{
if(req.url==="/api/health")return json(res,200,{ok:true,service:"toolloot-api",free:true});
if(req.url==="/api/auth/register"&&req.method==="POST"){const b=await read(req);if(!b.email||!b.password||!b.name)return json(res,400,{error:"name,email,password required"});const id=crypto.randomUUID();await pool.query("INSERT INTO users VALUES(?,?,?,?,?)",[id,b.name,b.email.toLowerCase(),hash(b.password),new Date()]);const token=crypto.randomBytes(32).toString("hex");await pool.query("INSERT INTO sessions VALUES(?,?,?)",[token,id,new Date()]);return json(res,201,{user:{id,name:b.name,email:b.email.toLowerCase()},token})}
if(req.url==="/api/auth/login"&&req.method==="POST"){const b=await read(req);const rows=await pool.query("SELECT * FROM users WHERE email=? LIMIT 1",[String(b.email||"").toLowerCase()]);if(!rows[0]||!verify(b.password||"",rows[0].password_hash))return json(res,401,{error:"Invalid credentials"});const token=crypto.randomBytes(32).toString("hex");await pool.query("INSERT INTO sessions VALUES(?,?,?)",[token,rows[0].id,new Date()]);return json(res,200,{user:{id:rows[0].id,name:rows[0].name,email:rows[0].email},token})}
if(req.url==="/api/me"&&req.method==="GET"){const u=await auth(req);return u?json(res,200,{user:{id:u.id,name:u.name,email:u.email}}):json(res,401,{error:"Unauthorized"})}
if(req.url==="/api/teams"&&req.method==="POST"){const u=await auth(req);if(!u)return json(res,401,{error:"Unauthorized"});const b=await read(req),id=crypto.randomUUID();await pool.query("INSERT INTO teams VALUES(?,?,?,?)",[id,b.name,u.id,new Date()]);await pool.query("INSERT INTO team_members VALUES(?,?,?)",[id,u.id,"owner"]);return json(res,201,{id,name:b.name,role:"owner"})}
if(req.url==="/api/analytics/event"&&req.method==="POST"){const b=await read(req),u=await auth(req);await pool.query("INSERT INTO analytics_events(user_id,event_name,path,session_id,meta,created_at) VALUES(?,?,?,?,?,?)",[u?.id||null,b.event||"unknown",b.path||"",b.sessionId||"",JSON.stringify(b.data||{}),new Date()]);return json(res,201,{ok:true})}
if(req.url==="/api/analytics/summary"&&req.method==="GET"){const u=await auth(req);if(!u)return json(res,401,{error:"Unauthorized"});const total=(await pool.query("SELECT COUNT(*) n FROM analytics_events"))[0].n;const users=(await pool.query("SELECT COUNT(*) n FROM users"))[0].n;const top=await pool.query("SELECT event_name event_name,COUNT(*) n FROM analytics_events GROUP BY event_name ORDER BY n DESC LIMIT 20");return json(res,200,{events:Number(total),users:Number(users),top})}return json(res,404,{error:"Not found"});
}catch(e){console.error(e);return json(res,500,{error:"Server error",detail:e.message})}}
init().then(()=>http.createServer(main).listen(port,()=>console.log("ToollooT API listening on "+port))).catch(e=>{console.error(e);process.exit(1)});
