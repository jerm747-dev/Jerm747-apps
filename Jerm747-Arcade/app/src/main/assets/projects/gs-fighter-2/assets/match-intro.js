(function(global){'use strict';
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
function plan(t,full=true,reduced=false){
 if(!full||reduced)return{phase:t<.65?'both':t<1?'ready':'fight',zoom:1,pan:1,fade:1,total:1.35};
 if(t<1.15)return{phase:'left',pan:ease(t/1.15),zoom:1,fade:clamp(t/.18),total:4.1};
 if(t<2.3)return{phase:'right',pan:ease((t-1.15)/1.15),zoom:1,fade:clamp((t-1.15)/.16),total:4.1};
 return{phase:t<3.15?'both':t<3.65?'ready':'fight',pan:1,zoom:1.10-.10*ease((t-2.65)/.85),fade:1,total:4.1};
}
function create({stage,names,paint,background,onDone,reduced=false}){
 const root=document.createElement('section');root.className='match-intro hidden';root.setAttribute('role','dialog');root.setAttribute('aria-label','Fighter introductions');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');root.append(canvas);
 const label=document.createElement('div');label.className='match-intro-label';label.setAttribute('role','status');root.append(label);
 const skip=document.createElement('button');skip.type='button';skip.className='match-intro-skip';skip.textContent='Skip intro';root.append(skip);stage.append(root);
 let active=false,elapsed=0,last=null,full=true,pair=[],suspended=false;
 function finish(skipped=false){if(!active)return;active=false;root.classList.add('hidden');last=null;onDone({skipped})}
 skip.onclick=()=>finish(true);
 root.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();skip.focus()}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(true)}});
 function draw(p){
  const box=root.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height),dpr=Math.min(global.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#101326';c.fillRect(0,0,w,h);
  background?.(c,w,h);c.fillStyle='#0b1026aa';c.fillRect(0,0,w,h);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  if(p.phase==='left'||p.phase==='right'){
   const i=p.phase==='left'?0:1;c.save();c.globalAlpha=p.fade;
   paint(c,pair[i],w*.5,h*(.92-1.08+.16*p.pan),h*1.08,i===0?1:-1);c.restore();
   label.textContent=names[pair[i]];
  }else{
   // Two full bodies in a close view, followed by a short pull-back.
   const height=Math.min(h*.8,w*.7)*p.zoom,ground=h*.86;
   paint(c,pair[0],w*.27,ground-height,height,1);paint(c,pair[1],w*.73,ground-height,height,-1);
   label.textContent=p.phase==='ready'?'READY':p.phase==='fight'?'FIGHT!':`${names[pair[0]]}  ·  ${names[pair[1]]}`;
  }
  root.dataset.phase=p.phase;
 }
 return{
  start(left,right,opts={}){pair=[left,right];full=opts.full!==false;elapsed=0;last=null;active=true;suspended=document.hidden;root.classList.remove('hidden');draw(plan(0,full,reduced));skip.focus()},
  tick(now){if(!active)return;if(document.hidden||suspended){last=null;return}if(last!==null)elapsed+=Math.max(0,Math.min(.1,(now-last)/1000));last=now;const p=plan(elapsed,full,reduced);if(elapsed>=p.total){finish();return}draw(p)},
  suspend(){suspended=true;last=null},resume(){suspended=false;last=null},
  skip:()=>finish(true),cancel(){active=false;last=null;root.classList.add('hidden')},get active(){return active}
 };
}
global.Jerm747MatchIntro={plan,create};
})(typeof window==='undefined'?globalThis:window);
