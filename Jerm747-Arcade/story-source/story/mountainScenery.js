import { stoneBounds } from "./journeyFrameBounds.js";
import {journeyWind} from "./japanPlatformer.js";
// Art layers keep scenery independent of collision geometry and viewport size.
let sceneryCache;
export function createMountainScenery(){
 if(sceneryCache)return sceneryCache;
 const background=new Image();background.src='/images/japan/mountain-ascent.webp';
 const stones=new Image();stones.src='/images/japan/mountain-platforms.webp';
 const summit=new Image();summit.src='/images/japan/river-stage.png.webp';
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const frames=stoneBounds;
 return sceneryCache={
  draw(ctx,{height,camera,route,time,player}){
   const bottom=route.bottom,progress=Math.max(0,Math.min(1,1-camera/(bottom-height*.5)));
   const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,progress>.6?'#c996ab':'#292738');gradient.addColorStop(1,'#18192b');ctx.fillStyle=gradient;ctx.fillRect(0,0,900,height);
   if(background.complete&&background.naturalWidth){
    // Scroll a little slower than the foreground, with the summit pinned to world top.
    const artHeight=bottom;ctx.drawImage(background,0,-camera*.88,900,artHeight);
    ctx.fillStyle=`rgba(17,16,31,${.1+(1-progress)*.18})`;ctx.fillRect(0,0,900,height);
   }
   if(camera<450&&summit.complete&&summit.naturalWidth){ctx.save();ctx.globalAlpha=Math.max(0,(450-camera)/450)*.35;ctx.drawImage(summit,0,-camera*.2,900,420);ctx.restore();}
   ctx.save();ctx.translate(0,-camera);
   // A contained cascade: two falls join a shelf pool, then return to the basin.
   const top=bottom*.39,ledge=bottom*.57,basin=bottom*.77;
   ctx.globalAlpha=.58;ctx.fillStyle='#89cfe0';ctx.fillRect(769,top,24,ledge-top);ctx.fillRect(739,ledge,35,basin-ledge);
   ctx.fillStyle='#c1e6e2';ctx.fillRect(744,ledge,65,5);
   for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#daf6ef':'#69b3cf';ctx.fillRect(771+i*3,top,1,ledge-top);ctx.fillRect(741+i*4,ledge,2,basin-ledge);}
   if(!reduced)for(let i=0;i<22;i++){const y=top+(i*67+time*155)%(basin-top);ctx.fillStyle='#edffff';ctx.fillRect(y<ledge?774+i%5*3:744+i%6*4,y,2,14);}
   ctx.globalAlpha=.7;ctx.fillStyle='#70bcc9';ctx.beginPath();ctx.ellipse(754,basin+5,68,12,0,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle='#d8eece';ctx.lineWidth=2;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(754,basin+5,22+i*16+(reduced?0:(time*12)%12),3+i*2,0,0,Math.PI*2);ctx.stroke();}
   ctx.restore();
   // Air trails and petals use the same crosswind as movement, above the sheltered garden.
   const wind=journeyWind(player.mode,player.y,player.elapsed||0);
   if(Math.abs(wind)>1){
    ctx.save();ctx.strokeStyle='#f9e5db55';ctx.lineWidth=1.5;
    for(let i=0;i<7;i++){const x=(i*173+(reduced?0:time*wind*2)+9000)%900,y=45+(i*83)%Math.max(80,height-90);ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+wind,y-5,x+wind*2,y-2);ctx.stroke();}
    ctx.fillStyle='#efb4cd';for(let i=0;i<12;i++){const x=(i*127+(reduced?0:time*wind*1.5)+9000)%900,y=(i*97+(reduced?0:time*14))%height;ctx.fillRect(x,y,4,2);}
    ctx.restore();
   }
  },
  platform(ctx,p,index,count){
   const kind=index<count*.3?0:index<count*.7?1:2;
   ctx.save();ctx.fillStyle='#080a1738';ctx.beginPath();ctx.ellipse(p.x+p.w*.5,p.y+45,p.w*.5,12,0,0,Math.PI*2);ctx.fill();
   if(stones.complete && stones.naturalWidth){const f=frames[kind],scale=p.w/f.w,depth=Math.max(43,Math.min(68,p.w*.29)),above=(f.surface-f.y)/f.h*depth;ctx.drawImage(stones,f.x,f.y,f.w,f.h,p.x,p.y-above,p.w,depth);}
   else{ctx.fillStyle='#484052';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.w,p.y);ctx.lineTo(p.x+p.w*.85,p.y+45);ctx.lineTo(p.x+p.w*.3,p.y+62);ctx.lineTo(p.x+10,p.y+30);ctx.fill();}
   // A continuous worn rim makes the exact collision surface legible.
   ctx.fillStyle=p.goal?'#f5cd83':kind===0?'#bba996':'#a6b989';ctx.fillRect(p.x,p.y,p.w,3);
   ctx.fillStyle='#625265';for(let x=9;x<p.w-5;x+=24)ctx.fillRect(p.x+x,p.y+3,2,5);
   ctx.restore();
  }
 };
}
