import { spriteBounds } from "./journeyFrameBounds.js";
let cache;
function loadSheet(id) {
 const image=new Image();
 image.src=`/images/groove-squad/level9-sprites/${id}.png.webp`;
 return {image,...spriteBounds[id]};
}
export function motionFrame(motion){
 if(!motion)return null;
 if(motion.phase==='prepare')return motion.time<.025?0:1;
 if(motion.phase==='rise')return motion.time<.2?2:3;
 if(motion.phase==='descend')return motion.vy<250?4:5;
 if(motion.phase==='land')return motion.time<.08?6:7;
 return null;
}
export function createJourneySprites(){
 if(!cache){
  const sprites=new Map(),motions=new Map(),fallbacks=new Map();
  for(const id of ['og-jerm','kiana'])sprites.set(id,loadSheet(id));
  for(const id of ['og-jerm','kiana']){const image=new Image();image.src=`/images/groove-squad/level9-sprites/${id}-reference.webp`;fallbacks.set(id,image);}
  cache={sprites,motions,fallbacks};
 }
 const {sprites,motions,fallbacks}=cache,reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 return {draw(context,{id,x,y,time=0,action='idle',facing=1,label='',guide=false,motion=null}){
  let entry=sprites.get(id)||sprites.get('og-jerm');
  let frame=action==='jump'?3:action==='fall'?4:action==='victory'?5:action==='run'&&!reducedMotion?1+Math.floor(time*9)%2:0;
  const m=motionFrame(motion),extra=motions.get(id);
  if(m!==null&&extra?.frames){entry=extra;frame=m;}
  context.save();context.translate(Math.round(x),Math.round(y));context.scale(facing<0?-1:1,1);
  if(entry.frames && entry.image.complete && entry.image.naturalWidth){
   const bounds=entry.frames[frame],scale=88/entry.maxHeight,width=bounds.w*scale,height=bounds.h*scale;
   const breathe=reducedMotion||motion?0:action==='idle'?Math.sin(time*3)*.7:action==='run'?Math.abs(Math.sin(time*9*Math.PI))*2:0;
   context.drawImage(entry.image,bounds.x,bounds.y,bounds.w,bounds.h,-width/2,-height-breathe,width,height);
  }else{const fallback=fallbacks.get(id);if(fallback?.complete&&fallback.naturalWidth){const width=fallback.naturalWidth/fallback.naturalHeight*88;context.drawImage(fallback,-width/2,-88,width,88);}}
  context.restore();context.save();context.font='bold 12px monospace';context.textAlign='center';context.shadowColor='#101426';context.shadowBlur=3;context.shadowOffsetY=1;context.fillStyle=guide?'#f7ca65':'#dffcff';context.fillText(label,x,y-98);context.restore();
 }};
}
