/* GS Fighter III v1.0 — packaged game shell: HUD, announcer, Start menu (controls, difficulty, video, sound),
 * results, keyboard presets, gamepad fighting controls, touch layouts, fullscreen and copy protection. */
(function(){'use strict';
const L=window.FighterLab,$=id=>document.getElementById(id),body=document.body;
const isAPK=/GSFighterAPK/.test(navigator.userAgent);if(isAPK)body.classList.add('is-apk');
body.classList.add('game');
// ---------- settings ----------
const DEF={touch:'auto',padStyle:'arcade',padSize:100,padOpacity:100,padSwap:false,padFade:true,haptics:true,keyboard:'arrows',autoFull:true,menuSounds:true,menuEffects:'standard',reducedMotion:false};
let S={...DEF};try{S={...DEF,...JSON.parse(localStorage.getItem('gsf-settings')||'{}')};}catch{}
function save(){try{localStorage.setItem('gsf-settings',JSON.stringify(S));}catch{}}
const crestParams=new URLSearchParams(location.search);if(crestParams.get('crest')==='1'&&crestParams.has('haptics'))S.haptics=crestParams.get('haptics')!=='0';
$('haptics').checked=S.haptics;
// ---------- keyboard presets ----------
const PRESETS={
 arrows:{label:'Arrows + J/K/L',map:{arrowleft:'left',arrowright:'right',arrowup:'up',arrowdown:'down',' ':'jump',l:'lp',j:'mp',u:'hp',k:'lk',o:'mk',p:'hk',b:'block',v:'vwave',c:'duck'},
  show:[['Move','← →'],['Jump','↑'],['Crouch','↓ / C'],['Backflip','Space'],['Low punch','L'],['Mid punch','J'],['High punch','U'],['Low kick','K'],['Mid kick','O'],['High kick','P'],['Block','B'],['V-Wave','V'],['Pause','Esc / Enter']]},
 wasd:{label:'WASD + numpad style',map:{a:'left',d:'right',w:'up',s:'down',' ':'jump',j:'lp',k:'mp',l:'hp',u:'lk',i:'mk',o:'hk',shift:'block',e:'vwave',c:'duck',arrowleft:'left',arrowright:'right',arrowup:'up',arrowdown:'down'},
  show:[['Move','A D'],['Jump','W'],['Crouch','S / C'],['Backflip','Space'],['Low punch','J'],['Mid punch','K'],['High punch','L'],['Low kick','U'],['Mid kick','I'],['High kick','O'],['Block','Shift'],['V-Wave','E'],['Pause','Esc / Enter']]}
};
function applyKeys(){const k=L.keys;for(const key of Object.keys(k))delete k[key];Object.assign(k,PRESETS[S.keyboard]?.map||PRESETS.arrows.map);}
applyKeys();
const PAD_SHOW=[['Move','D-pad / Left stick'],['Low punch','LB'],['Mid punch','X / □'],['High punch','Y / △'],['Low kick','LT'],['Mid kick','A / ✕'],['High kick','B / ○'],['Block','RB'],['V-Wave','RT'],['Backflip','Left stick click'],['Camera','Right stick'],['Pause','Start']];
// ---------- layout ----------
const coarse=matchMedia('(pointer:coarse)'),fine=matchMedia('(any-pointer:fine)');
function touchOn(){if(S.touch==='on')return true;if(S.touch==='off')return false;return isAPK||coarse.matches||(navigator.maxTouchPoints>0&&!fine.matches);}
let fightOn=false;
function layout(){
 const land=innerWidth>innerHeight;body.classList.toggle('is-landscape',land);body.classList.toggle('is-portrait',!land);
 body.classList.toggle('is-touch',touchOn()&&!padConnected());body.classList.toggle('pad-ghost',S.padStyle==='ghost');body.classList.toggle('pad-swap',!!S.padSwap);
 body.classList.toggle('fight-on',fightOn);
 body.style.setProperty('--pad-scale',S.padSize/100);body.style.setProperty('--pad-opacity',S.padOpacity/100);
}
addEventListener('resize',layout);addEventListener('orientationchange',()=>setTimeout(layout,120));coarse.addEventListener?.('change',layout);
let idleTimer=0;function padActivity(){body.classList.remove('pad-idle');clearTimeout(idleTimer);if(S.padFade)idleTimer=setTimeout(()=>body.classList.add('pad-idle'),3500);}
$('touch-controller').addEventListener('pointerdown',padActivity,true);
// ---------- copy / select protection ----------
for(const ev of ['copy','cut','paste','selectstart','dragstart','contextmenu'])document.addEventListener(ev,e=>{if(!['INPUT','TEXTAREA'].includes(e.target.tagName)||ev==='contextmenu')e.preventDefault();},true);
document.addEventListener('gesturestart',e=>e.preventDefault());
let lastTouchEnd=0;document.addEventListener('touchend',e=>{const n=Date.now();if(n-lastTouchEnd<320&&!e.target.closest('input'))e.preventDefault();lastTouchEnd=n;},{passive:false});
$('intro').addEventListener('load',()=>{try{const d=$('intro').contentDocument;const st=d.createElement('style');st.textContent='*{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}';d.head.append(st);for(const ev of ['copy','selectstart','contextmenu','dragstart'])d.addEventListener(ev,e=>e.preventDefault(),true);}catch{}});
// ---------- fullscreen ----------
function isFull(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function toggleFull(force){const el=document.documentElement;const want=force??!isFull();try{if(want&&!isFull())(el.requestFullscreen||el.webkitRequestFullscreen)?.call(el,{navigationUI:'hide'})?.catch?.(()=>{});else if(!want&&isFull())(document.exitFullscreen||document.webkitExitFullscreen)?.call(document);}catch{}}
const FS_ICON='<svg viewBox="0 0 24 24"><path d="M3 9V3h6v2H5v4H3zm12-6h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 0h2v6h-6v-2h4v-4z"/></svg>';
// ---------- DOM: HUD, announcer, menus ----------
const viewport=document.querySelector('.viewport');
const hud=document.createElement('div');hud.id='game-hud';hud.hidden=true;
hud.innerHTML='<div class="hud-side p1"><div class="hud-name"><span id="hud-n1">P1</span><small>P1</small></div><div class="hud-bar" id="hud-b1"><b></b><i></i></div><div class="hud-pips" id="hud-w1"><span></span><span></span></div></div>'+
 '<div class="hud-mid"><div class="hud-timer" id="hud-time">60</div><div class="hud-round" id="hud-round">ROUND 1</div><div class="hud-btns"><button class="hud-btn" id="hud-pause" aria-label="Pause menu"><svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg></button><button class="hud-btn fs-btn" aria-label="Fullscreen">'+FS_ICON+'</button></div></div>'+
 '<div class="hud-side p2"><div class="hud-name"><small>CPU</small><span id="hud-n2">CPU</span></div><div class="hud-bar" id="hud-b2"><b></b><i></i></div><div class="hud-pips" id="hud-w2"><span></span><span></span></div></div>';
viewport.append(hud);
const ann=document.createElement('div');ann.id='announce';ann.innerHTML='<span></span>';viewport.append(ann);
function announce(text,cls='',sound){const s=ann.firstChild;s.className='';void s.offsetWidth;s.textContent=text;s.className='go '+cls;if(sound)GSFAudio[sound]?.();}
const titleExtras=document.createElement('div');titleExtras.className='title-extras';titleExtras.innerHTML='<span class="build-label">1.3</span><button id="title-options">OPTIONS</button><button class="fs-btn" aria-label="Fullscreen">⛶ FULL</button>';$('title-screen').append(titleExtras);
const menu=document.createElement('div');menu.id='start-menu';menu.className='gs-overlay';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-modal','true');
menu.innerHTML=`<div class="gs-panel"><button class="gs-close" id="menu-close">✕</button><h2 id="menu-title">PAUSED</h2><p class="sub" id="menu-sub">GS Fighter III · Player Menu v8</p>
<div class="gs-tabs" role="tablist"><button role="tab" data-tab="game" aria-selected="true">GAME</button><button role="tab" data-tab="controls">CONTROLS</button><button role="tab" data-tab="video">VIDEO &amp; SOUND</button></div>
<section data-page="game"><div class="gs-list" id="menu-actions"><button data-act="resume">RESUME</button><button data-act="restart">RESTART MATCH</button><button data-act="select">FIGHTER SELECT</button><button data-act="title">QUIT TO TITLE</button></div>
<div class="gs-row"><span>CPU difficulty<small>Ferocious chases and punishes</small></span><div class="gs-seg" data-set="level"></div></div>
<div class="gs-row"><span>Round time</span><div class="gs-seg" data-set="rounds"><button data-v="30">30s</button><button data-v="60">60s</button><button data-v="99">99s</button></div></div></section>
<section data-page="controls" hidden>
<div class="gs-row"><span>Touch buttons<small>Auto shows them on phones and tablets</small></span><div class="gs-seg" data-set="touch"><button data-v="auto">Auto</button><button data-v="on">On</button><button data-v="off">Off</button></div></div>
<div class="gs-row"><span>Phone layout</span><div class="gs-seg" data-set="padStyle"><button data-v="arcade">Arcade</button><button data-v="ghost">Ghost</button></div></div>
<div class="gs-row"><span>Button size <small id="v-padSize"></small></span><input type="range" min="70" max="140" step="5" data-range="padSize"></div>
<div class="gs-row"><span>Button opacity <small id="v-padOpacity"></small></span><input type="range" min="25" max="100" step="5" data-range="padOpacity"></div>
<div class="gs-row"><span>Handedness</span><div class="gs-seg" data-set="padSwap"><button data-v="false">Pad left</button><button data-v="true">Pad right</button></div></div>
<div class="gs-row"><span>Fade when idle</span><div class="gs-seg" data-set="padFade"><button data-v="true">On</button><button data-v="false">Off</button></div></div>
<div class="gs-row"><span>Vibration</span><div class="gs-seg" data-set="haptics"><button data-v="true">On</button><button data-v="false">Off</button></div></div>
<div class="gs-row"><span>Keyboard layout</span><div class="gs-seg" data-set="keyboard"><button data-v="arrows">Arrows + J/K/L</button><button data-v="wasd">WASD</button></div></div>
<div class="gs-keys" id="key-table"></div>
<div class="gs-row"><span>Controller<small id="pad-status">No controller detected</small></span><div></div></div><div class="gs-keys" id="pad-table"></div>
<p class="gs-note">Touch pad: slide your thumb around the ring for 8 directions; ↑ jumps, ↗ jumps forward, ↖ backflips. Double-tap → and hold to run. Crouch + low kick sweeps.</p></section>
<section data-page="video" hidden>
<div class="gs-row"><span>Shaders<small>Bloom, color grade, impact flash</small></span><div class="gs-seg" data-set="postfx"><button data-v="off">Off</button><button data-v="standard">Standard</button><button data-v="high">High</button></div></div>
<div class="gs-row"><span>Fighter rim light</span><div class="gs-seg" data-set="rim"><button data-v="true">On</button><button data-v="false">Off</button></div></div>
<div class="gs-row"><span>Texture quality<small>Reloads the game</small></span><div class="gs-seg" data-set="quality"></div></div>
<div class="gs-row"><span>Sound volume <small id="v-volume"></small></span><input type="range" min="0" max="100" step="5" data-range="volume"></div>
<div class="gs-row"><span>Fullscreen</span><div class="gs-seg"><button class="fs-btn" data-v="x">Toggle fullscreen</button></div></div>
<div class="gs-row"><span>Auto fullscreen<small>On phones when you press Start</small></span><div class="gs-seg" data-set="autoFull"><button data-v="true">On</button><button data-v="false">Off</button></div></div>
<p class="gs-note" id="gfx-note"></p></section></div>`;
body.append(menu);
const results=document.createElement('div');results.id='results';results.className='gs-overlay';results.hidden=true;
results.innerHTML='<div class="gs-panel"><p class="sub" id="res-sub">MATCH OVER</p><h2 id="res-title">YOU WIN</h2><div class="score" id="res-score"></div><div class="gs-list"><button data-res="rematch">REMATCH</button><button data-res="select">FIGHTER SELECT</button><button data-res="title">TITLE SCREEN</button></div></div>';
body.append(results);
const loading=document.createElement('div');loading.id='loading';loading.className='gs-overlay';loading.hidden=true;loading.innerHTML='<div class="gs-panel"><p class="sub">GET READY</p><h2 id="load-title">LOADING</h2><div class="spinner"></div><p class="gs-note" id="load-note"></p></div>';body.append(loading);
window.GSFUI={loading(on,ids,err){loading.hidden=!on&&!err;if(on){$('load-title').textContent=ids.join(' VS ').toUpperCase();$('load-note').textContent='Loading fighters…';}if(err){$('load-title').textContent='LOAD ERROR';$('load-note').textContent=err;setTimeout(()=>loading.hidden=true,2500);}},
 rumble(ms,mag){if(!S.haptics)return;try{navigator.vibrate?.(Math.min(120,ms*.6));}catch{}for(const p of navigator.getGamepads?.()||[])p?.vibrationActuator?.playEffect?.('dual-rumble',{duration:ms,strongMagnitude:mag,weakMagnitude:mag*.6}).catch?.(()=>{});}};
// ---------- menu logic ----------
const LEVELS=['easy','normal','hard','ferocious','training'];
const segLevel=menu.querySelector('[data-set=level]');segLevel.innerHTML=LEVELS.map(l=>'<button data-v="'+l+'">'+L.AI_LEVELS[l].label+'</button>').join('');
const segQ=menu.querySelector('[data-set=quality]');segQ.innerHTML=Object.entries(GSFQuality.presets).filter(([k])=>!(isAPK&&k==='extreme')).map(([k,p])=>'<button data-v="'+k+'">'+p.label+'</button>').join('');
function getVal(key){switch(key){case 'level':return L.match.level;case 'rounds':return String(L.match.roundSeconds);case 'postfx':return GSFX.level;case 'rim':return String(GSFX.rim);case 'quality':return GSFQuality.key;case 'volume':return String(Math.round(GSFAudio.volume*100));default:return String(S[key]);}}
function setVal(key,v){
 switch(key){case 'level':L.match.level=v;try{localStorage.setItem('gsf-ai-level',v);}catch{}break;
  case 'rounds':L.match.roundSeconds=Number(v);try{localStorage.setItem('gsf-round-seconds',v);}catch{}break;
  case 'postfx':GSFX.setLevel(v);break;case 'rim':GSFX.setRim(v==='true');break;
  case 'quality':if(v!==GSFQuality.key){try{localStorage.setItem('gsf-quality-v27',v);}catch{}const url=new URL(location.href);url.searchParams.set('quality',v);location.assign(url.href);}return;
  default:S[key]=v==='true'?true:v==='false'?false:v;save();if(key==='haptics')$('haptics').checked=S.haptics;if(key==='keyboard')applyKeys();if(key==='padFade')padActivity();}
 layout();refreshMenu();GSFAudio.ui();
}
menu.querySelectorAll('[data-set]').forEach(seg=>seg.addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(b&&b.dataset.v!=='x')setVal(seg.dataset.set,b.dataset.v);}));
menu.querySelectorAll('[data-range]').forEach(r=>r.addEventListener('input',()=>{const k=r.dataset.range,v=Number(r.value);if(k==='volume')GSFAudio.setVolume(v/100);else{S[k]=v;save();layout();}refreshMenu();}));
function refreshMenu(){
 menu.querySelectorAll('[data-set]').forEach(seg=>{const cur=getVal(seg.dataset.set);seg.querySelectorAll('button[data-v]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===cur)));});
 for(const r of menu.querySelectorAll('[data-range]')){const k=r.dataset.range,v=k==='volume'?Math.round(GSFAudio.volume*100):S[k];r.value=v;$('v-'+k).textContent=v+'%';}
 const P=PRESETS[S.keyboard]||PRESETS.arrows;$('key-table').innerHTML=P.show.map(([a,k])=>'<div><span>'+a+'</span><kbd>'+k+'</kbd></div>').join('');
 $('pad-table').innerHTML=PAD_SHOW.map(([a,k])=>'<div><span>'+a+'</span><kbd>'+k+'</kbd></div>').join('');
 const pad=firstPad();$('pad-status').textContent=pad?pad.id.slice(0,46):'No controller detected — connect one any time';
 $('gfx-note').textContent=(GSFQuality.notice||'')+' Renderer: '+(L.renderer.isWebGLRenderer?'WebGL':'compatibility')+(GSFQuality.fps?' · '+GSFQuality.fps+' fps':'');
 const inFight=L.match.active;menu.querySelectorAll('[data-act=restart],[data-act=resume],[data-act=select]').forEach(b=>b.hidden=!inFight);
 $('menu-title').textContent=inFight?'PAUSED':'OPTIONS';
}
menu.querySelectorAll('[data-tab]').forEach(t=>t.onclick=()=>{menu.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===t)));menu.querySelectorAll('[data-page]').forEach(p=>p.hidden=p.dataset.page!==t.dataset.tab);GSFAudio.ui();});
let menuOpen=false;
function openMenu(){if(window.GSFPlayerMenu)return GSFPlayerMenu.open();if(menuOpen||window.GSFPostFight?.active)return;menuOpen=true;window.GSFPaused=L.match.active;refreshMenu();menu.hidden=false;GSFAudio.ui();setTimeout(()=>menu.querySelector(L.match.active?'[data-act=resume]':'[data-tab=controls]')?.focus(),30);}
function closeMenu(){if(window.GSFPlayerMenu?.isOpen)return GSFPlayerMenu.close();if(!menuOpen)return;menuOpen=false;menu.hidden=true;window.GSFPaused=false;GSFAudio.ui();padActivity();}
$('menu-close').onclick=closeMenu;$('hud-pause').onclick=openMenu;$('title-options').onclick=e=>{e.stopPropagation();openMenu();};
menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});
$('menu-actions').addEventListener('click',e=>{const a=e.target.closest('[data-act]')?.dataset.act;if(!a)return;closeMenu();
 if(a==='restart')L.startMatch();else if(a==='select')openSelect();else if(a==='title')L.openTitle();});
function openSelect(){results.hidden=true;L.endMatch();L.selection.open([L.PLAYER,L.PARTNER]);}
results.addEventListener('click',e=>{const a=e.target.closest('[data-res]')?.dataset.res;if(!a)return;results.hidden=true;GSFAudio.ui();
 if(a==='rematch')L.startMatch();else if(a==='select')openSelect();else L.openTitle();});
document.querySelectorAll('.fs-btn').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleFull();}));
// Press Start: phones go fullscreen on the same gesture.
$('press-start').addEventListener('click',()=>{if(S.autoFull&&touchOn()&&!isAPK)toggleFull(true);},true);
// Esc / Enter open the Start menu during a fight; Esc closes it.
addEventListener('keydown',e=>{
 if(window.GSFPostFight?.active||window.GSFPlayerMenu?.isOpen)return;
 const fight=L.match.active&&!L.selection.isOpen&&!L.titleOpen&&results.hidden;
 if(e.key==='Escape'){if(menuOpen){e.preventDefault();e.stopImmediatePropagation();closeMenu();}else if(fight){e.preventDefault();e.stopImmediatePropagation();openMenu();}}
 else if(e.key==='Enter'&&!menuOpen&&fight&&!['INPUT','BUTTON'].includes(e.target.tagName)){e.preventDefault();e.stopImmediatePropagation();openMenu();}
},true);
// Debug keys from the lab are disabled in the packaged game.
addEventListener('keydown',e=>{if(!window.GSFPlayerMenu?.isOpen&&['r','f','h'].includes(e.key.toLowerCase())&&!['INPUT','SELECT'].includes(e.target.tagName)&&!L.titleOpen){e.stopImmediatePropagation();}},true);
// Pause when the app is hidden (phone call, home button).
document.addEventListener('visibilitychange',()=>{if(document.hidden&&L.match.active&&L.match.state==='fight')openMenu();});
window.GSF_onPause=()=>{if(L.match.active&&L.match.state==='fight')openMenu();};
addEventListener('blur',window.GSF_onPause);
// ---------- gamepad fighting controls + menu navigation ----------
function firstPad(){return Array.from(navigator.getGamepads?.()||[]).find(p=>p&&p.connected);}
let padSeen=false;function padConnected(){return padSeen&&!!firstPad();}
addEventListener('gamepadconnected',()=>{padSeen=true;layout();});addEventListener('gamepaddisconnected',()=>layout());
const BTN={2:'mp',3:'hp',4:'lp',0:'mk',1:'hk',6:'lk',5:'block',7:'vwave',10:'jump'};
const padHeld=new Set();let prevButtons=[],navCool=0,padNeedsNeutral=false;
function padTick(dt){
 if(window.GSFPostFight?.active){for(const id of padHeld)L.inputUp('gp-'+id);padHeld.clear();return;}
 const p=firstPad();if(!p){if(padHeld.size){for(const id of padHeld)L.inputUp('gp-'+id);padHeld.clear();}return;}
 if(!padSeen){padSeen=true;layout();}
 const b=i=>!!p.buttons[i]?.pressed||(p.buttons[i]?.value||0)>.5,was=i=>!!prevButtons[i];
 if(window.GSFPlayerMenu?.isOpen){releasePad();GSFPlayerMenu.padTick(p,dt);prevButtons=p.buttons.map((_,i)=>b(i));return;}
 if(L.titleOpen&&(b(9)&&!was(9)||b(0)&&!was(0))){L.closeTitle();prevButtons=p.buttons.map((_,i)=>b(i));return;}
 if(padNeedsNeutral&&!p.buttons.some(x=>x.pressed||x.value>.5)&&!p.axes.some(x=>Math.abs(x)>.45))padNeedsNeutral=false;
 const fighting=L.match.active&&!padNeedsNeutral&&!menuOpen&&!L.selection.isOpen&&!L.titleOpen&&!L.demoPlaying&&results.hidden;
 if(b(9)&&!was(9)){if(menuOpen)closeMenu();else if(L.match.active&&!L.selection.isOpen)openMenu();prevButtons=p.buttons.map((_,i)=>b(i));return;}
 const want=new Set();
 if(fighting){const ax=p.axes[0]||0,ay=p.axes[1]||0;
  if(b(14)||ax<-.5)want.add('left');if(b(15)||ax>.5)want.add('right');if(b(12)||ay<-.6)want.add('up');if(b(13)||ay>.6)want.add('down');
  for(const [i,id] of Object.entries(BTN))if(b(Number(i)))want.add(id);}
 for(const id of padHeld)if(!want.has(id)){L.inputUp('gp-'+id);padHeld.delete(id);}
 for(const id of want)if(!padHeld.has(id)){L.inputDown(id,'gp-'+id);padHeld.add(id);}
 // Menu / results navigation with the D-pad and A / B.
 const overlay=menuOpen?menu:!results.hidden?results:null;
 if(overlay){navCool-=dt;const ay=p.axes[1]||0,ax=p.axes[0]||0;const dir=b(13)||ay>.6?1:b(12)||ay<-.6?-1:b(15)||ax>.6?1:b(14)||ax<-.6?-1:0;
  if(dir&&navCool<=0){navCool=.2;const items=[...overlay.querySelectorAll('button:not([hidden]),input')].filter(x=>x.offsetParent);const i=items.indexOf(document.activeElement);const n=items[(i+dir+items.length)%items.length]||items[0];n?.focus();GSFAudio.ui();}
  if(!dir)navCool=0;
  if(b(0)&&!was(0))document.activeElement?.click?.();
  if(b(1)&&!was(1)&&menuOpen)closeMenu();}
 prevButtons=p.buttons.map(x=>x.pressed);
}
function releasePad(){padNeedsNeutral=true;for(const id of padHeld)L.inputUp('gp-'+id);padHeld.clear();}
window.GSFGameShell={get:getVal,set(key,value){if(key==='volume'){GSFAudio.setVolume(Number(value)/100);return;}if(['padSize','padOpacity'].includes(key)){S[key]=Number(value);save();layout();return;}setVal(key,String(value));},keyboardMap:preset=>(PRESETS[preset||S.keyboard]||PRESETS.arrows).show,padMap:PAD_SHOW,fullscreen:toggleFull,activity:padActivity,releasePad};
const menuChime=GSFAudio.ui;GSFAudio.ui=(...args)=>{if(S.menuSounds!==false)menuChime(...args);};
// ---------- HUD loop ----------
let lastState='',lastRound=0,trail=[100,100],lastShots=0;
const names=()=>[L.PLAYER,L.PARTNER];
function hudTick(dt){
 const m=L.match,show=m.active&&!L.titleOpen&&!L.demoPlaying&&!L.selection.isOpen;
 if(fightOn!==show){fightOn=show;layout();if(show)padActivity();}
 hud.hidden=!show;
 if(show){
  const hp=L.health,[n1,n2]=names();$('hud-n1').textContent=n1.toUpperCase();$('hud-n2').textContent=n2.toUpperCase();
  for(let i=0;i<2;i++){const bar=$('hud-b'+(i+1));bar.querySelector('i').style.transform='scaleX('+hp[i]/100+')';if(hp[i]>=trail[i]||m.state==='intro')trail[i]=hp[i];bar.querySelector('b').style.transform='scaleX('+hp[i]/100+')';bar.classList.toggle('low',hp[i]>0&&hp[i]<=25);
   $('hud-w'+(i+1)).querySelectorAll('span').forEach((s,k)=>s.classList.toggle('won',m.wins[i]>k));}
  const t=Math.ceil(m.time);$('hud-time').textContent=m.training?'∞':String(t);$('hud-time').classList.toggle('urgent',!m.training&&m.state==='fight'&&t<=10);$('hud-round').textContent=m.training?'TRAINING':'ROUND '+m.round;hud.querySelector('.p2 .hud-name small').textContent=m.training?'DUMMY':'CPU';
  const shots=L.vwave.state.shots.length;if(shots>lastShots)GSFAudio.wave();lastShots=shots;
 }
 const key=m.state+':'+m.round;
 if(key!==lastState){lastState=key;
  if(m.state==='intro'){results.hidden=true;setTimeout(()=>{if(L.match.state==='intro')announce(m.round>=3&&m.wins[0]===1&&m.wins[1]===1?'FINAL ROUND':'ROUND '+m.round,'small','bell');},150);}
  else if(m.state==='fight')announce(m.training?'TRAINING':'FIGHT!',m.training?'small':'','fight');
  else if(m.state==='ko'){const perfect=m.roundWinner!=null&&L.health[m.roundWinner]===100;setTimeout(()=>announce(perfect?'PERFECT':'K.O.','ko','ko'),350);}
  else if(m.state==='time')announce(m.roundWinner==null?'DRAW':'TIME','small','bell');
  else if(m.state==='over')showResults();
 }
}
function showResults(){if(window.GSFPostFight){window.GSFPostFight.begin();return;}const m=L.match,[n1,n2]=names();const win=m.winner===0;
 $('res-title').textContent=m.winner==null?'DRAW':win?'YOU WIN':'YOU LOSE';$('res-sub').textContent=(m.winner==null?'MATCH DRAWN':(win?n1:n2).toUpperCase()+' WINS')+' · '+L.AI_LEVELS[m.level].label.toUpperCase();
 $('res-score').textContent=n1.toUpperCase()+'  '+m.wins[0]+' – '+m.wins[1]+'  '+n2.toUpperCase();
 setTimeout(()=>{if(L.match.state==='over'){results.hidden=false;results.querySelector('button').focus();}},900);}
let last=performance.now();function loop(now){const dt=Math.min(.1,(now-last)/1000);last=now;try{padTick(dt);hudTick(dt);}catch(e){console.error(e);}requestAnimationFrame(loop);}requestAnimationFrame(loop);
layout();padActivity();
// Branding: the packaged game title.
document.title='GS Fighter III · Player Menu v8';
})();
