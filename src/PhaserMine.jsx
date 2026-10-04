import{useEffect,useRef}from"react";
import Phaser from"phaser";

export default function PhaserMine({socket,players,rocks,onPosition,zone=1}){
 const host=useRef(null), own=useRef({x:500,y:300}), playerMap=useRef(new Map()), rockMap=useRef(new Map());
 useEffect(()=>{
  if(!host.current)return;
  class MineScene extends Phaser.Scene{
   constructor(){super("mine")}
   create(){
    this.cameras.main.setBackgroundColor("#182417");
    this.add.grid(500,300,1000,600,50,50,"#182417",1,"#263b22",.75);
    this.rocksG=this.add.group();
    this.playersG=this.add.group();
    this.fx=this.add.graphics();
    this.player=this.add.rectangle(500,300,52,30,0xf0b52f);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.setDepth(5);
    this.label=this.add.text(500,255,"YOU",{fontFamily:"system-ui",fontSize:"11px",color:"#dce9ff",fontStyle:"bold"}).setOrigin(.5).setDepth(6);
    this.cursors=this.input.keyboard.createCursorKeys();
    this.keys=this.input.keyboard.addKeys("W,A,S,D");
    this.input.on("pointerdown",p=>{
      const x=p.worldX,y=p.worldY;
      own.current={x,y};
      this.player.setPosition(x,y);
      socket?.emit("player:move",{x,y});
    });
   }
   update(){
    if(!this.player)return;
    const left=this.cursors.left.isDown||this.keys.A.isDown,right=this.cursors.right.isDown||this.keys.D.isDown;
    const up=this.cursors.up.isDown||this.keys.W.isDown,down=this.cursors.down.isDown||this.keys.S.isDown;
    let dx=(right?1:0)-(left?1:0),dy=(down?1:0)-(up?1:0);
    if(dx||dy){const l=Math.hypot(dx,dy),speed=175;this.player.body.setVelocity(dx/l*speed,dy/l*speed);own.current={x:this.player.x,y:this.player.y};socket?.emit("player:move",{x:this.player.x,y:this.player.y});}
    else this.player.body.setVelocity(0,0);
    this.label.setPosition(this.player.x,this.player.y-30);
    const seen=new Set();
    for(const r of rocks){if(r.hp<=0)continue;seen.add(r.id);let o=rockMap.current.get(r.id);if(!o){o=this.add.container(r.x,r.y);const g=this.add.graphics();g.fillStyle(r.type==="gold"?0xe9b83f:r.type==="iron"?0x7d8790:0x53604c,1);g.beginPath();g.moveTo(-20,12);g.lineTo(-14,-14);g.lineTo(8,-19);g.lineTo(21,8);g.lineTo(3,18);g.closePath();g.fillPath();const t=this.add.text(0,2,r.type==="gold"?"G":r.type==="iron"?"I":"",{fontFamily:"system-ui",fontSize:"10px",color:"#d9e1c9",fontStyle:"bold"}).setOrigin(.5);o.add([g,t]);this.rocksG.add(o);rockMap.current.set(r.id,o)}o.setPosition(r.x,r.y);o.setAlpha(Math.max(.2,Math.min(1,r.hp/30)));}
    for(const[id,o]of rockMap.current)if(!seen.has(id)){o.destroy();rockMap.current.delete(id)}
    const seenP=new Set();
    for(const p of players){if(p.id===socket?.id)continue;seenP.add(p.id);let o=playerMap.current.get(p.id);if(!o){o=this.add.container(p.x,p.y);const body=this.add.rectangle(0,0,44,27,0x56b6ff);const barBg=this.add.rectangle(0,-24,48,5,0x391b1b);const bar=this.add.rectangle(-24,-24,48,5,0x56d364).setOrigin(0,0.5);const name=this.add.text(0,-36,p.name?.slice(0,12)||"player",{fontFamily:"system-ui",fontSize:"10px",color:"#dce9ff"}).setOrigin(.5);o.add([body,barBg,bar,name]);o.setData("bar",bar);o.setDepth(4);playerMap.current.set(p.id,o)}o.setPosition(p.x,p.y);o.getData("bar").width=48*Math.max(0,Math.min(1,(p.hp||100)/100));}
    for(const[id,o]of playerMap.current)if(!seenP.has(id)){o.destroy();playerMap.current.delete(id)}
   }
  }
  const config={type:Phaser.AUTO,parent:host.current,width:1000,height:600,transparent:false,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:"arcade",arcade:{gravity:{y:0},debug:false}},scene:MineScene};
  const game=new Phaser.Game(config);
  return()=>game.destroy(true);
 },[socket]);
 return <div ref={host} className="phaserArena" aria-label="ToollooT Mining Master game"/> 
}
