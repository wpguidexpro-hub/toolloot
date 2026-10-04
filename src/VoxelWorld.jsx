import{useEffect,useRef,useState}from"react";
import*as THREE from"three";
import{PointerLockControls}from"three/addons/controls/PointerLockControls.js";

const W=48,D=48,H=20;
const TYPES={grass:0,dirt:1,stone:2,coal:3,iron:4,gold:5,sand:6,wood:7,leaf:8};
const COLORS=[0x67a846,0x8b5a36,0x777777,0x252525,0xaeb5bd,0xd7a52b,0xd9c78a,0x87552d,0x4b8c43];
const NAMES=["Grass","Dirt","Stone","Coal","Iron","Gold","Sand","Wood","Leaf"];
const HOT=[0,1,2,3,4,5,6,7,8];
const key=(x,y,z)=>x+","+y+","+z;
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
const terrain=(x,z)=>Math.max(3,Math.min(10,Math.floor(6+Math.sin(x*.25)*1.7+Math.cos(z*.22)*1.5+Math.sin((x+z)*.11)*1.1)));
function makeWorld(){
 const b=new Map(),set=(x,y,z,t)=>{if(x>=0&&x<W&&z>=0&&z<D&&y>=0&&y<H)b.set(key(x,y,z),t)};
 for(let x=0;x<W;x++)for(let z=0;z<D;z++){
  const h=terrain(x,z);
  for(let y=0;y<=h;y++){let t=y===h?0:y>h-3?1:2;if(y<2&&hash(x,z)<.13)t=6;
   if(y>1&&y<h-1){const r=hash(x*17+y*3,z*13+y*5);if(r<.018)t=5;else if(r<.055)t=4;else if(r<.12)t=3}
   set(x,y,z,t)
  }
  if(h>=6&&hash(x+91,z+37)>.86&&x>3&&x<W-4&&z>3&&z<D-4){
   for(let y=1;y<=4;y++)set(x,h+y,z,7);
   for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=3;dy<=5;dy++)
    if(Math.abs(dx)+Math.abs(dz)+(dy===5?1:0)<4)set(x+dx,h+dy,z+dz,8);
  }
 }
 return b;
}
function makeCharacter(local=false){
 const g=new THREE.Group();g.userData.local=local;
 const skin=new THREE.MeshLambertMaterial({color:0xd39a76}),shirt=new THREE.MeshLambertMaterial({color:local?0x3b82f6:0x6d42c7}),pants=new THREE.MeshLambertMaterial({color:0x303b58});
 const body=new THREE.Mesh(new THREE.BoxGeometry(.72,1,.42),shirt);body.position.y=1.45;
 const head=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.62),skin);head.position.y=2.28;
 const leg1=new THREE.Mesh(new THREE.BoxGeometry(.3,.78,.36),pants),leg2=leg1.clone();leg1.position.set(-.19,.62,0);leg2.position.set(.19,.62,0);
 const arm1=new THREE.Mesh(new THREE.BoxGeometry(.25,.85,.32),skin),arm2=arm1.clone();arm1.position.set(-.52,1.48,0);arm2.position.set(.52,1.48,0);
 g.add(body,head,leg1,leg2,arm1,arm2);g.userData.parts={body,head,leg1,leg2,arm1,arm2};return g;
}
function VoxelWorld({socket,players,onStatus,onCollect}){
 const host=useRef(null),world=useRef(makeWorld()),cam=useRef(null),scene=useRef(null),renderer=useRef(null),keys=useRef({}),player=useRef(new THREE.Vector3(0,0,0)),velocity=useRef(new THREE.Vector3()),yaw=useRef(0),pitch=useRef(-.12),mode=useRef(0),target=useRef(null),group=useRef(null),localModel=useRef(null),controls=useRef(null),blockGroup=useRef(null),selectBox=useRef(null),lastSync=useRef(0);
 const [sel,setSel]=useState(0),[view,setView]=useState(0),[inventory,setInventory]=useState(false),[hint,setHint]=useState("CLICK TO PLAY • WASD • SPACE • F5 CAMERA");
 useEffect(()=>{mode.current=view},[view]);
 useEffect(()=>{selectedHot(sel)},[sel]);
 function selectedHot(i){/* state is read directly from closure in the scene setup */}
 useEffect(()=>{
  const el=host.current;if(!el)return;
  const canvas=document.createElement("canvas");canvas.style.cssText="width:100%;height:100%;display:block";el.replaceChildren(canvas);
  const sc=new THREE.Scene();sc.background=new THREE.Color(0x87b8df);sc.fog=new THREE.Fog(0x87b8df,22,72);scene.current=sc;
  const c=new THREE.PerspectiveCamera(70,1,.05,120);cam.current=c;
  const ren=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"high-performance",failIfMajorPerformanceCaveat:false});
  ren.setPixelRatio(Math.min(devicePixelRatio||1,1.25));ren.outputColorSpace=THREE.SRGBColorSpace;renderer.current=ren;
  sc.add(new THREE.HemisphereLight(0xddeeff,0x40552f,1.65));
  const sun=new THREE.DirectionalLight(0xffffff,1.25);sun.position.set(25,35,15);sc.add(sun);
  const cube=new THREE.BoxGeometry(1,1,1),mats=COLORS.map(x=>new THREE.MeshLambertMaterial({color:x}));
  const rebuild=()=>{if(blockGroup.current)sc.remove(blockGroup.current);const counts=Array(9).fill(0);for(const t of world.current.values())counts[t]++;const root=new THREE.Group(),mx=new THREE.Matrix4();
   for(let t=0;t<9;t++){if(!counts[t])continue;const im=new THREE.InstancedMesh(cube,mats[t],counts[t]);im.userData.type=t;let i=0;for(const [k,v]of world.current){if(v!==t)continue;const [x,y,z]=k.split(",").map(Number);mx.makeTranslation(x-W/2+.5,y+.5,z-D/2+.5);im.setMatrixAt(i++,mx)}im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();root.add(im)}
   blockGroup.current=root;sc.add(root)};
  rebuild();
  const pg=new THREE.Group();group.current=pg;sc.add(pg);
  const avatar=makeCharacter(true);avatar.visible=false;localModel.current=avatar;pg.add(avatar);
  const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04,1.04,1.04)),new THREE.LineBasicMaterial({color:0xffffff}));outline.visible=false;sc.add(outline);selectBox.current=outline;
  const plc=new PointerLockControls(c,canvas);plc.pointerSpeed=.8;plc.minPolarAngle=.18;plc.maxPolarAngle=Math.PI-.18;controls.current=plc;
  plc.addEventListener("lock",()=>setHint("WASD MOVE • SPACE JUMP • LMB BREAK • RMB PLACE • F5 VIEW"));
  plc.addEventListener("unlock",()=>setHint("CLICK TO PLAY • WASD • SPACE • F5 CAMERA"));
  const ray=new THREE.Raycaster(),center=new THREE.Vector2(0,0),up=new THREE.Vector3(0,1,0);
  const floorAt=(x,z)=>terrain(Math.max(0,Math.min(W-1,Math.floor(x+W/2))),Math.max(0,Math.min(D-1,Math.floor(z+D/2))))+1.8;
  player.current.set(0,floorAt(0,0),0);
  const solid=(x,y,z)=>world.current.has(key(Math.floor(x+W/2),Math.floor(y),Math.floor(z+D/2)));
  const canStand=(x,z)=>{const fx=Math.floor(x+W/2),fz=Math.floor(z+D/2);return fx>=0&&fx<W&&fz>=0&&fz<D};
  const setMode=(m)=>{mode.current=m;setView(m);if(m!==0)plc.unlock();avatar.visible=m!==0;setHint(m===0?"CLICK TO PLAY • WASD • SPACE • F5 CAMERA":m===1?"TPP REAR • WASD • F5 CAMERA":"TPP FRONT • WASD • F5 CAMERA")};
  const cycle=()=>setMode((mode.current+1)%3);
  const updateAvatar=()=>{avatar.position.copy(player.current);avatar.rotation.y=yaw.current;avatar.visible=mode.current!==0};
  const getHit=()=>{ray.setFromCamera(center,c);const hits=ray.intersectObjects(blockGroup.current?.children||[],false);return hits[0]&&hits[0].distance<=6?hits[0]:null};
  const editBlock=(placing)=>{
   const h=getHit();if(!h)return;
   const n=h.face?.normal?.clone()||up.clone();const p=h.point.clone().add((placing?1:-1)*.01*n);
   const x=Math.floor(p.x+W/2),y=Math.floor(p.y),z=Math.floor(p.z+D/2);if(x<0||x>=W||z<0||z>=D||y<0||y>=H)return;
   const k=key(x,y,z);
   if(placing){if(world.current.has(k))return;world.current.set(k,sel);onStatus?.("PLACED "+NAMES[sel]);socket?.emit("voxel:place",{x,y,z,type:sel})}
   else{if(!world.current.has(k)||y===0)return;const t=world.current.get(k);world.current.delete(k);onCollect?.(t);onStatus?.("MINED "+NAMES[t]);socket?.emit("voxel:break",{x,y,z,type:t})}
   rebuild();
  };
  const down=e=>{keys.current[e.code]=true;const n=Number(e.key);if(n>=1&&n<=9)setSel(n-1);if(e.code==="KeyF"&&e.shiftKey)cycle();if(e.code==="F5"){e.preventDefault();cycle()}if(e.code==="KeyE"){setInventory(v=>!v);if(mode.current===0)plc.unlock()}if(e.code==="Space"&&!e.repeat&&Math.abs(velocity.current.y)<.08)velocity.current.y=7};
  const upKey=e=>{keys.current[e.code]=false};
  const mouseDown=e=>{if(e.button===0&&mode.current!==0&&plc.isLocked===false){canvas.requestPointerLock?.();return}if(e.button===0&&plc.isLocked)editBlock(false);if(e.button===2){e.preventDefault();if(mode.current!==0){canvas.requestPointerLock?.();return}editBlock(true)}};
  const click=()=>{if(mode.current===0&&!plc.isLocked&&!inventory){plc.lock()}};
  const move=e=>{if(mode.current===0)return;if(document.pointerLockElement!==canvas){return}yaw.current-=e.movementX*.0025;pitch.current-=e.movementY*.0025;pitch.current=Math.max(-1.25,Math.min(1.25,pitch.current))};
  addEventListener("keydown",down);addEventListener("keyup",upKey);canvas.addEventListener("mousedown",mouseDown);canvas.addEventListener("click",click);canvas.addEventListener("contextmenu",e=>e.preventDefault());addEventListener("mousemove",move);
  let raf,last=performance.now();
  const tick=()=>{
   const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
   if(!inventory){
    const k=keys.current,forward=(k.KeyW?1:0)-(k.KeyS?1:0),strafe=(k.KeyD?1:0)-(k.KeyA?1:0);let dx=0,dz=0;
    if(forward||strafe){const l=Math.hypot(forward,strafe);const f=forward/l,s=strafe/l;dx=(Math.sin(yaw.current)*f+Math.cos(yaw.current)*s)*4.7*dt;dz=(Math.cos(yaw.current)*f-Math.sin(yaw.current)*s)*4.7*dt}
    const nx=player.current.x+dx,nz=player.current.z+dz;if(canStand(nx,nz)&&!solid(nx,.9,nz)){player.current.x=nx;player.current.z=nz}
    velocity.current.y-=18*dt;player.current.y+=velocity.current.y*dt;const floor=floorAt(player.current.x,player.current.z);
    if(player.current.y<floor){player.current.y=floor;velocity.current.y=0}
    const min=-W/2+.55,max=W/2-.55;player.current.x=Math.max(min,Math.min(max,player.current.x));player.current.z=Math.max(min,Math.min(max,player.current.z));
    updateAvatar();
    if(mode.current===0){c.position.copy(player.current);c.position.y+=0.02;c.rotation.order="YXZ";c.rotation.y=yaw.current;c.rotation.x=pitch.current}
    else{const front=mode.current===2?1:-1,dist=5.8,targetPos=player.current.clone();targetPos.y+=1.35;const desired=new THREE.Vector3(Math.sin(yaw.current)*dist*front,1.8,Math.cos(yaw.current)*dist*front);desired.add(player.current);const blockRay=new THREE.Raycaster(targetPos,desired.clone().sub(targetPos).normalize(),0,dist);const hits=blockRay.intersectObjects(blockGroup.current?.children||[],false);if(hits[0])desired.copy(hits[0].point).add(targetPos.clone().sub(desired).normalize().multiplyScalar(.25));c.position.lerp(desired,.18);c.lookAt(targetPos)}
    const h=getHit();if(h){const n=h.face?.normal?.clone()||up.clone();const p=h.point.clone().sub(n.multiplyScalar(.01));selectBox.current.position.set(Math.floor(p.x)+.5,Math.floor(p.y)+.5,Math.floor(p.z)+.5);selectBox.current.visible=true}else selectBox.current.visible=false;
    if(now-lastSync.current>80){socket?.emit("player:move",{x:Math.round((player.current.x+W/2)/W*1000),y:Math.round((player.current.z+D/2)/D*600),yaw:yaw.current,view:mode.current});lastSync.current=now}
   }
   ren.render(sc,c);raf=requestAnimationFrame(tick)
  };tick();
  const resize=()=>{const w=el.clientWidth||800,h=el.clientHeight||500;c.aspect=w/h;c.updateProjectionMatrix();ren.setSize(w,h,false)};addEventListener("resize",resize);resize();
  return()=>{cancelAnimationFrame(raf);plc.dispose();removeEventListener("keydown",down);removeEventListener("keyup",upKey);removeEventListener("mousemove",move);canvas.removeEventListener("mousedown",mouseDown);canvas.removeEventListener("click",click);removeEventListener("resize",resize);ren.dispose();el.innerHTML=""};
 },[socket,onStatus,onCollect]);
 useEffect(()=>{if(!group.current)return;group.current.children.filter(x=>x!==localModel.current).forEach(x=>group.current.remove(x));(players||[]).filter(p=>p.id!==socket?.id).forEach(p=>{const g=makeCharacter(false);g.position.set((p.x||500)/1000*W-W/2,0,(p.y||300)/600*D-D/2);g.rotation.y=p.yaw||0;group.current.add(g)})},[players,socket]);
 return <div className="voxelWrap"><div ref={host} className="voxelCanvas"/><div className="crosshair">+</div><div className="cameraBadge">{view===0?"FPP":view===1?"TPP • REAR":"TPP • FRONT"} <b>F5</b></div><div className="voxelHint">{hint}</div><div className="hotbar">{HOT.map(i=><button key={i} className={sel===i?"selected":""} onClick={()=>setSel(i)}><span style={{background:"#"+COLORS[i].toString(16).padStart(6,"0")}}/><b>{i+1}</b><small>{NAMES[i]}</small></button>)}</div>{inventory&&<div className="inventoryPanel"><h2>Inventory</h2><p>Blocks collected: mine them and use the hotbar.</p><div className="invGrid">{HOT.map(i=><div key={i}><span style={{background:"#"+COLORS[i].toString(16).padStart(6,"0")}}/>{NAMES[i]}</div>)}</div><button onClick={()=>setInventory(false)}>CLOSE [E]</button></div>}</div>
}
export default VoxelWorld;
