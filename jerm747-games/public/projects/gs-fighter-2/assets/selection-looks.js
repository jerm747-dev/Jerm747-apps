(function(global){'use strict';
const OUTFIT_KEY='gs-fighter.fighter.looks.v139';
function choice(id,side='player'){try{const p=JSON.parse(localStorage.getItem(OUTFIT_KEY)||'{}'),v=p[side+':'+id]??p[id];return v===0||v===1?v:'auto';}catch{return 'auto';}}
function choose(id,side,value){try{let p;try{p=JSON.parse(localStorage.getItem(OUTFIT_KEY)||'{}');}catch{p={};}if(!p||typeof p!=='object'||Array.isArray(p))p={};p[side+':'+id]=value;localStorage.setItem(OUTFIT_KEY,JSON.stringify(p));}catch{}}
function alphas(seconds){const p=((seconds%9)+9)%9/9;let a=p<.4?0:p<.5?(p-.4)/.1:p<.9?1:1-(p-.9)/.1;a=Math.max(0,Math.min(1,a));a=a*a*(3-2*a);return{primary:1-a,alternate:a};}
function cycle(reduced=false){let id=null,ready=false,elapsed=0,last=null,locked=null,manual=null;
 return{choose(value){const next=value===0||value===1?value:null;if(manual===next&&locked===null)return;manual=next;locked=null;last=null;},select(next,hasAlt){if(next===id)return;id=next;ready=false;elapsed=0;last=null;locked=null;},ready(value){ready=!!value;last=null;},tick(now,visible=true){if(!visible){last=null;return this.value()}if(last!==null&&ready&&locked===null&&!reduced)elapsed+=Math.max(0,Math.min(.1,(now-last)/1000));last=now;return this.value()},value(){if(manual!==null&&locked===null)return{primary:1-manual,alternate:manual};if(locked!==null)return{primary:1-locked,alternate:locked};return ready&&!reduced?alphas(elapsed):{primary:1,alternate:0}},lock(){locked=this.value().alternate>=.5?1:0;last=null;return locked},resume(){locked=null;last=null;},get id(){return id}};
}
function assets(meta={}){const entries=new Map;
 for(const [id,m] of Object.entries(meta)){const entry={sheets:{},ready:false};entries.set(id,entry);entry.promise=new Promise(resolve=>{const img=new Image;img.onload=()=>{for(const [type,frames] of Object.entries(m.frames))entry.sheets[type]={key:id+'-look2-'+type,image:img,frames,maxH:m.maxH};entry.ready=true;resolve(true)};img.onerror=()=>resolve(false);img.src=m.src;});}
 return{get:(id,type,look)=>look===1?entries.get(id)?.sheets[type]:null,wait:async snapshot=>{for(const side of ['player','opponent']){const pick=snapshot[side];if(pick?.look===1&&!(await entries.get(pick.id)?.promise))return false;}return true}};
}
function preview({stage,getSelection,names={},reduced=false}){
 const side=(cls)=>'<figure class="vs-side '+cls+'"><div class="vs-art"><img alt="" decoding="async"><img alt="" class="vs-alt" decoding="async"><span class="vs-q">?</span></div><figcaption><small></small><b></b></figcaption></figure>';
 stage.innerHTML=side('vs-p1')+'<div class="vs-mark">VS</div>'+side('vs-p2');stage.removeAttribute('aria-hidden');
 const slots={player:{el:stage.querySelector('.vs-p1'),clock:cycle(reduced),token:0},opponent:{el:stage.querySelector('.vs-p2'),clock:cycle(reduced),token:0}};
 const altIds=new Set(['og-jerm','kiana']);let committed=false;
 for(const [sideName,slot]of Object.entries(slots)){slot.side=sideName;const controls=document.createElement('div');controls.className='vs-outfits';controls.setAttribute('role','group');controls.setAttribute('aria-label',(sideName==='player'?'Player 1':'Player 2')+' outfit');slot.controls=controls;slot.buttons=[];
  for(const v of ['auto',0,1]){const b=document.createElement('button');b.type='button';b.dataset.outfit=String(v);b.setAttribute('aria-label',v==='auto'?'Auto-switch outfits':v===0?'Use original outfit':'Use alternate outfit');b.title=b.getAttribute('aria-label');b.onclick=()=>{if(committed||!altIds.has(slot.clock.id))return;slot.manualOutfit=v;slot.clock.choose(v);paint(slot);};controls.appendChild(b);slot.buttons.push(b);}slot.el.querySelector('figcaption').appendChild(controls);
 }

 function paint(slot){const a=slot.clock.value(),imgs=slot.el.querySelectorAll('img');imgs[0].style.opacity=String(a.primary);imgs[1].style.opacity=String(a.alternate);const id=slot.clock.id,selected=slot.manualOutfit??'auto';slot.controls.hidden=!altIds.has(id);slot.buttons.forEach(b=>{const v=b.dataset.outfit==='auto'?'auto':Number(b.dataset.outfit);b.textContent=v==='auto'?'Auto':v===0?(id==='og-jerm'?'Classic':'Original'):(id==='og-jerm'?'Sensei':'Alternate');b.setAttribute('aria-pressed',String(v===selected));b.disabled=committed;});}
 function setSide(slot,id,label,random=false){const el=slot.el,imgs=el.querySelectorAll('img');el.querySelector('small').textContent=label;el.querySelector('b').textContent=random?'Random opponent':names[id]||id;el.classList.toggle('is-random',random);const key=random?'?':id;if(slot.clock.id===key)return;
  slot.manualOutfit='auto';slot.clock.select(key,altIds.has(id));slot.clock.choose(altIds.has(id)?null:0);const token=++slot.token;el.dataset.id=key;el.classList.remove('has-alt','is-in');imgs.forEach(img=>{window.GSIntroArt?.cancel(img);img.onload=null;img.onerror=null;});
  if(random){imgs.forEach(img=>img.removeAttribute('src'));paint(slot);return;}
  const identity=global.Jerm747FighterIdentities?.[id],src='/images/groove-squad/vs/'+id,v=(new Set(["mama-love", "pg", "ronnie", "unk-major", "unk-engineer", "unk-supporter", "john-henry", "chaundra", "wornitha", "dee-dee", "angela", "neese", "kay", "nitabug"]).has(id)?'158':id==='manager'?'118':'95');imgs[0].onerror=()=>{if(token!==slot.token||imgs[0].dataset.retried)return;imgs[0].dataset.retried='1';imgs[0].src=(identity?.portrait||src+'.webp?v='+v)+(identity?'?':'&')+'r='+Date.now();};delete imgs[0].dataset.retried;const fallback=identity?.portrait||src+'.webp?v='+v;if(!window.GSIntroArt?.bind(imgs[0],id,fallback))imgs[0].src=fallback;
  if(altIds.has(id)){let baseReady=imgs[0].complete&&imgs[0].naturalWidth>0,altReady=false;const ready=()=>{if(token!==slot.token)return;if(baseReady&&altReady){slot.clock.ready(true);el.classList.add('has-alt');paint(slot);}};imgs[0].onload=()=>{baseReady=true;ready()};imgs[1].onload=()=>{altReady=true;ready()};imgs[1].onerror=()=>{if(token===slot.token){slot.clock.ready(false);el.classList.remove('has-alt');paint(slot);}};imgs[1].src=src+'-2.webp?v=95';if(imgs[1].complete&&imgs[1].naturalWidth>0){altReady=true;ready();}
  }else imgs[1].removeAttribute('src');el.classList.add('is-in');paint(slot);
 }
 function update(){const s=getSelection();setSide(slots.player,s.chosen,s.humans&&!s.humans[0]?'CPU 1':'Player 1');setSide(slots.opponent,s.opponentChoice,s.humans?(s.humans[1]?'Player 2':'CPU 2'):(s.localTwo?'Player 2':'CPU'),!s.chooseOpponent);}
 function tick(now){for(const slot of Object.values(slots)){slot.clock.tick(now,!document.hidden&&stage.isConnected&&getSelection().screen==='lobby'&&!committed);paint(slot);}requestAnimationFrame(tick);}
 global.addEventListener?.('jerm747-outfit-choice',()=>{if(!committed&&getSelection().screen==='lobby')update();});
 update();requestAnimationFrame(tick);
 function refresh(){for(const slot of Object.values(slots)){const imgs=slot.el.querySelectorAll('img'),id=slot.clock.id;if(!id||id==='?')continue;
  // Rehydrate both sources, including an alternate that went missing while it was visible.
  slot.clock.select(null);
 }update();}

 return{update,refresh,lock(){committed=true;const s=getSelection(),picked={player:{id:s.chosen,look:slots.player.clock.lock()},opponent:s.chooseOpponent?{id:s.opponentChoice,look:slots.opponent.clock.lock()}:null};for(const slot of Object.values(slots))paint(slot);return picked;},resume(){committed=false;for(const slot of Object.values(slots)){slot.manualOutfit='auto';slot.clock.choose(null);slot.clock.resume();paint(slot);}},getState:()=>Object.fromEntries(Object.entries(slots).map(([k,v])=>[k,{id:v.clock.id,...v.clock.value()}]))};
}
global.Jerm747SelectionLooks={alphas,cycle,assets,preview,choice,choose};
if(typeof module!=='undefined')module.exports={alphas,cycle,assets,preview,choice,choose};
})(typeof window!=='undefined'?window:globalThis);
