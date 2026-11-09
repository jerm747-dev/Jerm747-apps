/* Image-based street renderer; source atlases remain editable and unmodified. */
(() => {
'use strict';
const images={};
const files={party:'party-terrace-v11.webp',waiter:'party-waiter-v11.webp',street:'street-day.png',market:'street-market-v7.png',rise:'street-rise-v8.png',rooftops:'street-rooftops-v8.png',pedestrians:'pedestrians-atlas.png',...Object.fromEntries(Object.entries(SpriteData).map(([k,v])=>[k,v.file]))};
const nightFiles={
 alley:'night-alley-v13.webp',...Object.fromEntries(StreetGame.merch.filter(m=>m.file).map(m=>[m.id,m.file])),
 nightCafe:'night-cafe-v12.webp',nightMarket:'night-market-v12.webp',nightRise:'night-rise-v12.webp',
 nightRoofs:'night-roofs-v12.webp',breakfast:'predawn-cafe-moon-v12.webp',barista:'cafe-server-v12.webp',
 breakfastStill:'party-breakfast-v12.webp'
};
let nightLoad=null,carryingLamp=false;
function loadNight(){
 if(!nightLoad)nightLoad=load(nightFiles).catch(error=>{nightLoad=null;throw error});
 return nightLoad;
}
function load(set=files){return Promise.all(Object.entries(set).map(([key,file])=>new Promise((resolve,reject)=>{
 const image=new Image();image.onload=()=>{images[key]=image;resolve()};image.onerror=()=>reject(new Error('Could not load '+file));image.src='assets/'+file;
})));}
function crop(ctx,key,rect,x,y,w,h){ctx.drawImage(images[key],...rect,x,y,w,h);if(carryingLamp)EncoreLamp.pose(ctx,rect,x,y,w,h)}
function pose(ctx,index,y=0){
 const d=SpriteData.parkour,f=d.frames[index],scale=d.scale;
 crop(ctx,'parkour',f,-f[2]*scale*d.anchors[index],-f[3]*scale+y,f[2]*scale,f[3]*scale);
}
function aerial(ctx,index){
 const d=SpriteData.aerial,f=d.frames[index],scale=d.scale;
 crop(ctx,'aerial',f,-f[2]*scale*d.anchors[index],-f[3]*scale,f[2]*scale,f[3]*scale);
}
function atlasPose(ctx,key,index){
 const d=SpriteData[key],f=d.frames[index],scale=d.scale;
 crop(ctx,key,f,-f[2]*scale*d.anchors[index],-f[3]*scale,f[2]*scale,f[3]*scale);
}
function throwFrame(p){return p.throwTime<.07?0:p.throwTime<.14?1:p.throwTime<.23?2:3}
function streaks(ctx,p,time){
 if(!p.boosting&&!p.dive)return;
 ctx.save();ctx.translate(p.x,p.y-65);
 ctx.rotate(p.dive?Math.atan2(p.vy,p.vx):p.vx<0?Math.PI:0);
 const length=p.dive?78:64+Math.min(30,(Math.abs(p.vx)-326)*.35);
 for(let i=0;i<3;i++){
  const y=(i-1)*19+Math.sin(time*11+i)*2,start=-22-i%2*12;
  const gradient=ctx.createLinearGradient(start-length,0,start,0);
  gradient.addColorStop(0,'#2b7aff00');gradient.addColorStop(.6,'#3fbcff88');gradient.addColorStop(1,'#a2eaffcc');
  ctx.strokeStyle=gradient;ctx.lineWidth=i===1?3:1.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(start-length,y);ctx.lineTo(start,y);ctx.stroke();
 }
 ctx.restore();
}
function player(ctx,p,time){
 streaks(ctx,p,time);
 const throwing=p.throwTime>=0&&!p.flip&&!p.dive;
 if(!throwing){playerBody(ctx,p,time);return}
 const index=throwFrame(p),duckOffset=p.duck?28:0;
 // Keep running/jumping legs under the throwing upper body.
 const composite=!p.grounded||Math.abs(p.vx)>9||p.duck;
 if(composite){ctx.save();ctx.beginPath();ctx.rect(p.x-150,p.y-63+duckOffset,300,100);ctx.clip();playerBody(ctx,p,time);ctx.restore();}
 ctx.save();ctx.translate(p.x,p.y+duckOffset);ctx.scale(p.throwFacing,1);
 if(composite){ctx.beginPath();ctx.rect(-150,-200,300,139);ctx.clip()}
 atlasPose(ctx,'throw',index);ctx.restore();
 if(p.throwTime<.14){
  const d=SpriteData.throw,f=d.frames[index],hand=d.hands[index];
  fireball(ctx,p.x+p.throwFacing*(hand[0]-d.anchors[index])*f[2]*d.scale,p.y+duckOffset+(hand[1]-1)*f[3]*d.scale,6,time,0,true);
 }
}
function merchIcon(ctx,index,x,y,size){
 const merch=StreetGame.merch[index];
 if(merch?.file){
  const icon=images[merch.id];
  if(icon){const scale=size/Math.max(icon.width,icon.height);ctx.drawImage(icon,x-icon.width*scale/2,y-icon.height*scale/2,icon.width*scale,icon.height*scale)}
  return;
 }
 const f=SpriteData.merch.frames[index],scale=size/Math.max(f[2],f[3]);
 crop(ctx,'merch',f,x-f[2]*scale/2,y-f[3]*scale/2,f[2]*scale,f[3]*scale);
}
// A continuous deformation gives the head, shoulders and spine some weight,
// without snapping the whole body to a different height at each frame boundary.
function stride(ctx,p,key,index){
 const f=SpriteData[key].frames[index],scale=128/291;
 const cell=images[key].width/4,col=index%4,anchor=(col+.5)*cell-f[0];
 const beat=p.phase*Math.PI*4,run=key==='run',lift=(1-Math.cos(beat))*.5;
 const bob=lift*(run?4.5:1.8),sway=Math.sin(beat)*(run?1.8:.8);
 const h=f[3]*scale,w=f[2]*scale,x=-anchor*scale;
 const strips=8;
 // Align heads to one baseline; a shorter flight pose lifts its feet instead
 // of suddenly dropping its head to keep the soles on the sidewalk.
 function vertical(t){return -128+t*h-bob-(1-t)*(1-t)*Math.sin(beat)*(run?1.6:.65)}
 for(let i=0;i<strips;i++){
  const a=i/strips,b=(i+1)/strips,upper=1-a;
  const y0=vertical(a),y1=vertical(b);
  crop(ctx,key,[f[0],f[1]+a*f[3],f[2],(b-a)*f[3]],x+sway*upper*upper,y0,w,y1-y0+.12);
 }
 if(carryingLamp){
  const [u,v]=EncoreLamp.strideHands[key][SpriteData[key].sequence.indexOf(index)];
  EncoreLamp.place(ctx,x+w*u+sway*(1-v)*(1-v),vertical(v));
 }
}
function spinTuck(ctx,angle){
 const f=SpriteData.tuck.frame,h=78,w=f[2]/f[3]*h;
 ctx.translate(0,-65);ctx.rotate(angle);crop(ctx,'tuck',f,-w/2,-h/2,w,h);
}
function playerBody(ctx,p,time){
 ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.facing,1);
 if(p.poundTime>=0){
  const t=p.poundTime/StreetGame.motion.poundTuck;
  if(t<1)spinTuck(ctx,t*Math.PI*2);
  else{
   ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#cfedfa99';ctx.beginPath();
   for(const [x,y,h] of [[-25,-51,22],[22,-68,30],[-12,-99,18]]){
    ctx.moveTo(x,y);ctx.lineTo(x,y-h);
   }
   ctx.stroke();ctx.restore();atlasPose(ctx,'squat',2);
  }
 }else if(p.dive){
  const d=SpriteData.dive,i=p.diveTime<.08?0:1,f=d.frames[i],a=d.centerAnchors[i];
  ctx.save();ctx.translate(0,-64);ctx.rotate(i?Math.max(.18,Math.min(.55,Math.atan2(p.vy,Math.abs(p.vx))-.52)):0);
  crop(ctx,'dive',f,-f[2]*d.scale*a[0],-f[3]*d.scale*a[1],f[2]*d.scale,f[3]*d.scale);ctx.restore();
 }else if(p.launchQueued){atlasPose(ctx,'squat',1)}
 else if(!p.grounded&&p.doubleJump){
  aerial(ctx,p.vy< -120?3:p.vy<150?4:5);
 }else if(p.flip){
  if(p.flipElapsed<.10)aerial(ctx,0);
  else if(p.flipElapsed<.18)aerial(ctx,1);
  else if(p.flipElapsed>.62)aerial(ctx,2);
  else spinTuck(ctx,p.flipAngle);
 }else if(!p.grounded){
  if(p.dropping)pose(ctx,3);
  else if(p.airTime<.09)pose(ctx,1);
  else if(p.airTime<.18)aerial(ctx,0);
  else if(p.vy<90)pose(ctx,2,-8);
  else pose(ctx,3);
 }else if(p.skid){pose(ctx,7)}
 else if(p.land>0){
  const elapsed=StreetGame.motion.landing-p.land;
  // Contact -> compression -> recoil. This never locks the player's controls.
  pose(ctx,elapsed<.045?4:elapsed<.125?5:6);
 }else if(Math.abs(p.vx)>9&&!p.duck){
  const key=Math.abs(p.vx)>215?'run':'walk',seq=SpriteData[key].sequence;
  stride(ctx,p,key,seq[Math.floor(p.phase*seq.length)%seq.length]);
 }else if(p.duck||p.squat>0){
  atlasPose(ctx,'squat',p.squatRising?3:p.squat<.34?0:p.squat<.78?1:2);
 }else{
  const stage=StreetGame.idlePose(p.idleTime||0),breath=Math.sin(time*2.3)*.65;
  // Common foot/head baselines keep turns from changing the character's size.
  ctx.transform(1,0,Math.sin(time*.7)*.004,1-breath/128,0,0);
  if(stage<4)atlasPose(ctx,'idleReady',stage);
  else{
   const f=SpriteData.idle.frame,h=128,w=f[2]/f[3]*h;
   crop(ctx,'idle',f,-w*.5,-h,w,h);
  }
 }
 ctx.restore();
}
function pedestrian(ctx,npc,frozen=false){
 const frame=frozen?0:Math.floor(npc.phase)%4;
 ctx.save();ctx.translate(npc.x,npc.y);ctx.scale(npc.dir,1);
 const scale=126/212;
 crop(ctx,'pedestrians',[frame*192,npc.type*224,192,224],-96*scale,-212*scale,192*scale,224*scale);
 if(npc.wristLight){
  const forward=frame%2===0;
  const wristX=forward?18:10,wristY=npc.type?-64:-63;
  ctx.strokeStyle=npc.wristLight;ctx.lineWidth=2.3;ctx.shadowColor=npc.wristLight;ctx.shadowBlur=5;
  ctx.beginPath();ctx.moveTo(wristX-1,wristY+1.6);ctx.lineTo(wristX+1,wristY-1.6);ctx.stroke();
 }
 ctx.restore();
}
function portrait(ctx,who,npcType=1){
 ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.fillStyle=who==='nige'?'#1b4038':'#353b47';ctx.fillRect(0,0,w,h);
 if(who==='nige'){
  const f=SpriteData.walk.frames[0];crop(ctx,'walk',[f[0]+30,f[1],85,105],w*.05,0,w*.95,h*1.22);
 }else{crop(ctx,'pedestrians',[npcType?67:74,npcType*224+8,63,78],0,0,w,h*1.08)}
}
function rounded(ctx,x,y,w,h,r=4){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function wood(ctx,p){
 const h=32;
 ctx.save();ctx.translate(p.x,p.y);
 const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#ba8850');g.addColorStop(1,'#745138');
 rounded(ctx,0,0,p.w,h,3);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#422e27';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#d3b078';ctx.fillRect(1,0,p.w-2,4);
 ctx.strokeStyle='#5a3c2d';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(1,15);ctx.lineTo(p.w-1,15);ctx.stroke();
 for(const x of [7,p.w-13]){ctx.fillStyle='#454340';ctx.fillRect(x,3,6,h-5);ctx.fillStyle='#b9a57a';ctx.fillRect(x+2,6,2,2);ctx.fillRect(x+2,24,2,2)}
 ctx.restore();
}
function fireball(ctx,x,y,r,time,vx=0,pickup=false){
 ctx.save();ctx.translate(x,y);
 const halo=ctx.createRadialGradient(0,0,2,0,0,r*3);halo.addColorStop(0,'#ffb53999');halo.addColorStop(1,'#ff6b0000');
 ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,r*3,0,Math.PI*2);ctx.fill();
 // Trailing flame follows the throw; collectible flames rise vertically.
 ctx.rotate(pickup?0:(vx<0?Math.PI/2:-Math.PI/2));
 const wobble=Math.sin(time*17)*r*.18;
 ctx.fillStyle='#f35b19';ctx.beginPath();ctx.moveTo(-r*.8,r*.35);ctx.quadraticCurveTo(-r*1.3,-r*.7,-r*.3,-r*2.3);ctx.quadraticCurveTo(wobble,-r*.8,r*.45,-r*1.65);ctx.quadraticCurveTo(r*1.7,-r*.5,r*.8,r*.5);ctx.closePath();ctx.fill();
 const core=ctx.createRadialGradient(-r*.2,-r*.2,0,0,0,r);core.addColorStop(0,'#fffbd3');core.addColorStop(.42,'#ffd45d');core.addColorStop(.8,'#ff8c20');core.addColorStop(1,'#e74815');
 ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#fff3ac';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,0,r*.55,time*4,time*4+Math.PI*1.3);ctx.stroke();
 ctx.restore();
}
function metal(ctx,p){
 ctx.fillStyle='#203735';ctx.fillRect(p.x,p.y,p.w,13);ctx.fillStyle='#9da58a';ctx.fillRect(p.x,p.y,p.w,3);
 ctx.strokeStyle='#324340';ctx.lineWidth=3;ctx.beginPath();for(let x=p.x+8;x<p.x+p.w;x+=20){ctx.moveTo(x,p.y+4);ctx.lineTo(x+10,p.y+12)}ctx.stroke();
}
// A thin railing leaves the landing edge readable against the dark masonry.
function fireEscape(ctx,p){
 ctx.save();ctx.translate(p.x,p.y);
 ctx.strokeStyle='#354552';ctx.lineWidth=3;ctx.beginPath();
 for(let x=9;x<p.w-4;x+=28){ctx.moveTo(x,0);ctx.lineTo(x,-29)}
 ctx.moveTo(6,-30);ctx.lineTo(p.w-6,-30);
 ctx.moveTo(12,10);ctx.lineTo(33,31);ctx.lineTo(49,10);
 ctx.moveTo(p.w-49,10);ctx.lineTo(p.w-33,31);ctx.lineTo(p.w-12,10);ctx.stroke();
 ctx.strokeStyle='#919299';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(5,-31);ctx.lineTo(p.w-6,-31);ctx.stroke();
 ctx.restore();metal(ctx,p);
}
// Extend the dark end of the painted wall without stretching its doors or lamp.
function drawBackdrop(ctx,image,width,sourceHeight=941,drawHeight=sourceHeight){
 const extension=width-1672;
 if(extension>0){ctx.save();ctx.translate(extension,0);ctx.scale(-1,1);ctx.drawImage(image,0,0,extension,sourceHeight,0,0,extension,drawHeight);ctx.restore()}
 ctx.drawImage(image,0,0,1672,sourceHeight,extension,0,1672,drawHeight);
}
// Slow pinpricks catch the eye at a handful of actual fixtures in the paintings.
const nightBulbs=[
 [[107,488],[151,489],[207,486],[261,489],[330,488],[410,483],[760,491],[908,489]],
 [[352,464],[495,448],[731,445],[941,448],[1109,443],[1269,453]],
 [[369,583],[898,555],[1063,549],[1472,555]],[[723,409],[789,429],[884,419]],[]];
function shimmer(ctx,index,time){
 const colors=['#f5c988','#8adcd3','#e7add9'];
 for(const [i,[x,y]] of nightBulbs[index].entries()){
  const crest=Math.pow((1+Math.sin(time*1.35+i*1.03))/2,5);
  if(crest<.05)continue;
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=colors[i%3];ctx.globalAlpha=crest*.55;
  ctx.lineWidth=.7;const size=2+crest*2.6;ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size,0);ctx.moveTo(0,-size);ctx.lineTo(0,size);ctx.stroke();ctx.restore();
 }
}
function render(ctx,s,w,h){
 const cam=s.camera;
 const backdrops=s.afterParty?['nightCafe','nightMarket','nightRise','nightRoofs','breakfast']:['street','market','rise','rooftops','party'];
 const alley=s.areaIndex===StreetGame.alleyIndex,width=StreetGame.areaWidth(s.areaIndex);
 const backdrop=alley?'alley':backdrops[s.areaIndex];
 ctx.fillStyle=s.areaIndex===3?'#403d89':s.areaIndex>0?'#b290a2':'#b5d6e3';ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(-cam.x,-cam.y);
 // Continue the sky above the source art so high double jumps never reveal a bar.
 if(cam.y<0){
  const skyTop=s.afterParty?'#091026':s.areaIndex===0?'#86b5cf':s.areaIndex===3?'#363c8f':'#7868a8';
  const skyEdge=s.afterParty?'#1c2747':s.areaIndex===0?'#b5d6e3':s.areaIndex===3?'#5f69ad':'#ae95be';
  const sky=ctx.createLinearGradient(0,-600,0,-75);sky.addColorStop(0,skyTop);sky.addColorStop(1,skyEdge);ctx.fillStyle=sky;ctx.fillRect(0,-600,width,600);
  if(s.afterParty){
   for(let i=0;i<68;i++){
    const x=(i*337+61)%width,y=-52-(i*113)%490;
    ctx.fillStyle=i%5?'#c9d5ed75':'#fcf4dbc9';ctx.fillRect(x,y,i%5?1.5:2,1.5);
   }
  }
  // A short, unscaled reflection joins the painted edge, fading into open sky.
  ctx.save();ctx.scale(1,-1);drawBackdrop(ctx,images[backdrop],width,alley?1:75,75);ctx.restore();
  const join=ctx.createLinearGradient(0,-75,0,0);join.addColorStop(0,skyEdge);join.addColorStop(1,skyEdge+'00');ctx.fillStyle=join;ctx.fillRect(0,-75,width,75);
 }
 drawBackdrop(ctx,images[backdrop],width);
 if(s.afterParty&&!alley)shimmer(ctx,s.areaIndex,s.time);
 for(const p of s.platforms){
  if(p.kind==='terrace')continue;
  if(p.kind==='wood')wood(ctx,p);
  else if(p.kind==='metal')metal(ctx,p);
  else if(p.kind==='fireEscape')fireEscape(ctx,p);
  else {
   ctx.fillStyle='#ffe9a36b';ctx.fillRect(p.x,p.y-2,p.w,3);
   ctx.fillStyle='#67472977';ctx.fillRect(p.x,p.y+1,p.w,2);
  }
 }
 for(const b of s.blocks){
  ctx.save();if(b.used)ctx.filter='saturate(.32) brightness(.82)';
  const f=SpriteData.gold.frame,dy=b.bump>0?Math.sin(b.bump/.24*Math.PI)*7:0;
  crop(ctx,'gold',f,b.x,b.y-dy,b.w,b.h);ctx.restore();
  if(!b.used){fireball(ctx,b.x+b.w/2,b.y+b.h/2,8,s.time,0,true);const shine=Math.sin(s.time*2.4+b.x)*.5+.5;ctx.fillStyle='rgba(255,246,199,'+(shine*.8)+')';ctx.fillRect(b.x+5,b.y+4,11,2);}
 }
 for(const b of s.lootCrates){
  if(b.broken)continue;
  ctx.save();ctx.shadowColor='#ffdf8c66';ctx.shadowBlur=9;
  const f=SpriteData.merch.frames[3];crop(ctx,'merch',f,b.x,b.y,b.w,b.h);ctx.restore();
  ctx.fillStyle='#fff0ba';ctx.font='bold 9px Arial';ctx.textAlign='center';if(b.nightGear){
   ctx.fillStyle='#151921';rounded(ctx,b.x+6,b.y+21,b.w-12,28,3);ctx.fill();
   ctx.fillStyle='#fff';ctx.font='bold 11px ui-monospace,monospace';ctx.fillText('NIGHT',b.x+b.w/2,b.y+33);ctx.fillText('DROP',b.x+b.w/2,b.y+45);
   ctx.font='bold 9px Arial';
  }
  ctx.fillText('POUND OR FIRE',b.x+b.w/2,b.y-9);
 }ctx.textAlign='start';
 if(s.areaIndex===4){
  // Two tray-carrying servers walk different beats behind the front edge of the terrace.
  for(const [lo,hi,offset,y,h] of [[330,745,0,650,114],[960,1330,7,638,106]]){
   const d=hi-lo,t=(s.time*32+offset*32)%(2*d),dir=t<d?1:-1,x=lo+(t<d?t:2*d-t);
   const i=Math.floor((s.time+offset)*3.7)%2;
   const frames=s.afterParty?[[43,18,311,463],[475,19,220,464]]:[[46,20,307,462],[475,20,218,463]];
   const anchors=s.afterParty?[[147,462],[79,463]]:[[143.5,460.5],[76.5,461]];
   const f=frames[i],a=anchors[i];
   ctx.save();ctx.translate(x,y);ctx.scale(dir*h/462,h/462);crop(ctx,s.afterParty?'barista':'waiter',f,-a[0],-a[1],f[2],f[3]);ctx.restore();
  }
 }
 for(const npc of s.walkers){
  ctx.fillStyle='#27363025';ctx.beginPath();ctx.ellipse(npc.x,npc.y+1,22,4,0,0,Math.PI*2);ctx.fill();
  pedestrian(ctx,npc,s.encounter.status==='talking'&&npc.id===s.encounter.partner);
  if(s.encounter.status==='available'&&npc.id===s.encounter.partner){
   const x=npc.x,y=npc.y-151+Math.sin(s.time*2.5)*2;
   rounded(ctx,x-17,y-13,34,23,8);ctx.fillStyle='#fbebc7';ctx.fill();ctx.strokeStyle='#755c39';ctx.lineWidth=1.2;ctx.stroke();
   ctx.fillStyle='#4e4a38';for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(x+i*6,y-2,1.5,0,Math.PI*2);ctx.fill()}
  }
 }
 const p=s.player;
 if(p.grounded){ctx.fillStyle='#1b242c30';ctx.beginPath();ctx.ellipse(p.x,p.y+1,24,4,0,0,Math.PI*2);ctx.fill()}
 carryingLamp=s.afterParty&&s.flashlightOn;
 player(ctx,p,s.time);
 if(alley)EncoreLamp.shadeAlley(ctx,p,cam,w,h,width,carryingLamp);
 if(carryingLamp){EncoreLamp.draw(ctx,p);carryingLamp=false}


 for(const orb of s.pickups){fireball(ctx,orb.x,orb.y+(orb.rest?Math.sin(s.time*4)*3:0),14,s.time,0,true);ctx.fillStyle='#fff2bf';ctx.strokeStyle='#5f281d';ctx.lineWidth=3;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.strokeText('×3',orb.x,orb.y+29);ctx.fillText('×3',orb.x,orb.y+29)}ctx.textAlign='start';
 for(const d of s.lootDrops){
  const y=d.y+(d.rest?Math.sin(s.time*3)*4:0);
  const glow=ctx.createRadialGradient(d.x,y,1,d.x,y,48);glow.addColorStop(0,'#ffe3a477');glow.addColorStop(1,'#ffe3a400');ctx.fillStyle=glow;ctx.fillRect(d.x-48,y-48,96,96);
  merchIcon(ctx,StreetGame.merch.findIndex(m=>m.id===d.item),d.x,y,58);
 }
 for(const d of s.debris){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.angle);ctx.globalAlpha=Math.min(1,d.life*3);ctx.fillStyle='#bd8247';ctx.fillRect(-d.w/2,-d.h/2,d.w,d.h);ctx.fillStyle='#f4cc86';ctx.fillRect(-d.w/2,-d.h/2,d.w,2);ctx.restore();}
 for(const b of s.blasts){
  if(b.pound){
   const t=1-b.life/.32;
   ctx.save();ctx.translate(b.x,b.y-2);ctx.globalAlpha=1-t;
   ctx.strokeStyle='#f2dbac';ctx.lineWidth=3*(1-t)+1;
   ctx.beginPath();ctx.ellipse(0,0,12+76*t,3+8*t,0,0,Math.PI*2);ctx.stroke();
   ctx.fillStyle='#c8b8a2';
   for(let i=0;i<8;i++){
    const side=i%2?1:-1,j=Math.floor(i/2);
    ctx.beginPath();ctx.ellipse(side*(7+(28+j*12)*t),-3-Math.sin(t*Math.PI)*(4+j*3),3+t*5,2+t*3,0,0,Math.PI*2);ctx.fill();
   }
   ctx.restore();continue;
  }
  const t=b.jump?(.24-b.life)/.24:(.4-b.life)/.4;ctx.save();ctx.globalAlpha=Math.max(0,1-t);ctx.strokeStyle=b.jump?'#d5f3cf':'#ffe6a4';ctx.lineWidth=b.jump?2:4;ctx.beginPath();ctx.ellipse(b.x,b.y,10+t*48,b.jump?3+t*8:10+t*48,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 for(const shot of s.shots)fireball(ctx,shot.x,shot.y,11,s.time,shot.vx);
 for(const f of s.fizzles){
  const t=f.age/.55;ctx.save();ctx.globalAlpha=Math.max(0,1-t);
  // Small cooling embers dissolve into a short, soft smoke puff.
  for(let i=0;i<3;i++){
   const x=f.x+(i-1)*(5+t*10),y=f.y-i*3-t*12,r=3+t*8;
   const smoke=ctx.createRadialGradient(x,y,0,x,y,r);smoke.addColorStop(0,'#67717c80');smoke.addColorStop(1,'#8e98a200');ctx.fillStyle=smoke;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#ffc76d':'#ed722e';ctx.beginPath();ctx.arc(f.x+Math.cos(i*2.4)*t*22,f.y+Math.sin(i*2.4)*t*15,Math.max(.1,2*(1-t)),0,Math.PI*2);ctx.fill()}
  ctx.restore();
 }
 for(const a of s.particles){ctx.globalAlpha=Math.min(1,a.life*2);ctx.fillStyle='#ffb955';ctx.beginPath();ctx.arc(a.x,a.y,2.5,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
 // Direction signs sit off the walking surface.
 function sign(x,y,text,width=175){ctx.fillStyle='#29473ce8';rounded(ctx,x,y,width,30,3);ctx.fill();ctx.fillStyle='#ffedc4';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(text,x+width/2,y+19);}
 const exitY=s.areaIndex===2?184:s.areaIndex===3?588:804;
 if(s.areaIndex<4)sign(width-207,exitY,StreetGame.areaName(s.areaIndex+1,s.afterParty).toUpperCase()+' →');
 if(alley)sign(1020,795,'↑  FIRE ESCAPE',135);
 if(s.afterParty&&s.areaIndex===0)sign(12,804,'← BACKSTAGE ALLEY',158);
 if(s.areaIndex===2)sign(1438,804,'↑ EXIT ON THE ROOF',202);
 if(s.areaIndex>0&&s.areaIndex<4)sign(12,s.areaIndex===3?588:804,'← '+StreetGame.areaName(s.areaIndex-1,s.afterParty).toUpperCase(),158);
 ctx.textAlign='start';
 ctx.restore();
}
globalThis.StreetArt={load,loadNight,render,portrait,player,merchIcon};
})();
