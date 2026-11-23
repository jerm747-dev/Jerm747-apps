/* The lantern follows a painted hand in each pose. These points are fractions
   of the cropped sprite, so mirrors, flips, camera zoom and resizing stay aligned. */
(() => {
 'use strict';
 const poseHands = {
  parkour:[[.12,.68],[.93,.23],[.91,.31],[.88,.41],[.9,.51],[.9,.54],[.91,.57],[.94,.44]],
  aerial:[[.91,.14],[.87,.56],[.93,.34],[.89,.07],[.94,.42],[.91,.34]],
  squat:[[.88,.45],[.91,.5],[.91,.58],[.88,.57]],
  idleReady:[[.81,.59],[.89,.59],[.89,.59],[.88,.59]],
  dive:[[.9,.69],[.94,.9]],
  throw:[[.86,.54],[.87,.52],[.61,.57],[.84,.55]]
 };
 const strideHands={
  walk:[[.82,.54],[.79,.5],[.83,.44],[.91,.55],[.87,.50],[.88,.48],[.77,.53],[.75,.54]],
  run:[[.92,.38],[.92,.50],[.92,.36],[.93,.48],[.91,.48],[.94,.44],[.91,.45],[.91,.45]]
 };
 const anchors=new Map();
 for(const [name,points] of Object.entries(poseHands)){
  SpriteData[name].frames.forEach((rect,index)=>anchors.set(rect,points[index]));
 }
 anchors.set(SpriteData.idle.frame,[.84,.56]);
 anchors.set(SpriteData.tuck.frame,[.64,.64]);
 let origin=null,beam=null;
 function place(ctx,x,y){
  const m=ctx.getTransform();
  origin={x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
 }
 function pose(ctx,rect,x,y,w,h){
  const hand=anchors.get(rect);
  if(hand)place(ctx,x+w*hand[0],y+h*hand[1]);
 }
 function makeBeam(){
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=160;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(320,160);
  for(let x=0;x<320;x++){
   const t=x/319,width=2+78*t;
   for(let y=0;y<160;y++){
    const across=Math.abs(y-79.5)/width;
    if(across>=1)continue;
    const feather=Math.min(1,(1-across)*4);
    const fade=Math.min(1,(1-t)/.52)*(1-.25*t);
    const intensity=(0.31+0.27*Math.pow(1-across,2))*fade*feather;
    const i=(y*320+x)*4;
    pixels.data[i]=255;pixels.data[i+1]=238;pixels.data[i+2]=184;pixels.data[i+3]=Math.round(255*intensity);
   }
  }
  ctx.putImageData(pixels,0,0);return canvas;
 }
 function aim(player){
  const stride=player.grounded?Math.sin(player.phase*Math.PI*2)*.035:0;
  return player.dive?.49:player.grounded?.17+stride:.07+Math.max(-.12,Math.min(.15,player.vy/2500));
 }
 // Cut the beam out of the ambient shadow. A second pool belongs to the streetlamp.
 let shade=null;
 function shadeAlley(ctx,player,cam,w,h,width,on){
  shade ||= document.createElement('canvas');
  const sw=Math.ceil(w/2),sh=Math.ceil(h/2);
  if(shade.width!==sw||shade.height!==sh){shade.width=sw;shade.height=sh}
  const mask=shade.getContext('2d');
  mask.setTransform(sw/w,0,0,sh/h,0,0);mask.globalCompositeOperation='source-over';
  mask.clearRect(0,0,w,h);mask.fillStyle='rgba(4,7,19,.55)';mask.fillRect(0,0,w,h);
  mask.globalCompositeOperation='destination-out';
  const lampX=width-145-cam.x,lampY=650-cam.y;
  const pool=mask.createRadialGradient(lampX,lampY,60,lampX,lampY,495);
  pool.addColorStop(0,'#000');pool.addColorStop(1,'transparent');mask.fillStyle=pool;mask.fillRect(0,0,w,h);
  if(on&&origin){
   beam ||= makeBeam();
   const scale=ctx.getTransform().a;
   mask.save();mask.translate(origin.x/scale,origin.y/scale);mask.scale(player.facing,1);mask.rotate(aim(player));
   mask.drawImage(beam,5,-80,322,160);mask.drawImage(beam,5,-80,322,160);mask.restore();
  }
  ctx.drawImage(shade,cam.x,cam.y,w,h);
 }
 function draw(ctx,player){
  if(!origin)return;
  beam ||= makeBeam();
  const scale=ctx.getTransform().a;
  const tilt=aim(player);
  ctx.save();
  ctx.setTransform(player.facing*scale,0,0,scale,origin.x,origin.y);
  ctx.rotate(tilt);
  ctx.globalCompositeOperation='screen';ctx.drawImage(beam,7,-64,266,128);
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#2e3843';ctx.fillRect(-3,-2,9,4);
  ctx.fillStyle='#9f9690';ctx.fillRect(0,-2,1.5,4);
  ctx.fillStyle='#53616a';ctx.fillRect(5,-3,3.3,6);
  ctx.fillStyle='#fff5bc';ctx.fillRect(8,-2.4,1.5,4.8);
  ctx.restore();origin=null;
 }
 globalThis.EncoreLamp={pose,place,draw,shadeAlley,strideHands};
})();
