'use strict';
function createFlightLook(canvas, canLook){
 const points=new Map();
 const limit=Math.PI/6, minZoom=.8, maxZoom=1.8;
 let targetYaw=0,targetPitch=0,targetZoom=1,lastTime=0;
 const camera={
  yaw:0,pitch:0,zoom:1,x:0,y:0,
  active(){return Math.abs(this.yaw)+Math.abs(this.pitch)>.00001;},
  release(){points.clear();targetYaw=targetPitch=0;},
  reset(){this.release();this.yaw=this.pitch=this.x=this.y=0;this.zoom=targetZoom=1;},
  advance(now){
   const dt=Math.min(.1,Math.max(0,(now-lastTime)/1000));lastTime=now;
   if(points.size&&!canLook())this.release();
   const t=1-Math.exp(-(points.size?22:7)*dt);
   this.yaw+=(targetYaw-this.yaw)*t;this.pitch+=(targetPitch-this.pitch)*t;
   this.zoom+=(targetZoom-this.zoom)*(1-Math.exp(-18*dt));
   const distance=Math.min(canvas.clientWidth,canvas.clientHeight)*.58*this.zoom;
   this.x=-Math.tan(this.yaw)*distance;this.y=-Math.tan(this.pitch)*distance;
  },
  transform(ctx,depth){
   const cx=canvas.clientWidth/2,cy=canvas.clientHeight/2;
   ctx.translate(cx+this.x*depth,cy+this.y*depth);ctx.scale(this.zoom,this.zoom);ctx.translate(-cx,-cy);
  }
 };
 function measure(){
  const [a,b]=points.values();
  return b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,span:Math.hypot(a.x-b.x,a.y-b.y)}:{...a,span:0};
 }
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'||points.size>=2||!canLook())return;
  e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(!points.has(e.pointerId))return;
  const before=measure();points.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=measure();
  const gain=limit/Math.max(60,Math.min(canvas.clientWidth,canvas.clientHeight)*.48);
  targetYaw-=(after.x-before.x)*gain;targetPitch-=(after.y-before.y)*gain;
  const angle=Math.hypot(targetYaw,targetPitch);
  if(angle>limit){targetYaw*=limit/angle;targetPitch*=limit/angle;}
  if(before.span>3&&after.span>3)targetZoom=Math.max(minZoom,Math.min(maxZoom,targetZoom*after.span/before.span));
 });
 function end(e){if(points.delete(e.pointerId)&&!points.size)camera.release();}
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,end);
 window.addEventListener('blur',()=>camera.release());
 return camera;
}
