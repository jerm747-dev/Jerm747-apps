/* Portrait-only artwork. Combat sheets and fighter identity records stay independent. */
(function(global){'use strict';
const cache=new Map(),metadata=global.Jerm747PreviewPortraits||{},MAX_IMAGES=6;
function src(id,look=0){return metadata[id]?.src||global.Jerm747FighterIdentities?.[id]?.portrait||'images/groove-squad/vs/'+id+(look===1?'-2':'')+'.webp?v=95';}
function key(id,look){return id+':'+look;}
function prune(){while(cache.size>MAX_IMAGES){const entry=[...cache].find(([,v])=>!v.pending);if(!entry)break;cache.delete(entry[0]);}}
function load(id,look=0){const k=key(id,look);let entry=cache.get(k);if(entry){cache.delete(k);cache.set(k,entry);return entry.promise;}
 const image=new Image();entry={image,pending:true,ready:false};cache.set(k,entry);
 entry.promise=new Promise(resolve=>{let settled=false;const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);entry.pending=false;entry.ready=ok;if(!ok)cache.delete(k);prune();resolve(ok);};const timer=setTimeout(()=>finish(false),8000);image.onload=()=>finish(image.naturalWidth>0);image.onerror=()=>finish(false);image.src=src(id,look);});return entry.promise;
}
async function wait(pair){return Promise.all(['player','opponent'].map(side=>pair?.[side]?.id?load(pair[side].id,pair[side].look||0):Promise.resolve(true)));}
function paint(ctx,id,x,y,height,facing,look=0,renderScale=1){const entry=cache.get(key(id,look));if(!entry?.ready){load(id,look);return false;}
 const image=entry.image,b=metadata[id]?.bounds||[0,0,image.naturalWidth,image.naturalHeight],shownHeight=height*renderScale,width=b[2]*shownHeight/b[3];
 ctx.save();ctx.translate(x,y+height-shownHeight);ctx.scale(facing,1);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,...b,-width/2,0,width,shownHeight);ctx.restore();return true;
}
global.Jerm747PreviewArt={src,load,wait,paint};
})(window);
