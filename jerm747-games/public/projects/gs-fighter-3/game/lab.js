(function(){'use strict';
const T=THREE,$=id=>document.getElementById(id),stage=$('stage'),scene=new T.Scene(); // transparent: the Living River stage is drawn behind
let selection=null,cameraPadReleased=true;
let cameraYaw=0,cameraPitch=.08;
const camera=new T.OrthographicCamera(-9,9,4,-4,.1,100);let zoom=1,zoomBias=1,padOpen=true;
let renderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});renderer.isWebGLRenderer=true;renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputEncoding=T.sRGBEncoding;renderer.shadowMap.enabled=true;}catch{renderer=new FighterCanvasRenderer();$('render-mode').textContent='Compatibility graphics';}stage.appendChild(renderer.domElement);GSFQuality.init(renderer);
const hemi=new T.HemisphereLight(0xe8efff,0x4d3e37,1.5);scene.add(hemi);const light=new T.DirectionalLight(0xffe9ce,2);light.position.set(-2,7,5);scene.add(light,light.target);const courtyard=createCourtyard(T,scene);const stageWalls=createStageWalls(T,scene),wallFocus=new T.Vector3();const riverScene=createRiverScenery(T,scene,renderer.capabilities?.maxTextureSize||4096);
light.castShadow=true;light.shadow.mapSize.set(Math.min(GSFQuality.profile.shadow,GSFQuality.maxTextureSize),Math.min(GSFQuality.profile.shadow,GSFQuality.maxTextureSize));light.shadow.bias=-.00015;light.shadow.normalBias=.02;Object.assign(light.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:20});light.shadow.radius=4;
/* 1.3.1: the stone environment reflection (with its built-in sun) blew the floor out to white-yellow once the
   renderer flag enabled it. It stays available but off by default; ?stoneenv=0.3 turns it on at that strength. */
try{const envI=Number(new URLSearchParams(location.search).get('stoneenv')||0);const surface=courtyard.userData.surface;surface.environment=envI>0?GSFQuality.makeStoneEnvironment(T,renderer):null;for(const m of surface.materials){m.envMap=surface.environment?.texture||null;m.envMapIntensity=envI||1;m.needsUpdate=true;}}catch(e){console.warn('Stone environment lighting unavailable',e);}
// Training grid (lane line, metre marks, start marks): hidden by default now that the stage is painted; toggle with Grid.
const grid=new T.Group();grid.visible=false;scene.add(grid);
function box(w,h,d,x,y,z,color){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:1}));m.position.set(x,y,z);m.renderOrder=-10;grid.add(m);return m;}
// Invisible floor that only catches the fighters' shadows, so they sit on the painted flagstones.
const shadowFloor=new T.Mesh(new T.PlaneGeometry(40,8),new T.ShadowMaterial({opacity:.32}));shadowFloor.rotation.x=-Math.PI/2;shadowFloor.receiveShadow=true;shadowFloor.visible=false;scene.add(shadowFloor);
box(18,.025,.04,0,.002,0,0xedbd61);
for(let x=-8;x<=8;x++)box(.025,.02,x%5===0?.8:.35,x,.006,0,0x9babb9);
box(.08,.02,1,-5.5,.01,0,0xed725a);box(.08,.02,1,5.5,.01,0,0xf2c760);
// Player and training partner. Default: Nika plays, Akeem trains. ?player=Akeem swaps them.
let PLAYER=new URLSearchParams(location.search).get('player')==='Akeem'?'Akeem':'Nika',PARTNER=PLAYER==='Nika'?'Akeem':'Nika';
const fighters=Object.fromEntries(FighterRoster.filter(f=>f.data()).map(f=>[f.id,createFighterRig(f.id,f.data())])),defaults=FighterDefaults;let active=fighters[PLAYER],opponent=fighters[PARTNER];
let MY=defaults[PLAYER],THEIRS=defaults[PARTNER];
const player=new T.Group(),target=new T.Group();scene.add(player,target);player.add(active.root);target.add(opponent.root);player.rotation.y=Math.PI/2;target.rotation.y=-Math.PI/2;
// Foot planting: one planter per fighter, plus floor markers shown with the skeleton view (gold = planted).
const planters={},markers=[];for(const [k,f] of Object.entries(fighters)){planters[k]=createFootPlanter(f);if(planters[k])for(const ft of planters[k].feet){const m=new T.Mesh(new T.RingGeometry(.05,.09,20),new T.MeshBasicMaterial({color:0xedbd61,depthTest:false,transparent:true}));m.rotation.x=-Math.PI/2;m.renderOrder=20;m.visible=false;scene.add(m);markers.push([ft,m]);}}
function plantFeet(dt){const show=$('skeleton').checked;player.updateMatrixWorld(true);target.updateMatrixWorld(true);
 planters[active.label]?.update(dt,active.playing&&rules[mode]?.ik!==false&&mode!=='bind'&&!air);planters[opponent.label]?.update(dt,opponent.playing&&!['fall','recover','hit'].includes(enemyMode));
 for(const [ft,m] of markers){m.visible=show&&ft.weight>0;m.position.set(ft.from.x,.012,ft.from.z);m.material.opacity=.35+.65*ft.weight;m.material.color.setHex(ft.locked?0xedbd61:0x9babb9);}}
for(const f of Object.values(fighters)){f.setInPlace(true);f.helper=new T.SkeletonHelper(f.root);f.helper.material.depthTest=false;f.helper.visible=false;scene.add(f.helper);}
let jumpDir=0,curRule=null,bufferedAt=0,landed=false,airAttackDone=false,queuedAirPunch=false,air=null,airUsed=false,upAt=-Infinity,kickAt=-Infinity,backStart=0,backFast=false,x=-5.5,nikaX=5.5,mode='idle',pending=false,returnIdle=false,direction=0,running=false,runAt=Infinity,held=new Map(),lastTap={left:-Infinity,right:-Infinity},hitCount=0,hitDone=false,enemyReact=false;
const strikeWindows=new Set(),tempo=GSFCombatTiming;
const pretty=s=>s.replaceAll('_',' '),keys={arrowleft:'left',arrowright:'right',arrowup:'up',arrowdown:'down',' ':'jump',j:'mp',u:'hp',l:'lp',p:'hk',o:'mk',k:'lk',b:'block',v:'vwave',c:'duck',f:'fall',h:'hit'};
function hud(){ $('clip-name').textContent=active.current?pretty(active.current.name):'T-pose';$('input-state').textContent=pretty(mode)+' · '+playSpeed+'×';$('play').textContent=active.playing?'Pause':'Play';$('timeline').max=active.duration;document.querySelectorAll('[data-clip]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clip===active.current?.name)));}
// v0.10 transition logic: move rules, cancel windows and an input buffer (see fighter-defaults.js).
let playSpeed=1;$('speed').onchange=()=>{playSpeed=Number($('speed').value);};
// Shared move rules, with any per-fighter overrides from FighterDefaults.<name>.rules.
const rules=Object.fromEntries(Object.entries(window.FighterMoveRules).map(([k,v])=>[k,{...v,...(MY.rules?.[k]||{})}])),entryFor={loop:'cycle',hold:'windup',strike:'windup',air:'lead',react:'lead',step:'lead'};let buffered=null,cancels=false;const rhythmQueue=[];let health=[100,100],enemyMode='idle',enemyPending=false,enemySpeed=1,koWait=0;
const combatRules=FighterCombatRules;
// Sweeps stay anchored so a linked punch cannot snap the fighter back along the lane.
rules.sweep.root='anchored';
const finishClock=createFinishClock(),vwave=createVWaveSystem(T,scene),reactions=createReactionController(T);let waveCast=null,reactionTests=[];
// 1.3.2: Cyborg fires the Arc Lance (restored from 1.1.0/1.2.0); everyone else fires the V-Wave orb.
function waveVar(id){return FighterRoster.find(f=>f.id===String(id).replace('__P2',''))?.waveVariant||'orb';}
vwave.config.resolveColors=owner=>FighterRoster.find(f=>f.id===(owner===1?PARTNER:PLAYER))?.energy.colors;
function beginVWave(){
 if(air||AIR_MOVES.includes(mode)||['fall','recover','hit','bind','preview'].includes(mode)||!vwave.ready()||waveCast)return;
 if(!MOVABLE.includes(mode)&&!['block','crouch'].includes(mode)){ $('status').textContent='Finish the current move before casting V-Wave';return; }
 rhythmQueue.length=0;buffered=null;mode='vwave';
 const id=PLAYER==='Nika'?'hp':'mp',d=MY[id],r={...rules[id],root:'pinned'};
 play(d[0],false,true,d[1],r);waveCast={release:r.active,start:active.time,clip:d[0]};
 $('status').textContent='Azure V-Wave · charging';
}
function resetEffects(keepCycles=false){waveCast=null;vwave.reset();finishClock.reset();reactions.reset(keepCycles===true);reactionTests=[];$('reaction-status').textContent='Ready · body, waist, face, side and launch reactions';}
function waveHit(p,t){
 if(demoPlaying){
  if(roundOver)return;const c=cpus[t.owner],blocked=c.move==='block';
  c.hp=Math.max(0,c.hp-(blocked?2:p.damage));
  if(!blocked||c.hp===0)cpuMove(c,c.hp===0||p.powerful?'fall':'hit',{move:'vwave',height:'mid',heavy:true,damage:p.damage,knockdown:c.hp===0||p.powerful,side:0});
  if(c.hp===0)finishRound(1-t.owner);
 }else if(match.active&&t.owner===0){hitPlayer('vwave',p.damage,true);
 }else{
  if(!$('hit-test').checked||health[1]<=0)return;
  hitCount++;health[1]=Math.max(0,health[1]-auraDmg(0,1,p.damage));
  reactOpponent(health[1]===0||p.powerful?'fall':'hit',{move:'vwave',height:'mid',heavy:true,damage:p.damage,knockdown:health[1]===0||p.powerful,side:0});if(health[1]===0){rhythmQueue.length=0;buffered=null;finishClock.impact();}updateHealth();
 }
}
function updateCombatEffects(dt){
 reactions.update(dt);
 if(waveCast&&(mode!=='vwave'||active.current?.name!==waveCast.clip)){waveCast=null;vwave.clearCharge(0);}
 const targets=demoPlaying?cpus.map((c,i)=>({owner:i,x:i?nikaX-opponent.sway:x+active.sway,alive:!roundOver&&c.hp>0&&!['fall','recover'].includes(c.move)})):
 [{owner:1,x:nikaX-opponent.sway,alive:$('hit-test').checked&&health[1]>0&&!['fall','recover'].includes(enemyMode)}].concat(match.active?[{owner:0,x:x+active.sway,alive:health[0]>0&&!['fall','recover'].includes(mode)}]:[]);
 vwave.update(dt,targets,waveHit);
 const cooldown=vwave.state.cooldowns[0],label=$('vwave-ready');
 label.textContent=vwave.azure.status==='loading'?'LOAD':waveCast?'CAST':cooldown>0?cooldown.toFixed(1)+'s':'V';
 $('vwave-button').setAttribute('aria-disabled',String(!!waveCast||!vwave.ready()));
 const state=finishClock.state;$('finish-indicator').hidden=state.phase==='idle';
 $('finish-indicator').textContent=state.phase==='impact'?'FINISH · '+state.scale.toFixed(2)+'×':'FINAL EXCHANGE';
}
$('finish-slowmo').onchange=()=>{finishClock.config.enabled=$('finish-slowmo').checked;finishClock.reset();};
$('finish-lead').onchange=()=>finishClock.config.lead=$('finish-lead').value;
$('finish-speed').oninput=()=>{finishClock.config.scale=Number($('finish-speed').value);$('finish-speed-value').textContent=finishClock.config.scale.toFixed(2)+'×';};
for(const key of ['radius','speed'])$('vwave-'+key).oninput=()=>{vwave.config[key]=Number($('vwave-'+key).value);$('vwave-'+key+'-value').textContent=vwave.config[key].toFixed(key==='radius'?2:1)+(key==='radius'?' m':' m/s');};
$('vwave-color').onchange=()=>{vwave.config.resolveColors=null;vwave.config.palette=$('vwave-color').value;};
$('vwave-glow').oninput=()=>{vwave.config.glow=Number($('vwave-glow').value);$('vwave-glow-value').textContent=Math.round(vwave.config.glow*100)+'%';};
$('vwave-pulse').onchange=()=>vwave.config.pulse=$('vwave-pulse').checked;
vwave.azure.ready?.then(()=>{$('vwave-asset-status').textContent=vwave.azure.status==='ready'?'Azure mesh ready · 24 damage · knockdown · 2.4 s recharge':'Mesh unavailable · glowing energy fallback active';});
$('finish-setup').onclick=()=>{reset();x=-.425;nikaX=.425;player.position.x=x;target.position.x=nikaX;health[1]=5;updateHealth();fitCamera();$('status').textContent='Final hit ready · land a punch or V-Wave (5 HP)';document.querySelector('.controller-settings').open=false;};
const LINK_COST=1.5; // after the active frame, a buffered move fires as soon as its entry pose matches this well (or 60% into recovery)
function describe(t,speed){if(!t)return '';const p=pretty(t.to);if(!active.smart)return p+' · classic v0.9 blend from frame 0';
 if(t.loop&&t.cost!=null)return p+' · phase-matched at '+(Math.round(t.entry/Math.max(.001,active.duration)*100)%100)+'% of cycle';
 if(t.entry>.005)return p+' · entered at '+t.entry.toFixed(2)+' s · '+(t.entry/speed).toFixed(2)+' s of windup skipped';return p+' · from first frame';}
function play(name,loop=false,reset=false,speed=2,rule=null,entry){pending=false;curRule=rule;returnIdle=reset;hitDone=false;strikeWindows.clear();airUsed=false;if(!air){airAttackDone=false;}if(!AIR_MOVES.includes(mode))landed=false;playSpeed=speed;$('speed').value=String([.5,1,1.5,2,2.2,2.4,2.5,3,3.5,4].includes(speed)?speed:1);active.play(name,{loop,speed,root:rule?.root,entry:entry??(rule?entryFor[rule.kind]:'start'),window:entry==='start'?undefined:rule?.window,end:rule?.end,active:rule?.active,hipY:rule?.hipY});$('loop').checked=loop;$('status').textContent=describe(active.lastTransition,speed);hud();}
function cancelAt(){const r=curRule??rules[mode];if(!r||!active.current)return 0;if(r.cancel!=null)return active.duration*r.cancel;if(r.kind==='strike')return tempo.linkAt(active.smart?r:null,active.smart?active.clipInfo.activeAt:active.duration*.45,playSpeed,active.clipEnd??active.duration);return 0;}
// A buffered move links when (a) the cancel point has passed and (b) the body is in a pose the next move can start from.
function linkReady(id){const r=rules[mode];if(!cancels||!r||!['strike','air','react'].includes(r.kind)||!active.playing)return true;const c=cancelAt(),t=active.time;if(t<c)return false;if(!active.smart)return true;
 const end=active.clipEnd??active.duration,nr=rules[id]||{kind:'strike'};return t>=c+(end-c)*.6||active.entryCost(MY[id][0],entryFor[nr.kind],nr.window)<LINK_COST;}
const KICKS=['lk','mk','hk'],PUNCHES=['lp','mp','hp'],AIR_MOVES=['up','jump','jumpkick','airpunch'],GROUND_ONLY=['block','crouch','stepback','back','backrun','walk','run','idle','sweep'];
// Jump kick. In the air: enter the flying kick at the frame closest to the current jump pose and finish it within the
// remaining air time. Up + kick together (within 150 ms, before takeoff): the flying kick's own full takeoff.
function airPlaybackSpeed(end,fixedSpeed){
 const remaining=Math.max(.025,air.T-air.t);
 const speed=fixedSpeed??T.MathUtils.clamp((end-active.time)/remaining,1.5,3);
 {
  // Preserve the current arc phase when shortening the remaining flight time.
  const u=Math.min(.98,air.t/air.T),left=Math.max(.025,(end-active.time)/speed);
  air.T=left/(1-u);air.t=u*air.T;
 }
 return speed;
}
function jumpKick(now,fromGround){const d=MY.jumpkick,r=rules.jumpkick,info=active.analyze(d[0]);if(!info)return false;mode='jumpkick';airAttackDone=true;
 if(fromGround){play(d[0],false,true,d[1],r,'start');return true;}
 const remaining=Math.max(.15,air.T-air.t),win=info.air?[info.air[0],Math.max(info.air[0],info.activeAt-.05)]:[0,info.activeAt];
 play(d[0],false,true,d[1],{...r,window:win},'windup');airUsed=true;const land=info.air?info.air[1]:info.duration*.6;
 air.clip=[active.time,land];playSpeed=airPlaybackSpeed(land);$('status').textContent+=' · finishes in the air time left';return true;}
// Air punch: same idea as the air kick. Rising half of the jump = rising punch, falling half = falling punch.
function jumpPunch(){const d=MY.airpunch,r=rules.airpunch;if(!d||!r||!air)return false;const rising=air.t/air.T<.5,seg=rising?r.rising:r.falling;
 mode='airpunch';airAttackDone=true;play(d[0],false,true,d[1],{...r,window:seg.window,active:seg.active},'windup');airUsed=true;
 const remaining=Math.max(.15,air.T-air.t);playSpeed=airPlaybackSpeed(r.land);
 $('status').textContent=(rising?'Rising':'Falling')+' punch · '+pretty(d[0])+' at '+active.time.toFixed(2)+' s · lands with the jump';return true;}
// Backflip in the air: from an ↑ jump, Space (or ↑+← pressed again) takes over with the backflip's airborne section,
// picked up at the closest frame, finished within the remaining air time, and the drift turns backward.
function airFlip(){const d=MY.jump,r=rules.jump,info=d&&active.analyze(d[0]);if(!info?.air||!air)return false;
 const win=[info.air[0],info.air[0]+(info.air[1]-info.air[0])*.5];mode='jump';airAttackDone=true;
 play(d[0],false,true,d[1],{...r,window:win},'windup');airUsed=true;const remaining=Math.max(.15,air.T-air.t);
 playSpeed=airPlaybackSpeed(info.air[1],PLAYER==='Nika'?MY.jump[1]:undefined);air.vx=-(MY.air?.jump?.drift?.back??1.5);
 $('status').textContent='Backflip takes over the jump at '+active.time.toFixed(2)+' s';return true;}
function preTakeoff(){const ci=active.clipInfo;return mode==='up'&&!air&&!airUsed&&!!ci?.air&&active.time<ci.air[0];}
function action(id,now=performance.now(),fromQueue=false){
 if(id==='vwave'){beginVWave();return;}
 if(id==='hit'){const p=reactions.choose(active,{...reactions.profile(PARTNER,'hp'),side:-1});if(p){waveCast=null;vwave.clearCharge(0);buffered=null;rhythmQueue.length=0;air=null;mode='hit';pending=false;returnIdle=true;curRule=rules.hit;playSpeed=p.speed;reactions.apply(active,p);showReaction(p);hud();return;}}
 if(mode==='vwave'&&waveCast&&!['fall','hit','recover','idle'].includes(id))return;
 if(waveCast&&['fall','hit','recover','idle'].includes(id)){waveCast=null;vwave.clearCharge(0);}
 const ground=tempo.ground;
 if(!ground.includes(id))rhythmQueue.length=0; // Guard, movement, jump and recovery cancel queued offense.
 if(!fromQueue&&!cancels&&ground.includes(id)&&ground.includes(mode)&&active.playing){
  const contact=tempo.linkAt(curRule,active.clipInfo?.activeAt??0,playSpeed,active.clipEnd??active.duration);
  if(active.time<contact){
   if(rhythmQueue.length<tempo.queueLimit)rhythmQueue.push({id,at:now});
   return;
  }
 }

 if(id==='lk'&&mode==='crouch'&&MY.sweep)id='sweep';
 const attack=KICKS.includes(id)||PUNCHES.includes(id);if(KICKS.includes(id))kickAt=now;
 let fresh=false; // a press after touchdown cancels the landing; it is never a leftover from the air
 if(attack&&AIR_MOVES.includes(mode)){
  if(air){if(mode==='up'&&!airAttackDone){if(KICKS.includes(id))jumpKick(now,false);else jumpPunch();}return;} // one air attack per jump; extra presses are dropped
  if(preTakeoff()){if(KICKS.includes(id))jumpKick(now,true);else queuedAirPunch=true;return;} // during the jump's crouch
  fresh=landed;}
 // ↑ while holding ← = backflip (the purple Jump button still works too).
 if(id==='up'&&direction<0&&!air&&MY.jump)id='jump';
 if(id==='jump'&&air){if(mode==='up'&&!airAttackDone)airFlip();return;} // never start a ground backflip mid-air
 if(id==='up'||id==='jump')jumpDir=direction; // remember the direction held when the jump was pressed
 if(id==='up'){upAt=now;if(KICKS.includes(mode)&&now-kickAt<=(MY.input?.kickThenUp??.15)*1000&&active.time<.25*active.duration&&jumpKick(now,true))return;}
 if(air&&GROUND_ONLY.includes(id))return; // no guarding or walking mid-air
 const d=MY[id];if(!d)return;const r=rules[id]||{kind:'strike',root:'anchored'};
 if(['strike','air'].includes(r.kind)&&!fresh&&!linkReady(id)){if(AIR_MOVES.includes(mode))return;buffered=id;bufferedAt=now;$('status').textContent='Buffered '+pretty(d[0])+' · links after the active frame';return;}
 // Same looping clip already playing (back walk ↔ fast back walk, etc.): change speed only, no new blend.
 if(r.kind==='loop'&&active.playing&&active.current?.name===d[0]&&rules[mode]?.kind==='loop'){mode=id;playSpeed=strideSpeed(id,d);hud();return;}
 buffered=null;mode=id;active.setBlend(Number($('blend').value));play(d[0],r.kind==='loop',!['loop','hold'].includes(r.kind),strideSpeed(id,d),r);
 if(r.window&&active.smart)$('status').textContent=pretty(id)+' · '+pretty(d[0])+' section '+r.window[0]+'–'+(r.end??'end')+' s · picked up at '+active.time.toFixed(2)+' s to match the current pose';}
// Stride matching: with foot IK on, walk and run play at the rate where the clip's feet move at the arena speed.
let WORLD_SPEED=MY.speeds||{walk:1,run:2.6,back:.9,backrun:1.4};
function strideSpeed(id,d){if(!WORLD_SPEED[id]||!$('footik').checked||!active.smart)return d[1];const g=active.analyze(d[0])?.groundSpeed;return g>.2?Math.max(1.5,+(WORLD_SPEED[id]/g).toFixed(2)):d[1];}
function desired(){const ids=[...held.values()];if(ids.includes('block'))return 'block';if(ids.includes('duck')||ids.includes('down'))return 'crouch';if(direction>0)return running?'run':'walk';if(direction<0)return backFast?'backrun':'back';return 'idle';}
function settle(){const next=desired();if(mode!==next)action(next);}
function bindRigCallbacks(){active.onFinished(()=>{if(demoPlaying)return;pending=returnIdle;hud();});opponent.onFinished(()=>{if(demoPlaying)return;enemyPending=true;});}
bindRigCallbacks();
function updateDirection(){const ids=[...held.values()],next=ids.includes('right')?1:ids.includes('left')?-1:0;if(next!==direction){direction=next;running=false;runAt=Infinity;if(next>=0)backFast=false;}}
// 1.4 Quick recovery: once feet are back on the floor after a jump/backflip, or a get-up is ~70% done, movement,
// block and attacks may cut the rest of the pose. Attack timing is unchanged. Options › Gameplay › Quick recovery.
function tailFree(){if(window.GSFQuickRecover===false||!active.current)return false;
 if(AIR_MOVES.includes(mode)&&!air&&landed)return true;
 if(mode==='recover'&&health[0]>0&&active.time>=(active.clipEnd??active.duration)*.7)return true;return false;}
function inputDown(id,token,now=performance.now()){if(window.GSFPostFight?.active||selection?.isOpen||held.has(token)||window.GSFPaused||window.GSFLoading?.busy)return;held.set(token,id);if(id==='mp'||id==='hp')auraInput(id,now);if(tailFree()){mode='finished';settle();}if(['fall','recover'].includes(mode))return;if(match.active&&(match.state!=='fight'||health[0]<=0)&&!['left','right','up','down'].includes(id))return;if(match.active&&match.state!=='fight')return;if(mode==='hit'&&!['left','right','up','down','block'].includes(id))return;if(id==='left'||id==='right'){updateDirection();const twice=now-lastTap[id]<=320;lastTap[id]=now;
  if(id==='left'){backFast=twice&&direction<0;if(MOVABLE.includes(mode)){if(!backFast&&direction<0&&['idle','walk','run'].includes(mode)){backStart=now;action('stepback',now);}else settle();}}
  else{if(twice){running=false;runAt=now+500;}if(MOVABLE.includes(mode))settle();}}
 else if(['down','duck','block'].includes(id))action(id==='block'?'block':'crouch',now);else action(id,now);}
// The player faces right: ← is backward. Tap = one step back; hold = step, then walk backward; double-tap + hold = faster back walk.
const MOVABLE=['idle','walk','run','back','backrun','stepback'];
function inputUp(token){if(!held.has(token))return;held.delete(token);updateDirection();if(['walk','run','idle','block','crouch','back','backrun'].includes(mode))settle();}
function clearInput(reset=false){if(typeof padDirs!=='undefined'){padDirs=[];padPointer=null;}held.clear();rhythmQueue.length=0;direction=0;running=false;runAt=Infinity;lastTap={left:-Infinity,right:-Infinity};document.querySelectorAll('[data-input]').forEach(b=>b.classList.remove('pressed'));if(reset)action('idle');}
function reset(keepCycles=false){resetEffects(keepCycles===true);clearInput();health=[100,100];enemyMode='idle';enemyPending=false;enemySpeed=1;koWait=0;buffered=null;air=null;queuedAirPunch=false;airAttackDone=false;landed=false;active.setLift(0);backFast=false;for(const p of Object.values(planters))p?.reset();x=-5.5;nikaX=5.5;hitCount=0;active.resetPosition();opponent.resetPosition();action('idle');opponent.play(THEIRS.idle[0],{loop:true,entry:'cycle',root:'pinned'});enemyReact=false;player.position.x=x;target.position.x=nikaX;}
function filter(){const q=$('clip-filter').value.toLowerCase();for(const b of $('clip-list').children)b.hidden=!b.textContent.toLowerCase().includes(q);}
function rebuildClips(){$('clip-list').textContent='';for(const clip of active.clips){if(clip.name.endsWith('__Mirror'))continue;const b=document.createElement('button');b.dataset.clip=clip.name;b.textContent=pretty(clip.name)+' · '+clip.duration.toFixed(2)+'s';b.onclick=()=>{clearInput();mode='preview';const d=Object.values(MY).find(d=>d[0]===clip.name);play(clip.name,$('loop').checked,false,FighterReactionSpecs[clip.name]?reactions.config.speed:d?d[1]:2);};$('clip-list').append(b);}}
rebuildClips();$('clip-filter').oninput=filter;
$('reset').onclick=reset;$('test-jab').onclick=()=>{clearInput();action('mp');};$('test-recovery').onclick=()=>{clearInput();action('fall');};$('recovery').onchange=()=>MY.recover[0]=$('recovery').value;
$('play').onclick=()=>{active.setPlaying(!active.playing);hud();};$('restart').onclick=()=>{if(active.current)play(active.current.name,$('loop').checked,returnIdle,playSpeed);};$('loop').onchange=()=>{returnIdle=false;active.setLoop($('loop').checked);};$('timeline').oninput=()=>{pending=false;returnIdle=false;active.seek(Number($('timeline').value));hud();};$('bind').onclick=()=>{clearInput();pending=false;returnIdle=false;mode='bind';active.bind();hud();};
$('skeleton').onchange=()=>{for(const f of Object.values(fighters))f.helper.visible=$('skeleton').checked&&(f===active||f===opponent);};$('smart').onchange=()=>{for(const f of Object.values(fighters))f.setSmart($('smart').checked);buffered=null;};$('footik').onchange=()=>{for(const p of Object.values(planters))if(p){p.enabled=$('footik').checked;}};$('cancels').onchange=()=>{cancels=$('cancels').checked;buffered=null;rhythmQueue.length=0;};$('blend').oninput=()=>{for(const f of Object.values(fighters))f.setBlend(Number($('blend').value));$('blend-value').textContent=Math.round(Number($('blend').value)*1000)+' ms';};
// ---- Living River stage (stage/environment.js) ----
// The painted plate is placed so its flagstone line (y=440 of 563) sits exactly where the 3D floor is on screen at the
// current zoom, and it pans at a quarter of the fighters' speed for parallax. Its lighting presets tint the fighters.
const envCanvas=$('env'),baseHemi=hemi.intensity,baseLight=light.intensity,warmCol=new T.Color(0xff9a4a),coolCol=new T.Color(0xffe9ce);
let env=null,envOK=false;envCanvas.hidden=true;
$('weather').onchange=()=>{if(env)env.transition($('weather').value,4);};$('grid').onchange=()=>{grid.visible=$('grid').checked;};
const FLOOR_ROW=440,tmpV=new T.Vector3();
function placeStage(){if(!envOK)return;const W=envCanvas.width,H=envCanvas.height,camX=(x+nikaX)/2;
 tmpV.set(camX,0,0).project(camera);const floorY=(1-tmpV.y)/2*H,pxPerM=H/(camera.top-camera.bottom);
 let s=Math.max(W/1000,H/563)*(1+(zoom-1)*.08);s=Math.max(s,floorY/FLOOR_ROW,(H-floorY)/(563-FLOOR_ROW));
 const pan=camX*pxPerM*.25/s;let ox=W/2-(500+pan)*s;ox=Math.min(0,Math.max(W-1000*s,ox));env.setView(s,ox,floorY-FLOOR_ROW*s);}
// Smooth distance-based framing: prefer 3x in mid-range and 5x toe-to-toe.
function zoomTarget(){const gap=Math.abs(nikaX-x);return T.MathUtils.clamp(15/(gap+2.4)*zoomBias,1,5);}
let frameWidth=0,frameHeight=0,camLift=0; // camLift: eased jump height so airborne fighters stay in frame
function fitCamera(){if(selection?.isOpen)return;const w=stage.clientWidth,h=Math.max(1,stage.clientHeight),aspect=w/h;riverScene.setViewAspect(aspect);if(w!==frameWidth||h!==frameHeight){renderer.setSize(w,h);frameWidth=w;frameHeight=h;const r=Math.min(devicePixelRatio||1,1.5);envCanvas.width=Math.round(w*r);envCanvas.height=Math.round(h*r);}const centerX=(x+nikaX)/2,view=frameArenaView(T,camera,{aspect,zoom,lift:camLift,yaw:cameraYaw,pitch:cameraPitch,centerX});courtyard.userData.updateForeground(camera,centerX,view);camera.updateMatrixWorld(true);courtyard.userData.surface.updateView(camera,centerX,zoom,renderer.domElement.width,renderer.domElement.height);$('zoom-label').textContent='Auto '+zoom.toFixed(1)+'×';}
function adjustZoom(delta){zoomBias=T.MathUtils.clamp(zoomBias+delta,.4,1.5);}
$('zoom-in').onclick=()=>adjustZoom(.1);$('zoom-out').onclick=()=>adjustZoom(-.1);stage.addEventListener('wheel',e=>{e.preventDefault();adjustZoom(e.deltaY<0?.05:-.05);},{passive:false});new ResizeObserver(fitCamera).observe(stage);
$('controller-toggle').onclick=()=>{padOpen=!padOpen;clearInput();document.body.classList.toggle('controller-open',padOpen);$('touch-controller').hidden=!padOpen;$('controller-toggle').textContent=padOpen?'Move workshop':'Touch controller';$('controller-toggle').setAttribute('aria-expanded',String(padOpen));fitCamera();};
// Touch orbit: 90-degree total viewing arc; two fingers pinch. Right stick orbits, triggers zoom.
const cameraTouches=new Map();let pinchDistance=0;
function cameraReset(){cameraYaw=0;cameraPitch=.08;zoomBias=1;}
$('camera-home').onclick=cameraReset;
stage.addEventListener('pointerdown',e=>{if(titleOpen||demoPlaying||selection?.isOpen)return;e.preventDefault();stage.setPointerCapture(e.pointerId);cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});pinchDistance=0;});
stage.addEventListener('pointermove',e=>{
 if(!cameraTouches.has(e.pointerId))return;e.preventDefault();
 const prev=cameraTouches.get(e.pointerId);cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(cameraTouches.size===1){cameraYaw=T.MathUtils.clamp(cameraYaw-(e.clientX-prev.x)*.006,-Math.PI/4,Math.PI/4);cameraPitch=T.MathUtils.clamp(cameraPitch+(e.clientY-prev.y)*.003,.08,.45);}
 else{const [a,b]=[...cameraTouches.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)zoomBias=T.MathUtils.clamp(zoomBias*d/pinchDistance,.4,1.5);pinchDistance=d;}
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,e=>{cameraTouches.delete(e.pointerId);pinchDistance=0;});
function updateCameraPad(dt){
 if(titleOpen||demoPlaying||selection?.isOpen)return;const p=Array.from(navigator.getGamepads?.()||[]).find(Boolean);if(!p)return;
 if(!cameraPadReleased){if(p.axes.some(a=>Math.abs(a)>.3)||p.buttons.some(b=>b.pressed))return;cameraPadReleased=true;}
 const axis=v=>Math.abs(v||0)>.18?v:0;
 cameraYaw=T.MathUtils.clamp(cameraYaw-axis(p.axes[2])*dt,-Math.PI/4,Math.PI/4);
 cameraPitch=T.MathUtils.clamp(cameraPitch+axis(p.axes[3])*dt*.45,.08,.45);
}
// Surface workshop: only material, texture mapping and light intensity change.
for(const id of ['scale','rotation','moisture','light','relief','vignette','innerSize']){
 const input=$('surface-'+id),out=$('surface-'+id+'-value');
 input.oninput=()=>{const value=Number(input.value);courtyard.userData.surface.set(id,value);out.textContent=id==='innerSize'?value.toFixed(2)+'×':id==='rotation'?value+'°':(id==='moisture'||id==='vignette')?Math.round(value*100)+'%':value.toFixed(1);};
}
$('wall-layout').onchange=()=>stageWalls.set('layout',$('wall-layout').value);
$('wall-autoFade').onchange=()=>stageWalls.set('autoFade',$('wall-autoFade').checked);
for(const id of ['height','distance','opacity']){
 $('wall-'+id).oninput=()=>{const v=Number($('wall-'+id).value);stageWalls.set(id,v);$('wall-'+id+'-value').textContent=id==='opacity'?Math.round(v*100)+'%':v.toFixed(1)+' m';};
}
// ---- Circular 8-way pad: the whole ring is one touch zone; thumb angle snaps to 8 directions like an arcade gate. ----
// Sliding the thumb around changes direction without lifting; sliding back to the centre releases (so double-taps work).
const pad=document.querySelector('.gd-ov-pad'),padBtn=d=>pad.querySelector('[data-input="'+d+'"]');let padPointer=null,padDirs=[];
const SECTORS={0:['right'],1:['right','up'],2:['up'],3:['left','up'],4:['left'],'-4':['left'],'-3':['left','down'],'-2':['down'],'-1':['right','down']}; // horizontal first, so ↑+← reads as a backflip
function padRead(e){const r=pad.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);if(Math.hypot(dx,dy)<r.width*.1)return [];return SECTORS[Math.round(Math.atan2(-dy,dx)/(Math.PI/4))]||[];}
function padSet(dirs){for(const d of padDirs)if(!dirs.includes(d)){inputUp('pad-'+d);padBtn(d)?.classList.remove('pressed');}
 for(const d of dirs)if(!padDirs.includes(d)){if($('haptics').checked&&navigator.vibrate)navigator.vibrate(8);inputDown(d,'pad-'+d);padBtn(d)?.classList.add('pressed');}padDirs=dirs;}
pad.style.touchAction='none';
pad.addEventListener('pointerdown',e=>{if(e.button!==0||padPointer!==null)return;e.preventDefault();padPointer=e.pointerId;pad.setPointerCapture(e.pointerId);padSet(padRead(e));});
pad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer)padSet(padRead(e));});
const padEnd=e=>{if(e.pointerId!==padPointer)return;padPointer=null;padSet([]);};for(const ev of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(ev,padEnd);
pad.addEventListener('contextmenu',e=>e.preventDefault());
for(const b of pad.querySelectorAll('[data-input]'))b.addEventListener('click',e=>{if(e.detail===0){inputDown(b.dataset.input,'accessible');inputUp('accessible');}}); // keyboard/switch access
for(const b of document.querySelectorAll('[data-input]')){if(pad.contains(b))continue;b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('pressed');if($('haptics').checked&&navigator.vibrate)navigator.vibrate(12);inputDown(b.dataset.input,'p'+e.pointerId);});const release=e=>{inputUp('p'+e.pointerId);if(![...held.values()].includes(b.dataset.input))b.classList.remove('pressed');};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('click',e=>{if(e.detail===0){inputDown(b.dataset.input,'accessible');inputUp('accessible');}});}
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if(keys[k])e.preventDefault();if(e.repeat)return;if(k==='r'){reset();return;}if(keys[k])inputDown(keys[k],'k'+k);});window.addEventListener('keyup',e=>inputUp('k'+e.key.toLowerCase()));window.addEventListener('blur',()=>{if(!demoPlaying)clearInput(!(window.FighterLab?.match.active||window.GSFPaused));});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!demoPlaying)clearInput(!(window.FighterLab?.match.active||window.GSFPaused));});
const contactPoint=new T.Vector3();
const healthHUD=document.createElement('div');healthHUD.id='fight-health';
healthHUD.innerHTML='<label>'+PLAYER+'<meter min="0" max="100" value="100"></meter></label><label>'+PARTNER+'<meter min="0" max="100" value="100"></meter></label>';
stage.parentElement.append(healthHUD);
function updateHealth(){healthHUD.querySelectorAll('meter').forEach((m,i)=>{m.value=health[i];m.setAttribute('aria-label',(i?PARTNER:PLAYER)+' health '+health[i]);});}
function reactionCameraLift(){
 let top=1.65;
 for(const rig of [active,opponent])if(rig.current?.name==='BeHit_FlyUp'&&rig.playing){rig.root.updateWorldMatrix(true,true);for(const b of rig.bones){b.getWorldPosition(contactPoint);top=Math.max(top,contactPoint.y);}}
 return Math.max(0,(top-1.65)*.9);
}
function showReaction(p){$('reaction-status').textContent=pretty(p.source)+' · '+p.speed.toFixed(1)+'× · '+Math.round(p.duration*1000)+' ms'+(p.rapid?' · rapid hit':'')+(p.mirrored?' · opposite side':'');}
function reactOpponent(id,hit=null){
 enemyPending=false;enemyMode=id;enemyReact=true;
 if(hit){const p=reactions.choose(opponent,hit);if(p){enemyMode=p.kind;enemySpeed=p.speed;reactions.apply(opponent,p);showReaction(p);return;}}
 const d=THEIRS[id],r=THEIRS.rules?.[id]||{};
 enemySpeed=id==='hit'?2:d[1];opponent.setBlend(id==='hit'?.065:Number($('blend').value));
 opponent.play(d[0],{speed:enemySpeed,root:'anchored',entry:'lead',window:r.window,end:r.end});
}
$('reaction-speed').oninput=()=>{reactions.config.speed=Number($('reaction-speed').value);$('reaction-speed-value').textContent=reactions.config.speed.toFixed(1)+'×';};
$('reaction-adaptive').onchange=()=>reactions.config.adaptive=$('reaction-adaptive').checked;
function reactionTestHit(){
 const selected=$('reaction-test-kind').value||'mk';
 const attacker=selected==='hook'?'Akeem':PLAYER,move=selected==='hook'?'lp':selected;
 const hit={...reactions.profile(attacker,move,move==='vwave'?24:['mk','lk'].includes(move)?8:5),side:-1,knockdown:move==='vwave'};
 if(!['fall','recover'].includes(enemyMode))reactOpponent(hit.knockdown?'fall':'hit',hit);
}
function testReactions(flurry=false){
 if(titleOpen||demoPlaying||selection?.isOpen)return;
 reset(true);x=-.8;nikaX=.8;player.position.x=x;target.position.x=nikaX;fitCamera();
 reactionTestHit();if(flurry&&$('reaction-test-kind').value!=='vwave')reactionTests=[.17,.34];
}
$('reaction-test').onclick=()=>testReactions();$('reaction-flurry').onclick=()=>testReactions(true);

const strikes=['hp','mp','lp','hk','mk','lk','jumpkick','sweep','airpunch'];
function step(dt,now,dtOpp=dt){
 while(reactionTests.length&&reactions.time>=reactionTests[0]){reactionTests.shift();reactionTestHit();}
if($('hit-test').checked&&health[1]>0&&health[1]<=12&&nikaX-x<1.9&&strikes.includes(mode)&&!hitDone)finishClock.anticipate();
if(buffered&&now-bufferedAt>(MY.input?.bufferMax??.3)*1000){buffered=null;$('status').textContent='Late press dropped';}
while(rhythmQueue.length&&now-rhythmQueue[0].at>tempo.queueMaxAge)rhythmQueue.shift();
if(rhythmQueue.length&&(!active.playing||!strikes.includes(mode)||active.time>=tempo.linkAt(curRule,active.clipInfo?.activeAt??0,playSpeed,active.clipEnd??active.duration))){
 const next=rhythmQueue.shift();pending=false;action(next.id,now,true);
}
if(buffered&&linkReady(buffered)){const b=buffered;buffered=null;pending=false;action(b);}if(pending){pending=false;if(mode==='fall'){if(!(match.active&&health[0]<=0))action('recover');}else{mode='finished';updateDirection();settle();}}if(direction>0&&!running&&now>=runAt){running=true;if(mode==='walk')settle();}
if(mode==='stepback'&&direction<0&&now-backStart>250)settle(); // still holding ← after the first step: walk backward
if(direction&&tailFree()){mode='finished';settle();}
if(direction&&['walk','run','back','backrun'].includes(mode)&&active.playing)x+=direction*dt*WORLD_SPEED[mode];
// Air time: start the arc at the clip's own takeoff frame, stretch the airborne frames, land on the clip's landing frame.
const airCfg=MY.air?.[mode],ci=active.clipInfo;
if(!air&&!airUsed&&airCfg&&ci?.air&&active.playing&&active.time>=ci.air[0]&&active.time<ci.air[1]){airUsed=true;landed=false;
 const dr=airCfg.drift,dir=direction||jumpDir,vx=!dr?0:dir>0?dr.fwd:dir<0?-dr.back:0; // cardinal direction held at takeoff
 const jumpSpeed=MY[mode]?.[1]||2;
 const flightTime=Math.max(.04,(ci.air[1]-active.time)/jumpSpeed);
 air={t:0,T:flightTime,H:airCfg.height,clip:ci.air,vx};playSpeed=jumpSpeed;
 if(queuedAirPunch){queuedAirPunch=false;jumpPunch();}}
if(air&&air.vx)x+=air.vx*dt;
if(air){air.t+=dt;const u=Math.min(1,air.t/air.T);active.setLift(air.H*4*u*(1-u));if(u>=1){air=null;active.setLift(0);landed=true;buffered=null;queuedAirPunch=false;const d=MY[mode];if(d&&active.current?.name===d[0])playSpeed=d[1];}}
reactions.capture(active);active.update(dt,playSpeed);
if(waveCast&&mode==='vwave'&&active.current?.name===waveCast.clip){
 player.updateMatrixWorld(true);let handX=x+.55,handY=1.05;
 for(const b of active.bones)if(/LeftHand|RightHand/.test(b.name)){b.getWorldPosition(contactPoint);if(contactPoint.x>handX){handX=contactPoint.x;handY=contactPoint.y;}}
 const spawnX=Math.min(nikaX-.3,handX+.12),spawnY=T.MathUtils.clamp(handY,.85,1.3);
 if(active.time>=waveCast.release||pending){vwave.launch({owner:0,x:spawnX,y:spawnY,direction:1,variant:waveVar(PLAYER)});waveCast=null;$('status').textContent='Azure V-Wave · blast released';}
 else vwave.charge({owner:0,x:spawnX,y:spawnY,variant:waveVar(PLAYER),progress:(active.time-waveCast.start)/Math.max(.01,waveCast.release-waveCast.start)});
}
if(active.playing||pending){if(!['walk','run','idle','preview','bind','block','crouch','back','backrun'].includes(mode))x+=active.rootDelta.z;}x=T.MathUtils.clamp(x,-8,nikaX-.85);player.position.x=x;target.position.x=nikaX;if(enemyPending){enemyPending=false;if(match.active&&enemyMode==='fall'&&health[1]<=0){}else if(enemyMode==='fall'&&health[1]>0)reactOpponent('recover');else if(health[1]>0){enemyMode='idle';enemyReact=false;opponent.setBlend(Number($('blend').value));enemySpeed=THEIRS.idle[1];opponent.play(THEIRS.idle[0],{loop:true,entry:'cycle',root:'pinned'});}}
if(match.active)cpuThink(dtOpp,now);opponent.update(dtOpp,enemySpeed);if(match.active)cpuAfterUpdate(dt);plantFeet(dt);
if(!match.active&&health[1]<=0){koWait+=dt;if(koWait>3)reset();}
updateHealth();
const hitAt=active.smart&&active.clipInfo?((curRule??rules[mode])?.active??active.clipInfo.activeAt):active.duration*.45;
if($('hit-test').checked&&strikes.includes(mode)&&!hitDone&&health[1]>0&&enemyMode!=='fall'&&enemyMode!=='recover'){
 // Contact only during the extension window; actual hand/foot world reach, not just a centre-distance guess.
 const hitRule=active.smart?(curRule??rules[mode]):null,contact=tempo.contactIndex(active.time,hitRule,hitAt,playSpeed,strikeWindows);
 if(contact>=0){
  const kicking=['hk','mk','lk','jumpkick','sweep'].includes(mode);
  player.updateMatrixWorld(true);target.updateMatrixWorld(true);
  let reach=-Infinity;
  for(const b of active.bones)if((kicking?/LeftFoot|RightFoot/:/LeftHand|RightHand/).test(b.name)){
   // Hand bones sit at the wrist; include 4 cm of fist beyond the joint.
   b.getWorldPosition(contactPoint);reach=Math.max(reach,contactPoint.x+(kicking?0:.04));
  }
  reach=Math.max(reach,x+(window.FighterReach?.[mode]??-9)); // 1.4.1 equal contact box per button
  const hurtX=nikaX-opponent.sway;
  if(reach>=hurtX-.38&&!(match.active&&match.state!=='fight')){strikeWindows.add(contact);hitDone=strikeWindows.size===tempo.contacts(hitRule,hitAt).length;hitCount++;if(match.active&&enemyMode==='block'&&mode!=='sweep'){health[1]=Math.max(1,health[1]-1);nikaX=Math.min(8,nikaX+.18);GSFX.block(contactPoint);updateHealth();}else{const damage=auraDmg(0,1,tempo.damageAt(mode==='sweep'?12:kicking?8:5,hitRule,contact));health[1]=Math.max(0,health[1]-damage);const knockdown=mode==='sweep'||health[1]===0;GSFX.impact(damage,false,{move:mode,knockdown});const hit=reactions.impact(active,PLAYER,mode,opponent,damage,health[1]===0,knockdown);reactOpponent(knockdown?'fall':'hit',hit);if(health[1]===0){rhythmQueue.length=0;buffered=null;finishClock.impact();}updateHealth();}}
 }
}
$('distance').textContent=(nikaX-x).toFixed(1)+' m apart';$('position').textContent=PLAYER+' '+x.toFixed(2)+' m · '+PARTNER+' '+nikaX.toFixed(1)+' m';$('hits').textContent='Range hits: '+hitCount;$('time').textContent=active.time.toFixed(2)+' / '+active.duration.toFixed(2)+' s';$('timeline').value=active.time;zoom+=(zoomTarget()-zoom)*(1-Math.exp(-dt*4));camLift+=((air?air.H:0)-camLift)*(1-Math.exp(-dt*(air?10:3)));camLift=Math.max(camLift,reactionCameraLift());fitCamera();}
document.querySelector('aside .section-head h2').textContent=PLAYER+' · '+active.clips.filter(c=>!c.name.endsWith('__Mirror')).length+' motions';
document.querySelector('.arena-hud').firstElementChild.innerHTML=PLAYER.toUpperCase()+' <small>PLAYER</small>';document.querySelector('.arena-hud').lastElementChild.innerHTML=PARTNER.toUpperCase()+' <small>TRAINING PARTNER</small>';
function refreshFighterLabels(){
 document.querySelector('aside .section-head h2').textContent=PLAYER+' · '+active.clips.filter(c=>!c.name.endsWith('__Mirror')).length+' motions';
 document.querySelector('.arena-hud').firstElementChild.innerHTML=PLAYER.toUpperCase()+' <small>PLAYER</small>';
 document.querySelector('.arena-hud').lastElementChild.innerHTML=PARTNER.toUpperCase()+' <small>TRAINING PARTNER</small>';
 healthHUD.innerHTML='<label>'+PLAYER+'<meter min="0" max="100" value="100"></meter></label><label>'+PARTNER+'<meter min="0" max="100" value="100"></meter></label>';
 $('swap').textContent='Play as '+PARTNER;$('recovery').value=MY.recover[0];
}
function acquireRig(side,id,p1){
 if(side===0||id!==p1)return fighters[id];
 const key=id+'__P2';if(!fighters[key]){
  const base=fighters[id],f=createFighterRig(key,base.data,base);fighters[key]=f;f.setInPlace(true);
  f.helper=new T.SkeletonHelper(f.root);f.helper.material.depthTest=false;f.helper.visible=$('skeleton').checked&&(f===active||f===opponent);scene.add(f.helper);
  f.setSmart($('smart').checked);f.setBlend(Number($('blend').value));planters[key]=createFootPlanter(f);if(planters[key])planters[key].enabled=$('footik').checked;GSFX.decorate(f);
 }
 return fighters[key];
}
function configureMatchup(p1,p2){
 clearInput();active.setLift(0);opponent.setLift(0);player.clear();target.clear();
 PLAYER=p1;PARTNER=p2;active=acquireRig(0,p1,p1);opponent=acquireRig(1,p2,p1);
 MY=defaults[PLAYER];THEIRS=defaults[PARTNER];WORLD_SPEED=MY.speeds;
 player.add(active.root);target.add(opponent.root);
 for(const f of Object.values(fighters))f.helper.visible=$('skeleton').checked&&(f===active||f===opponent);
 for(const id of Object.keys(rules))delete rules[id];
 for(const [id,r] of Object.entries(FighterMoveRules))rules[id]={...r,...(MY.rules?.[id]||{})};
 rules.sweep.root='anchored';bindRigCallbacks();rebuildClips();refreshFighterLabels();reset();frameWidth=frameHeight=0;
 padOpen=true;document.body.classList.add('controller-open');$('touch-controller').hidden=false;
 $('controller-toggle').textContent='Move workshop';$('controller-toggle').setAttribute('aria-expanded','true');
 fitCamera();
 
}
function swapFighter(){if(demoPlaying)finishDemo();closeTitle(false);configureMatchup(PARTNER,PLAYER);}
refreshFighterLabels();$('swap').onclick=swapFighter;
reset();fitCamera();Promise.all([active.ready,opponent.ready]).catch(()=>{$('status').textContent='Texture unavailable · rig remains usable';});
// Shadows follow the fighters; the stage is drawn first, then the fighters on top.
function frameShadows(){const cx=(x+nikaX)/2;light.position.set(cx-2,7,5);light.target.position.set(cx,0,0);const span=Math.max(3,Math.abs(nikaX-x)/2+2);Object.assign(light.shadow.camera,{left:-span,right:span});light.shadow.camera.updateProjectionMatrix();}

// ---- 1.4 Aura mode: a last-stand power-up near the end of a fight. ----
// At 10% health or less, a 3 s window opens (it reopens after each hit taken while still unused). Mid + High punch
// together (one held while the other is pressed, or within 350 ms) ignites it, once per match. For 9 s the fighter takes 50% damage and deals 75%; the
// opponent slows to 0.75x. Each hit taken drains an extra 1 s. Both in Aura at once: the slowdowns cancel.
// CPU uses it once per match on Hard and Ferocious. ?aura=test opens the window at once for tuning.
const AURA={threshold:10,prompt:3,duration:9,hitDrain:1,slow:.75,take:.5,deal:.75,ease:.5,combo:.35,cpuLevels:['hard','ferocious']};
const aura=[{},{}];let auraScale=[1,1],auraLast={mp:-1e9,hp:-1e9};
const auraParam=new URLSearchParams(location.search).get('aura'),auraTest=auraParam==='test',auraCpuTest=auraParam==='cpu';
// Test switches: ?aura=test keeps Aura ready for P1 at any health; ?aura=cpu makes the CPU ignite it within a second.
if(auraTest||auraCpuTest)AURA.threshold=100;if(auraCpuTest)AURA.cpuLevels=['easy','normal','hard','ferocious'];
function auraReset(full){for(const a of aura){a.active=false;a.prompt=0;a.time=0;a.cpuAt=null;a.lastHp=100;if(full){a.used=false;a.level=0;}}if(full)auraScale=[1,1];}
auraReset(true);
function auraEmit(side,on,instant=false){window.dispatchEvent(new CustomEvent('gsf:aura',{detail:{side,on,instant,id:side===0?PLAYER:PARTNER}}));}
function auraStart(side){const a=aura[side];if(!match.active||match.training||match.state!=='fight'||a.used||a.active||health[side]<=0)return false;
 a.used=true;a.active=true;a.prompt=0;a.time=AURA.duration;auraEmit(side,true);return true;}
function auraEnd(side,instant=false){const a=aura[side];if(!a.active)return;a.active=false;a.time=0;auraEmit(side,false,instant);}
function auraInput(id,now){auraLast[id]=now;const other=id==='mp'?'hp':'mp';if(aura[0].prompt>0&&([...held.values()].includes(other)||now-auraLast[other]<=AURA.combo*1000))auraStart(0);}
function auraDmg(att,tgt,d){if(!match.active||!d)return d;let k=1;if(aura[att]?.active)k*=AURA.deal;if(aura[tgt]?.active){k*=AURA.take;aura[tgt].time-=AURA.hitDrain;}return k===1?d:Math.max(1,Math.round(d*k));}
function auraTick(dt){
 if(!match.active||match.training||demoPlaying){for(let i=0;i<2;i++)auraEnd(i,true);auraScale=[1,1];for(const a of aura)a.level=Math.max(0,a.level-dt/AURA.ease);return;}
 for(let i=0;i<2;i++){const a=aura[i],hp=health[i];
  const eligible=match.state==='fight'&&!a.used&&!a.active&&hp>0&&hp<=AURA.threshold;
  if(eligible&&(hp<a.lastHp||(auraTest&&i===0&&a.prompt<=0)||(auraCpuTest&&i===1))){ // newly eligible, or hit again while unused
   if(i===0)a.prompt=AURA.prompt;
   else if(a.cpuAt==null&&AURA.cpuLevels.includes(match.level))a.cpuAt=.35+Math.random()*.9;}
  a.lastHp=hp;
  if(a.prompt>0){a.prompt=Math.max(0,a.prompt-dt);if(!eligible)a.prompt=0;}
  if(a.cpuAt!=null){a.cpuAt-=dt;if(a.cpuAt<=0){a.cpuAt=null;auraStart(i);}}
  if(a.active){a.time-=dt;if(hp<=0)auraEnd(i,true);else if(a.time<=0||match.state!=='fight')auraEnd(i);}
  a.level=T.MathUtils.clamp(a.level+(a.active?1:-1)*dt/AURA.ease,0,1);}
 // The opponent of an Aura fighter slows; when both burn, the effects cancel.
 const want=[aura[1].active&&!aura[0].active?AURA.slow:1,aura[0].active&&!aura[1].active?AURA.slow:1];
 for(let i=0;i<2;i++)auraScale[i]+=(want[i]-auraScale[i])*Math.min(1,dt/(AURA.ease*.5));
}
let last=performance.now();function frame(now){
 const realDt=document.hidden?0:Math.min((now-last)/1000,.1);last=now;
 if(window.GSFPostFight?.active){requestAnimationFrame(frame);try{window.GSFPostFight.tick(realDt);}catch(e){console.error('Post-fight frame',e);}return;}
 // The loading curtain and title cover the arena. Let navigation paint before compiling arena shaders.
 if(window.GSFLoading?.busy||document.hidden){requestAnimationFrame(frame);return;}
 if(window.GSFPaused){if(!titleOpen&&!window.GSFPlayerMenu?.isOpen)GSFX.render(renderer,scene,camera,0);requestAnimationFrame(frame);return;}
 if(titleOpen&&!demoPlaying){attractTick(realDt);requestAnimationFrame(frame);return;}
 if(selection?.isOpen){selection.tick(realDt,now);requestAnimationFrame(frame);return;}
 updateCameraPad(realDt);attractTick(realDt);matchTick(realDt);
 const dt=realDt*finishClock.update(realDt)*GSFX.timeScale(realDt);
 // Keep queued inputs alive for the same simulation interval during a finish.
 const extra=(realDt-dt)*1000;bufferedAt+=extra;rhythmQueue.forEach(q=>q.at+=extra);
 auraTick(realDt);if(demoPlaying)demoStep(dt);else step(dt*auraScale[0],now,dt*auraScale[1]);
 updateCombatEffects(dt);
 if(envOK){env.update(dt);placeStage();env.draw();}riverScene.update(dt);frameShadows();stageWalls.update(realDt,camera,wallFocus.set((x+nikaX)/2,0,0),Math.abs(nikaX-x)/2);GSFX.render(renderer,scene,camera,realDt);GSFQuality.tick(now);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
// ---- Live CPU attract mode. Timings are visible-time seconds, never background catch-up. ----
let demoPlaying=false,attractPhase='wait',attractTime=0,demoIndex=0,cpus=[],demoElapsed=0,roundOver=false,roundEndAge=0,roundWinner=null,exitUntil=0;
const demoConfig={initialWait:20,fightSeconds:45,titleBetween:20,fightCount:1};
const demoHipA=new T.Vector3(),demoHipB=new T.Vector3();
const demoHUD=document.createElement('div');demoHUD.id='demo-hud';demoHUD.hidden=true;stage.parentElement.append(demoHUD);
function cpuMove(c,id,hit=null){
 if(hit){const p=reactions.choose(c.rig,hit);if(p){c.move=p.kind;c.hit=false;c.age=0;c.speed=p.speed;c.activeAt=null;c.wait=.45;reactions.apply(c.rig,p);showReaction(p);return;}}
 c.rig.setBlend(Number($('blend').value));
 const d=defaults[c.name][id]||defaults[c.name].idle;
 c.move=id;c.hit=false;c.age=0;
 const r={...FighterMoveRules[id],...(defaults[c.name].rules?.[id]||{})};
 c.rig.setLift(0);
 c.rig.play(d[0],{loop:['idle','walk','back'].includes(id),speed:d[1],root:['idle','walk','back','block'].includes(id)?'pinned':'travel',
 entry:r.window?'windup':['hit','fall','recover'].includes(id)?'lead':'start',
 window:r.window,end:r.end,active:r.active,hipY:r.hipY});
 c.activeAt=r.active;
 c.speed=d[1];c.wait=.45+Math.random()*.5;
}
function finishRound(winner){roundOver=true;roundEndAge=0;roundWinner=winner;finishClock.impact();}
let demoPair=null;
function prepDemo(){const ids=FighterRoster.map(f=>f.id);const a=ids[Math.floor(Math.random()*ids.length)];let b=ids[Math.floor(Math.random()*ids.length)];if(b===a)b=ids[(ids.indexOf(a)+1+Math.floor(Math.random()*(ids.length-1)))%ids.length];
 Promise.all([ensureRig(a),ensureRig(b)]).then(()=>{demoPair=[a,b];}).catch(()=>{demoPair=null;});}
function startDemo(){
 if(window.GSFLoading?.busy||window.GSFPlayerMenu?.isOpen)return;
 if(demoPair&&!selection?.isOpen){configureMatchup(...demoPair);demoPair=null;}
 clearInput();reset();cameraReset();demoPlaying=true;titleOpen=false;titleScreen.classList.add('title-cut');titleScreen.classList.add('hide');$('intro').src='about:blank';
 document.body.classList.add('demo-active');demoHUD.hidden=false;demoElapsed=0;roundOver=false;roundEndAge=0;roundWinner=null;
 x=-3;nikaX=3;
 cpus=[{name:PLAYER,rig:active,hp:100},{name:PARTNER,rig:opponent,hp:100}];
 cpus.forEach(c=>cpuMove(c,'idle'));env?.transition(['sunset','night','morning'][demoIndex],3);
 attractPhase='fight';attractTime=0;fitCamera();
}
function finishDemo(){
 // Cover the arena instantly before restoring training positions; no reset shows
 // through the title's old 600 ms fade-in.
 titleScreen.classList.add('title-cut');titleScreen.classList.remove('hide');
 demoPlaying=false;demoHUD.hidden=true;document.body.classList.remove('demo-active');reset();
 const next=demoIndex+1;openTitle();demoIndex=next%demoConfig.fightCount;
 attractPhase='between';attractTime=0;
 env?.transition($('weather').value,3);
}
function demoStep(dt){
 demoElapsed+=dt;if(roundOver)roundEndAge+=dt;
 const gap=nikaX-x;
 for(let i=0;i<2;i++){
  const c=cpus[i],other=cpus[1-i];c.age+=dt;c.wait-=dt;
  if(!roundOver&&(other.hp<=12||attractTime>=demoConfig.fightSeconds-2)&&other.hp>0&&gap<1.9&&strikes.includes(c.move)&&!c.hit)finishClock.anticipate();
  reactions.capture(c.rig);c.rig.update(dt,c.speed);
  // Keep non-loop root travel in world space through attack/fall/get-up changes.
  // Do not ease a completed move back to its old anchor.
  if(i===0)x+=c.rig.rootDelta.z;else nikaX-=c.rig.rootDelta.z;
  if(roundOver&&c.hp>0&&!c.rig.playing&&c.move!=='idle')cpuMove(c,'idle');
  if(!roundOver){
   if(c.move==='fall'&&!c.rig.playing){cpuMove(c,'recover');}
   else if(['hit','recover'].includes(c.move)&&!c.rig.playing)cpuMove(c,'idle');
   else if(!['hit','recover','fall'].includes(c.move)){
    if(gap>1.65){
     if(!c.rig.playing||['idle','walk','back'].includes(c.move)){
      if(c.move!=='walk')cpuMove(c,'walk');
      const pace=.85*defaults[c.name].walk[1];if(i===0)x+=dt*pace;else nikaX-=dt*pace;
     }
    }else if(c.move==='walk')cpuMove(c,'idle');
    else if((!c.rig.playing||['idle','block','back'].includes(c.move))&&c.wait<=0){
     const choices=attractTime>=demoConfig.fightSeconds-2?['mp','hp','lp']:['mp','hp','lp','mk','hk','lk','jumpkick','airpunch','sweep','block','block','back','idle'];
     cpuMove(c,choices[Math.floor(Math.random()*choices.length)]);
    }
    if(c.move==='back'&&c.age<.45){const pace=.5*defaults[c.name].back[1];if(i===0)x-=dt*pace;else nikaX+=dt*pace;}
    if(['mp','hp','lp','mk','hk','lk','jumpkick','airpunch','sweep'].includes(c.move)&&!c.hit&&c.rig.time>=(c.activeAt??c.rig.clipInfo?.activeAt??c.rig.duration*.45)){
     c.hit=true;
     if(!['fall','recover'].includes(other.move)&&nikaX-x<=(['mk','hk','lk','jumpkick','sweep'].includes(c.move)?1.9:1.65)){
      const blocked=other.move==='block',damage=blocked?1:4+Math.floor(Math.random()*4);other.hp=Math.max(0,other.hp-damage);
      if((!blocked||other.hp===0)&&other.move!=='fall'&&other.move!=='recover')cpuMove(other,other.hp===0||c.move==='sweep'?'fall':'hit',reactions.impact(c.rig,c.name,c.move,other.rig,damage,other.hp===0,other.hp===0||c.move==='sweep'));
      if(other.hp===0)finishRound(i);
      else if(!blocked&&attractTime>=demoConfig.fightSeconds-2){
       // The timed exhibition also ends on a real landed hit, without inventing a KO.
       finishRound(cpus[0].hp===cpus[1].hp?null:cpus[0].hp>cpus[1].hp?0:1);
      }
     }
    }
   }
  }
 }
 // Resolve arena limits and spacing together, avoiding repeated boundary corrections.
 const mid=(x+nikaX)/2,gapSafe=Math.max(1.15,Math.min(18,nikaX-x));
 const boundedMid=T.MathUtils.clamp(mid,-9+gapSafe/2,9-gapSafe/2);
 x=boundedMid-gapSafe/2;nikaX=boundedMid+gapSafe/2;
 player.position.x=x;target.position.x=nikaX;
 cpus.forEach(c=>planters[c.name]?.update(dt,!['hit','fall','recover','jumpkick','airpunch','sweep'].includes(c.move)));
 // Resolve body penetration after clip/root sway and before rendering.
 // Anchors alone are insufficient: a lunge can carry the visible hips past them.
 player.updateMatrixWorld(true);target.updateMatrixWorld(true);
 const leftHip=active.bones[active.rig.hips].getWorldPosition(demoHipA);
 const rightHip=opponent.bones[opponent.rig.hips].getWorldPosition(demoHipB);
 const overlap=1.15-(rightHip.x-leftHip.x);
 if(overlap>0){x-=overlap*.5;nikaX+=overlap*.5;player.position.x=x;target.position.x=nikaX;}
 player.updateMatrixWorld(true);target.updateMatrixWorld(true);

 zoom+=(zoomTarget()-zoom)*(1-Math.exp(-dt*4));camLift+=(0-camLift)*(1-Math.exp(-dt*3));camLift=Math.max(camLift,reactionCameraLift());fitCamera();
 const result=roundOver?(roundWinner===null?'DRAW':cpus[roundWinner].name.toUpperCase()+' WINS'):Math.max(0,Math.ceil(demoConfig.fightSeconds-attractTime))+'s';
 demoHUD.innerHTML='<div class="demo-label">DEMO · CPU vs CPU</div><div class="demo-health">'+cpus.map(c=>'<label>'+c.name+'<meter min="0" max="100" value="'+c.hp+'"></meter></label>').join('')+'</div><div>'+result+'</div><small>Press any button or tap to return to title</small>';
}
function attractTick(dt){
 pollDemoGamepad();
 if(document.hidden||attractPhase==='off')return;
 attractTime+=dt;
 if(attractPhase==='wait'&&attractTime>=demoConfig.initialWait)startDemo();
 else if(attractPhase==='fight'&&((!roundOver&&attractTime>=demoConfig.fightSeconds+8)||(roundOver&&finishClock.state.phase==='idle'&&roundEndAge>3)))finishDemo();
 else if(attractPhase==='between'&&attractTime>=demoConfig.titleBetween)startDemo();

}
function exitDemo(){if(demoPlaying)finishDemo();openTitle();exitUntil=performance.now()+500;}
function attractInput(e){
 if(demoPlaying){e.preventDefault();e.stopImmediatePropagation();exitDemo();return;}
 if(performance.now()<exitUntil){e.preventDefault();e.stopImmediatePropagation();return;}
 if(titleOpen){attractTime=0;attractPhase='wait';demoIndex=0;}
}
for(const ev of ['pointerdown','keydown','click'])window.addEventListener(ev,attractInput,true);
let padWasDown=false;
function pollDemoGamepad(){
 const down=Array.from(navigator.getGamepads?.()||[]).some(p=>p&&(p.buttons.some(b=>b.pressed)||p.axes.some(a=>Math.abs(a)>.65)));
 if(!window.GSFLoading?.busy&&down&&!padWasDown){if(demoPlaying)exitDemo();else if(titleOpen&&performance.now()>=exitUntil)closeTitle();}
 padWasDown=down;
}
// ---- v1.0 MATCH MODE: CPU opponent, player damage, rounds, timer. ----
// The opponent rig is driven by a CPU brain using the same clips, rules and reaction system as the lab.
const AI_LEVELS={
 training:{label:'Training dummy',think:9,aggro:0,block:0,react:9,wave:0,run:0,breath:0},
 easy:{label:'Easy',think:.6,aggro:.38,block:.12,react:.5,wave:.05,run:.1,breath:.35},
 normal:{label:'Normal',think:.38,aggro:.58,block:.3,react:.3,wave:.1,run:.35,breath:.25},
 hard:{label:'Hard',think:.24,aggro:.76,block:.5,react:.18,wave:.16,run:.6,breath:.16},
 ferocious:{label:'Ferocious',think:.13,aggro:.93,block:.66,react:.1,wave:.22,run:.9,breath:.08}
};
const match={active:false,state:'off',round:1,wins:[0,0],time:60,roundSeconds:60,stateAge:0,winner:null,roundWinner:null,koBy:null,level:'normal',lastResult:''};
try{const lv=localStorage.getItem('gsf-ai-level');if(AI_LEVELS[lv])match.level=lv;const rs=Number(localStorage.getItem('gsf-round-seconds'));if([30,60,99].includes(rs))match.roundSeconds=rs;}catch{}
const cpu={think:0,hitDone:false,windows:new Set(),rule:null,activeAt:null,blockUntil:0,backUntil:0,wave:null,combo:0,lastAttack:'',moveAge:0};
const CPU_STRIKES=['mp','hp','lp','mk','hk','lk','jumpkick','airpunch','sweep'];
const DAMAGE={lp:5,mp:5,hp:6,lk:7,mk:8,hk:9,jumpkick:9,airpunch:7,sweep:12,vwave:24};
const HIGH=['hp','hk','airpunch','jumpkick'];
function enemyPlay(id){
 const d=THEIRS[id]||THEIRS.idle;const r={...FighterMoveRules[id],...(THEIRS.rules?.[id]||{})};
 enemyMode=id;enemyReact=false;enemyPending=false;cpu.hitDone=false;cpu.windows.clear();cpu.rule=r;cpu.moveAge=0;cpu.activeAt=r.active??null;
 const loop=['idle','walk','back','run','backrun'].includes(id),hold=['block','crouch'].includes(id);
 enemySpeed=d[1];opponent.setBlend(Number($('blend').value));opponent.setLift(0);
 opponent.play(d[0],{loop,speed:d[1],root:loop||hold?'pinned':(id==='jumpkick'||id==='airpunch'?'travel':'anchored'),
  entry:r.window?'windup':['hit','fall','recover'].includes(id)?'lead':loop?'cycle':'start',window:r.window,end:r.end,active:r.active,hipY:r.hipY});
}
function enemyFree(){return !['hit','fall','recover'].includes(enemyMode)&&(!opponent.playing||['idle','walk','back','run','block','crouch','backrun'].includes(enemyMode)||enemyPending);}
function playerThreat(){return CPU_STRIKES.includes(mode)||mode==='vwave'||mode==='jumpkick';}
function cpuThink(dt,now){
 const L=AI_LEVELS[match.training?'training':match.level],gap=nikaX-x;cpu.moveAge+=dt;
 if(match.state!=='fight'||health[1]<=0){if(enemyFree()&&enemyMode!=='idle'&&health[1]>0)enemyPlay('idle');return;}
 if(health[0]<=0){if(enemyFree()&&enemyMode!=='idle')enemyPlay('idle');return;}
 // Hold block / back-off timers.
 if(enemyMode==='block'&&now>=cpu.blockUntil){enemyPlay('idle');}
 if(enemyMode==='back'){nikaX=Math.min(8,nikaX+dt*(THEIRS.speeds?.back||1.35));if(now>=cpu.backUntil)enemyPlay('idle');}
 if(enemyMode==='walk')nikaX-=dt*(THEIRS.speeds?.walk||1.5)*.95;
 if(enemyMode==='run')nikaX-=dt*(THEIRS.speeds?.run||3.9)*.9;
 if((enemyMode==='walk'&&gap<1.55)||(enemyMode==='run'&&gap<2.1))enemyPlay('idle');
 // React to an incoming strike with a block (faster on higher levels).
 if(enemyFree()&&enemyMode!=='block'&&playerThreat()&&gap<2.2&&Math.random()<L.block*dt/Math.max(.05,L.react)*1.6){enemyPlay('block');cpu.blockUntil=now+260+Math.random()*260;return;}
 cpu.think-=dt;if(cpu.think>0||!enemyFree())return;
 cpu.think=L.think*(.6+Math.random()*.8);
 if(L.aggro<=0){if(enemyMode!=='idle')enemyPlay('idle');return;}
 const r=Math.random();
 if(gap>2.4){
  if(vwave.ready(1)&&r<L.wave*2.2&&gap>3)return enemyCast();
  if(r<L.breath*.4&&enemyMode!=='idle')return enemyPlay('idle');
  if(gap>3.6&&Math.random()<L.run){if(enemyMode!=='run')enemyPlay('run');}else if(enemyMode!=='walk')enemyPlay('walk');
  if(gap<3.2&&gap>2.2&&Math.random()<L.aggro*.18)enemyPlay('jumpkick');
  return;
 }
 if(r<L.breath){cpu.backUntil=now+350+Math.random()*450;return enemyPlay('back');}
 if(r<L.breath+(1-L.aggro)*.5)return enemyPlay(Math.random()<.5?'block':'idle'),void(cpu.blockUntil=now+300);
 // Attack choice by range; crouching players get swept, airborne players get anti-aired.
 let pool;
 if(air)pool=['hp','hp','mp'];
 else if(mode==='crouch')pool=['sweep','lk','lk','mp'];
 else if(gap<1.35)pool=['mp','mp','lp','hp','lk','sweep','mk'];
 else if(gap<1.95)pool=['mk','hk','lk','mp','hp','sweep','airpunch'];
 else pool=['hk','mk','jumpkick','airpunch','walk'];
 if(cpu.combo>0&&Math.random()<L.aggro)pool=pool.concat(['mp','lp','hp']); // keep the pressure after landing a hit
 let id=pool[Math.floor(Math.random()*pool.length)];if(id===cpu.lastAttack&&Math.random()<.5)id=pool[Math.floor(Math.random()*pool.length)];
 if(id==='walk'){if(enemyMode!=='walk')enemyPlay('walk');return;}
 cpu.lastAttack=id;enemyPlay(id);
}
function enemyCast(){
 const id=PARTNER==='Nika'||GSFMoveSource[PARTNER]?.hp==='Nika'?'hp':'mp',d=THEIRS[id];if(!d)return;
 enemyPlay(id);cpu.hitDone=true;const r={...FighterMoveRules[id],...(THEIRS.rules?.[id]||{})};cpu.wave={release:r.active??opponent.clipInfo?.activeAt??.4,start:opponent.time};enemyMode='vwave';
}
function cpuAfterUpdate(dt){
 if(enemyMode==='jumpkick'||enemyMode==='airpunch')nikaX-=opponent.rootDelta.z;
 // CPU V-Wave release from the casting hand.
 if(cpu.wave){
  if(enemyMode!=='vwave'){cpu.wave=null;vwave.clearCharge(1);}
  else{target.updateMatrixWorld(true);let hx=nikaX-.55,hy=1.05;for(const b of opponent.bones)if(/LeftHand|RightHand/.test(b.name)){b.getWorldPosition(contactPoint);if(contactPoint.x<hx){hx=contactPoint.x;hy=contactPoint.y;}}
   const sx=Math.max(x+.3,hx-.12),sy=T.MathUtils.clamp(hy,.85,1.3);
   if(opponent.time>=cpu.wave.release||!opponent.playing){vwave.launch({owner:1,x:sx,y:sy,direction:-1,variant:waveVar(PARTNER)});cpu.wave=null;}
   else vwave.charge({owner:1,x:sx,y:sy,variant:waveVar(PARTNER),progress:(opponent.time-cpu.wave.start)/Math.max(.01,cpu.wave.release-cpu.wave.start)});}
 }
 if(enemyMode==='vwave'&&!opponent.playing){enemyPlay('idle');}
 // Strike contact at the clip's measured active frame, using the attacking limb's real reach.
 if(CPU_STRIKES.includes(enemyMode)&&!cpu.hitDone&&match.state==='fight'&&health[0]>0){
  const at=cpu.activeAt??opponent.clipInfo?.activeAt??opponent.duration*.45,frames=tempo.contacts(cpu.rule,at),contact=tempo.contactIndex(opponent.time,cpu.rule,at,enemySpeed,cpu.windows);
  if(opponent.time>frames[frames.length-1]+.13*enemySpeed)cpu.hitDone=true;
  if(contact>=0){
   const kicking=['hk','mk','lk','jumpkick','sweep'].includes(enemyMode);target.updateMatrixWorld(true);player.updateMatrixWorld(true);let reach=Infinity;
    for(const b of opponent.bones)if((kicking?/LeftFoot|RightFoot/:/LeftHand|RightHand/).test(b.name)){b.getWorldPosition(contactPoint);reach=Math.min(reach,contactPoint.x-(kicking?0:.04));}
    reach=Math.min(reach,nikaX-(window.FighterReach?.[enemyMode]??-9)); // 1.4.1 equal contact box per button
    const hurtX=x+active.sway;
    if(reach<=hurtX+.38&&!['fall','recover'].includes(mode)){cpu.windows.add(contact);cpu.hitDone=cpu.windows.size===frames.length;
     if(mode==='crouch'&&HIGH.includes(enemyMode)){GSFX.whiff();}
     else hitPlayer(enemyMode,tempo.damageAt(DAMAGE[enemyMode]||5,cpu.rule,contact),enemyMode==='sweep');}
  }
 }
 if(CPU_STRIKES.includes(enemyMode)&&!opponent.playing&&!enemyPending)enemyPending=true;
 // Spacing, arena limits and body overlap (shared with the demo's resolution).
 nikaX=T.MathUtils.clamp(nikaX,x+.85,8.6);
 player.updateMatrixWorld(true);target.updateMatrixWorld(true);
 const lh=active.bones[active.rig.hips].getWorldPosition(demoHipA),rh=opponent.bones[opponent.rig.hips].getWorldPosition(demoHipB),ov=1.1-(rh.x-lh.x);
 if(ov>0&&!air){const half=ov*.5;x-=half;nikaX+=half;if(x<-8.6){nikaX+=-8.6-x;x=-8.6;}if(nikaX>8.6){x-=nikaX-8.6;nikaX=8.6;}}
 player.position.x=x;target.position.x=nikaX;
}
function hitPlayer(move,damage,knockdown){
 if(health[0]<=0||['fall','recover'].includes(mode))return;
 const unblockable=move==='sweep'||move==='vwave'&&false;
 if(mode==='block'&&!unblockable){health[0]=Math.max(1,health[0]-(move==='vwave'?3:1));x=Math.max(-8.6,x-.2);GSFX.block(null);updateHealth();return;}
 cpu.combo++;damage=auraDmg(1,0,damage);health[0]=Math.max(0,health[0]-damage);const ko=health[0]===0;knockdown=knockdown||ko||move==='vwave';
 GSFX.impact(damage,true,{move,knockdown});
 const hit=move==='vwave'?{...reactions.profile(PARTNER,'vwave',damage),side:0,heavy:true,knockdown:true}:reactions.impact(opponent,PARTNER,move,active,damage,ko,knockdown);
 waveCast=null;vwave.clearCharge(0);buffered=null;rhythmQueue.length=0;queuedAirPunch=false;airAttackDone=false;
 if(air){air=null;active.setLift(0);}
 if(knockdown){
  const p=hit&&hit.knockdown&&reactions.choose(active,hit);
  if(p&&p.kind==='fall'){mode='fall';pending=false;returnIdle=true;curRule=rules.fall;playSpeed=p.speed;reactions.apply(active,p);}
  else{mode='fall';play(MY.fall[0],false,true,MY.fall[1],rules.fall);}
 }else{
  const p=reactions.choose(active,hit);
  if(p){mode='hit';pending=false;returnIdle=true;curRule=rules.hit;playSpeed=p.speed;reactions.apply(active,p);}
  else{mode='hit';play(MY.hit[0],false,true,MY.hit[1],rules.hit,'lead');}
 }
 if(ko){finishClock.impact();}
 hud();updateHealth();
}
function matchSet(state){match.state=state;match.stateAge=0;}
function startMatch(training=false){
 match.training=training===true;auraReset(true);
 window.GSFPostFight?.close();
 match.active=true;match.wins=[0,0];match.round=1;match.winner=null;cpu.combo=0;startRound();
}
function startRound(){
 auraReset(false);reset();health=[100,100];updateHealth();cameraReset();match.time=match.roundSeconds;match.roundWinner=null;match.koBy=null;
 cpu.think=.8;cpu.wave=null;cpu.combo=0;x=-2.6;nikaX=2.6;player.position.x=x;target.position.x=nikaX;enemyPlay('idle');fitCamera();matchSet(match.training?'fight':'intro');
}
function endMatch(){window.GSFPostFight?.close();match.active=false;match.training=false;matchSet('off');resetEffects();}
function endRound(winner,how){
 if(match.state!=='fight')return;match.roundWinner=winner;match.koBy=how;
 if(winner===0||winner===1)match.wins[winner]++;
 matchSet(how==='time'?'time':'ko');clearInput();
}
function matchTick(dt){
 if(!match.active||selection?.isOpen||titleOpen||demoPlaying)return;
 match.stateAge+=dt;
 if(match.training){
  match.time=match.roundSeconds;
  if(match.state==='fight'&&(health[0]<=0||health[1]<=0)){matchSet('training-reset');clearInput();}
  else if(match.state==='training-reset'&&match.stateAge>2.5)startRound();
  return;
 }
 if(match.state==='intro'&&match.stateAge>2.1)matchSet('fight');
 else if(match.state==='fight'){
  match.time=Math.max(0,match.time-dt*(finishClock.state.phase==='idle'?1:.25));
  if(health[1]<=0)endRound(0,'ko');else if(health[0]<=0)endRound(1,'ko');
  else if(match.time<=0){endRound(health[0]===health[1]?null:health[0]>health[1]?0:1,'time');}
 }else if((match.state==='ko'||match.state==='time')&&match.stateAge>3.4&&finishClock.state.phase==='idle'){
  if(match.wins[0]>=2||match.wins[1]>=2){match.winner=match.wins[0]>=2?0:1;matchSet('over');}
  else if(match.round>=5){match.winner=match.wins[0]===match.wins[1]?null:match.wins[0]>match.wins[1]?0:1;matchSet('over');}
  else{match.round++;startRound();}
 }
}
// On-demand rigs for the newcomer roster (loaded the first time they are chosen).
function ensureRig(id){
 if(fighters[id])return Promise.resolve(fighters[id]);
 const entry=FighterRoster.find(f=>f.id===id);
 const load=window.GSFNewcomers?.isNewcomer(id)?GSFNewcomers.load(id):Promise.resolve();
 return load.then(()=>{
  const data=entry?.data();if(!data)throw new Error('Fighter data missing: '+id);
  if(!fighters[id]){const f=createFighterRig(id,data);fighters[id]=f;f.setInPlace(true);f.helper=new T.SkeletonHelper(f.root);f.helper.material.depthTest=false;f.helper.visible=false;scene.add(f.helper);
   f.setSmart($('smart').checked);f.setBlend(Number($('blend').value));planters[id]=createFootPlanter(f);if(planters[id])planters[id].enabled=$('footik').checked;GSFX.decorate(f);}
  return fighters[id];
 });
}

// ---- Title screen: the animated intro plays until Press Start (button, any key, or tap). ----
const titleScreen=$('title-screen');let titleOpen=true;
function closeTitle(showSelect=true,covered=false){if(!titleOpen)return;if(showSelect&&window.GSFPlayerMenu&&!covered){return window.GSFLoading.run(()=>closeTitle(showSelect,true));}attractPhase='off';titleOpen=false;titleScreen.classList.remove('title-cut');titleScreen.classList.add('hide');setTimeout(()=>{if(!titleOpen)$('intro').src='about:blank';},700);titleScreen.inert=true;if(showSelect){if(window.GSFPlayerMenu)GSFPlayerMenu.showModes();else selection?.open([PLAYER,PARTNER]);}else stage.focus?.();}
function openTitle(){endMatch();prepDemo();resetEffects();if(selection?.isOpen)selection.close(null);titleScreen.inert=false;attractPhase='wait';attractTime=0;demoIndex=0;titleOpen=true;const f=$('intro');delete f.dataset.loaded;if(f.dataset.src)f.src=f.dataset.src;titleScreen.classList.remove('hide');clearInput(true);$('press-start').focus();}
$('press-start').onclick=closeTitle;$('title-btn').onclick=()=>window.GSFLoading.run(openTitle);window.addEventListener('keydown',e=>{if(titleOpen&&!window.GSFPlayerMenu?.isOpen&&!e.target.closest?.('.title-extras')&&!['Tab','Shift'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(['Enter',' '].includes(e.key)||e.key.length===1||e.key.startsWith('Arrow'))closeTitle();}},true);
// Static original artwork keeps the menu independent of the arena renderer.
selection=createFighterSelect({roster:FighterRoster,
 onOpen:()=>{attractPhase='off';clearInput();reset();cameraTouches.clear();},
 onClose:chosen=>{cameraPadReleased=false;if(!chosen){configureMatchup(PLAYER,PARTNER);endMatch();return;}
  window.GSFUI?.loading(true,chosen);Promise.all(chosen.map(ensureRig)).then(()=>{window.GSFUI?.loading(false);configureMatchup(...chosen);cameraReset();fitCamera();startMatch();})
  .catch(e=>{console.error(e);window.GSFUI?.loading(false,null,e.message);configureMatchup(PLAYER,PARTNER);startMatch();});},onTitle:openTitle});
$('select-btn').onclick=()=>{closeTitle(false);selection.open([PLAYER,PARTNER]);};
// The intro only loads when the title screen is shown (skipped after Play as …).
if(new URLSearchParams(location.search).has('skipintro'))closeTitle(!new URLSearchParams(location.search).has('skipselect'));else{$('intro').src=$('intro').dataset.src;$('press-start').focus();}
for(const f of Object.values(fighters))GSFX.decorate(f);
window.FighterLab={clearInput,get aura(){return aura.map(a=>({used:a.used,active:a.active,prompt:a.prompt,time:a.time,level:a.level}));},get auraScale(){return [...auraScale];},AURA,auraStart,auraEnd,get playerRig(){return active;},get opponentRig(){return opponent;},playerGroup:player,opponentGroup:target,match,AI_LEVELS,startMatch,endMatch,startRound,ensureRig,keys,openTitle,get titleOpen(){return titleOpen;},get demoPlaying(){return demoPlaying;},exitDemo,prepDemo,hitPlayer,get enemy(){return enemyMode;},reactions,testReactions,get enemyMode(){return enemyMode;},selection,configureMatchup,renderer,finishClock,vwave,get waveCast(){return waveCast;},courtyard,quality:GSFQuality,scenery:riverScene,walls:stageWalls,surface:courtyard.userData.surface,get health(){return [...health];},get cameraYaw(){return cameraYaw;},get queue(){return rhythmQueue.slice();},combatRules,demoConfig,startDemo,get attract(){return {phase:attractPhase,index:demoIndex,time:attractTime,playing:demoPlaying,roundOver,winner:roundWinner,hp:cpus.map(c=>c.hp),moves:cpus.map(c=>c.move),positions:[x,nikaX]};},padRead:e=>padRead(e),padSet:d=>padSet(d),get env(){return env;},get envOK(){return envOK;},closeTitle,swapFighter,get PLAYER(){return PLAYER;},get PARTNER(){return PARTNER;},planters,get buffered(){return buffered;},rules,fighters,defaults,scene,camera,inputDown,inputUp,reset,step,action,get zoom(){return zoom;},get zoomTarget(){return zoomTarget();},get mode(){return mode;},get position(){return x;},get running(){return running;},get air(){return air;},get playSpeed(){return playSpeed;},get hits(){return hitCount;}};
})();
