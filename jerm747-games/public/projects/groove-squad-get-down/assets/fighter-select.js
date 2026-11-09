/* v140: independent fighter-grid movement for the controllers assigned to Blue and Red. */
(function(global){'use strict';
function next(items,current,direction){
 if(!items.length)return null;const entries=items.map(button=>({button,r:button.getBoundingClientRect()})).sort((a,b)=>a.r.top-b.r.top||a.r.left-b.r.left),rows=[];
 for(const e of entries){const last=rows[rows.length-1];if(!last||Math.abs(last[0].r.top-e.r.top)>Math.max(3,e.r.height/4))rows.push([e]);else last.push(e);}
 rows.forEach(row=>row.sort((a,b)=>a.r.left-b.r.left));const flat=rows.flat(),index=flat.findIndex(e=>e.button.dataset.fighter===current);if(index<0)return flat[0].button;
 if(direction==='left'||direction==='right')return flat[(index+(direction==='left'?-1:1)+flat.length)%flat.length].button;
 if(direction!=='up'&&direction!=='down')return flat[index].button;
 const at=rows.findIndex(row=>row.includes(flat[index])),row=rows[(at+(direction==='up'?-1:1)+rows.length)%rows.length],x=flat[index].r.left+flat[index].r.width/2;
 return row.reduce((best,e)=>Math.abs(e.r.left+e.r.width/2-x)<Math.abs(best.r.left+best.r.width/2-x)?e:best).button;
}
function menu(data){const out={...(data.menu||{})},pad=data.pad,profile=global.Jerm747SitePadProfile;if(!pad||!profile)return out;try{const p=profile.load(pad),s=profile.stick(pad,p,p.focusStick);if(Math.max(Math.abs(s.x),Math.abs(s.y))>.55){if(Math.abs(s.x)>=Math.abs(s.y))out[s.x<0?'left':'right']=true;else out[s.y<0?'up':'down']=true;}}catch{}return out;}
global.Jerm747FighterSelect={next,menu};
})(typeof window==='undefined'?globalThis:window);
