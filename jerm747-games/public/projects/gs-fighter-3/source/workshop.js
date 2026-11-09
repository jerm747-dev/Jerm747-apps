(function(){
'use strict';
const roster=window.WORKSHOP_ROSTER, $=s=>document.querySelector(s);
// Every concept keeps one top anchor (Akeem) and one bottom anchor (Cyborg).
const order=['Akeem','Nika','Rokr','Tye','Static','Billie','Major','Cyon','Sheila','Rayburn','Mike','Shadow','Tank','Cyborg'];
const layouts={
 s:{note:'Offset diamonds. A subtle S through the center.',shape:'diamond',points:[[196,37],[160,78],[232,78],[124,119],[196,119],[268,119],[88,160],[160,160],[52,201],[124,201],[196,201],[88,242],[160,242],[124,283]]},
 crest:{note:'A balanced crest, built around the diagonal.',shape:'diamond',points:[[160,32],[144,80],[112,112],[176,112],[80,144],[144,144],[208,144],[112,176],[176,176],[240,176],[144,208],[208,208],[176,240],[160,288]]},
 grid:{note:'Clipped squares. The clearest view of the full roster.',shape:'square',points:[[160,33],[52,96],[124,96],[196,96],[268,96],[52,160],[124,160],[196,160],[268,160],[52,224],[124,224],[196,224],[268,224],[160,287]]}
};
const records=order.map(id=>roster.find(f=>f.id===id)), previews=[...document.querySelectorAll('.fighter-preview')];
let currentLayout='crest',focusIndex=0,preferredSide=0,chosen=['Akeem','Nika'],locked=[false,false],confirmTimers=[0,0],chargeAnimations=[[],[]],matchStarting=false,readyTimer=0,vsAnimation=null;
const byId=id=>roster.find(f=>f.id===id);
function pulse(ms=8){if($('#haptics').checked){try{navigator.vibrate?.(ms);}catch{}}}
// Read fresh controller handles for each confirmation; a single pad serves both slots.
function controllerRumble(side,kind='select'){
 if(!$('#haptics').checked||document.hidden)return;
 try{
  const pads=Array.from(navigator.getGamepads?.()||[]).filter(p=>p&&p.connected);
  const pad=pads[side]||(pads.length===1?pads[0]:null);if(!pad)return;
  const actuator=[pad.vibrationActuator,...(pad.hapticActuators||[])].find(a=>a&&(typeof a.playEffect==='function'||typeof a.pulse==='function'));if(!actuator)return;
  const ready=kind==='ready',duration=ready?170:95,strongMagnitude=ready ? .65 : .3,weakMagnitude=ready ? .85 : .55;
  const effect=typeof actuator.playEffect==='function'?actuator.playEffect('dual-rumble',{startDelay:0,duration,strongMagnitude,weakMagnitude}):actuator.pulse(ready ? .7 : .45,duration);
  Promise.resolve(effect).catch(()=>{});
 }catch{} // Disconnected, blocked, or unsupported hardware must never interrupt selection.
}
function renderPortrait(side,id){const f=byId(id),p=previews[side],img=p.querySelector('.body-art');if(img.dataset.id!==id){img.src=f.portrait.body;img.dataset.id=id;img.alt=f.name+' full-body fighter portrait';p.style.setProperty('--energy',f.energy.color);p.style.setProperty('--spiral',`url("${f.portrait.spiral}")`);}p.querySelector('strong').textContent=f.name.toUpperCase();p.classList.toggle('is-ready',locked[side]);p.querySelector('.fighter-name').classList.toggle('ready',locked[side]);p.querySelector('small').textContent=locked[side]?'✓ Ready':'Choose a fighter';}
function render(){const both=locked.every(Boolean);$('#ready-button').disabled=!both||matchStarting;$('#workshop').classList.toggle('match-ready',both);chosen.forEach((id,side)=>{renderPortrait(side,id);$('#versus-stamp').style.setProperty('--vs-p'+(side+1),byId(id).energy.color);});tiles.forEach((t,i)=>{const owners=[0,1].filter(side=>locked[side]&&chosen[side]===records[i].id);t.dataset.owner=owners.join('');t.querySelector('.tile-owners').textContent=owners.map(x=>'P'+(x+1)).join(' / ');t.classList.toggle('is-focus',focusIndex===i);t.setAttribute('aria-label',records[i].name+(owners.length?', assigned to '+owners.map(x=>'player '+(x+1)).join(' and '):'')+'. Tap, hold, or press Enter to assign.');});$('#browsed-name').textContent=records[focusIndex].name.toUpperCase();$('.caption-help').textContent=locked.some(Boolean)?'Next tap → P'+(preferredSide+1):'Tap / hold to assign';$('#match-status').textContent=locked.every(Boolean)?`${chosen[0]} vs ${chosen[1]} · Ready`:locked.some(Boolean)?`P${locked[0]?1:2} ready · Choose P${locked[0]?2:1}`:'Build your matchup';}
function browse(i,moveFocus=false){focusIndex=(i+records.length)%records.length;tiles.forEach((t,j)=>{t.classList.toggle('is-focus',j===focusIndex);t.tabIndex=j===focusIndex?0:-1;});$('#browsed-name').textContent=records[focusIndex].name.toUpperCase();if(moveFocus)tiles[focusIndex].focus({preventScroll:true});}
// The idle sheen is CSS-driven on a shared timeline; selection never restarts it.
function chargePortrait(side){
 const brush=previews[side].querySelector('.spiral'),charge=brush.querySelector('.brush-charge');
 chargeAnimations[side].forEach(a=>a.cancel());chargeAnimations[side]=[];
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!brush.animate)return;
 chargeAnimations[side]=[
  brush.animate([{transform:'scale(.97)',offset:0},{transform:'scale(1.045)',offset:.17},{transform:'scale(1)',offset:1}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'}),
  charge.animate([{opacity:0,offset:0},{opacity:.9,offset:.12},{opacity:.38,offset:.3},{opacity:0,offset:1}],{duration:620,easing:'ease-out'})
 ];
}
function commit(index,side,kind='select'){if(matchStarting)return;chosen[side]=records[index].id;locked[side]=true;preferredSide=1-side;render();chargePortrait(side);if(locked.every(Boolean))flashVersus();controllerRumble(side,kind);previews[side].classList.add('is-confirmed');clearTimeout(confirmTimers[side]);confirmTimers[side]=setTimeout(()=>previews[side].classList.remove('is-confirmed'),240);}
// SVG feedback only reports real pointer coordinates; it never moves on its own.
function createTrace(){
 const svg=$('#touch-trace'),tail=$('#trace-tail'),halo=$('#trace-halo'),dot=$('#trace-dot'),ns='http://www.w3.org/2000/svg';
 const nodes=Array.from({length:8},()=>{const n=document.createElementNS(ns,'circle');tail.append(n);return n;});let points=[],last=null,raf=0,hideTimer=0;
 const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function frame(now){raf=0;points=points.filter(p=>now-p.t<180);nodes.forEach((n,i)=>{const p=points[i];if(!p||reduce()){n.setAttribute('opacity','0');return;}n.setAttribute('cx',p.x);n.setAttribute('cy',p.y);n.setAttribute('r',String(1.3+i*.16));n.setAttribute('opacity',String(Math.max(0,1-(now-p.t)/180)*.38));});if(points.length)raf=requestAnimationFrame(frame);}
 return {point(x,y,side=null){clearTimeout(hideTimer);const t=performance.now();if(last&&Math.hypot(x-last.x,y-last.y)>1.5){points.push({...last,t});points=points.slice(-8);}last={x,y};for(const n of [halo,dot]){n.setAttribute('cx',x);n.setAttribute('cy',y);}svg.style.setProperty('--trace-color',side===1?'#b594ee':'#efd080');svg.classList.add('visible');if(!raf)raf=requestAnimationFrame(frame);},fade(){clearTimeout(hideTimer);hideTimer=setTimeout(()=>svg.classList.remove('visible'),130);},hide(){clearTimeout(hideTimer);svg.classList.remove('visible');points=[];last=null;nodes.forEach(n=>n.setAttribute('opacity','0'));},get position(){return last;}};
}
const trace=createTrace();
class TouchChoice{
 constructor(){this.layer=$('#choice-layer');this.panel=$('#touch-choice');this.buttons=[...this.panel.querySelectorAll('[data-player]')];this.opened=false;this.active=null;this.index=0;this.side=null;this.anchor=null;this.idle=0;this.fade=0;this.hover=false;this.suppressUntil=0;this.lastFocus=null;this.committed=false;
  this.buttons.forEach((b,i)=>b.addEventListener('click',e=>{if(e.detail===0&&this.opened){this.select(i);this.confirm();this.arm();}}));
  this.panel.addEventListener('pointerdown',e=>{if(!this.opened||this.active||e.isPrimary===false||e.button!==0)return;e.preventDefault();this.keep();this.active={id:e.pointerId,x:e.clientX,y:e.clientY,opened:true,index:this.index,moved:false,timer:0};this.select(this.hit(e.clientX,e.clientY,this.side),false);trace.point(e.clientX,e.clientY,this.side);pulse();this.capture(e.pointerId);});
  this.layer.addEventListener('pointerdown',e=>{if(e.target===this.layer&&e.isPrimary!==false&&!this.active){e.preventDefault();this.close();}});
  window.addEventListener('pointerdown',e=>{if(this.opened&&this.committed&&!this.panel.contains(e.target))this.close(true);},true);
  window.addEventListener('pointermove',e=>this.move(e),{passive:false});window.addEventListener('pointerup',e=>this.up(e));window.addEventListener('pointercancel',e=>this.cancelPointer(e));window.addEventListener('lostpointercapture',e=>this.cancelPointer(e));
  window.addEventListener('blur',()=>this.close(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)this.close(true);});window.addEventListener('resize',()=>{this.clearActive();if(this.opened){this.position();this.arm();}});
 }
 capture(id){try{document.documentElement.setPointerCapture?.(id);}catch{}}
 clearActive(){const a=this.active;this.active=null;if(!a)return;clearTimeout(a.timer);tiles[a.index]?.classList.remove('is-holding');try{if(document.documentElement.hasPointerCapture?.(a.id))document.documentElement.releasePointerCapture(a.id);}catch{}}
 start(e,index){if(this.opened||this.active||e.isPrimary===false||e.button!==0)return;e.preventDefault();browse(index);this.lastFocus=tiles[index];tiles[index].focus({preventScroll:true});tiles[index].classList.add('is-holding');pulse();trace.point(e.clientX,e.clientY);this.active={id:e.pointerId,index,x:e.clientX,y:e.clientY,opened:false,moved:false,timer:0};const a=this.active;a.timer=setTimeout(()=>{if(this.active!==a)return;a.opened=true;tiles[index].classList.remove('is-holding');this.open(index,{x:a.x,y:a.y});pulse(12);},300);this.capture(e.pointerId);}
 open(index,anchor=null){this.keep();this.opened=true;this.committed=false;this.layer.classList.remove('allows-roster');this.panel.setAttribute('aria-modal','true');this.index=index;this.side=null;this.anchor=anchor;this.hover=false;this.lastFocus=tiles[index];this.layer.hidden=false;this.panel.setAttribute('aria-label','Assign '+records[index].name+' to P1 or P2');$('#workshop').inert=true;this.buttons.forEach(b=>b.setAttribute('aria-pressed','false'));this.position();if(!anchor){this.select(preferredSide,false);this.buttons[preferredSide].focus({preventScroll:true});}else this.panel.focus({preventScroll:true});}
 position(){const r=this.panel.getBoundingClientRect(),w=window.innerWidth,h=window.innerHeight,a=this.anchor||{x:w/2,y:h/2};const clamp=(v,max)=>Math.max(10,Math.min(v,max-10));this.panel.style.left=clamp(a.x-r.width/2,w-r.width)+'px';this.panel.style.top=clamp(a.y-r.height/2-6,h-r.height)+'px';}
 hit(x,y,previous=null){const r=this.panel.getBoundingClientRect();if(x<r.left+4||x>r.right-4||y<r.top-12||y>r.bottom+12)return null;const mid=(r.left+r.right)/2;if(Math.abs(x-mid)<5)return previous;return x<mid?0:1;}
 select(side,buzz=true){if(!this.opened||side===null||side===this.side)return;this.side=side;this.buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===side)));if(buzz)pulse(8);}
 move(e){const a=this.active;if(a&&a.id===e.pointerId){e.preventDefault();trace.point(e.clientX,e.clientY,this.side);if(!a.opened){if(Math.hypot(e.clientX-a.x,e.clientY-a.y)>12){this.clearActive();trace.fade();}return;}this.keep();if(Math.hypot(e.clientX-a.x,e.clientY-a.y)>5)a.moved=true;if(a.moved)this.select(this.hit(e.clientX,e.clientY,this.side));return;}
  if(!this.opened||e.pointerType==='touch'||e.buttons)return;const side=this.hit(e.clientX,e.clientY,this.side);const inside=side!==null;if(inside){this.hover=true;this.keep();this.select(side);trace.point(e.clientX,e.clientY,this.side);}else if(this.hover){this.hover=false;trace.fade();this.arm();}
 }
 up(e){const a=this.active;if(!a||a.id!==e.pointerId)return;const opened=a.opened;this.clearActive();this.suppressUntil=performance.now()+600;if(!opened){e.preventDefault();if(locked.some(Boolean)){const side=preferredSide;commit(a.index,side);pulse(12);trace.point(e.clientX,e.clientY,side);}else{this.open(a.index,{x:a.x,y:a.y});this.arm();}trace.fade();return;}e.preventDefault();trace.point(e.clientX,e.clientY,this.side);if(a.moved)this.select(this.hit(e.clientX,e.clientY,this.side));const side=this.hit(e.clientX,e.clientY,this.side);if(side!==null&&this.side!==null)this.confirm();else if(a.moved){this.close();return;}this.hover=e.pointerType==='mouse'&&side!==null;trace.fade();this.arm();}
 confirm(){if(!this.opened||this.side===null)return;commit(this.index,this.side);pulse(12);this.committed=true;this.layer.classList.add('allows-roster');this.panel.setAttribute('aria-modal','false');$('#workshop').inert=false;this.keep();}
 keep(){clearTimeout(this.idle);clearTimeout(this.fade);this.layer.classList.remove('is-leaving');}
 arm(){this.keep();if(!this.opened||this.active||this.hover)return;this.idle=setTimeout(()=>this.close(),4000);}
 close(immediate=false){this.clearActive();this.keep();this.hover=false;trace.fade();if(!this.opened){trace.hide();return;}const finish=()=>{this.opened=false;this.committed=false;this.layer.hidden=true;this.layer.classList.remove('allows-roster');this.layer.classList.remove('is-leaving');$('#workshop').inert=false;trace.hide();this.lastFocus?.focus({preventScroll:true});};if(immediate){finish();return;}this.layer.classList.add('is-leaving');this.fade=setTimeout(finish,280);}
 cancelPointer(e){if(this.active?.id===e.pointerId)this.close(true);}
}
const touch=new TouchChoice();
const tiles=records.map((f,i)=>{const b=document.createElement('button');b.type='button';b.className='fighter-tile';b.dataset.id=f.id;b.style.setProperty('--accent',f.accent);b.setAttribute('aria-haspopup','dialog');b.tabIndex=i===0?0:-1;b.innerHTML='<span class="tile-frame"><span class="tile-face"><img alt="" draggable="false"></span><span class="tile-label"></span></span><span class="tile-owners"></span>';b.querySelector('img').src=f.portrait.head;if(f.portrait.headFromBody)b.querySelector('img').classList.add('clean-head');b.querySelector('.tile-label').textContent=f.name;b.addEventListener('pointerdown',e=>touch.start(e,i));b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('focus',()=>{if(!touch.opened)browse(i);});b.addEventListener('click',e=>{if(e.detail===0&&!touch.opened&&performance.now()>touch.suppressUntil){browse(i);touch.open(i);}});$('#matrix').append(b);return b;});
function setLayout(key){if(!layouts[key])return;touch.close(true);currentLayout=key;$('#arena').dataset.layout=key;layouts[key].points.forEach(([x,y],i)=>{tiles[i].style.setProperty('--x',x);tiles[i].style.setProperty('--y',y);});document.querySelectorAll('[data-layout]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.layout===key));});$('#concept-note').textContent=layouts[key].note;}
document.querySelectorAll('.concepts button').forEach(b=>b.onclick=()=>setLayout(b.dataset.layout));
document.querySelectorAll('[data-random-side]').forEach(b=>b.onclick=()=>{const side=Number(b.dataset.randomSide),pool=records.filter(f=>f.id!==chosen[side]),f=pool[Math.floor(Math.random()*pool.length)];commit(order.indexOf(f.id),side);browse(order.indexOf(f.id));pulse(12);});
document.querySelectorAll('[data-preview-side]').forEach(b=>b.onclick=()=>{const side=Number(b.dataset.previewSide),index=order.indexOf(chosen[side]);if(locked[side]){commit(index,side,'ready');pulse(20);}else{preferredSide=side;render();}browse(index,true);});
function flashVersus(){
 const stamp=$('#versus-stamp');vsAnimation?.cancel();
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!stamp.animate)return;
 const colors=chosen.map(id=>byId(id).energy.color);
 vsAnimation=stamp.animate([{filter:'brightness(1)',transform:'scale(.94)'},{filter:`brightness(1.7) drop-shadow(0 0 10px ${colors[0]}99) drop-shadow(0 0 16px ${colors[1]}77)`,transform:'scale(1.08)',offset:.22},{filter:'brightness(1)',transform:'scale(1)'}],{duration:540,easing:'ease-out'});
}
function beginMatch(){
 if(matchStarting||!locked.every(Boolean))return;
 const fighters=[...chosen],haptics=$('#haptics').checked;
 matchStarting=true;touch.close(true);render();$('#workshop').inert=true;
 $('#ready-matchup').textContent=fighters.join('  VS  ');$('#ready-transition').hidden=false;
 chargePortrait(0);chargePortrait(1);flashVersus();pulse(28);controllerRumble(0,'ready');controllerRumble(1,'ready');
 const params=new URLSearchParams({skipintro:'1',skipselect:'1',crest:'1',p1:fighters[0],p2:fighters[1],haptics:haptics?'1':'0',mode:new URLSearchParams(location.search).get('mode')==='training'?'training':'arcade'});
 const url='game/index.html?'+params.toString();
 readyTimer=setTimeout(()=>{const event=new CustomEvent('gsfighter:launch',{cancelable:true,detail:{fighters,haptics,url}});if(window.dispatchEvent(event))window.GSFLoading.navigate(url);},window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?120:650);
}
const readyButton=$('#ready-button');let readyPointer=null,readySuppressUntil=0;
function clearReadyPointer(){const id=readyPointer;readyPointer=null;readyButton.classList.remove('is-pressed');try{if(id!==null&&readyButton.hasPointerCapture?.(id))readyButton.releasePointerCapture(id);}catch{}trace.fade();}
readyButton.addEventListener('pointerdown',e=>{if(readyButton.disabled||readyPointer!==null||e.isPrimary===false||e.button!==0)return;e.preventDefault();readyPointer=e.pointerId;readyButton.focus({preventScroll:true});readyButton.classList.add('is-pressed');trace.point(e.clientX,e.clientY);pulse();try{readyButton.setPointerCapture?.(e.pointerId);}catch{}});
window.addEventListener('pointermove',e=>{if(readyPointer===e.pointerId){e.preventDefault();trace.point(e.clientX,e.clientY);}},{passive:false});
window.addEventListener('pointerup',e=>{if(readyPointer!==e.pointerId)return;const r=readyButton.getBoundingClientRect(),inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;e.preventDefault();readySuppressUntil=performance.now()+600;clearReadyPointer();if(inside)beginMatch();});
for(const type of ['pointercancel','lostpointercapture'])window.addEventListener(type,e=>{if(readyPointer===e.pointerId)clearReadyPointer();});
readyButton.addEventListener('click',e=>{if(e.detail===0||performance.now()>readySuppressUntil)beginMatch();});
window.addEventListener('blur',clearReadyPointer);
window.addEventListener('pageshow',e=>{if(e.persisted){clearTimeout(readyTimer);matchStarting=false;$('#ready-transition').hidden=true;$('#workshop').inert=false;render();}});

function spatialNeighbor(dx,dy){const pts=layouts[currentLayout].points,p=pts[focusIndex];let best=focusIndex,score=Infinity;pts.forEach((q,i)=>{const x=q[0]-p[0],y=q[1]-p[1],forward=x*dx+y*dy;if(forward<=0)return;const lateral=Math.abs(x*dy-y*dx),s=Math.hypot(x,y)+lateral*1.3;if(s<score){score=s;best=i;}});return best;}
window.addEventListener('keydown',e=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],a:[-1,0],d:[1,0],w:[0,-1],s:[0,1]};if(touch.opened&&touch.committed&&!touch.panel.contains(document.activeElement))touch.close(true);if(touch.opened){if(e.key==='Tab'){e.preventDefault();touch.keep();const next=document.activeElement===touch.buttons[0]?1:0;touch.buttons[next].focus();return;}if(e.key==='Escape'){e.preventDefault();touch.close();return;}if(keys[e.key]){e.preventDefault();touch.keep();touch.select(keys[e.key][0]<0||keys[e.key][1]<0?0:1);return;}if(e.key==='Enter'||e.key===' '){e.preventDefault();if(e.repeat)return;touch.select(touch.side??preferredSide);touch.confirm();touch.arm();}return;}if(!tiles.includes(document.activeElement))return;if(keys[e.key]){e.preventDefault();browse(spatialNeighbor(...keys[e.key]),true);}else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)touch.open(focusIndex);}});
const returnParams=new URLSearchParams(location.search);if(order.includes(returnParams.get('p1'))&&order.includes(returnParams.get('p2'))){chosen=[returnParams.get('p1'),returnParams.get('p2')];locked=/^[01]{2}$/.test(returnParams.get('locks')||'')?[...returnParams.get('locks')].map(v=>v==='1'):[true,true];}if(returnParams.has('haptics'))$('#haptics').checked=returnParams.get('haptics')!=='0';const requestedLayout=returnParams.get('layout');setLayout(layouts[requestedLayout]?requestedLayout:'crest');render();
// Small read-only surface for deterministic input tests and integration.
window.GSMatrixWorkshop={layouts,get state(){return {layout:currentLayout,chosen:[...chosen],locked:[...locked],focus:focusIndex,nextSide:preferredSide,starting:matchStarting,open:touch.opened,side:touch.side};},touch,trace};
})();

// Shared production options; the matchup survives the round trip.
document.getElementById('select-title').onclick=()=>window.GSFLoading.navigate('game/index.html');
document.getElementById('select-options').onclick=()=>{const q=new URLSearchParams({menu:'options',return:'select',p1:GSMatrixWorkshop.state.chosen[0],p2:GSMatrixWorkshop.state.chosen[1],layout:GSMatrixWorkshop.state.layout,locks:GSMatrixWorkshop.state.locked.map(Number).join(''),mode:new URLSearchParams(location.search).get('mode')||'arcade'});window.GSFLoading.navigate('game/index.html?'+q);};
if(new URLSearchParams(location.search).get('mode')==='training'){document.querySelector('.edition').textContent='TRAINING / CHOOSE YOUR DUMMY';}
