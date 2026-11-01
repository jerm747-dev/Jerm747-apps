/* v0.36 — 3D brush artwork, tap P1 / hold-slide P2 and independent gamepad cursors. */
window.createFighterSelect=function({roster,onOpen,onClose,onTitle}){
 const el=document.createElement('section');el.id='fighter-select';el.hidden=true;
 el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','select-title');el.tabIndex=-1;
 el.innerHTML=`<div class="select-top"><div><small>JERM747 / GS FIGHTER III</small><h1 id="select-title">CHOOSE YOUR FIGHTERS</h1></div><div class="select-options"><button id="select-touch" type="button">Touch buttons</button><button id="select-title-back" type="button">Title</button></div></div>
 <div class="select-stage"><div class="select-glow left"></div><div class="select-glow right"></div><div class="select-center-fade"></div><span class="select-vs" aria-hidden="true">VS</span>
 <div class="select-figure p1"><div class="select-art" role="img"></div><button class="select-person" data-side="0"><span class="select-player">P1 · YOUR FIGHTER</span><strong></strong><span class="select-person-state"></span></button></div>
 <div class="select-figure p2"><div class="select-art" role="img"></div><button class="select-person" data-side="1"><span class="select-player">P2 · OPPONENT</span><strong></strong><span class="select-person-state"></span></button></div></div>
 <div class="select-dock"><div class="select-nav"><small>BROWSE</small><div><button data-nav="-1" aria-label="Previous fighter">◀</button><button data-nav="1" aria-label="Next fighter">▶</button></div><button id="select-undo">Back</button></div>
 <div class="select-roster-panel"><p class="select-eyebrow">THE MATCHUP</p><h2 id="select-prompt" aria-live="polite">Pick a fighter</h2><p id="select-tip"></p><div class="select-roster" aria-label="Fighter roster"></div><p class="select-count"></p></div>
 <div class="select-confirm"><small>ASSIGN TO</small><button id="select-lock">P1 / P2</button><span>Open player choices</span></div></div>
 <div class="select-bottom"><div class="select-help"><span><b>KEYBOARD</b> Arrows / WASD · Enter or Space</span><span><b>CONTROLLER</b> Left stick: P1 · Right stick: P2</span><span>LB: lock P1 · RB: lock P2 · Start: begin · B / Esc: back</span></div><button id="select-begin" disabled>CHOOSE BOTH FIGHTERS</button><p id="select-connection">Keyboard & touch ready</p></div>
 <div class="select-player-popover" id="select-player-popover" role="group" aria-label="Assign fighter to player" hidden><button class="select-circle p1" data-assign="0" aria-label="Assign to P1">P1</button><button class="select-circle p2" data-assign="1" aria-label="Assign to P2">P2</button></div>`;
 document.body.append(el);
 const $=s=>el.querySelector(s),people=[...el.querySelectorAll('[data-side]')],art=[...el.querySelectorAll('.select-art')],circles=[...el.querySelectorAll('[data-assign]')],overlay=$('.select-player-popover');
 const svgNS='http://www.w3.org/2000/svg';let artSerial=0;
 let state,isOpen=false,touchOverride=null,connected=false,lastPadSignature='',pads=new Map(),focusBefore=null,inertElements=[],hold=null,suppressClickUntil=0;
 // Separate generated body and head images preserve the full pose and a clear thumbnail.
 function setArt(host,f,thumb=false){
  const key=f.id+(thumb?':thumb':':full');if(host.dataset.art===key)return;host.dataset.art=key;host.textContent='';
  host.setAttribute('aria-label',f.name+' · 3D brush artwork');const p=thumb?(f.headshot||f.portrait):f.portrait;
  if(!p){const fallback=document.createElement('span');fallback.className='select-art-fallback';fallback.textContent=f.name;host.append(fallback);return;}
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox',(thumb&&p.thumb)||p.viewBox||`0 0 ${p.width} ${p.height}`);svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const img=document.createElementNS(svgNS,'image');img.setAttribute('href',p.src);img.setAttribute('width',p.width);img.setAttribute('height',p.height);
  if(p.clip&&!thumb){const defs=document.createElementNS(svgNS,'defs'),clip=document.createElementNS(svgNS,'clipPath'),polygon=document.createElementNS(svgNS,'polygon'),id='fighter-art-'+(++artSerial);clip.id=id;polygon.setAttribute('points',p.clip);clip.append(polygon);defs.append(clip);svg.append(defs);img.setAttribute('clip-path',`url(#${id})`);}
  svg.append(img);if(!thumb&&f.spiral){const spiral=document.createElement('img');spiral.className='select-spiral';spiral.src=f.spiral;spiral.alt='';spiral.setAttribute('aria-hidden','true');host.append(spiral);}host.append(svg);
 }
 function haptic(ms=10){if(document.getElementById('haptics')?.checked)navigator.vibrate?.(ms);}
 function clearHold(){if(!hold)return;clearTimeout(hold.timer);hold.tile.classList.remove('is-holding');hold=null;}
 function focusTile(){tiles[state.focus]?.focus({preventScroll:true});}
 function highlight(index){state.highlight(index);update();}
 const tiles=roster.map((f,i)=>{
  const b=document.createElement('button');b.type='button';b.className='select-tile';b.dataset.index=i;b.style.setProperty('--fighter-color',f.accent||'#ffbe69');b.innerHTML='<span class="tile-art"></span><strong></strong><span class="tile-markers"></span>';b.querySelector('strong').textContent=f.name;setArt(b.querySelector('.tile-art'),f,true);
  b.setAttribute('aria-controls','select-player-popover');b.setAttribute('aria-expanded','false');
  b.addEventListener('pointerdown',e=>{
   if(!isOpen||e.button!==0||e.isPrimary===false)return;
   if(state.assignment)cancelChoice(false);clearHold();highlight(i);b.focus({preventScroll:true});b.classList.add('is-holding');
   const record={id:e.pointerId,tile:b,index:i,timer:0,gesture:new FighterTileGesture(e.clientX,e.clientY)};hold=record;
   record.timer=setTimeout(()=>{if(hold!==record||!isOpen||!record.gesture.open())return;b.classList.remove('is-holding');openChoice(i,0,false);haptic(12);},320);
   b.setPointerCapture?.(e.pointerId);
  });
  b.addEventListener('pointermove',e=>{
   if(hold?.id!==e.pointerId)return;const g=hold.gesture;g.move(e.clientX,e.clientY);
   if(g.cancelled){if(state.assignment)cancelChoice(false);clearHold();suppressClickUntil=performance.now()+400;return;}
   if(g.opened){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-assign]');if(target&&overlay.contains(target))g.side=Number(target.dataset.assign);if(state.assignment.side!==g.side){state.chooseSide(g.side);updateChoice();haptic(7);}overlay.classList.toggle('is-outside',!g.inside);}
  });
  b.addEventListener('pointerup',e=>{
   if(hold?.id!==e.pointerId)return;const record=hold,target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-assign]'),explicit=target&&overlay.contains(target)?Number(target.dataset.assign):undefined,side=record.gesture.release(e.clientX,e.clientY,explicit);clearHold();suppressClickUntil=performance.now()+500;
   if(side===null){cancelChoice(false);return;}
   if(!state.assignment)state.pick(record.index,side);assign(side,false);
  });
  b.addEventListener('pointercancel',()=>{clearHold();cancelChoice(false);suppressClickUntil=performance.now()+500;});
  b.addEventListener('lostpointercapture',()=>{if(hold){clearHold();cancelChoice(false);}});
  b.addEventListener('contextmenu',e=>e.preventDefault());
  b.onclick=e=>{if(!isOpen||performance.now()<suppressClickUntil)return;if(e.detail===0){highlight(i);openChoice(i,0);}else{state.pick(i,0);assign(0,false);}};
  b.onfocus=()=>{if(isOpen&&!state.assignment&&state.focus!==i)highlight(i);};
  $('.select-roster').append(b);return b;
 });
 $('.select-count').textContent=roster.length+' FIGHTERS · MIRROR MATCHES AVAILABLE';
 function update(){
  if(!state)return;const ready=state.ready;el.classList.toggle('select-ready',ready);
  people.forEach((p,i)=>{const f=roster[state.cursor[i]];setArt(art[i],f);p.querySelector('strong').textContent=f.name;p.querySelector('.select-person-state').textContent=state.locked[i]?'✓ READY':'NOT ASSIGNED';p.classList.toggle('is-locked',state.locked[i]);p.setAttribute('aria-label','Browse fighters for P'+(i+1)+', '+f.name);});
  $('#select-prompt').textContent=ready?'Your matchup is ready':'Pick a fighter';
  $('#select-tip').textContent='Tap: P1 · Hold & slide right: P2';
  tiles.forEach((b,i)=>{const owners=[0,1].filter(s=>state.cursor[s]===i);b.classList.toggle('cursor-p1',owners.includes(0)&&state.locked[0]);b.classList.toggle('cursor-p2',owners.includes(1)&&state.locked[1]);b.classList.toggle('is-browsed',i===state.focus);b.setAttribute('aria-label',roster[i].name+(owners.length?', '+owners.map(s=>'P'+(s+1)+(state.locked[s]?' ready':' preview')).join(', '):'')+'. Tap for P1; hold and slide right for P2; Enter for player choices.');b.querySelector('.tile-markers').textContent=owners.filter(s=>state.locked[s]).map(s=>'P'+(s+1)+' ✓').join('  ')||'TAP P1 · HOLD P2';});
  $('#select-begin').disabled=!ready;$('#select-begin').textContent=ready?'ENTER FIGHTER LAB  →':'CHOOSE BOTH FIGHTERS';
  if(!state.assignment)tiles[state.focus]?.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 function placeChoice(){
  if(!state.assignment)return;const tile=tiles[state.assignment.index],a=tile.getBoundingClientRect(),bounds=el.getBoundingClientRect(),w=120,h=62;
  // Popover is outside the scrolling roster so it stays unclipped above its tile.
  overlay.style.left=Math.max(8,Math.min(bounds.width-w-8,a.left-bounds.left+a.width/2-w/2))+'px';
  overlay.style.top=Math.max(8,a.top-bounds.top-h-8)+'px';
 }
 function updateChoice(){if(!state.assignment)return;const {index,side}=state.assignment;overlay.setAttribute('aria-label',roster[index].name+' · choose P1 or P2');circles.forEach((b,i)=>{b.classList.toggle('is-chosen',side===i);b.setAttribute('aria-pressed',String(side===i));});}
 function openChoice(index=state.focus,side=0,clear=true){if(!isOpen)return;if(clear)clearHold();state.pick(index,side);overlay.hidden=false;overlay.classList.remove('is-outside');tiles.forEach((b,i)=>b.setAttribute('aria-expanded',String(i===index)));placeChoice();updateChoice();if(clear)circles[side].focus({preventScroll:true});}
 function dismissChoice(focus=true){overlay.hidden=true;tiles.forEach(b=>b.setAttribute('aria-expanded','false'));clearHold();update();if(focus)focusTile();}
 function assign(side,focus=true){if(state.assign(side)){haptic();dismissChoice(focus);}}
 function cancelChoice(focus=true){if(state?.cancel())dismissChoice(focus);}
 function setTouch(){const show=touchOverride??!connected;el.classList.toggle('no-touch',!show);$('#select-touch').textContent='Touch buttons: '+(show?'On':'Off');$('#select-touch').setAttribute('aria-pressed',String(show));}
 function browse(delta){clearHold();state.browse(delta);update();focusTile();haptic();}
 function move(side,delta){state.move(side,delta);update();haptic();}
 function confirm(side=state.side){state.confirm(side);update();haptic();}
 function advance(side=null){if(state.ready){commit();return;}confirm(side??state.side);}
 function back(){clearHold();if(state.assignment){cancelChoice();return;}if(state.back()){update();focusTile();}else{close(null);onTitle();}}
 function commit(){if(state.ready&&!state.assignment)close(state.chosen);}
 function close(chosen){if(!isOpen)return;clearHold();state.cancel();overlay.hidden=true;isOpen=false;el.hidden=true;document.body.classList.remove('select-open');inertElements.forEach(([n,value])=>n.inert=value);pads.clear();onClose(chosen);focusBefore?.focus?.();}
 function open(initial){
  if(isOpen)return;focusBefore=document.activeElement;onOpen();state=new FighterSelectState(roster.map(f=>f.id),initial);isOpen=true;el.hidden=false;document.body.classList.add('select-open');suppressClickUntil=0;
  inertElements=[...document.body.children].filter(n=>n!==el&&n.tagName!=='SCRIPT').map(n=>[n,n.inert]);inertElements.forEach(([n])=>n.inert=true);lastPadSignature=null;pads.clear();update();setTouch();focusTile();
 }
 people.forEach((p,i)=>p.onclick=()=>{state.side=i;highlight(state.cursor[i]);focusTile();});
 circles.forEach((p,i)=>{p.onclick=()=>assign(i);p.onfocus=()=>{if(state.assignment){state.chooseSide(i);updateChoice();}};});
 el.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>browse(Number(b.dataset.nav)));
 $('#select-lock').onclick=()=>openChoice();$('#select-undo').onclick=back;$('#select-begin').onclick=commit;
 document.addEventListener('pointerdown',e=>{if(isOpen&&state.assignment&&!overlay.contains(e.target)&&!tiles[state.assignment.index].contains(e.target))cancelChoice(false);},true);
 window.addEventListener('resize',()=>{clearHold();cancelChoice(false);});$('.select-roster').addEventListener('scroll',()=>{if(state?.assignment){clearHold();cancelChoice(false);}});
 $('#select-title-back').onclick=()=>{close(null);onTitle();};$('#select-touch').onclick=()=>{touchOverride=!(touchOverride??!connected);setTouch();};
 function keyboard(e){
  if(!isOpen)return;const k=e.key.toLowerCase();
  if(k==='tab'){
   e.stopImmediatePropagation();if(state.assignment)cancelChoice();const scope=el,items=[...scope.querySelectorAll('button:not(:disabled)')].filter(n=>!n.closest('[inert]')&&n.getClientRects().length),first=items[0],last=items[items.length-1];
   if(e.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){e.preventDefault();first?.focus();}return;
  }
  const delta={a:-1,w:-1,arrowleft:-1,arrowup:-1,d:1,s:1,arrowright:1,arrowdown:1}[k];
  if(delta==null&&!['enter',' ','escape','backspace'].includes(k))return;e.stopImmediatePropagation();e.preventDefault();if(e.repeat)return;
  if(k==='escape'||k==='backspace'){back();return;}
  if(state.assignment){if(delta!=null){state.chooseSide(delta<0?0:1);updateChoice();circles[state.assignment.side].focus({preventScroll:true});}else assign(state.assignment.side);return;}
  if(delta!=null){browse(delta);return;}
  const button=document.activeElement?.closest?.('button');if(button&&el.contains(button)&&!button.classList.contains('select-tile'))button.click();else openChoice();
 }
 window.addEventListener('keydown',keyboard,true);window.addEventListener('keyup',e=>{if(isOpen)e.stopImmediatePropagation();},true);
 window.addEventListener('blur',()=>{clearHold();if(isOpen)cancelChoice();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearHold();if(isOpen)cancelChoice();}});
 function pollGamepads(now){
  let available=[];try{available=Array.from(navigator.getGamepads?.()||[]).filter(Boolean);}catch{}connected=available.length>0;
  const signature=available.map(p=>p.index+':'+p.id).join('|');if(signature!==lastPadSignature||!$('#select-connection').dataset.ready){lastPadSignature=signature;$('#select-connection').dataset.ready='1';setTouch();$('#select-connection').textContent=connected?(available.length>1?'Two controllers · Controller 2 selects P2':'One controller · Left stick P1 / right stick P2'):'Keyboard & touch ready · Connect a controller anytime';}
  const live=new Set();available.forEach((p,index)=>{live.add(p.index);if(!pads.has(p.index)){pads.set(p.index,new FighterMenuPad(p));return;}
   pads.get(p.index).poll(p,now,(event,side,delta)=>{if(!isOpen)return;
    if(state.assignment){if(event==='back')cancelChoice();else if(event==='move'){state.chooseSide(delta<0?0:1);updateChoice();circles[state.assignment.side].focus({preventScroll:true});}else if(event==='confirm')assign(side);else if(event==='advance')assign(side??state.assignment.side);return;}
    clearHold();el.focus({preventScroll:true});if(event==='move')move(side,delta);else if(event==='confirm')confirm(side);else if(event==='advance')advance(side);else if(event==='back')back();else if(event==='start'&&state.ready)commit();
   },index>0,state.side);
  });for(const k of pads.keys())if(!live.has(k))pads.delete(k);
 }
 function tick(dt,now){if(isOpen)pollGamepads(now);}
 return {open,close,tick,get isOpen(){return isOpen;},get state(){return state;}};
};
