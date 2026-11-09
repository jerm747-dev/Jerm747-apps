'use strict';
const pitchState={value:0,velocity:0};
const rollState={value:0,velocity:0};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const degrees=180/Math.PI;
let requestPitch=0,requestRoll=0,pointer=null,tiltMode='off',calibration=null,latest=null;
let clock=0,lastTime=0,lastParticleFrame=-1,lastReadout=0,sensorAttempt=0;
const heldKeys=new Set();
const tiltKey='jerm747.arcade.visorTilt';
function savedTilt(){
  try{return localStorage.getItem(tiltKey)!=='off';}catch{return true;}
}
let tiltEnabled=savedTilt(),motionPermission='unknown',context=(['game','title','cabinet'].includes(hudQuery.get('context'))?hudQuery.get('context'):'game'),panel='main';
let lastPadRead=0,menuSpec={};
const closeButton=byId('close-hud');
const openButton=byId('open-menu');
let menuOpen=!embeddedVisor,closing=false,animationFrame;
const layers={tint:'tint-layer',fringe:'crt-layer',molecules:'particles'};
const layerKey=id=>'jerm747.arcade.visorLayer.'+id;
function readLayer(id){try{return localStorage.getItem(layerKey(id))!=='off';}catch{return true;}}
function applyLayer(id,on){
  byId(id).setAttribute('aria-pressed',String(on));
  const control=byId('pref-'+id);
  control.setAttribute('aria-checked',String(on));
  control.querySelector('.pref-value').textContent=on?'On':'Off';
  byId(layers[id]).style.display=on?'':'none';
}
for(const id of Object.keys(layers)){
  const flip=()=>{
    const on=byId(id).getAttribute('aria-pressed')!=='true';
    applyLayer(id,on);
    try{localStorage.setItem(layerKey(id),on?'on':'off');}catch{}
  };
  byId(id).addEventListener('click',flip);
  byId('pref-'+id).addEventListener('click',flip);
  applyLayer(id,readLayer(id));
}
window.addEventListener('storage',e=>{
 for(const id of Object.keys(layers))if(!e.key||e.key===layerKey(id))applyLayer(id,readLayer(id));
});
const notice=message=>{byId('notice').textContent=message;};
function setHint(){
  if(!tiltEnabled){byId('hint').textContent='Visor tilt off · Cabinet preference';return;}
  byId('hint').innerHTML=tiltMode==='active'?'Tilt your phone <span class="mid">·</span> Recenter to level':'Drag to tilt <span class="mid">·</span> Release to settle';
}
function restoreTarget(){
  if(!tiltEnabled||panel==='position'){requestPitch=0;requestRoll=0;return;}
  if(heldKeys.size){
    requestPitch=(Number(heldKeys.has('ArrowDown'))-Number(heldKeys.has('ArrowUp')))*.82;
    requestRoll=(Number(heldKeys.has('ArrowRight'))-Number(heldKeys.has('ArrowLeft')))*.82;
  }else if(tiltMode==='active'&&latest&&calibration){
    const delta=(a,b)=>((a-b+540)%360)-180;
    requestPitch=clamp(delta(latest.pitch,calibration.pitch)/35,-1,1);
    requestRoll=-clamp(delta(latest.roll,calibration.roll)/32,-1,1);
  }else{requestPitch=0;requestRoll=0;}
}
stage.addEventListener('pointerdown',e=>{
  if(!tiltEnabled||panel==='position'||!menuOpen||closing||pointer||e.target.closest('button, select, .settings-list')||e.button!==0)return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,p:requestPitch,r:requestRoll};
  stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');stage.focus({preventScroll:true});
});
stage.addEventListener('pointermove',e=>{
  if(pointer?.id!==e.pointerId)return;
  requestPitch=clamp(pointer.p+(e.clientY-pointer.y)/Math.min(stage.clientHeight*.33,120),-1,1);
  requestRoll=clamp(pointer.r+(e.clientX-pointer.x)/Math.min(stage.clientWidth*.23,160),-1,1);
});
function endPointer(e){
  if(pointer?.id!==e.pointerId)return;
  pointer=null;stage.classList.remove('dragging');restoreTarget();
}
for(const evt of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(evt,endPointer);
stage.addEventListener('keydown',e=>{
  if(!tiltEnabled||panel==='position'||!menuOpen||closing||e.target!==stage||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();heldKeys.add(e.key);restoreTarget();
});
stage.addEventListener('keyup',e=>{if(heldKeys.delete(e.key)){e.preventDefault();restoreTarget();}});
stage.addEventListener('blur',()=>{heldKeys.clear();if(!pointer)restoreTarget();});
const centerButton=byId('recenter');
function recenter(){
  if(latest)calibration={...latest};
  pointer=null;heldKeys.clear();stage.classList.remove('dragging');restoreTarget();
  notice(tiltMode==='active'?'This phone angle is now level.':'Visor centered.');

  window.navigator.vibrate?.(14);
}
centerButton.addEventListener('click',recenter);
function stopSensor(){
  sensorAttempt++;window.removeEventListener('deviceorientation',onOrientation);
  tiltMode='off';calibration=null;latest=null;setHint();restoreTarget();
}
function onOrientation(e){
  if(!menuOpen||tiltMode==='off'||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
  const b=e.beta/degrees,g=e.gamma/degrees;
  const a=(window.screen.orientation?.angle??window.orientation??0)/degrees;
  const x=Math.cos(b)*Math.sin(g),y=Math.sin(b),z=Math.cos(b)*Math.cos(g);
  const screenX=x*Math.cos(a)+y*Math.sin(a),screenY=y*Math.cos(a)-x*Math.sin(a);
  latest={pitch:Math.atan2(screenY,z)*degrees,roll:Math.asin(clamp(screenX,-1,1))*degrees};
  if(!calibration)calibration={...latest};
  if(tiltMode!=='active'){tiltMode='active';setHint();}
  if(!pointer&&!heldKeys.size)restoreTarget();
}
function newOrientation(){latest=null;calibration=null;restoreTarget();}
window.screen.orientation?.addEventListener('change',newOrientation);
window.addEventListener('orientationchange',newOrientation);
function updatePreferenceView(){
  byId('sensor').setAttribute('aria-checked',String(tiltEnabled));
  byId('sensor').querySelector('.pref-value').textContent=tiltEnabled?'On':'Off';
  const needsGesture=typeof window.DeviceOrientationEvent?.requestPermission==='function';
  byId('motion-access').hidden=!tiltEnabled||!needsGesture||motionPermission==='granted';
  byId('motion-access').lastChild.textContent=motionPermission==='denied'?'Retry motion access':'Allow phone motion';
  setHint();
}
async function startSensor(userGesture=false){
  if(!menuOpen||!tiltEnabled||tiltMode!=='off')return;
  const sensor=window.DeviceOrientationEvent;
  if(!sensor||!window.isSecureContext)return;
  const needsPermission=typeof sensor.requestPermission==='function'&&motionPermission!=='granted';
  if(needsPermission&&!userGesture)return;
  const attempt=++sensorAttempt;
  try{
    if(needsPermission){
      tiltMode='requesting';const response=await sensor.requestPermission();
      if(attempt!==sensorAttempt)return;
      motionPermission=response;updatePreferenceView();
      if(response!=='granted'){
        stopSensor();notice('Phone motion access was declined. You can still drag the visor.');return;
      }
    }
    tiltMode='waiting';window.addEventListener('deviceorientation',onOrientation);
  }catch{if(attempt===sensorAttempt){stopSensor();notice('Phone motion is unavailable here. Drag to tilt.');}}
}
function applyTilt(on,persist){
  tiltEnabled=on;
  if(persist){try{localStorage.setItem(tiltKey,on?'on':'off');}catch{/* The current session still uses this preference. */}}
  if(!on){pointer=null;heldKeys.clear();stage.classList.remove('dragging');stopSensor();}
  else startSensor(persist);
  updatePreferenceView();
}
byId('sensor').addEventListener('click',()=>{applyTilt(!tiltEnabled,true);});
byId('motion-access').addEventListener('click',()=>startSensor(true));
window.addEventListener('storage',e=>{
  if(e.key===tiltKey||e.key===null)applyTilt(savedTilt(),false);
});
const expand=byId('expand');
function setExpanded(on){
  document.body.classList.toggle('expanded',on);
  expand.querySelector('span').textContent=on?'Collapse':'Expand';
  expand.querySelector('use').setAttribute('href',on?'#i-shrink':'#i-expand');
  expand.setAttribute('aria-pressed',String(on));
  byId('hud-fullscreen').querySelector('span').textContent=on?(window.EncoreAndroid?'Exit fullscreen':'Collapse'):(window.EncoreAndroid||document.fullscreenEnabled?'Fullscreen':'Expand');
  byId('hud-fullscreen').querySelector('.icon use').setAttribute('href',on?'#i-shrink':'#i-expand');
}
expand.setAttribute('aria-pressed','false');
async function toggleExpanded(){
  if(embeddedVisor){sendHostState('fullscreen');return;}
  const on=!document.body.classList.contains('expanded');setExpanded(on);
  try{
    if(on&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    else if(!on&&document.fullscreenElement)await document.exitFullscreen();
  }catch{/* The expanded in-page view also works without native fullscreen. */}
}
expand.addEventListener('click',toggleExpanded);
byId('hud-fullscreen').addEventListener('click',toggleExpanded);
setExpanded(false);
document.addEventListener('fullscreenchange',()=>setExpanded(!!document.fullscreenElement));
const visorLabel=stage.getAttribute('aria-label');
const sceneAction=byId('scene-action');
function renderMenu(){
  const testing=panel==='controller',cabinet=context==='cabinet',main=panel==='main';
  document.body.dataset.panel=panel;
  byId('hud-heading').textContent=({controller:'Controller test',overlay:'Visor settings',position:'Move HUD icon'})[panel]||(cabinet?'Cabinet settings':'Settings');
  byId('game-actions').hidden=!main||cabinet;
  byId('cabinet-options').hidden=!(main&&cabinet||panel==='overlay'&&!cabinet);
  byId('controller-panel').hidden=!testing;
  byId('overlay-panel').hidden=panel!=='overlay';
  byId('position-panel').hidden=panel!=='position';
  gearButton.hidden=true;
  byId('cabinet-overlay').hidden=!main;
  byId('controller').hidden=!main;
  byId('tools-back').hidden=false;
  byId('hud-fullscreen').hidden=!main&&!testing;
  byId('recenter').hidden=panel!=='overlay';
  updateHotkeys();
  byId('primary-action').querySelector('.glass-button__label span').textContent=context==='title'?'Start':'Resume';
  byId('title-action').hidden=context==='title';
  renderHostMenu();renderSessions();
  if(testing)showPadInput();
}
function showScene(){
  const names={game:'Scene preview',title:'Game title screen',cabinet:'Cabinet shelf'};
  stage.setAttribute('aria-label',names[context]);byId('view-title').textContent=names[context];
  sceneAction.hidden=context==='game';
  sceneAction.textContent=context==='cabinet'?'Open game title':'Start game';
  if(embeddedVisor)sceneAction.hidden=true;
  updateHotkeys();
}
function closeMenu(destination=context,action='close',command){
  if(!menuOpen||closing)return;
  closing=true;
  if(action==='close')closeButton.classList.add('is-pressed');
  if(window.EncoreAndroid)window.EncoreAndroid.rumble(action==='close'?6:12,action==='close'?35:65);
  else window.navigator.vibrate?.(action==='close'?6:12);
  // Leave the highlight on screen for a short tap before handing input back.
  setTimeout(()=>{
    menuOpen=false;closing=false;closeButton.classList.remove('is-pressed');
    cancelAnimationFrame(animationFrame);
    if(pointer&&stage.hasPointerCapture(pointer.id))stage.releasePointerCapture(pointer.id);
    pointer=null;heldKeys.clear();stage.classList.remove('dragging');
    stopSensor();context=destination;panel='main';
    document.body.classList.add('hud-closed');stage.tabIndex=-1;
    showScene();notice('');if(!embeddedVisor)(context==='cabinet'?cabinetHotkey:openButton).focus({preventScroll:true});
    const eventName=action==='title'?'hud:title':action==='cabinet'?'hud:cabinet':
      action==='start'?'hud:start':context==='game'?'hud:resume':'hud:close';
    stage.dispatchEvent(new CustomEvent(eventName,{bubbles:true,detail:{context}}));
    sendHostState(action==='command'?'command':eventName.slice(4),command);
  },80);
}
function openMenu(startPanel='main'){
  if(menuOpen)return;
  menuOpen=true;openButton.hidden=true;sceneAction.hidden=true;overlayParent='main';panel=startPanel;renderMenu();
  document.body.classList.remove('hud-closed');stage.classList.remove('visor-enter');void stage.offsetWidth;stage.classList.add('visor-enter');stage.tabIndex=0;
  stage.setAttribute('aria-label',visorLabel);byId('view-title').textContent='Curved visor';
  startSensor(motionPermission==='unknown');
  (panel==='controller'?byId('tools-back'):panel==='overlay'?byId('launcher-toggle'):panel==='choices'||context==='title'?byId('host-actions').querySelector('button')||closeButton:context==='game'?byId('primary-action'):byId('sensor')).focus({preventScroll:true});lastTime=0;animationFrame=requestAnimationFrame(frame);
  stage.dispatchEvent(new CustomEvent('hud:open',{bubbles:true}));sendHostState('open');
}
closeButton.addEventListener('click',()=>closeMenu());
byId('primary-action').addEventListener('click',()=>closeMenu('game',context==='title'?'start':'resume'));
byId('title-action').addEventListener('click',()=>closeMenu('title','title'));
byId('shelf-action').addEventListener('click',()=>closeMenu('cabinet','cabinet'));
sceneAction.addEventListener('click',()=>{
  context=context==='cabinet'?'title':'game';showScene();
  (sceneAction.hidden?openButton:sceneAction).focus({preventScroll:true});
});
function showController(open){
  panel=open?'controller':'main';renderMenu();
  byId(open?'tools-back':'controller').focus({preventScroll:true});
}
byId('controller').addEventListener('click',()=>showController(true));
byId('tools-back').addEventListener('click',()=>{if(!overlayBack())closeMenu();});
openButton.addEventListener('click',()=>openMenu(hotkey.visible()?'main':'overlay'));
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||e.repeat)return;
  if(embeddedVisor&&menuOpen){e.preventDefault();if(!overlayBack())closeMenu();return;}
  if(menuOpen&&overlayBack())return;
  else if(document.body.classList.contains('expanded')&&!document.fullscreenElement)setExpanded(false);
  else if(menuOpen&&!document.fullscreenElement)closeMenu();
});
function spring(state,target,dt){
  const stiffness=reduceMotion.matches?88:53;
  const drag=reduceMotion.matches?20:8.8;
  state.velocity+=(stiffness*(target-state.value)-drag*state.velocity)*dt;
  state.value+=state.velocity*dt;
  if(Math.abs(state.velocity)<.00006&&Math.abs(state.value-target)<.00006){state.value=target;state.velocity=0;}
}
function frame(now){
  const dt=lastTime?Math.min((now-lastTime)/1000,.035):0;lastTime=now;
  const oldP=pitchState.value, oldR=rollState.value;
  spring(pitchState,requestPitch,dt);spring(rollState,requestRoll,dt);
  // Use linear travel so the lens stays readable at the edge of the gesture.
  const p=pitchState.value,r=rollState.value;
  const roll=Math.tan(r*Math.min(.048,height/14000));
  if(oldP!==pitchState.value||oldR!==rollState.value){
    // Keep the x-positions of the two temple mounts fixed. A small shear lets
    // the glass swing vertically in its side mounts while preserving its width.
    const size=1-p*.042, offset=p*height*.039 + (1-size)*height*.5;
    const shift=offset-500*roll;
    byId('glass-unit').setAttribute('transform','matrix(1 '+roll+' 0 '+size+' 0 '+shift+')');
    // Match the glass matrix in CSS pixels so the well stays seated during tilt.
    byId('visor-controls').style.transform='matrix(1,'+roll+',0,'+size+',0,'+(shift*rig.clientWidth/1000)+')';
  }
  if(!reduceMotion.matches)clock+=dt;
  if(now-lastParticleFrame>=36&&byId('particles').style.display!=='none'&&(!reduceMotion.matches||oldP!==pitchState.value||oldR!==rollState.value||lastParticleFrame<0)){
    particlesAt(clock,p*7,r*6);lastParticleFrame=now;
  }
  if(panel==='controller'&&now-lastPadRead>45){showPadInput();lastPadRead=now;}
  if(now-lastReadout>75){
    const format=v=>Math.abs(v)<.05?'0.0°':(v>0?'+':'−')+Math.abs(v).toFixed(1)+'°';
    byId('pitch').textContent=format(p*9);byId('roll').textContent=format(Math.atan(roll)*degrees);
    lastReadout=now;
  }
  animationFrame=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden){pointer=null;heldKeys.clear();stage.classList.remove('dragging');restoreTarget();}});
renderMenu();updatePreferenceView();
if(menuOpen){startSensor();animationFrame=requestAnimationFrame(frame);}
else{document.body.classList.add('hud-closed');showScene();sendHostState('ready');}
