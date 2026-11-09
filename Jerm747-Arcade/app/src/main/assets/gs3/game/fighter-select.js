/* 1.01B — fingertip P1/P2 slide chooser; fighter artwork and gamepad selection preserved. */
window.createFighterSelect=function({roster,onOpen,onClose,onTitle}){
 const el=document.createElement('section');el.id='fighter-select';el.hidden=true;
 el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','select-title');el.tabIndex=-1;
 el.innerHTML=`<div class="select-top"><div><small>JERM747 / GS FIGHTER III · 1.01B</small><h1 id="select-title">CHOOSE YOUR FIGHTER</h1></div><div class="select-options"><button id="select-touch" type="button">Touch buttons</button><button id="select-title-back" type="button">Title</button></div></div>
 <div class="select-stage"><div class="select-glow left"></div><div class="select-glow right"></div><div class="select-center-fade"></div><span class="select-vs" aria-hidden="true">VS</span>
 <div class="select-figure p1"><div class="select-art" role="img"></div><button class="select-person" data-side="0"><span class="select-player">P1 · YOUR FIGHTER</span><strong></strong><span class="select-person-state"></span></button></div>
 <div class="select-figure p2"><div class="select-art" role="img"></div><button class="select-person" data-side="1"><span class="select-player">P2 · CPU OPPONENT</span><strong></strong><span class="select-person-state"></span></button></div></div>
 <div class="select-dock"><div class="select-nav"><small>BROWSE</small><div><button data-nav="-1" aria-label="Previous fighter">◀</button><button data-nav="1" aria-label="Next fighter">▶</button></div><button id="select-undo">Back</button></div>
 <div class="select-roster-panel"><p class="select-eyebrow">THE MATCHUP</p><h2 id="select-prompt" aria-live="polite">Pick a fighter</h2><p id="select-tip"></p><div class="select-roster" aria-label="Fighter roster"></div><p class="select-count"></p></div>
 <div class="select-confirm"><small>ASSIGN TO</small><button id="select-lock">P1 / P2</button><span>Open player choices</span></div></div>
 <div class="select-bottom"><div class="select-help"><span><b>KEYBOARD</b> Arrows / WASD · Enter or Space</span><span><b>CONTROLLER</b> Left stick: P1 · Right stick: P2</span><span>LB: lock P1 · RB: lock P2 · Start: begin · B / Esc: back</span></div><button id="select-begin" disabled>CHOOSE BOTH FIGHTERS</button><p id="select-connection">Keyboard & touch ready</p></div>
 <div class="select-assign-overlay" hidden><section class="select-assign" role="dialog" aria-modal="true" aria-labelledby="select-assign-title" aria-describedby="select-assign-tip"><small>CHOOSE A PLAYER</small><h2 id="select-assign-title"></h2><p id="select-assign-tip">Tap a circle, or use Left / Right and Enter.</p><div class="select-circles"><button class="select-circle p1" data-assign="0"><b>P1</b><span>Your fighter</span></button><button class="select-circle p2" data-assign="1"><b>P2</b><span>Opponent</span></button></div><button id="select-assign-cancel">Cancel</button></section></div>`;
 document.body.append(el);
 const $=s=>el.querySelector(s),people=[...el.querySelectorAll('[data-side]')],art=[...el.querySelectorAll('.select-art')],circles=[...el.querySelectorAll('[data-assign]')],overlay=$('.select-assign-overlay');
 const base=[...el.children].filter(n=>n!==overlay),svgNS='http://www.w3.org/2000/svg';let artSerial=0;
 let state,isOpen=false,touchOverride=null,connected=false,lastPadSignature='',pads=new Map(),focusBefore=null,inertElements=[],hold=null,suppressClickUntil=0,choiceAnchor=null;
 // Viewports frame the original standing poses. Source image bytes stay unchanged.
 function setArt(host,f,thumb=false){
  const key=f.id+(thumb?':thumb':':full');if(host.dataset.art===key)return;host.dataset.art=key;host.textContent='';
  host.setAttribute('aria-label',f.name+' · original fighter artwork');const p=f.portrait;
  if(!p){const fallback=document.createElement('span');fallback.className='select-art-fallback';fallback.textContent=f.name;host.append(fallback);return;}
  if(p.body){host.classList.add('brush-art');host.style.setProperty('--fighter-color',f.accent||'#ffbe69');
   if(thumb){const im=new Image();im.className='art-head'+(p.rendered?' is-render':'');im.alt='';im.draggable=false;im.src=p.head||p.body;host.append(im);return;}
   const sp=document.createElement('span');sp.className='art-spiral tinted';sp.setAttribute('aria-hidden','true');sp.style.setProperty('--spiral-image',`url("${p.spiral}")`);sp.style.setProperty('--tint',f.energy?.color||p.tint||f.accent);
   const im=new Image();im.className='art-body'+(p.rendered?' is-render':'');im.alt='';im.draggable=false;im.src=p.body;host.append(sp,im);host.setAttribute('aria-label',f.name+(p.rendered?' · rendered from the game model':' · fighter artwork'));return;}
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox',thumb?(p.thumb||p.viewBox):(p.viewBox||`0 0 ${p.width} ${p.height}`));svg.setAttribute('preserveAspectRatio',thumb?'xMidYMin slice':'xMidYMid meet');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const img=document.createElementNS(svgNS,'image');img.setAttribute('href',p.src);img.setAttribute('width',p.width);img.setAttribute('height',p.height);
  if(p.clip&&!thumb){const defs=document.createElementNS(svgNS,'defs'),clip=document.createElementNS(svgNS,'clipPath'),polygon=document.createElementNS(svgNS,'polygon'),id='fighter-art-'+(++artSerial);clip.id=id;polygon.setAttribute('points',p.clip);clip.append(polygon);defs.append(clip);svg.append(defs);img.setAttribute('clip-path',`url(#${id})`);}
  svg.append(img);host.append(svg);
 }
 function haptic(ms=10){if(document.getElementById('haptics')?.checked){try{navigator.vibrate?.(ms);}catch{}}}
 // Capture on the dialog root, which remains interactive when the roster becomes inert.
 function capture(id){try{el.setPointerCapture?.(id);}catch{}}
 function clearHold(){if(!hold)return;const previous=hold;hold=null;clearTimeout(previous.timer);previous.tile?.classList.remove('is-holding');try{if(el.hasPointerCapture?.(previous.id))el.releasePointerCapture(previous.id);}catch{}}
 function placeChoice(anchor){
  if(!anchor)return;const panel=$('.select-assign'),row=$('.select-circles'),bounds=overlay.getBoundingClientRect();
  panel.style.left='0px';panel.style.top='0px';
  const box=panel.getBoundingClientRect(),r=row.getBoundingClientRect(),gap=12;
  const clamp=(v,max)=>Math.max(gap,Math.min(v,Math.max(gap,max-gap)));
  // Put the two circles just above the finger, within the same horizontal slide lane.
  panel.style.left=clamp(anchor.x-bounds.left-box.width/2,bounds.width-box.width)+'px';
  panel.style.top=clamp(anchor.y-bounds.top-12-(r.top-box.top+r.height/2),bounds.height-box.height)+'px';
 }
 function chooseSide(side,pulse=false){
  if(!state.assignment)return;const changed=state.assignment.side!==side;state.chooseSide(side);updateChoice();
  if(pulse&&changed)haptic(8);
 }
 function slideSide(x,y,previous){
  const r=$('.select-circles').getBoundingClientRect();
  if(x<r.left-14||x>r.right+14||y<r.top-20||y>r.bottom+24)return null;
  const mid=(r.left+r.right)/2;
  // A small dead zone prevents vibration chatter from finger jitter at the divider.
  if(Math.abs(x-mid)<=5)return previous;
  return x<mid?0:1;
 }
 function trackSlide(e){
  if(!hold?.opened||!state.assignment)return;
  if(!hold.moved&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)<7)return;
  hold.moved=true;const side=slideSide(e.clientX,e.clientY,hold.hoverSide);
  if(side===hold.hoverSide)return;hold.hoverSide=side;
  if(side!==null){const changed=state.assignment.side!==side;chooseSide(side,true);if(!changed)haptic(8);}
 }
 el.addEventListener('pointermove',e=>{
  if(hold?.id!==e.pointerId)return;
  if(hold.opened){e.preventDefault();trackSlide(e);}
  else if(Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>12)clearHold();
 });
 el.addEventListener('pointerup',e=>{
  if(hold?.id!==e.pointerId)return;const record=hold;
  if(record.opened)trackSlide(e);clearHold();
  if(!record.opened)return;
  e.preventDefault();suppressClickUntil=performance.now()+500;
  if(record.hoverSide!==null)assign(record.hoverSide);
  else if(record.moved)cancelChoice();
  else circles[state.assignment?.side??0].focus({preventScroll:true});
 });
 function cancelPointer(e){if(hold?.id!==e.pointerId)return;const opened=hold.opened;clearHold();if(opened)cancelChoice();}
 el.addEventListener('pointercancel',cancelPointer);el.addEventListener('lostpointercapture',cancelPointer);
 function focusTile(){tiles[state.focus]?.focus({preventScroll:true});}
 function highlight(index){state.highlight(index);update();}
 const tiles=roster.map((f,i)=>{
  const b=document.createElement('button');b.type='button';b.className='select-tile';b.dataset.index=i;b.style.setProperty('--fighter-color',f.accent||'#ffbe69');b.innerHTML='<span class="tile-art"></span><strong></strong><span class="tile-markers"></span>';b.querySelector('strong').textContent=f.name;setArt(b.querySelector('.tile-art'),f,true);
  b.setAttribute('aria-haspopup','dialog');
  b.addEventListener('pointerdown',e=>{
   if(!isOpen||state.assignment||e.button!==0||e.isPrimary===false)return;
   if(hold)return;highlight(i);b.focus({preventScroll:true});b.classList.add('is-holding');haptic(8);
   const record={id:e.pointerId,x:e.clientX,y:e.clientY,tile:b,index:i,opened:false,moved:false,hoverSide:null,timer:0};hold=record;
   record.timer=setTimeout(()=>{if(hold!==record||!isOpen)return;record.opened=true;b.classList.remove('is-holding');suppressClickUntil=performance.now()+700;openChoice(i,state.side,false,{x:record.x,y:record.y});haptic(14);},360);
   capture(e.pointerId);
  });
  b.addEventListener('contextmenu',e=>e.preventDefault());
  b.onclick=e=>{if(!isOpen||performance.now()<suppressClickUntil||state.assignment)return;highlight(i);if(e.detail===0)openChoice(i);};
  b.onfocus=()=>{if(isOpen&&!state.assignment&&state.focus!==i)highlight(i);};
  $('.select-roster').append(b);return b;
 });
 $('.select-count').textContent=roster.length+' FIGHTERS · MIRROR MATCHES AVAILABLE';
 function update(){
  if(!state)return;const ready=state.ready;el.classList.toggle('select-ready',ready);
  people.forEach((p,i)=>{const f=roster[state.cursor[i]];setArt(art[i],f);p.querySelector('strong').textContent=f.name;p.querySelector('.select-person-state').textContent=state.locked[i]?'✓ READY':'NOT ASSIGNED';p.classList.toggle('is-locked',state.locked[i]);p.setAttribute('aria-label','Browse fighters for P'+(i+1)+', '+f.name);});
  $('#select-prompt').textContent=ready?'Your matchup is ready':'Pick a fighter';
  $('#select-tip').textContent=ready?'Hold and slide to change P1 or P2.':'Hold a fighter. Slide to P1 or P2, then release.';
  tiles.forEach((b,i)=>{const owners=[0,1].filter(s=>state.cursor[s]===i);b.classList.toggle('cursor-p1',owners.includes(0)&&state.locked[0]);b.classList.toggle('cursor-p2',owners.includes(1)&&state.locked[1]);b.classList.toggle('is-browsed',i===state.focus);b.setAttribute('aria-label',roster[i].name+(owners.length?', '+owners.map(s=>'P'+(s+1)+(state.locked[s]?' ready':' preview')).join(', '):'')+'. Hold, or press Enter, to choose P1 or P2.');b.querySelector('.tile-markers').textContent=owners.filter(s=>state.locked[s]).map(s=>'P'+(s+1)+' ✓').join('  ')||'HOLD TO CHOOSE';});
  $('#select-begin').disabled=!ready;$('#select-begin').textContent=ready?'FIGHT!  →':'CHOOSE BOTH FIGHTERS';
  if(!state.assignment)tiles[state.focus]?.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 function updateChoice(){if(!state.assignment)return;const {index,side}=state.assignment;$('#select-assign-title').textContent=roster[index].name;circles.forEach((b,i)=>{b.classList.toggle('is-chosen',side===i);b.setAttribute('aria-pressed',String(side===i));b.querySelector('span').textContent=state.locked[i]?'Replace '+roster[state.cursor[i]].name:i===0?'Your fighter':'Opponent';});}
 function openChoice(index=state.focus,side=state.side,clear=true,anchor=null){if(!isOpen)return;if(clear)clearHold();choiceAnchor=anchor;overlay.classList.toggle('is-touch',!!anchor);const panel=$('.select-assign');panel.style.left='';panel.style.top='';state.pick(index,side);overlay.hidden=false;base.forEach(n=>n.inert=true);$('#select-assign-tip').textContent=anchor?'Slide P1 ↔ P2. Release to choose.':'Tap a circle, or use Left / Right and Enter.';updateChoice();placeChoice(anchor);if(clear)circles[state.assignment.side].focus({preventScroll:true});}
 function dismissChoice(){overlay.hidden=true;choiceAnchor=null;base.forEach(n=>n.inert=false);clearHold();update();focusTile();}
 function assign(side){if(state.assign(side)){haptic(14);dismissChoice();}}
 function cancelChoice(){if(state?.cancel())dismissChoice();}
 function setTouch(){const show=touchOverride??!connected;el.classList.toggle('no-touch',!show);$('#select-touch').textContent='Touch buttons: '+(show?'On':'Off');$('#select-touch').setAttribute('aria-pressed',String(show));}
 function browse(delta){clearHold();state.browse(delta);update();focusTile();haptic();}
 function move(side,delta){state.move(side,delta);update();haptic();}
 function confirm(side=state.side){state.confirm(side);update();haptic();}
 function advance(side=null){if(state.ready){commit();return;}confirm(side??state.side);}
 function back(){clearHold();if(state.assignment){cancelChoice();return;}if(state.back()){update();focusTile();}else{close(null);onTitle();}}
 function commit(){if(state.ready&&!state.assignment)close(state.chosen);}
 function close(chosen){if(!isOpen)return;clearHold();state.cancel();overlay.hidden=true;base.forEach(n=>n.inert=false);isOpen=false;el.hidden=true;document.body.classList.remove('select-open');inertElements.forEach(([n,value])=>n.inert=value);pads.clear();onClose(chosen);focusBefore?.focus?.();}
 function open(initial){
  if(isOpen)return;focusBefore=document.activeElement;onOpen();state=new FighterSelectState(roster.map(f=>f.id),initial);isOpen=true;el.hidden=false;document.body.classList.add('select-open');suppressClickUntil=0;
  inertElements=[...document.body.children].filter(n=>n!==el&&n.tagName!=='SCRIPT').map(n=>[n,n.inert]);inertElements.forEach(([n])=>n.inert=true);lastPadSignature=null;pads.clear();update();setTouch();focusTile();
 }
 people.forEach((p,i)=>p.onclick=()=>{state.side=i;highlight(state.cursor[i]);focusTile();});
 circles.forEach((p,i)=>{p.onclick=e=>{if(e.detail===0||performance.now()>=suppressClickUntil)assign(i);};p.onfocus=()=>chooseSide(i);});
 $('.select-circles').addEventListener('pointerdown',e=>{
  if(!state.assignment||hold||e.button!==0||e.isPrimary===false)return;e.preventDefault();
  const target=e.target.closest('[data-assign]'),side=target?Number(target.dataset.assign):null;
  hold={id:e.pointerId,x:e.clientX,y:e.clientY,tile:null,opened:true,moved:false,hoverSide:side,timer:0};
  if(side!==null)chooseSide(side);haptic(8);capture(e.pointerId);
 });
 el.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>browse(Number(b.dataset.nav)));
 $('#select-lock').onclick=()=>openChoice();$('#select-undo').onclick=back;$('#select-begin').onclick=commit;$('#select-assign-cancel').onclick=cancelChoice;
 overlay.addEventListener('click',e=>{if(e.target===overlay&&performance.now()>=suppressClickUntil)cancelChoice();});
 $('#select-title-back').onclick=()=>{close(null);onTitle();};$('#select-touch').onclick=()=>{touchOverride=!(touchOverride??!connected);setTouch();};
 function keyboard(e){
  if(!isOpen)return;const k=e.key.toLowerCase();
  if(k==='tab'){
   e.stopImmediatePropagation();const scope=state.assignment?overlay:el,items=[...scope.querySelectorAll('button:not(:disabled)')].filter(n=>!n.closest('[inert]')&&n.getClientRects().length),first=items[0],last=items[items.length-1];
   if(e.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){e.preventDefault();first?.focus();}return;
  }
  const delta={a:-1,w:-1,arrowleft:-1,arrowup:-1,d:1,s:1,arrowright:1,arrowdown:1}[k];
  if(delta==null&&!['enter',' ','escape','backspace'].includes(k))return;e.stopImmediatePropagation();e.preventDefault();if(e.repeat)return;
  if(k==='escape'||k==='backspace'){back();return;}
  if(state.assignment){if(delta!=null){chooseSide(delta<0?0:1,true);circles[state.assignment.side].focus({preventScroll:true});}else if(document.activeElement===$('#select-assign-cancel'))cancelChoice();else assign(state.assignment.side);return;}
  if(delta!=null){browse(delta);return;}
  const button=document.activeElement?.closest?.('button');if(button&&el.contains(button)&&!button.classList.contains('select-tile'))button.click();else openChoice();
 }
 window.addEventListener('keydown',keyboard,true);window.addEventListener('keyup',e=>{if(isOpen)e.stopImmediatePropagation();},true);
 window.addEventListener('blur',()=>{clearHold();if(isOpen)cancelChoice();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearHold();if(isOpen)cancelChoice();}});
 window.addEventListener('resize',()=>{if(isOpen&&state.assignment){clearHold();placeChoice(choiceAnchor);}});
 function pollGamepads(now){
  let available=[];try{available=Array.from(navigator.getGamepads?.()||[]).filter(Boolean);}catch{}connected=available.length>0;
  const signature=available.map(p=>p.index+':'+p.id).join('|');if(signature!==lastPadSignature||!$('#select-connection').dataset.ready){lastPadSignature=signature;$('#select-connection').dataset.ready='1';setTouch();$('#select-connection').textContent=connected?(available.length>1?'Two controllers · Controller 2 selects P2':'One controller · Left stick P1 / right stick P2'):'Keyboard & touch ready · Connect a controller anytime';}
  const live=new Set();available.forEach((p,index)=>{live.add(p.index);if(!pads.has(p.index)){pads.set(p.index,new FighterMenuPad(p));return;}
   pads.get(p.index).poll(p,now,(event,side,delta)=>{if(!isOpen)return;
    if(state.assignment){if(event==='back')cancelChoice();else if(event==='move'){chooseSide(delta<0?0:1,true);circles[state.assignment.side].focus({preventScroll:true});}else if(event==='confirm')assign(side);else if(event==='advance')assign(side??state.assignment.side);return;}
    clearHold();el.focus({preventScroll:true});if(event==='move')move(side,delta);else if(event==='confirm')confirm(side);else if(event==='advance')advance(side);else if(event==='back')back();else if(event==='start'&&state.ready)commit();
   },index>0,state.side);
  });for(const k of pads.keys())if(!live.has(k))pads.delete(k);
 }
 function tick(dt,now){if(isOpen)pollGamepads(now);}
 return {open,close,tick,get isOpen(){return isOpen;},get state(){return state;}};
};
