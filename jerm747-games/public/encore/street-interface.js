(() => {
'use strict';
const $=s=>document.querySelector(s),game=$('#game'),field=$('#playfield'),ctx=field.getContext('2d'),help=$('#help'),chat=$('#conversation');
let worldWidth=920,worldHeight=500,ready=false,last=0,lag=0,pauseFrom='run',resumeAfterHelp=false,controller;
const engine=StreetGame.create({onEvent:onGameEvent,now:()=>performance.now()});
const record=EncoreRecord.open(()=>window.localStorage);
const finale=EncoreFinale.mount(engine,record,()=>newRun({timed:true}),()=>newRun(),()=>newRun({afterParty:true}));
function onGameEvent(event){
 if(event.type==='message')$('#toast').textContent=event.text;
 if(event.type==='sound')EncoreSynth.play(event.name,event);
 if(event.type==='fire'||event.type==='lootBreak'||event.type==='poundImpact')EncoreHaptics.pulse(event.type);
 if(event.type==='finale'){controller?.clear();finale.beat(event.beat);return}
 if(event.type==='breakfast'){controller?.clear();finale.breakfast(event.beat);return}
 if(event.type==='complete'){finale.complete();return}
 if(event.type==='reset'){
  finale.reset();
  chat.hidden=true;$('#nige-line').textContent='…';$('#npc-line').textContent='…';$('#toast').textContent='';
 }
 if(event.type==='dialogue'){
  controller?.clear();chat.hidden=false;$('#overlay').hidden=true;
  const who=event.line.speaker;
  $('#'+who+'-line').textContent=event.line.text;
  $('#nige-card').classList.toggle('active',who==='nige');$('#npc-card').classList.toggle('active',who==='npc');
  $('#dialogue-count').textContent=(event.index+1)+' / '+engine.script.length;
  $('#spoken-line').textContent=(who==='nige'?'Nige Hood: ':'Open mic regular: ')+event.line.text;
  $('#next-line').textContent=event.index===engine.script.length-1?'Take token & go →':'Next →';
  StreetArt.portrait($('#nige-portrait').getContext('2d'),'nige');
  StreetArt.portrait($('#npc-portrait').getContext('2d'),'npc',engine.state.walkers[event.partner].type);
  if(event.index===0)$('#next-line').focus({preventScroll:true});
 }
 if(event.type==='dialogueEnd'){chat.hidden=true;controller?.clear();field.focus({preventScroll:true})}
}
function resize(){
 const r=field.getBoundingClientRect();if(!r.width||!r.height)return;
 const dpr=Math.min(2,window.devicePixelRatio||1);field.width=Math.round(r.width*dpr);field.height=Math.round(r.height*dpr);
 worldWidth=Math.max(540,Math.min(920,500*r.width/r.height));worldHeight=worldWidth*r.height/r.width;
}
new ResizeObserver(resize).observe($('#viewport'));
let lastHud='',clockFrame=-1;
function render(){
 if(!ready||screen!=='game'||$('#ending').open)return;const s=engine.state,scale=field.width/worldWidth;
 ctx.setTransform(scale,0,0,scale,0,0);StreetArt.render(ctx,s,worldWidth,worldHeight);
 if(s.timed){
  const tenths=Math.floor(engine.runMs()/100);if(tenths!==clockFrame){clockFrame=tenths;$('#run-clock').textContent='TIME '+EncoreRecord.format(tenths*100);}
 }
 const hudKey=[s.areaIndex,s.fireAmmo,s.timed,s.afterParty,s.flashlightOn,s.collection.join('/'),s.tokens].join(':');
 if(hudKey!==lastHud){lastHud=hudKey;
 const lamp=$('.arc-flashlight');
 lamp.hidden=!s.afterParty;
 lamp.setAttribute('aria-pressed',String(s.flashlightOn));
 $('#lamp-state').textContent=s.flashlightOn?'ON':'OFF';
 const inAlley=s.areaIndex===StreetGame.alleyIndex;
 $('#route-label').hidden=inAlley;
 $('#stop').textContent=inAlley?'PRELUDE · BACKSTAGE ALLEY':(s.afterParty?['01 · NIGHTCLUB','02 · NIGHT MARKET','03 · MOONRISE','04 · ROOFTOPS','05 · ROOF CAFÉ']:['01 · CAFÉ','02 · MARKET','03 · RISE','04 · ROOFTOPS','05 · PARTY'])[s.areaIndex];$('#score').textContent='🔥 '+s.fireAmmo;
 $('#run-clock').hidden=!s.timed;
 $('#fire-count').textContent=s.fireAmmo;$('.arc-fire').classList.toggle('charged',s.fireAmmo>0);$('.arc-fire').setAttribute('aria-label','Throw fireball, '+s.fireAmmo+' available');
$('#tokens').textContent='◉ '+s.tokens+' TOKEN'+(s.tokens===1?'':'S');
 const total=StreetGame.merchTotal(s.afterParty);
 for(const card of document.querySelectorAll('[data-night-merch]'))card.hidden=!s.afterParty;
 $('#collection-banner span').textContent=s.collection.length+' of '+total+' finds collected';
 $('#merch-count').textContent=s.collection.length+'/'+total;
 $('#merch').setAttribute('aria-label','NH merchandise collected: '+s.collection.length+' of '+total);
 for(const card of document.querySelectorAll('[data-merch]')){
  const id=card.dataset.merch,found=s.collection.includes(id);
  card.classList.toggle('collected',found);
  card.title=found?StreetGame.merch.find(m=>m.id===id).name:'Undiscovered gear';
  card.setAttribute('aria-label',card.title);
 }
 }
  $('#area-transition').hidden=!s.transition;$('#area-transition').style.opacity=String(s.fade);if(s.transition)$('#area-name').textContent=StreetGame.areaName(s.transition.target,s.afterParty);
 $('#collection-banner').hidden=!(s.celebrate>0);$('#collection-banner').style.opacity=String(Math.min(1,s.celebrate||0));
 const intro=$('#night-intro');
 intro.hidden=!(s.afterParty&&s.mode==='run'&&s.areaIndex===StreetGame.alleyIndex&&s.elapsed<6);
 if(!intro.hidden)intro.style.opacity=String(Math.min(1,6-s.elapsed));
 const talk=$('#talk-prompt');talk.hidden=!s.talkAvailable||s.mode!=='run';
 if(!talk.hidden){const npc=s.walkers[s.encounter.partner];talk.style.left=Math.max(15,Math.min(85,(npc.x-s.camera.x)/worldWidth*100))+'%';talk.style.top=Math.max(25,Math.min(75,(npc.y-168-s.camera.y)/worldHeight*100))+'%';}
 $('#route-label').textContent=s.areaIndex===StreetGame.alleyIndex?'BACKSTAGE ALLEY':s.afterParty&&s.areaIndex===4?'BREAKFAST SERVICE':s.afterParty?'AFTER PARTY':s.areaIndex===4?'THE TERRACE':s.areaIndex===3?'THE SKYLINE':s.player.y<220?'THE ROOFTOPS':s.player.y<600?'THE UPPER ROUTE':'THE SIDEWALK';
 $('#progress').style.width=Math.min(100,s.player.x/(s.areaIndex===StreetGame.alleyIndex?StreetGame.areaWidth(s.areaIndex)-48:engine.world.finish)*100)+'%';
}
function frame(now){
 pollPad(now);
 if (!ready || screen!=='game') { last=0; lag=0; requestAnimationFrame(frame); return; }
 lag+=Math.min(.20,(now-(last||now))/1000);last=now;
 while(lag>=1/120){engine.step(1/120,worldWidth,worldHeight);lag-=1/120}
 render();requestAnimationFrame(frame);
}
function clearHeld(){controller.clear();lastPadKeys='';engine.clearInput()}
const launch = new URLSearchParams(location.search);
const isApp = launch.get('app') === 'android' || !!window.EncoreAndroid;
const modes = {
 cdman: {name:'CD Man', location:'Returnity Arcade', image:'cd-arcade.webp', blurb:'Catch the disc on the highway. Jump the fare gate in the subway.'},
 street: {name:'On the Block', location:'Café Block', image:'street-day.png', blurb:'Run the block and find your way to the rooftop show.'},
 trial: {name:'Time Trial', location:'Roofline Rise', image:'street-rise-v8.png', blurb:'Race from the café to the roof. Beat your best time.'},
 night: {name:'After Party', location:'Backstage Alley', image:'night-alley-v13.webp', blurb:'Take your flashlight through the alley to a late-night set.'}
};
const synth = EncoreSynth;
let settings = {touch:'auto', sound:true, music:true};
try { Object.assign(settings, JSON.parse(localStorage.getItem('encore.settings') || '{}')); } catch {}
let screen = 'loading', selected = 'street', inputKind = matchMedia('(pointer:coarse)').matches ? 'touch' : 'key';
let runRequest = 0, menuReleased = true;
function saveSettings() {
 try { localStorage.setItem('encore.settings', JSON.stringify(settings)); } catch {}
 applySettings();
}
function applySettings() {
 synth.setSfx(settings.sound); synth.setMusic(settings.sound && settings.music);
 $('#front-sound').textContent = $('#audio').textContent = settings.sound ? 'Sound on' : 'Sound off';
 $('#audio').setAttribute('aria-pressed',String(settings.sound));
 $('#front-music').textContent = settings.music ? 'Music on' : 'Music off';
 const touch = settings.touch;
 $('#touch-toggle').textContent = 'Pad · ' + touch[0].toUpperCase() + touch.slice(1);
 game.dataset.deck = touch === 'off' || (touch === 'auto' && inputKind !== 'touch') ? 'hidden' : 'shown';
}
function input(kind) {
 if (kind !== inputKind) { inputKind = kind; applySettings(); }
}
function cycleTouch() {
 settings.touch = {auto:'on', on:'off', off:'auto'}[settings.touch] || 'auto';
 saveSettings(); synth.play('toggle');
}
function updateMusic() {
 if (['title','modes'].includes(screen) && !document.hidden && settings.sound && settings.music) synth.startMusic();
 else synth.stopMusic(.18);
}
function setScreen(value) {
 screen = game.dataset.screen = value;
 $('#sleeve').hidden = value !== 'title';
 $('#selector').hidden = value !== 'modes';
 $('#loader').hidden = value !== 'loading';
 $('#front').hidden = value === 'game' || value === 'error';
 updateMusic();
}
function soundToggle() {
 settings.sound = !settings.sound; saveSettings();
 synth.unlock().then(() => { updateMusic(); synth.play('toggle'); });
}
function preview(mode) {
 selected = mode;
 const m = modes[mode];
 $('#mode-image').src = 'assets/' + m.image;
 $('#mode-location').textContent = m.location.toUpperCase();
 $('#mode-blurb').textContent = mode === 'trial' && record.best !== null ? 'Device best · ' + EncoreRecord.format(record.best) : m.blurb;
 for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('previewing', b.dataset.mode === mode);
}
function showModes() {
 if(window.ArcadeGameClock&&parent.Arcade.gameTitle(window))return;
 ++runRequest;
 if ($('#ending').open) $('#ending').close();
 if (help.open) { resumeAfterHelp = false; help.close(); }
 if (ready) { clearHeld(); engine.setMode('ready'); }
 $('#overlay').hidden = true; chat.hidden = true; $('#reaction').hidden = true;
 setScreen('modes'); preview(selected);
 document.querySelector('[data-mode="' + selected + '"]').focus({preventScroll:true});
}
function showTitle(boot=false) {
 if(boot!==true&&window.ArcadeGameClock&&parent.Arcade.gameTitle(window))return;
 ++runRequest;
 $('#overlay').hidden = true;
 if (help.open) { resumeAfterHelp = false; help.close(); }
 if (ready) {
  if (!engine.state) engine.reset();
  if (engine.state.mode === 'finale' && !engine.state.afterParty) {
   record.finish(engine.state.timed, engine.state.finale.totalMs);
  }
  finale.reset(); clearHeld(); engine.setMode('ready');
 }
 chat.hidden = true; selected = 'street';
 setScreen('title'); $('#press-start').focus({preventScroll:true});
}
function openModes() {
 synth.unlock().then(() => { synth.play('ok'); updateMusic(); });
 showModes();
}
function playCDMan() {
 synth.stopMusic(.1); EncoreHaptics.stop();
 const target = new URL('cd-man/index.html', location.href);
 if(screen==='modes')target.searchParams.set('return','modes');
 if (isApp) target.searchParams.set('app','android');
 location.replace(target.href);
}
function startSelected(mode) {
 if (mode === 'cdman') { playCDMan(); return; }
 preview(mode); newRun({timed:mode === 'trial', afterParty:mode === 'night'});
}
async function newRun({timed=false, afterParty=false, areaIndex=0} = {}) {
 if (!ready) return;
 const request = ++runRequest;
 selected = afterParty ? 'night' : timed ? 'trial' : 'street';
 resumeAfterHelp = false;
 if (help.open) help.close();
 if ($('#ending').open) $('#ending').close();
 clearHeld(); engine.setMode('ready');
 $('#overlay').hidden = true; chat.hidden = true;
 $('#load-caption').textContent = 'Opening ' + modes[selected].name + '…';
 setScreen('loading'); synth.unlock().then(() => synth.play('ok'));
 try {
  await Promise.all([afterParty ? StreetArt.loadNight() : Promise.resolve(), new Promise(resolve => setTimeout(resolve,450))]);
 } catch {
  if (request !== runRequest) return;
  setScreen('error');
  overlay('ENCORE', 'The artwork couldn’t load.', 'Try opening this run again.', 'Retry', () => newRun({timed,afterParty,areaIndex}), 'Choose mode', showModes);
  return;
 }
 if (request !== runRequest) return;
 engine.reset({areaIndex,timed,afterParty}); clockFrame = -1; lastHud = ''; lag = 0; last = 0;
 $('#pause').disabled = false; $('#pause').textContent = 'Pause';
 setScreen('game'); resize(); field.focus({preventScroll:true});
 synth.play('go'); EncoreHaptics.pulse('confirm');
}
$('#press-start').onclick = openModes;
$('#mini-start').onclick = playCDMan;
$('#end-title-button').onclick = $('#pause-title-button').onclick = showTitle;
$('#front-back').onclick = showTitle;
$('#front-help').onclick = openHelp;
$('#front-sound').onclick = $('#audio').onclick = soundToggle;
$('#front-music').onclick = () => { settings.music = !settings.music; saveSettings(); updateMusic(); synth.play('toggle'); };
$('#touch-toggle').onclick = cycleTouch;
$('#mode-return').onclick = $('#end-modes').onclick = showModes;
for (const b of document.querySelectorAll('[data-mode]')) {
 b.onfocus = b.onpointerenter = () => preview(b.dataset.mode);
 b.onclick = () => startSelected(b.dataset.mode);
}

function overlay(k,title,desc,a,onA,b,onB){
 $('.pause-routes').hidden = screen !== 'game';
 $('#overKicker').textContent=k;$('#overTitle').textContent=title;$('#overText').textContent=desc;
 $('#primary').textContent=a;$('#primary').onclick=onA;$('#secondary').textContent=b;$('#secondary').onclick=onB;
 $('#overlay').hidden=false;$('#primary').focus({preventScroll:true});
}
function pause(){
 if(!ready||screen!=='game')return;
 const mode=engine.state.mode;if(!['run','dialogue','transition','paused'].includes(mode))return;
 if(mode==='paused'){
  synth.play('resume');engine.setMode(pauseFrom);$('#overlay').hidden=true;$('#pause').textContent='Pause';
  chat.hidden=pauseFrom!=='dialogue';
  (pauseFrom==='dialogue'?$('#next-line'):field).focus({preventScroll:true});return;
 }
 synth.play('pause');pauseFrom=mode;EncoreHaptics.stop();clearHeld();engine.setMode('paused');chat.hidden=true;$('#pause').textContent='Resume';
 overlay('ENCORE','Take a breath.','Your place on the block is waiting.','Resume',pause,'New run',()=>newRun({timed:engine.state.timed,afterParty:engine.state.afterParty}));
}
function openHelp(){
 if(!ready||(screen==='game'&&['finale','complete'].includes(engine.state.mode)))return;resumeAfterHelp=screen==='game'&&['run','dialogue','transition'].includes(engine.state.mode);
 if(resumeAfterHelp)pause();help.showModal();
}
help.addEventListener('close',()=>{if(resumeAfterHelp&&engine.state.mode==='paused')pause();resumeAfterHelp=false});
help.addEventListener('click',e=>{if(e.target===help)help.close()});
$('[data-close-help]').onclick=()=>help.close();
$('[data-close-manual]').onclick=()=>help.close();
document.querySelectorAll('[data-help]').forEach(b=>b.onclick=openHelp);
$('#haptics').checked=EncoreHaptics.enabled;$('#haptics').onchange=event=>EncoreHaptics.setEnabled(event.target.checked);
$('#talk-prompt').onclick=()=>engine.talk();

$('#pause').onclick=pause;$('#next-line').onclick=()=>engine.advance();$('#leave-chat').onclick=()=>engine.skip();
if(!game.requestFullscreen)$('#expand').hidden=true;
else $('#expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await game.requestFullscreen();resize()}catch{$('#expand').hidden=true}};
controller=EncoreInput.mount({root:$('.deck'),press:key=>engine.press(key),release:key=>engine.release(key),enabled:()=>ready&&screen==='game'&&!help.open&&['run','transition'].includes(engine.state.mode)});
function visibleButtons(root) {
 return [...root.querySelectorAll('button:not(:disabled),input[type="checkbox"]')].filter(el => el.getClientRects().length);
}
function menuItems() {
 if (help.open) return visibleButtons(help);
 if ($('#ending').open) return visibleButtons($('#ending'));
 if (!$('#overlay').hidden) return visibleButtons($('#overlay'));
 if (screen === 'title') return visibleButtons($('#sleeve'));
 if (screen === 'modes') return visibleButtons($('#selector'));
 if (screen === 'game' && !chat.hidden) return visibleButtons(chat);
 if (screen === 'game' && !$('#reaction').hidden) return visibleButtons($('#reaction'));
 return [];
}
function moveFocus(items,dir) {
 if (!items.length) return;
 const i = items.indexOf(document.activeElement);
 items[i < 0 ? 0 : (i + dir + items.length) % items.length].focus();
 synth.play('move');
}
function back() {
 if (help.open) { help.close(); return; }
 if ($('#ending').open) {
  showTitle();
  return;
 }
 if (screen === 'loading') { if (ready) showModes(); return; }
 if (screen === 'error') { if (ready) showModes(); else window.EncoreAndroid?.exit(); return; }
 if (screen === 'modes') { showTitle(); return; }
 if (screen === 'title') { window.EncoreAndroid?.exit(); return; }
 if (engine.state.mode === 'finale' || engine.state.mode === 'complete') showTitle();
 else if (engine.state.mode === 'dialogue') engine.skip(); else pause();
}
let waitForPadRelease = launch.get('from') === 'cdman';
let previous = {}, heldNav = 0, nextNav = 0, lastPadKeys = '';
function pollPad(now) {
 const pad = EncorePads.read();
 if (!pad.connected) {
  if (previous.connected) { controller.setSource('gamepad',[]); lastPadKeys=''; heldNav=0; input(matchMedia('(pointer:coarse)').matches?'touch':'key'); }
  previous={}; menuReleased=true; return;
 }
 if (waitForPadRelease) {
  previous=pad; waitForPadRelease=pad.active; return;
 }
 const edge = key => pad[key] && !previous[key];
 if (pad.active && !previous.active) { input('pad'); synth.unlock().then(updateMusic); }
 if (edge('select')) cycleTouch();
 const items = menuItems();
 if (items.length) {
  if (lastPadKeys) { controller.setSource('gamepad',[]); lastPadKeys=''; }
  const direction = pad.U || pad.L ? -1 : pad.D || pad.R ? 1 : 0;
  if (direction && (direction !== heldNav || now >= nextNav)) {
   moveFocus(items,direction); nextNav = now + (direction === heldNav ? 145 : 370);
  }
  heldNav=direction;
  if (edge('a') || edge('start')) {
   menuReleased=false;
   const focused = items.includes(document.activeElement) ? document.activeElement : items[0];
   if (edge('start') && engine.state?.mode==='paused' && !help.open) pause(); else focused.click();
  } else if (edge('b')) { menuReleased=false; back(); }
 } else if (screen === 'game') {
  heldNav=0;
  if (edge('b') && engine.state.mode==='finale') { menuReleased=false; back(); }
  else if (edge('start')) { menuReleased=false; pause(); }
  else if (engine.state.mode === 'run') {
   if (!pad.a && !pad.b && !pad.start) menuReleased=true;
   if (edge('y')) controller.toggleSpeed();
   const keys=[];
   if (pad.L) keys.push('left'); if (pad.R) keys.push('right'); if (pad.D) keys.push('down');
   if ((pad.a && menuReleased) || pad.U) keys.push('jump');
   if ((pad.b && menuReleased) || pad.x) keys.push('flip');
   if (pad.lb || pad.rb) keys.push('speed');
   if (pad.rt) keys.push('fire'); if (pad.lt) keys.push('talk'); if (pad.r3) keys.push('flashlight');
   const id=keys.join(',');
   if (id!==lastPadKeys) { lastPadKeys=id; controller.setSource('gamepad',keys); }
  }
 } else if (edge('b') && ready) back();
 previous=pad;
}
addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.pointerType==='pen') input('touch'); synth.unlock().then(updateMusic);}, true);
addEventListener('keydown',event=>{
 input('key'); synth.unlock().then(updateMusic);
 if (event.code==='Escape') { event.preventDefault(); if(!event.repeat) back(); return; }
 const items=menuItems();
 if (items.length && /^Arrow(Up|Left|Down|Right)$/.test(event.code)) {
  event.preventDefault(); moveFocus(items,['ArrowLeft','ArrowUp'].includes(event.code)?-1:1); return;
 }
 if (screen==='game' && !help.open && event.code==='KeyP') {event.preventDefault(); if(!event.repeat) pause();}
});
function pauseIfPlaying() {
 if (ready && screen==='game' && ['run','dialogue','transition'].includes(engine.state.mode)) pause();
 if (screen==='loading' && ready) showModes();
 EncoreHaptics.stop(); synth.stopMusic(.1);
}
window.EncoreApp={back,pause:pauseIfPlaying};
if(!window.ArcadeGameClock)addEventListener('blur',pauseIfPlaying);
document.addEventListener('visibilitychange',()=>{ if(document.hidden){if(!window.ArcadeGameClock)pauseIfPlaying();}else updateMusic(); });
document.documentElement.classList.toggle('embedded',launch.get('embedded')==='1');
if(isApp) $('#expand').hidden=true;
applySettings(); setScreen('loading'); $('#pause').disabled=true;
StreetArt.load().then(()=>{
 ready=true;
 for(const el of document.querySelectorAll('[data-merch-icon]')) StreetArt.merchIcon(el.getContext('2d'),Number(el.dataset.merchIcon),24,24,44);
 resize(); showTitle(true); if(launch.get('menu')==='modes'){selected='cdman';showModes();}
 if(launch.get('autostart')==='1') {
  const areaIndex=({market:1,rise:2,rooftops:3,party:4})[launch.get('area')]||0;
  newRun({areaIndex,afterParty:launch.get('mode')==='afterparty',timed:launch.get('mode')==='trial'});
 }
}).catch(()=>{
 setScreen('error'); overlay('ENCORE','The block couldn’t load.','Reload to try again.','Reload',()=>location.reload(),'Exit',()=>window.EncoreAndroid?.exit());
});
requestAnimationFrame(frame);

})();
