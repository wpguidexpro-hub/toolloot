import * as THREE from 'three';

const scene=new THREE.Scene();scene.background=new THREE.Color(0x061018);scene.fog=new THREE.Fog(0x061018,15,30);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,100);camera.position.set(0,10.7,8.5);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe9ff,0x152018,2.1));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(3,9,4);sun.castShadow=true;scene.add(sun);

const wood=new THREE.MeshStandardMaterial({color:0x633016,roughness:.4}),felt=new THREE.MeshStandardMaterial({color:0x075c3b,roughness:.8}),dark=new THREE.MeshStandardMaterial({color:0x04140f});
const table=new THREE.Group();scene.add(table);
function box(x,y,z,sx,sy,sz,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;table.add(m);return m}
box(0,-.48,0,11,.65,6,wood);box(0,-.13,0,10.15,.2,5.15,felt);
box(-5.15,.12,0,.4,.42,5.6,wood);box(5.15,.12,0,.4,.42,5.6,wood);box(0,.12,-2.65,10.5,.42,.4,wood);box(0,.12,2.65,10.5,.42,.4,wood);
for(const [x,z] of [[-5,-2.5],[0,-2.5],[5,-2.5],[-5,2.5],[0,2.5],[5,2.5],[-5,0],[5,0]]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.08,24),dark);p.rotation.x=Math.PI/2;p.position.set(x,.02,z);table.add(p)}

const palette=[0xffd21c,0x2675d8,0xe53935,0x9147b8,0xff8c00,0x159447,0x6b55bd,0x111111];
const geo=new THREE.SphereGeometry(.16,20,14),balls=[];
function makeBall(x,z,color,num){const b=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.22}));b.position.set(x,.08,z);b.castShadow=true;b.userData={v:new THREE.Vector2(),num,active:true};scene.add(b);balls.push(b)}
function rack(){for(const b of balls)scene.remove(b);balls.length=0;makeBall(2.85,0,0xffffff,0);let n=1;for(let row=0;row<5;row++)for(let j=0;j<=row;j++){makeBall(-2.05+row*.285,(j-row/2)*.34,palette[(n-1)%8],n++);}}
rack();

const cue=new THREE.Group();const cueMesh=new THREE.Mesh(new THREE.CylinderGeometry(.035,.06,5.1,12),new THREE.MeshStandardMaterial({color:0xc69a61,roughness:.35}));cueMesh.rotation.z=Math.PI/2;cue.add(cueMesh);scene.add(cue);
let aim=new THREE.Vector2(-1,0),charging=false,power=0,score=0;
function placeCue(){const b=balls[0];if(!b?.userData.active)return;cue.position.set(b.position.x,.16,b.position.z);cue.rotation.y=Math.atan2(aim.x,aim.y)}
function aimAt(e){const r=renderer.domElement.getBoundingClientRect(),mx=(e.clientX-r.left)/r.width*2-1,my=-((e.clientY-r.top)/r.height*2+0);const v=new THREE.Vector3(mx,my,.5).unproject(camera),d=v.sub(camera.position).normalize(),t=-camera.position.y/d.y,p=camera.position.clone().add(d.multiplyScalar(t)),b=balls[0];if(b){const dx=p.x-b.position.x,dz=p.z-b.position.z;if(dx*dx+dz*dz>.01)aim.set(dx,dz).normalize();placeCue()}}
renderer.domElement.onpointerdown=e=>{charging=true;power=0;aimAt(e);renderer.domElement.setPointerCapture(e.pointerId)};
renderer.domElement.onpointermove=e=>{if(charging)aimAt(e)};
renderer.domElement.onpointerup=()=>{if(charging){charging=false;shoot(.35+power*.75);power=0}};
function shoot(p){const b=balls[0];if(!b?.userData.active)return;b.userData.v.set(aim.x*p*.09,aim.y*p*.09);cue.visible=false}
function physics(dt){let moving=false;for(const b of balls){if(!b.userData.active)continue;const v=b.userData.v;b.position.x+=v.x*dt*60;b.position.z+=v.y*dt*60;v.multiplyScalar(Math.pow(.985,dt*60));if(v.lengthSq()>.00002)moving=true;if(Math.abs(b.position.x)>4.87){b.position.x=Math.sign(b.position.x)*4.87;v.x*=-.82}if(Math.abs(b.position.z)>2.37){b.position.z=Math.sign(b.position.z)*2.37;v.y*=-.82}}
for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){const a=balls[i],b=balls[j];if(!a.userData.active||!b.userData.active)continue;const dx=b.position.x-a.position.x,dz=b.position.z-a.position.z,d2=dx*dx+dz*dz;if(d2<.102&&d2>.00001){const d=Math.sqrt(d2),nx=dx/d,nz=dz/d,rv=(b.userData.v.x-a.userData.v.x)*nx+(b.userData.v.y-a.userData.v.y)*nz;if(rv<0){a.userData.v.x+=rv*nx;a.userData.v.y+=rv*nz;b.userData.v.x-=rv*nx;b.userData.v.y-=rv*nz}const q=(.32-d)/2;a.position.x-=nx*q;a.position.z-=nz*q;b.position.x+=nx*q;b.position.z+=nz*q}}
if(!moving){const b=balls[0];if(b?.userData.active){cue.visible=true;placeCue()}}}
let last=performance.now();function loop(t){requestAnimationFrame(loop);const dt=Math.min(.033,(t-last)/1000);last=t;if(charging)power=Math.min(1,power+dt*.7);document.querySelector('#power span').style.width=power*100+'%';physics(dt);renderer.render(scene,camera)}requestAnimationFrame(loop);
document.querySelector('#new').onclick=()=>{score=0;document.querySelector('#score').textContent=0;rack();cue.visible=true;placeCue()};document.querySelector('#again').onclick=()=>{document.querySelector('#gameover').style.display='none';rack();cue.visible=true;placeCue()};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});