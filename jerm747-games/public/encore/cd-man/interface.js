(() => {
'use strict';
const $=s=>document.querySelector(s);
const game=$('#game'),help=$('#help'),field=$('#playfield'),ctx=field.getContext('2d');
let audio=null,soundOn=false,frameId=0,last=0,lag=0,worldWidth=800,dpr=1;
let postWin=false,pauseFrom='run';
const labels={jump:[260,490,.09],flip:[300,630,.12],note:[620,930,.07],crack:[130,62,.08],discOut:[360,680,.14],tap:[150,115,.04],power:[460,920,.22],retry:[210,105,.16],save:[430,720,.16],win:[330,880,.4],pickup:[320,510,.12],throw:[520,200,.09]};
/* Sound and vibration are independent. Both switches use Encore's device settings. */
const cdSettings = (() => {
 try { return JSON.parse(localStorage.getItem('encore.settings')) || {}; } catch { return {}; }
})();
soundOn = cdSettings.sound !== false;
function updateSoundLabel() {
 $('#audio').textContent = soundOn ? 'Sound on' : 'Sound off';
 $('#audio').setAttribute('aria-pressed',String(soundOn));
}
async function unlockSound() {
 if (!soundOn || audio?.state === 'running') return;
 try {
  const Engine = window.AudioContext || window.webkitAudioContext;
  if (!Engine) return;
  audio ||= new Engine();
  await audio.resume();
 } catch {}
}
function tone(from,to,duration,start=0,type='sine',gain=.085) {
 if (!soundOn || audio?.state !== 'running') return;
 const t=audio.currentTime+start, oscillator=audio.createOscillator(), volume=audio.createGain();
 oscillator.type=type;
 oscillator.frequency.setValueAtTime(from,t);
 oscillator.frequency.exponentialRampToValueAtTime(to,t+duration);
 volume.gain.setValueAtTime(.0001,t);
 volume.gain.exponentialRampToValueAtTime(gain,t+.008);
 volume.gain.exponentialRampToValueAtTime(.0001,t+duration);
 oscillator.connect(volume);volume.connect(audio.destination);
 oscillator.start(t);oscillator.stop(t+duration+.01);
}
function playSound(id) {
 if (id==='win') {
  const notes=Highway.state.leg===0?[392,494,587]:[392,494,587,784];
  notes.forEach((n,i)=>tone(n,n*1.006,i===notes.length-1?.30:.13,i*.095,'triangle',.10));
  return;
 }
 const [from,to,duration]=labels[id]||labels.note;
 tone(from,to,duration,0,['crack','retry','throw'].includes(id)?'triangle':'sine');
 if (id==='power') tone(880,1175,.18,.11,'triangle');
}
$('#audio').onclick=async()=>{
 soundOn=!soundOn;cdSettings.sound=soundOn;
 try {localStorage.setItem('encore.settings',JSON.stringify(cdSettings));} catch {}
 updateSoundLabel();await unlockSound();playSound('note');field.focus({preventScroll:true});
};
const rumbleEvents={power:'cdDisc',pickup:'cdLift',throw:'cdThrow',save:'cdCheckpoint',win:'cdFinish'};
Highway.setCallbacks({
 message:t=>{$('#toast').textContent=t},
 sound:id=>{playSound(id);if(rumbleEvents[id]) EncoreHaptics.pulse(rumbleEvents[id]);},
 win:()=>{clearHeld();$('#pause').disabled=true}
});
function resize(){
 
 const r=field.getBoundingClientRect();if(!r.height||!r.width)return;
 worldWidth=Math.min(1152,432*r.width/r.height);dpr=Math.min(2,window.devicePixelRatio||1);field.width=Math.round(r.width*dpr);field.height=Math.round(r.height*dpr);
}
new ResizeObserver(resize).observe($('#viewport'));
function render(){
 const s = Highway.state;
 const scale = field.width / worldWidth;
 const visibleHeight = field.height / scale;
 const floorOffset = Math.max(0, 340 - visibleHeight * .8);
 const cameraY = visibleHeight < 431 ? Math.min(floorOffset, Math.max(0, s.player.y - 100)) : 0;
 ctx.setTransform(scale, 0, 0, scale, 0, -cameraY * scale);
 Highway.draw(ctx,worldWidth,432);
 const stop=s.route.theme==='subway'?'METRO · PL '+(s.save+1):['SIDE A','SIDE B','SIDE C'][s.save];
 $('#stop').textContent=(s.leg>=2?'ENDLESS '+(s.leg-1)+' · ':'')+stop;$('#score').textContent=String(s.score).padStart(3,'0')+' PTS';
 $('#power').hidden=s.player.power<=0;$('#power').textContent='◉ '+Math.ceil(s.player.power)+'s';$('#progress').style.width=Math.min(100,100*s.player.x/Highway.finish)+'%';
}
function frame(now){
 pollPad(now);
 lag+=Math.min(.08,(now-(last||now))/1000);last=now;
 while(lag>=1/120){Highway.step(1/120,worldWidth);lag-=1/120}
 render();
 const s=Highway.state;
 if(s.mode==='win'&&s.winTime>1&&!postWin){
  postWin=true;
  if(s.leg===0){
   overlay('01 / 02   ·   MANSION STATION','Next stop: underground.',
    'Flag raised. Take your '+s.score+' points down to the platform.',
    'Enter the subway',continueRoute,'Back to Title',toEncore,'transfer');
  }else{
   overlay('02 / 02   ·   LAST TRAIN','Fare paid.',
    'Both routes clear. '+s.score+(s.score===1?' point':' points')+' · '+s.stomps+(s.stomps===1?' flip.':' flips.')+' You made the last train.',
    'Play again',start,'Back to Title',toEncore,'finish');
  }
 }
 frameId=requestAnimationFrame(frame);
}
function clearHeld(){ controller.clear(); heldKeys=''; Highway.clearInput(); }
function continueRoute(){
 if(!Highway.nextRoute())return;
 clearHeld();postWin=false;$('#overlay').hidden=true;game.dataset.panel='';$('#pause').disabled=false;$('#pause').textContent='Pause';
 lag=0;field.focus({preventScroll:true});render();
}
function start(firstLeg=0){
 if(help.open)help.close();
 clearHeld();Highway.reset(firstLeg===1?1:0);postWin=false;$('#overlay').hidden=true;game.dataset.panel='';$('#pause').disabled=false;$('#pause').textContent='Pause';
 resize();cancelAnimationFrame(frameId);last=0;lag=0;render();frameId=requestAnimationFrame(frame);field.focus({preventScroll:true});
}
function overlay(k,title,desc,a,onA,b,onB,scene=''){
 game.dataset.panel=scene;$('#overlay').dataset.scene=scene; $('#cd-return').hidden=scene!=='pause';
 $('#overKicker').textContent=k;$('#overTitle').textContent=title;$('#overText').textContent=desc;$('#primary').textContent=a;$('#primary').onclick=onA;$('#secondary').textContent=b;$('#secondary').onclick=onB;$('#overlay').hidden=false;$('#primary').focus({preventScroll:true});
}
function pause(){
 const s=Highway.state;if(!s||!['run','retry','paused'].includes(s.mode))return;
 if(s.mode==='paused'){Highway.setMode(pauseFrom);$('#pause').textContent='Pause';$('#overlay').hidden=true;game.dataset.panel='';field.focus({preventScroll:true});return}
 pauseFrom=s.mode;clearHeld();Highway.setMode('paused');$('#pause').textContent='Resume';overlay('RETURNITY ARCADE','Intermission','Your run is waiting right here.','Resume run',pause,'Restart run',start,'pause');
}
let resumeAfterHelp = false;
function openHelp() {
 resumeAfterHelp = ['run', 'retry'].includes(Highway.state.mode);
 if (resumeAfterHelp) pause();
 help.showModal();
}
$('[data-close-manual]').onclick=()=>help.close();
document.querySelectorAll('[data-help]').forEach(button => button.onclick = openHelp);
$('[data-close-help]').onclick = () => help.close();
$('#pause').onclick = pause;
help.addEventListener('click', event => { if (event.target === help) help.close(); });
help.addEventListener('close', () => {
 if (resumeAfterHelp && Highway.state.mode === 'paused') pause();
 resumeAfterHelp = false;
});
if(!game.requestFullscreen)$('#expand').hidden=true;else $('#expand').onclick=async()=>{try{
 if(document.fullscreenElement)await document.exitFullscreen();else await game.requestFullscreen();resize();field.focus({preventScroll:true})
 }catch{ $('#expand').hidden=true }};
const controller = EncoreInput.mount({
 root: $('.deck'),
 press: key => Highway.press(key),
 release: key => Highway.release(key),
 enabled: () => !help.open && Highway.state?.mode === 'run'
});
const inApp=!!window.EncoreAndroid || new URLSearchParams(location.search).get('app')==='android';
function toEncore() {
 if(window.ArcadeGameClock&&parent.Arcade.gameTitle(window))return;
 clearHeld();EncoreHaptics.stop();
 const target=new URL('../index.html',location.href);
 target.searchParams.set('from','cdman');
 if(inApp) target.searchParams.set('app','android');
 location.replace(target.href);
}
function back() {
 if (help.open) {help.close();return;}
 if (Highway.state.mode==='win') {toEncore();return;}
 pause();
}
function pauseIfPlaying() {
 if (['run','retry'].includes(Highway.state.mode)) pause();
 EncoreHaptics.stop();
}
window.EncoreApp={back,pause:pauseIfPlaying};
let previousPad={},waitForRelease=true,heldKeys='',lastDirection=0,repeatAt=0,blockJump=false;
let lastInput=matchMedia('(pointer:coarse)').matches?'touch':'keyboard';
function noteInput(kind) {
 lastInput=kind;
 const h=cdSettings.touch || 'auto';
 game.dataset.deck=h==='on'||(h==='auto'&&lastInput==='touch')?'shown':'hidden';
}
function cycleTouch() {
 cdSettings.touch={auto:'on',on:'off',off:'auto'}[cdSettings.touch||'auto'];
 try{localStorage.setItem('encore.settings',JSON.stringify(cdSettings));}catch{}
 noteInput(lastInput);
}
function navButtons() {
 const root=help.open?help:$('#overlay').hidden?null:$('#overlay');
 return root?[...root.querySelectorAll('button:not(:disabled),input')].filter(b=>b.getClientRects().length):[];
}
function navigate(items,direction) {
 const i=items.indexOf(document.activeElement);
 items[i<0?0:(i+items.length+direction)%items.length]?.focus();
}
function pollPad(now) {
 const pad=EncorePads.read();
 if(!pad.connected){
  if(previousPad.connected){controller.setSource('gamepad',[]);heldKeys='';waitForRelease=true;noteInput(matchMedia('(pointer:coarse)').matches?'touch':'keyboard');}
  previousPad={};return;
 }
 if(waitForRelease){previousPad=pad;waitForRelease=pad.active;return}
 const edge=k=>pad[k]&&!previousPad[k];
 if(pad.active&&!previousPad.active){noteInput('pad');unlockSound();}
 if(edge('select')) cycleTouch();
 const items=navButtons();
 if(items.length){
  const d=pad.L||pad.U?-1:pad.R||pad.D?1:0;
  if(d&&(lastDirection!==d||now>repeatAt)){navigate(items,d);repeatAt=now+(d===lastDirection?150:370)}
  lastDirection=d;
  if(edge('a')||edge('start')){
   blockJump=true;
   if(edge('start')&&Highway.state.mode==='paused'&&!help.open)pause();
   else (items.includes(document.activeElement)?document.activeElement:items[0]).click();
  }else if(edge('b'))back();
 }else if(Highway.state.mode==='run'){
  if(edge('start'))pause();
  else{
   if(!pad.a&&!pad.b&&!pad.x&&!pad.U)blockJump=false;
   if(edge('y'))controller.toggleSpeed();
   const keys=[];
   if(pad.L)keys.push('left');if(pad.R)keys.push('right');if(pad.D)keys.push('down');
   if((pad.a||pad.U)&&!blockJump)keys.push('jump');
   if(pad.b&&!blockJump)keys.push('lift');if(pad.x&&!blockJump)keys.push('pulse');
   if(pad.lb||pad.rb||pad.lt||pad.rt)keys.push('speed');
   const keyset=keys.join(',');
   if(keyset!==heldKeys){heldKeys=keyset;controller.setSource('gamepad',keys)}
  }
 }else if(edge('b')&&Highway.state.mode==='win')back();
 previousPad=pad;
}
window.addEventListener('keydown',event=>{
 noteInput('keyboard');unlockSound();
 if(event.code==='Escape'){event.preventDefault();if(!event.repeat)back();return;}
 const items=navButtons();
 if(items.length&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){
  event.preventDefault();navigate(items,['ArrowUp','ArrowLeft'].includes(event.code)?-1:1);return;
 }
 if(!help.open&&event.code==='KeyP'){event.preventDefault();if(!event.repeat)pause();}
});
window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.pointerType==='pen')noteInput('touch');unlockSound();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!window.ArcadeGameClock)pauseIfPlaying();});
if(!window.ArcadeGameClock)window.addEventListener('blur',pauseIfPlaying);
$('#cd-haptics').checked=EncoreHaptics.enabled;
$('#cd-haptics').onchange=e=>EncoreHaptics.setEnabled(e.target.checked);
$('#cd-return').onclick=toEncore;
$('#cd-touch').onclick=cycleTouch;
if(inApp)$('#expand').hidden=true;
updateSoundLabel();noteInput(lastInput);start(new URLSearchParams(location.search).get('leg')==='subway'?1:0);unlockSound();

})();
