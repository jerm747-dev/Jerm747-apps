/* Decorative practice scenery; the simulation and fighter sprites stay independent. */
(()=>{'use strict';
const ROOT='/images/groove-squad/practice-scenery/';
const PALETTES=[{name:'cedar',rgb:[35,110,77],alpha:.035},{name:'golden',rgb:[174,112,43],alpha:.17},{name:'blue',rgb:[42,64,122],alpha:.19}];
const wrap=(n,size)=>((n%size)+size)%size;
function paletteAt(distance){const phase=wrap(distance/1600,3),index=Math.floor(phase),fraction=phase-index;const mix=fraction*fraction*(3-2*fraction),a=PALETTES[index],b=PALETTES[(index+1)%3];return{name:a.name,next:b.name,mix,rgb:a.rgb.map((v,i)=>v+(b.rgb[i]-v)*mix),alpha:a.alpha+(b.alpha-a.alpha)*mix};}
function create(target){
 const layer=document.createElement('canvas');layer.width=600;layer.height=600;const ctx=layer.getContext('2d'),textures={};let revision=0,paintedRevision=-1,lastDistance=NaN,lastReduced=null;
 const images={},failed=new Set(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 for(const [id,file]of [['mountains','mountain-valley.png.webp'],['trees','cedar-tree-line.png.webp'],['path','moss-stone-path.png.webp']]){const image=new Image();images[id]=image;image.onerror=()=>{failed.add(id);revision++;};image.onload=()=>{const size={mountains:[750,250],trees:[600,175],path:[750,100]}[id],c=document.createElement('canvas');c.width=size[0];c.height=size[1];const p=c.getContext('2d');p.imageSmoothingEnabled=false;p.drawImage(image,0,0,c.width,c.height);textures[id]=c;revision++;};image.src=ROOT+file;}
 function tile(image,position,width,y,height,alpha=1){if(!image?.width)return;const first=Math.floor(position/width),offset=wrap(position,width);ctx.save();ctx.globalAlpha=alpha;
  // Alternate mirrored tiles meet on identical edge pixels, even for negative travel.
  for(let n=0;n<Math.ceil(600/width)+2;n++){const i=first+n,x=n*width-offset;ctx.save();if(wrap(i,2)===1){ctx.translate(x+width,y);ctx.scale(-1,1);ctx.drawImage(image,0,0,width,height);}else ctx.drawImage(image,x,y,width,height);ctx.restore();}ctx.restore();
 }
 function draw(distance){if(!Number.isFinite(lastDistance)||Math.abs(distance-lastDistance)>.1||revision!==paintedRevision||lastReduced!==reduce.matches){lastDistance=distance;paintedRevision=revision;lastReduced=reduce.matches;const color=paletteAt(distance);ctx.save();ctx.imageSmoothingEnabled=false;const sky=ctx.createLinearGradient(0,0,0,500);sky.addColorStop(0,'#18374e');sky.addColorStop(1,'#91b4ab');ctx.fillStyle=sky;ctx.fillRect(0,0,600,600);
  tile(textures.mountains,450+(reduce.matches?0:distance*.10),1500,0,500);
  tile(textures.trees,180+(reduce.matches?0:distance*.38),1200,150,350,.86);
  const haze=ctx.createLinearGradient(0,230,0,500);haze.addColorStop(0,'rgba(22,39,53,0)');haze.addColorStop(1,'rgba(13,30,37,.25)');ctx.fillStyle=haze;ctx.fillRect(0,230,600,270);
  ctx.fillStyle='#596253';ctx.fillRect(0,500,600,100);tile(textures.path,distance,750,500,100);
  ctx.fillStyle=`rgba(${color.rgb.map(Math.round).join(',')},${color.alpha})`;ctx.fillRect(0,0,600,600);
  // A quiet contact shadow grounds the sprite without covering the paving details.
  ctx.restore();
 }target.save();target.imageSmoothingEnabled=false;target.drawImage(layer,0,0,600,600);target.restore();
 }
 return{draw,canvas:layer,state:distance=>({distance,reduced:reduce.matches,ready:Object.values(images).every(i=>i.complete&&i.naturalWidth>0),failed:[...failed],palette:paletteAt(distance),offsets:{mountains:reduce.matches?0:distance*.10,trees:reduce.matches?0:distance*.38,path:distance}})};
}
window.Jerm747PracticeScenery={create};
})();
