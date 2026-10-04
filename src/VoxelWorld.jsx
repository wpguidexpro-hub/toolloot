import{useEffect,useRef,useState}from"react";
import*as THREE from"three";

const W=32,D=32,H=12,S=1;
const TYPES={grass:0,dirt:1,stone:2,coal:3,iron:4,gold:5,sand:6,wood:7,leaf:8};
const COLORS=[0x65a845,0x8a5a36,0x777777,0x292929,0x9aa0a6,0xd5a62a,0xd6c27a,0x8b5a2b,0x4f8f42];
const NAMES=["Grass","Dirt","Stone","Coal","Iron","Gold","Sand","Wood","Leaf"];
const terrain=(x,z)=>Math.max(3,Math.min(8,Math.floor(5+Math.sin(x*.38)*1.4+Math.cos(z*.31)*1.2+Math.sin((x+z)*.17)*.9)));
const hash=(x,z)=>{let n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
function makeWorld(){
 const blocks=new Map(),k=(x,y,z)=>x+","+y+","+z,set=(x,y,z,t)=>blocks.set(k(x,y,z),t);
 for(let x=0;x<W;x++)for(let z=0;z<D;z++){const h=terrain(x,z);for(let y=0;y<=h;y++){let t=y===h?TYPES.grass:y>h-3?TYPES.dirt:TYPES.stone;if(y<2&&hash(x,z)<.12)t=TYPES.sand; if(y>1&&y<h-1){const r=hash(x*7+y,z*11+y);if(r<.025)t=TYPES.gold;else if(r<.07)t=TYPES.iron;else if(r<.14)t=TYPES.coal}set(x,y,z,t)}
 if(h>=5&&hash(x,z)>.82&&x>2&&x<W-3&&z>2&&z<D-3){for(let y=h+1;y<h+4;y++)set(x,y,z,TYPES.wood);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=3;dy<=4;dy++)if(Math.abs(dx)+Math.abs(dz)+dy<8)set(x+dx,h+dy,z+dz,TYPES.leaf)}
 }
 return blocks;
}
function VoxelWorld({socket,players,onStatus,onCollect}){
 const host=useRef(null),world=useRef(makeWorld()),camera=useRef(null),scene=useRef(null),renderer=useRef(null),keys=useRef({}),yaw=useRef(0),pitch=useRef(-.15),locked=useRef(false),selected=useRef(0),target=useRef(null),blockGroup=useRef(null),playerGroup=useRef(null),selectBox=useRef(null);
 const [sel,setSel]=useState(0);
 const [hint,setHint]=useState("CLICK WORLD TO LOOK • WASD MOVE • SPACE JUMP • LMB MINE • RMB PLACE");
 useEffect(()=>{selected.current=sel},[sel]);
 useEffect(()=>{
  const el=host.current;if(!el)return;const canvas=document.createElement("canvas");canvas.style.width="100%";canvas.style.height="100%";canvas.style.display="block";el.replaceChildren(canvas);
  const sc=new THREE.Scene();sc.background=new THREE.Color(0x88b8dc);sc.fog=new THREE.Fog(0x88b8dc,18,58);scene.current=sc;
  const cam=new THREE.PerspectiveCamera(72,1,.05,100);cam.position.set(W/2,terrain(W/2|0,D/2|0)+2.2,D/2+7);camera.current=cam;
  const ren=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"high-performance",failIfMajorPerformanceCaveat:false});ren.setPixelRatio(Math.min(devicePixelRatio||1,1.25));ren.outputColorSpace=THREE.SRGBColorSpace;ren.shadowMap.enabled=false;renderer.current=ren;
  sc.add(new THREE.HemisphereLight(0xddeeff,0x506040,1.7));const sun=new THREE.DirectionalLight(0xffffff,1.4);sun.position.set(20,30,10);sc.add(sun);
  const geo=new THREE.BoxGeometry(1,1,1),mats=COLORS.map(c=>new THREE.MeshLambertMaterial({color:c}));
  const rebuild=()=>{if(blockGroup.current){sc.remove(blockGroup.current)}
   const counts=Array(9).fill(0);for(const t of world.current.values())counts[t]++;const g=new THREE.Group();
   for(let t=0;t<9;t++){if(!counts[t])continue;const im=new THREE.InstancedMesh(geo,mats[t],counts[t]);im.userData.type=t;let i=0;const mat=new THREE.Matrix4();for(const [key,v] of world.current){if(v!==t)continue;const [x,y,z]=key.split(",").map(Number);mat.makeTranslation(x-W/2+.5,y+.5,z-D/2+.5);im.setMatrixAt(i++,mat)}im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();g.add(im)}blockGroup.current=g;sc.add(g)};
  rebuild();
  const pg=new THREE.Group();playerGroup.current=pg;sc.add(pg);
  const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03,1.03,1.03)),new THREE.LineBasicMaterial({color:0xffffff}));outline.visible=false;sc.add(outline);selectBox.current=outline;
  const ray=new THREE.Raycaster(),center=new THREE.Vector2(0,0),vel=new THREE.Vector3(),pos=cam.position.clone();let lastTime=performance.now();
  const getHit=()=>{ray.setFromCamera(center,cam);const hits=ray.intersectObjects(blockGroup.current?.children||[],false);return hits[0]||null};
  const updatePlayers=()=>{pg.clear();(players||[]).filter(p=>p.id!==socket?.id).forEach(p=>{const g=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1,.7),new THREE.MeshLambertMaterial({color:0x3c8cff}));const head=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.62),new THREE.MeshLambertMaterial({color:0xd49b78}));head.position.y=.8;g.add(body,head);g.position.set((p.x||500)/1000*W-W/2,.8,(p.y||300)/600*D-D/2);pg.add(g)})};updatePlayers();
  const down=e=>{keys.current[e.key.toLowerCase()]=true;if(e.code==="Space"&&Math.abs(vel.y)<.05)vel.y=6};const up=e=>{keys.current[e.key.toLowerCase()]=false};
  const click=()=>{if(document.pointerLockElement!==ren.domElement)ren.domElement.requestPointerLock?.();else{const h=getHit();if(h&&h.instanceId!==undefined){const type=h.object.userData.type;const p=h.point.clone();const n=h.face?.normal?.clone()||new THREE.Vector3(0,1,0);const wp=new THREE.Vector3().copy(h.point).sub(n.multiplyScalar(.01));const x=Math.floor(wp.x+W/2),y=Math.floor(wp.y),z=Math.floor(wp.z+D/2);if(echoMine(x,y,z,type))onStatus?.("MINED "+NAMES[type]);}}};
  const echoMine=(x,y,z,type)=>{const key=x+","+y+","+z;if(!world.current.has(key))return false;world.current.delete(key);rebuild();onCollect?.(type);socket?.emit("voxel:break",{x,y,z,type});return true};
  const context=e=>{e.preventDefault();if(document.pointerLockElement!==ren.domElement)ren.domElement.requestPointerLock?.();else{const h=getHit();if(!h)return;const n=h.face?.normal?.clone()||new THREE.Vector3(0,1,0),p=h.point.clone().add(n.multiplyScalar(.01));const x=Math.floor(p.x+W/2),y=Math.floor(p.y),z=Math.floor(p.z+D/2),key=x+","+y+","+z;if(x>=0&&x<W&&z>=0&&z<D&&y>=0&&y<H&&!world.current.has(key)){world.current.set(key,selected.current);rebuild();onStatus?.("PLACED "+NAMES[selected.current]);socket?.emit("voxel:place",{x,y,z,type:selected.current})}}};
  const move=e=>{if(!locked.current)return;yaw.current-=e.movementX*.0025;pitch.current-=e.movementY*.0025;pitch.current=Math.max(-1.45,Math.min(1.45,pitch.current))};
  const lock=()=>{locked.current=document.pointerLockElement===ren.domElement;setHint(locked.current?"WASD MOVE • SPACE JUMP • LMB MINE • RMB PLACE • ESC RELEASE":"CLICK WORLD TO LOOK • WASD MOVE • SPACE JUMP • LMB MINE • RMB PLACE")};
  addEventListener("keydown",down);addEventListener("keyup",up);document.addEventListener("pointerlockchange",lock);document.addEventListener("mousemove",move);ren.domElement.addEventListener("click",click);ren.domElement.addEventListener("contextmenu",context);
  let raf;const tick=()=>{const now=performance.now();const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;const dir=new THREE.Vector3((keys.current.d?1:0)-(keys.current.a?1:0),0,(keys.current.s?1:0)-(keys.current.w?1:0));if(dir.lengthSq()){dir.normalize();const sy=Math.sin(yaw.current),cy=Math.cos(yaw.current);const mx=dir.x*cy-dir.z*sy,mz=dir.x*sy+dir.z*cy;pos.x+=mx*5*dt;pos.z+=mz*5*dt}vel.y-=15*dt;pos.y+=vel.y*dt;const gx=Math.floor(pos.x+W/2),gz=Math.floor(pos.z+D/2);let floor=terrain(Math.max(0,Math.min(W-1,gx)),Math.max(0,Math.min(D-1,gz)))+1.75;if(pos.y<floor){pos.y=floor;vel.y=0}pos.x=Math.max(-W/2+.5,Math.min(W/2-.5,pos.x));pos.z=Math.max(-D/2+.5,Math.min(D/2-.5,pos.z));cam.position.copy(pos);cam.rotation.order="YXZ";cam.rotation.y=yaw.current;cam.rotation.x=pitch.current;
   const h=getHit();if(h){const n=h.face?.normal?.clone()||new THREE.Vector3(0,1,0);const p=h.point.clone().sub(n.multiplyScalar(.01));selectBox.current.position.set(Math.floor(p.x)+.5,Math.floor(p.y)+.5,Math.floor(p.z)+.5);selectBox.current.visible=h.distance<7}else selectBox.current.visible=false;
   ren.render(sc,cam);raf=requestAnimationFrame(tick)};tick();
  const resize=()=>{const w=el.clientWidth||800,h=el.clientHeight||500;cam.aspect=w/h;cam.updateProjectionMatrix();ren.setSize(w,h,false)};addEventListener("resize",resize);resize();
  return()=>{cancelAnimationFrame(raf);removeEventListener("keydown",down);removeEventListener("keyup",up);document.removeEventListener("pointerlockchange",lock);document.removeEventListener("mousemove",move);ren.domElement.removeEventListener("click",click);ren.domElement.removeEventListener("contextmenu",context);removeEventListener("resize",resize);ren.dispose();el.innerHTML=""};
 },[]);
 useEffect(()=>{if(!playerGroup.current)return;playerGroup.current.clear();(players||[]).filter(p=>p.id!==socket?.id).forEach(p=>{const g=new THREE.Group(),b=new THREE.Mesh(new THREE.BoxGeometry(.7,1,.7),new THREE.MeshLambertMaterial({color:0x3c8cff})),h=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.62),new THREE.MeshLambertMaterial({color:0xd49b78}));h.position.y=.8;g.add(b,h);g.position.set((p.x||500)/1000*W-W/2,.8,(p.y||300)/600*D-D/2);playerGroup.current.add(g)})},[players,socket]);
 const blocks=[0,1,2,3,4,5,6,7,8];
 return <div className="voxelWrap"><div ref={host} className="voxelCanvas"/><div className="crosshair">+</div><div className="voxelHint">{hint}</div><div className="hotbar">{blocks.map(i=><button key={i} className={sel===i?"selected":""} onClick={()=>setSel(i)}><span style={{background:"#"+COLORS[i].toString(16).padStart(6,"0")}}/>{i+1}<small>{NAMES[i]}</small></button>)}</div></div>
}
export default VoxelWorld;
