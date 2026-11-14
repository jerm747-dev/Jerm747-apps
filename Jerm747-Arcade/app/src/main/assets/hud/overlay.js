'use strict';
const hotkey=window.Jerm747Hotkey;
let gameId=hudQuery.get('game')||'preview';
const map=byId('position-map'),mapSafe=map.querySelector('.map-safe');
const bounds=byId('hotkey-bounds'),mapValue=byId('position-value');
const cabinetHotkey=byId('cabinet-hud'),gearButton=byId('overlay-gear');
const presets=[...document.querySelectorAll('[data-corner]')];
const currentScope=()=>context==='cabinet'?'':gameId;
let mapPointer=null,overlayParent='main';
function locationLabel({x,y}){
  const h=x===0?'left':x===1?'right':'',v=y===0?'top':y===1?'bottom':'';
  if(!h&&!v)return Math.round(x*100)+'% from left · '+Math.round(y*100)+'% from top';
  const label=h&&v?v+' '+h:v?v+' edge · '+Math.round(x*100)+'% from left':h+' edge · '+Math.round(y*100)+'% from top';
  return label[0].toUpperCase()+label.slice(1);
}
function drawMap(pos){
  hotkey.place(mapSafe,pos);mapValue.value=locationLabel(pos);
  for(const preset of presets)preset.setAttribute('aria-pressed',String(preset.dataset.corner===pos.x+','+pos.y));
}
function sizeMap(){
  const ratio=Math.max(1,window.innerWidth)/Math.max(1,window.innerHeight);
  const height=Math.min(innerHeight<530&&ratio>1?100:170,230/ratio);
  map.style.setProperty('--map-w',height*ratio+'px');map.style.setProperty('--map-h',height+'px');
}
function updateHotkeys(){
  const visible=hotkey.visible(),pos=hotkey.position(currentScope());
  const toggle=byId('launcher-toggle');
  toggle.setAttribute('aria-checked',String(visible));toggle.querySelector('.pref-value').textContent=visible?'On':'Off';
  hotkey.place(bounds,pos);drawMap(pos);sizeMap();
  cabinetHotkey.hidden=embeddedVisor||context!=='cabinet';
  openButton.hidden=embeddedVisor||menuOpen||context==='cabinet';
  openButton.dataset.gear=String(!visible);
  openButton.querySelector('img').src=visible?'icons/hud-overlay.svg':'icons/hud-gear.svg';
  openButton.setAttribute('aria-label',visible?'Open HUD menu':'HUD overlay settings');
  openButton.title=visible?'Open HUD menu':'HUD overlay settings';
  sendHostState();
}
function savePosition(pos){
  const scope=currentScope(),saved=hotkey.savedPosition(scope);
  if(saved && saved.x===pos.x && saved.y===pos.y)return;
  hotkey.save(scope,pos);hotkey.place(bounds,pos);drawMap(pos);sendHostState();
}
function placeAtPointer(e){
  const r=mapSafe.getBoundingClientRect();
  savePosition(hotkey.point((e.clientX-r.left)/Math.max(1,r.width),(e.clientY-r.top)/Math.max(1,r.height)));
}
map.addEventListener('pointerdown',e=>{
  if(e.button!==0||mapPointer!==null)return;
  e.preventDefault();map.focus({preventScroll:true});mapPointer=e.pointerId;
  map.setPointerCapture(e.pointerId);placeAtPointer(e);
});
map.addEventListener('pointermove',e=>{if(e.pointerId===mapPointer)placeAtPointer(e);});
map.addEventListener('pointerup',e=>{
  if(e.pointerId!==mapPointer)return;
  placeAtPointer(e);mapPointer=null;
});
function cancelPlacement(){mapPointer=null;}
for(const event of ['lostpointercapture','pointercancel'])map.addEventListener(event,e=>{
  if(e.pointerId===mapPointer)cancelPlacement();
});
map.addEventListener('keydown',e=>{
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!delta)return;e.preventDefault();e.stopPropagation();
  const p=hotkey.position(currentScope()),step=e.shiftKey ? .1 : .025;
  savePosition(hotkey.point(p.x+delta[0]*step,p.y+delta[1]*step));
});
for(const button of presets)button.addEventListener('click',()=>{
  const [x,y]=button.dataset.corner.split(',').map(Number);savePosition({x,y});
});
byId('launcher-toggle').addEventListener('click',()=>{hotkey.setVisible(!hotkey.visible());updateHotkeys();});
function showPanel(next,focus){
  if(mapPointer!==null)cancelPlacement();
  panel=next;byId('settings-list').scrollTop=0;heldKeys.clear();restoreTarget();renderMenu();
  if(focus)byId(focus).focus({preventScroll:true});
}
function overlayBack(){
  if(lab.open){requestLabBack();return true;}
  if(panel==='library'){showPanel('sessions','browse-games');return true;}
  if(panel==='sessions'){showPanel('main','open-games');return true;}
  if(panel==='choices'){showPanel('main','more-actions');return true;}
  if(panel==='position'){showPanel('overlay','position-open');return true;}
  if(panel==='overlay'){showPanel(overlayParent,'cabinet-overlay');return true;}
  if(panel==='controller'){showPanel('main','controller');return true;}
  return false;
}
function editOverlay(){overlayParent=panel;showPanel('overlay','launcher-toggle');}
gearButton.addEventListener('click',editOverlay);
byId('cabinet-overlay').addEventListener('click',editOverlay);
byId('position-open').addEventListener('click',()=>showPanel('position','position-map'));
cabinetHotkey.addEventListener('click',()=>menuOpen?showPanel('main','sensor'):openMenu());
window.addEventListener('resize',sizeMap);
window.addEventListener('storage',e=>{if(hotkey.isPreference(e.key))updateHotkeys();});

const hostOrigin=location.origin==='null'?'*':location.origin;
function sendHostState(action='state', command){
  if(!embeddedVisor||window.parent===window)return;
  window.parent.postMessage({channel:'jerm747-hud',action,command,open:menuOpen,context,visible:hotkey.visible(),position:hotkey.position(currentScope()),cabinetPositioned:!!hotkey.savedPosition(),placing:menuOpen&&panel==='position'},hostOrigin);
}
window.addEventListener('message',event=>{
  if(!embeddedVisor||event.source!==parent||event.origin!==location.origin||event.data?.channel!=='jerm747-host')return;
  const m=event.data;
  if(m.action==='place'){
    if(m.context!==context||String(m.gameId)!==gameId||!Number.isFinite(m.position?.x)||!Number.isFinite(m.position?.y))return;
    savePosition(hotkey.point(m.position.x,m.position.y));
  }else if(m.action==='context'||m.action==='open'){
    if(!['game','title','cabinet'].includes(m.context))return;
    context=m.context;gameId=String(m.gameId||'game');panel='main';
    if(m.action==='open'){
      menuSpec=m.menu||{};
      if(!menuOpen)openMenu(['choices','overlay','controller'].includes(m.panel)?m.panel:'main');
      else renderMenu();
    }else{renderMenu();updateHotkeys();}
  }else if(m.action==='input'&&menuOpen){navigateHUD(m.key);
  }else if(m.action==='fullscreen-state'){setExpanded(!!m.active);
  }else if(m.action==='back'&&menuOpen){if(!overlayBack())closeMenu();}
});
