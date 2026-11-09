'use strict';
(() => {
const $=id=>document.getElementById(id),T=THREE, screen=$('screen'),poster=$('poster'),panel=$('panel');
const titleButton=$('start'), padRoot=document.querySelector('.deck'), held=new Set();
const labels={idle:'READY',walk:'WALK',run:'RUN',up:'JUMP',jump:'BACKFLIP',lp:'LOW PUNCH',mp:'MID PUNCH',hp:'HIGH PUNCH',lk:'KNEE STRIKE',mk:'DOUBLE KICK',hk:'ROUNDHOUSE',airpunch:'AIR PUNCH',jumpkick:'FLYING KICK',sweep:'LOW SWEEP',block:'GUARD',crouch:'CROUCH',stepback:'BACKSTEP',back:'BACK WALK',backrun:'BACK RUN',hit:'HIT REACTION',fall:'KNOCKDOWN',recover:'GET UP',lance:'ARC LANCE'};
const groundPunches=['mp','lp','hp'],groundKicks=['hk','mk','lk'];
const binds=[
  ['Orbit / zoom','Drag the arena / pinch or scroll'],['Center camera','Camera reset / Home'],
  ['Move / run','WASD or arrows / Shift'],['Jump / backflip','Space / tap Jump again in air'],
  ['High · mid · low punch','U · I · O'],['High · mid · low kick','3 · 2 · 1'],
  ['Punch / kick chains','J / K'],['Air punch / flying kick','Jump + any punch / kick'],
  ['Rapid chest cannon','Hold Fire / E'],['Arc Lance','V'],
  ['Ascend / hover','Hold Ascend / R, release to hover'],
  ['Descend / land','Hold Descend / X to lower, tap to land'],
  ['Guard / crouch / sweep','B / C / crouch + low kick'],['Backstep / retreat','Q / hold Q + move'],
  ['Reaction / knockdown','H / F'],['Pause','Esc / P']
];
let state='title',session=false,loading=null,scene,camera,renderer,stage,actor,rig,shot,orbit,systems,compat=false;
let mode='idle',rate=2,air=null,strike=null,queued=null,finished=false,hits=0,seconds=0,cd=0,angle=Math.PI,px=0,pz=1.4;
let pc=0,kc=0,lastPunch=-9,lastKick=-9,feedbackUntil=0,activePanel='',lastTime=0,sound=false,ac;
let pads=[],lastMovePad='';


function readout(text){if($('action').textContent!==text)$('action').textContent=text;}
function note(text,duration=1){$('feedback').textContent=text;feedbackUntil=seconds+duration;}
function beep(f=200,dt=.08,end=65,type='triangle'){
  if(!sound||!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,ac.currentTime);o.frequency.exponentialRampToValueAtTime(end,ac.currentTime+dt);
  g.gain.setValueAtTime(.043,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dt);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+dt+.01);
}
$('audio').onclick=async()=>{try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();await ac.resume();sound=!sound;$('audio').setAttribute('aria-pressed',sound);$('audio').setAttribute('aria-label',sound?'Mute sound':'Enable sound');if(sound)beep(440,.09,660);}catch{ $('audio').title='Sound unavailable'; }};
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else{document.body.classList.toggle('expanded');$('full').setAttribute('aria-pressed',document.body.classList.contains('expanded'));}}catch{document.body.classList.toggle('expanded');}};
document.addEventListener('fullscreenchange',()=>$('full').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen'));
function configureHUD(){
  document.querySelector('.playhud').hidden=!session;document.querySelector('.bottomhud').hidden=!session;
  poster.hidden=session;document.body.classList.toggle('playing',session);
  $('state').textContent=state==='paused'?'PAUSED':session?'LIVE INPUT':state==='loading'?'LOADING':'STANDBY';
}
function closePanel(){
  if(panel.open)panel.close();activePanel='';
  if(state==='paused'){state='play';lastTime=performance.now();}configureHUD();
  if(session)renderer.domElement.focus({preventScroll:true});
}
function openPanel(kind){
  if(state==='loading')return;if(session)state='paused';input.clear();held.clear();pads=[];lastMovePad='';orbit?.clear();systems?.cancelFire();activePanel=kind;configureHUD();
  $('panelTitle').textContent=kind==='moves'?'Move list':'Arena paused';
  const content=$('panelBody');content.replaceChildren();
  if(kind==='moves'){
    const p=document.createElement('p');p.textContent='Each strike button selects its own GS Fighter III move. Hold Fire while moving or hovering to cycle the chest cannon. Face a training core for a guided shot.';content.append(p);
    for(const [left,right] of binds){const row=document.createElement('div');row.className='listrow';const b=document.createElement('b'),span=document.createElement('span');b.textContent=left;span.textContent=right;row.append(b,span);content.append(row);}
    const p2=document.createElement('p');p2.textContent='Gamepad • Left stick moves and right stick orbits. X punches and B kicks. Hold LB for low or RB for high. RT fires, Y casts Arc Lance, A jumps, LT crouches. Click and hold the left stick to ascend or the right stick to descend. Start pauses.';content.append(p2);
  }else{
    const p=document.createElement('p');p.textContent='Your position and practice hits are saved for this session.';content.append(p);
    const row=document.createElement('div');row.className='modalbuttons';content.append(row);
    for(const [label,action,cls] of [['Resume',closePanel,'primary'],['Move list',()=>openPanel('moves'),'secondary'],['Title screen',goTitle,'secondary']]){
      const b=document.createElement('button');b.className=cls;b.textContent=label;b.onclick=action;row.append(b);
    }
  }
  if(!panel.open)panel.showModal();
}
panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});panel.addEventListener('click',e=>{if(e.target===panel)closePanel();});
$('close').onclick=closePanel;$('navMoves').onclick=$('manual').onclick=()=>openPanel('moves');
$('arenaTab').onclick=()=>{if(panel.open)closePanel();if(session)renderer.domElement.focus();else titleButton.focus();};
$('pause').onclick=()=>openPanel('pause');$('recenter').onclick=()=>{orbit?.reset();renderer?.domElement.focus({preventScroll:true});};
function goTitle(){systems?.reset();orbit?.clear();session=false;state='title';closePanel();input.clear();readout('SYSTEM READY');$('feedback').textContent='';titleButton.focus();}
function glowMaterial(){
  const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'#fff');g.addColorStop(.22,'rgba(255,255,255,.54)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,64,64);
  const texture=new T.CanvasTexture(cv);
  return color=>new T.Sprite(new T.SpriteMaterial({map:texture,color,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));
}
async function prepare(){
  if(!window.CyborgMeshData)await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='assets/cyborg.js';el.onload=resolve;el.onerror=()=>{el.remove();reject(Error('Cyborg asset could not load'));};document.head.append(el);});
  if(!renderer){
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}
    catch{renderer=new FighterCanvasRenderer();compat=true;}
    renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Cyborg flight arena. Drag to orbit, pinch to zoom. R ascends, X descends, E fires the chest cannon.');
    $('world').append(renderer.domElement);renderer.outputEncoding=T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));scene=new T.Scene();camera=new T.PerspectiveCamera(43,1,.06,120);stage=buildArena(scene,compat);orbit=createArenaOrbit(renderer.domElement,camera,()=>state==='play');
    actor=new T.Group();scene.add(actor);window.ArcLanceImage='assets/arc-lance.webp';shot=createArcLanceVisual(glowMaterial());scene.add(shot.group);shot.group.visible=false;
    new ResizeObserver(resize).observe(screen);
  }
  if(compat&&!window.CyborgLOD)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/cyborg-lod.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
  if(!rig){rig=createFighterRig('Cyborg',compat?{...CyborgMeshData,...CyborgLOD}:CyborgMeshData);actor.add(rig.root);rig.onFinished(()=>{finished=true;});}
  try{await rig.ready;}catch(e){actor.remove(rig.root);rig=null;throw e;}systems=systems||createCyborgSystems(scene,actor,rig,glowMaterial());resize();
}
function resize(){if(!renderer)return;const w=Math.max(screen.clientWidth,1),h=Math.max(screen.clientHeight,1);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
function anim(id,overrides={}){
  const key=id==='lance'?'mp':id,[clip,speed]=CyborgMoves[key];
  const rule={...CyborgRules[key],...CyborgMoves.rules[key]},loop=rule.kind==='loop';finished=false;mode=id;rate=speed;
  rig.play(clip,{root:loop?'pinned':'anchored',entry:loop?'cycle':rule.kind==='strike'?'windup':'start',loop,speed,window:rule.window,end:rule.end,active:rule.active,...overrides});readout(labels[id]||id.toUpperCase());
  return rule;
}
async function start(){
  if(state==='loading'||session)return;state='loading';titleButton.disabled=true;titleButton.querySelector('span').textContent='Loading Cyborg…';configureHUD();
  try{
    loading=loading||prepare();await loading;
    input.clear();held.clear();pads=[];lastMovePad='';px=-1.24;pz=.58;angle=Math.atan2(1.24,-.73);seconds=0;hits=0;cd=0;pc=kc=0;lastPunch=lastKick=-9;air=strike=queued=null;shot.group.visible=false;
    for(const t of stage.targets){t.flash=0;t.age=0;}
    rig.setLift(0);anim('idle',{instant:true,start:0});session=true;state='play';actor.rotation.y=angle;actor.position.set(px,0,pz);
    systems.reset();orbit.reset();orbit.update(px,.94,pz,0,true);$('hitcounter').textContent='0 HITS';configureHUD();resize();lastTime=performance.now();
    renderer.domElement.focus({preventScroll:true});note('Drag to orbit · hold Ascend to fly',2.6);beep(245,.1,420);
  }catch(e){loading=null;state='title';configureHUD();readout('LOAD INTERRUPTED');$('feedback').textContent='Could not load the arena. Tap Enter arena to retry.';console.error(e);}
  finally{titleButton.disabled=false;titleButton.querySelector('span').textContent='Enter arena';}
}
titleButton.onclick=start;
function jump(flip=false){
  if(air&&!flip)return;if(!air){air={t:0,duration:.74,attacked:false};beep(110,.12,260);}
  strike=null;queued=null;
  const id=flip?'jump':'up',info=rig.analyze(CyborgMoves[id][0]);
  const begin=flip&&air.t>0?(info.air?.[0]??0):0, end=info.air?.[1]??info.duration;
  anim(id,{start:begin,end,hipY:{base:rig.data.bones[0].position[1],scale:.62}});rate=Math.max(.6,(end-begin)/Math.max(.16,air.duration-air.t));
}
function strikeNow(key){
  const isAerial=!!air;
  if(isAerial){if(air.attacked)return;air.attacked=true;key=['kick','lk','mk','hk'].includes(key)?'jumpkick':'airpunch';}
  else if(key==='lk'&&held.has('crouch')&&!systems.flight.on){key='sweep';}
  else if(key==='attack'){if(seconds-lastPunch>1.4)pc=0;key=groundPunches[pc++%3];lastPunch=seconds;}
  else if(key==='kick'){if(held.has('crouch'))key='sweep';else{if(seconds-lastKick>1.5)kc=0;key=groundKicks[kc++%3];lastKick=seconds;}}
  const info=rig.analyze(CyborgMoves[key==='lance'?'mp':key][0]),extra={};
  if(isAerial){const lo=info.air?.[0]??info.duration*.29;extra.start=key==='airpunch'?(air.t<air.duration*.5?.72:1):lo;extra.end=key==='airpunch'?1.55:(info.air?.[1]??info.duration*.76);extra.hipY={base:rig.data.bones[0].position[1],scale:.48};}
  const rule=anim(key,extra);
  if(isAerial)rate=(extra.end-extra.start)/Math.max(.12,air.duration-air.t);
  strike={events:key==='lance'?[rule.active]:(rule.contacts||[rule.active??Math.max(rig.time,info.activeAt)]),index:0};
  beep(key==='lance'?430:key==='jumpkick'||groundKicks.includes(key)?140:210,.07,60);
}
function press(key){
  if(state==='play')advance(performance.now());
  held.add(key);
  if(state==='title'){readout(({up:'FORWARD',down:'BACK',speed:'RUN',attack:'ATTACK',kick:'KICK',jump:'JUMP',lance:'ARC LANCE'})[key]||key.toUpperCase());return;}
  if(state!=='play'||['fall','recover'].includes(mode))return;
  if(key==='fire'){systems.tapFire();return;}
  if(key==='ascend'){
    if(!systems.flight.on){const height=rig.lift;air=strike=queued=null;rig.setLift(0);anim('idle');systems.ascend(height);beep(135,.18,330);}
    else systems.ascend(systems.flight.y);
    return;
  }
  if(key==='descend'){systems.lower(performance.now()/1000);return;}
  if(systems.flight.on&&['jump','stepback','fall','hit'].includes(key))return;
  if(key==='fall'||key==='hit'){air=strike=queued=null;rig.setLift(0);anim(key);return;}
  if(key==='stepback'&&!air&&!strike){anim('stepback');return;}
  if(key==='jump'){
    if(air&&!air.attacked){air.attacked=true;jump(true);}else if(!air&&!strike)jump();
    return;
  }
  if(!['attack','kick','lance','lp','mp','hp','lk','mk','hk'].includes(key))return;
  if(key==='lance'&&(air||cd>0||strike)){if(cd>0)note('Arc Lance recharging',.65);return;}
  if(strike){if(!air&&key!=='lance')queued={key,until:seconds+.32};return;}
  strikeNow(key);
}
function release(key){if(state==='play')advance(performance.now());held.delete(key);if(key==='descend'&&state==='play')systems.releaseLower(performance.now()/1000);if(state==='title'&&!held.size)readout('SYSTEM READY');}
const input=EncoreInput.mount({root:padRoot,press,release,enabled:()=>!panel.open&&(state==='play'||state==='title')});
// Touch equivalents for held modifiers and the backstep.
const aux=document.createElement('div');aux.className='aux';document.querySelector('.playhud').append(aux);
for(const [name,key] of [['Guard','block'],['Crouch','crouch'],['Evade','stepback']]){
  const button=document.createElement('button');button.textContent=name;button.setAttribute('aria-label',name);aux.append(button);
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);input.setSource('aux'+key,[key]);};
  button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>input.setSource('aux'+key,[]);
  button.onkeydown=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat)input.setSource('auxKey'+key,[key]);}};
  button.onkeyup=e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();input.setSource('auxKey'+key,[]);}};
}
window.addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='Home'&&state==='play'){e.preventDefault();orbit.reset();return;}
  if((e.code==='Escape'||e.code==='KeyP')&&session&&!panel.open){e.preventDefault();openPanel('pause');}
  else if(e.code==='Enter'&&state==='title'&&!panel.open&&document.activeElement?.tagName!=='BUTTON'){e.preventDefault();start();}
});
function resetInputs(){
  // The arcade visor owns focus and the clock while its menu is open.
  const inLauncher=window.parent!==window && !document.hidden && !!window.ArcadeGameClock;
  if(session&&state==='play'&&!inLauncher)openPanel('pause');else{input.clear();held.clear();orbit?.clear();systems?.cancelFire();pads=[];lastMovePad='';}}
window.addEventListener('blur',resetInputs);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInputs();});
function pollPad(){
  let gp;try{gp=Array.from(navigator.getGamepads?.()||[]).find(Boolean);}catch{return;}
  if(!gp){orbit?.stick(0,0);if(lastMovePad||pads.some(Boolean)){for(let i=0;i<12;i++)input.setSource('gp'+i,[]);input.setSource('gp-dir',[]);pads=[];lastMovePad='';}return;}
  const now=gp.buttons.map(b=>b.pressed);
  if(now[9]&&!pads[9]){if(panel.open)closePanel();else if(session)openPanel('pause');else start();}
  if(state==='play'){
    const level=now[5]?'h':now[4]?'l':'m',map=['jump',level+'k',level+'p','lance','speed','block','crouch','fire',null,null,'ascend','descend'];
    map.forEach((key,i)=>{if(key&&!!now[i]!==!!pads[i])input.setSource('gp'+i,now[i]?[key]:[]);});
    orbit.stick(gp.axes[2]||0,gp.axes[3]||0);
    const x=gp.axes[0]||0,y=gp.axes[1]||0,dirs=[];
    if(x<-.3||now[14])dirs.push('left');if(x>.3||now[15])dirs.push('right');if(y<-.3||now[12])dirs.push('up');if(y>.3||now[13])dirs.push('down');
    if(dirs.join()!==lastMovePad){input.setSource('gp-dir',dirs);lastMovePad=dirs.join();}
  }
  pads=now;
}
function contact(target,source=labels[mode]||'STRIKE'){
  hits++;target.flash=.42;$('hitcounter').textContent=hits+' HIT'+(hits===1?'':'S');note('CONTACT  /  '+source,.65);
  beep(620,.1,135,'square');try{navigator.vibrate?.(16);}catch{}
}
function melee(){
  if(systems.flight.y>1.65)return;
  const dx=Math.sin(angle),dz=Math.cos(angle),reach=(CyborgReach[mode]||1.32)+.55;
  for(const target of stage.targets){
    const tx=target.base.position.x-px,tz=target.base.position.z-pz,front=tx*dx+tz*dz;
    if(front>-.1&&front<=reach&&Math.abs(tx*dz-tz*dx)<.81&&Math.hypot(tx,tz)<reach+.07)contact(target);
  }
}
function launch(){
  cd=2.4;shot.age=0;shot.group.visible=true;shot.dx=Math.sin(angle);shot.dz=Math.cos(angle);
  shot.group.position.set(px+shot.dx*.72,systems.flight.y+1.13,pz+shot.dz*.72);shot.group.rotation.y=angle-Math.PI/2;beep(770,.18,125,'sawtooth');
}
function updateShot(dt){
  if(!shot.group.visible)return;shot.age+=dt;const p=shot.group.position,dist=dt*13.5,ox=p.x,oz=p.z;
  p.x+=shot.dx*dist;p.z+=shot.dz*dist;shot.group.scale.setScalar(Math.min(1,.20+shot.age*4));shot.update(shot.age,1,.5+.5*Math.sin(shot.age*19));
  for(const t of stage.targets){
    const tx=t.base.position.x-ox,tz=t.base.position.z-oz,along=Math.max(0,Math.min(dist,tx*shot.dx+tz*shot.dz));
    if(Math.hypot(tx-along*shot.dx,tz-along*shot.dz,p.y-t.core.position.y)<.62){contact(t,'ARC LANCE');shot.group.visible=false;break;}
  }
  if(shot.age>1.4||Math.hypot(p.x/15,p.z/12)>1.1)shot.group.visible=false;
}
function update(dt){
  seconds+=dt;cd=Math.max(0,cd-dt);if(seconds>feedbackUntil)$('feedback').textContent='';
  const ix=Number(held.has('right'))-Number(held.has('left')),iz=Number(held.has('down'))-Number(held.has('up')),mag=Math.hypot(ix,iz);
  const cy=Math.cos(orbit.yaw),sy=Math.sin(orbit.yaw),x=(ix*cy+iz*sy)/(mag||1),z=(iz*cy-ix*sy)/(mag||1);
  const flight=systems.flight,wasFlying=flight.on,sprint=held.has('speed');
  systems.move(dt,x,z,sprint,held.has('ascend'),held.has('descend'));
  if(wasFlying&&!flight.on){anim('idle');strike=queued=null;note('Touchdown',.65);}
  const retreat=!flight.on&&held.has('stepback')&&mag>0,locked=!!strike||['hit','fall','recover','stepback'].includes(mode);
  let dx=0,dz=0;
  if(air){air.t+=dt;rig.setLift(.70*Math.sin(Math.PI*Math.min(1,air.t/air.duration)));}
  if(!air&&!locked){
    let next='idle';
    if(!flight.on)next=held.has('block')?'block':held.has('crouch')?'crouch':mag?(retreat?(sprint?'backrun':'back'):(sprint?'run':'walk')):'idle';
    if(mode!==next)anim(next);
  }
  if(flight.on){dx=flight.vx;dz=flight.vz;}
  else if(mag&&(air||(!locked&&!['block','crouch'].includes(mode)))){
    const speed=air?(sprint?4.9:3.35):CyborgMoves.speeds[mode]||2;dx=x*speed;dz=z*speed;
  }else if(mode==='stepback'){dx=-Math.sin(angle)*2.6;dz=-Math.cos(angle)*2.6;}
  if(mag&&!strike&&!retreat&&(flight.on||dx||dz)){
    const aim=Math.atan2(x,z);angle+=Math.atan2(Math.sin(aim-angle),Math.cos(aim-angle))*(1-Math.exp(-(flight.on?12:22)*dt));
  }
  px+=dx*dt;pz+=dz*dt;
  for(const t of stage.targets){const vx=px-t.base.position.x,vz=pz-t.base.position.z,d=Math.hypot(vx,vz);if(flight.y<1.8&&d<.88){px=t.base.position.x+(d?vx/d:0)*.88;pz=t.base.position.z+(d?vz/d:1)*.88;}}
  const boundary=Math.hypot(px/15.9,pz/12.9);if(boundary>1){px/=boundary;pz/=boundary;}
  actor.position.set(px,flight.y+(flight.on ? .045*Math.sin(seconds*3.7)*Math.min(1,flight.y) : 0),pz);actor.rotation.y=angle;
  rig.update(dt,rate);
  if(strike){
    while(strike.index<strike.events.length&&rig.time>=strike.events[strike.index]){if(mode==='lance')launch();else melee();strike.index++;}
    if(queued&&queued.until<seconds)queued=null;
    if(!air&&queued&&strike.index===strike.events.length){const key=queued.key;queued=null;strike=null;strikeNow(key);}
  }
  if(air&&air.t>=air.duration){air=null;strike=null;queued=null;rig.setLift(0);anim('idle');}
  else if(finished&&!air){finished=false;if(mode==='fall')anim('recover');else if(!['block','crouch'].includes(mode)){strike=null;anim('idle');}}
  systems.pose(dt,angle,mode,seconds);
  systems.weapon(dt,held.has('fire'),!['fall','recover'].includes(mode),angle,stage.targets,t=>contact(t,'CHEST CANNON'),()=>beep(660,.075,155,'triangle'));
  updateShot(dt);
  stage.shadow.position.set(px,.045,pz);stage.shadow.scale.setScalar(1+Math.min(3,rig.lift+flight.y)*.22);
  for(let i=0;i<stage.targets.length;i++){const t=stage.targets[i];t.age+=dt;t.flash=Math.max(0,t.flash-dt);t.core.position.y=1.14+.08*Math.sin(t.age*2.3+i);t.core.rotation.y=t.age*.8+i;t.halo.rotation.x=.52+.25*Math.sin(t.age*1.8);t.light.emissive.setHex(t.flash>0?0xff981c:0x1699a8);t.core.scale.setScalar(1+t.flash*.45);}
  orbit.update(px,.94+flight.y+(air?rig.lift*.32:0),pz,dt);
  const flightLabel=flight.on?(flight.landing?'LANDING':held.has('ascend')?'ASCENDING':held.has('descend')?'DESCENDING':mag?'FLIGHT':'HOVER'):'GROUND';
  const altitude=flight.y.toFixed(1)+' m',bearing=((Math.round(orbit.yaw*180/Math.PI)%360)+360)%360;
  const telemetry=flightLabel+'  /  '+altitude+'  ·  '+String(bearing).padStart(3,'0')+'°';
  if($('telemetry').textContent!==telemetry)$('telemetry').textContent=telemetry;
  const rounds=systems.shots+' RDS';if($('rounds').textContent!==rounds)$('rounds').textContent=rounds;
  if(mode==='idle'||held.has('fire'))readout(held.has('fire')?'AUTO FIRE':flight.on?flightLabel:labels[mode]);
  $('screen').dataset.move=mode;
}
// Input edges use the same clock as animation. This preserves a held burst or
// ascent even when a device renders at a lower rate than the combat simulation.
function advance(now){
  if(state!=='play'||now<=lastTime)return;
  let elapsed=Math.min(1.5,(now-lastTime)/1000);lastTime=now;
  while(elapsed>.00001){const step=Math.min(elapsed,1/30);update(step);elapsed-=step;}
}
function frame(now){
  requestAnimationFrame(frame);pollPad();
  if(state==='play'){advance(now);renderer.render(scene,camera);}
}
requestAnimationFrame(frame);
})();
