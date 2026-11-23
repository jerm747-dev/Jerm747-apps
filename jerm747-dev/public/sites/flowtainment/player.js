'use strict';
let watching=null;
const introUrl='media/intro/default/flow-ripple-v3.mp4';
const clock=s=>Math.floor((s||0)/60)+':'+String(Math.floor((s||0)%60)).padStart(2,'0');
function sources(t,v){
 const path=media(t);
 const options=[{id:'mp4',name:'H.264 MP4 · '+t.clip.width+'p',url:path+t.clip.file,type:'video/mp4; codecs="avc1.42E01E"'}];
 if(t.clip.id==='block-party-blvd')options.push(
 {id:'vp9',name:'VP9 WebM · 720p',url:path+'vp9-720p.webm',type:'video/webm; codecs="vp9"'},
 {id:'hevc',name:'HEVC · 720p',url:path+'hevc-720p.mp4',type:'video/mp4; codecs="hvc1"'},
 {id:'hls',name:'Adaptive HLS',url:path+'hls/master.m3u8',type:'application/vnd.apple.mpegurl'});
 return options.filter(s=>v.canPlayType(s.type));
}
function playerMarkup(t){return '<header>'+iconButton('Back to browsing','back','data-back')+'<div><strong>'+t.name+'</strong><small id="watch-sub">Preparing sample</small></div></header><div class="screen"><video id="screen-video" playsinline preload="auto" aria-label="'+t.name+'"></video></div><button class="btn secondary skip" data-control="skip" hidden>Skip intro '+icon('right')+'</button><div class="stage-msg" id="stage-msg" aria-live="polite"></div><div class="transport"><div class="timebar"><span id="elapsed">0:00</span><input id="seek" type="range" min="0" max="'+t.seconds+'" value="0" step="0.05" aria-label="Seek through program"><span id="duration">'+clock(t.seconds)+'</span></div><div class="player-buttons">'+iconButton('Pause','pause','data-control="toggle"')+iconButton('Mute','sound','data-control="mute"')+'<div class="player-actions">'+(t.cc?iconButton('Captions and audio','cc','data-dialog="captions"'):'')+iconButton('Playback options','settings','data-dialog="play-settings"')+iconButton('Fullscreen','full','data-control="full"')+'</div></div></div>'}
function stateBox(s,title,body='',actions='',loader=false){if(watching!==s)return;const box=$('#stage-msg',s.root);box.innerHTML=title?'<div>'+(loader?'<span class="spinner" aria-hidden="true"></span>':'')+'<strong>'+esc(title)+'</strong>'+(body?'<p>'+esc(body)+'</p>':'')+actions+'</div>':''}
function paintControl(action,name,label){const btn=$('[data-control="'+action+'"]',watching.root);btn.innerHTML=icon(name);btn.setAttribute('aria-label',label);btn.title=label}
function wakeControls(){
 const s=watching;if(!s)return;
 clearTimeout(s.idle);s.root.classList.remove('quiet');
 if(s.phase==='show'&&!s.v.paused&&!route.sheet)s.idle=setTimeout(()=>{if(watching===s&&!route.sheet&&!s.v.paused&&!s.keyboard)s.root.classList.add('quiet')},3000);
}
function saveTime(s,finished=false){
 if(!s||s.phase!=='show'||s.changing)return;
 const pos=s.v.currentTime;
 if(finished)delete account().progress[s.t.id];
 else if(pos>=.4&&Number.isFinite(pos))account().progress[s.t.id]=pos;
 saveAccount();
}
function playbackPanel(name){
 const s=watching;if(!s)return '';
 if(name==='captions')return '<div class="sheet">'+sheetHeader('Captions & audio')+'<div class="setting-group">'+selectPref('Captions','cc',prefs.cc,[['false','Off'],['true','English']])+'<div class="preference"><span>Audio</span><strong>Original mix</strong></div></div></div>';
 const opts=[['auto','Automatic'],...s.available.map(x=>[x.id,x.name])];
 return '<div class="sheet">'+sheetHeader('Playback options')+'<div class="setting-group">'+selectPref('Playback speed','rate',prefs.rate,[[.75,'0.75×'],[1,'Normal'],[1.25,'1.25×'],[1.5,'1.5×'],[2,'2×']])+selectPref('Video format','format',opts.some(x=>x[0]===prefs.format)?prefs.format:'auto',opts)+'</div>'+(s.selected?'<p>Playing format · '+esc(s.selected.name)+'</p>':'')+'</div>';
}
function setCaptions(s){
 for(const track of s.v.textTracks)track.mode=s.phase==='show'&&prefs.cc?'showing':'disabled';
}
function changePlaybackPref(key){
 const s=watching;if(!s)return;
 if(key==='cc')setCaptions(s);
 if(key==='rate'&&s.phase==='show')s.v.playbackRate=prefs.rate;
 if(key==='format'&&s.phase==='show'){const pos=s.v.currentTime;saveTime(s);prepare(s,false,pos,!s.v.paused)}
}
function releaseProbe(s){if(!s.probe)return;s.probe.oncanplay=null;s.probe.onerror=null;s.probe.removeAttribute('src');s.probe.load();s.probe=null}
function active(s,run){return watching===s&&run===s.run}
// Keep the inline video covered while a source has no decoded frame to display.
function coverVideo(s){
 $('.screen',s.root).classList.remove('frame-ready');
 s.sourceVersion++;
 if(s.frameRequest!=null){
  s.v.cancelVideoFrameCallback(s.frameRequest);
  s.frameRequest=null;
 }
}
function revealVideo(s){
 if(watching===s&&['intro','show'].includes(s.phase))$('.screen',s.root).classList.add('frame-ready');
}
function waitForFrame(s){
 if(!s.v.requestVideoFrameCallback)return;
 const version=s.sourceVersion;
 s.frameRequest=s.v.requestVideoFrameCallback(()=>{
  if(s.sourceVersion!==version)return;
  s.frameRequest=null;
  revealVideo(s);
 });
}
function tryPlay(s){
 const version=s.sourceVersion;
 const promise=s.v.play();
 if(!promise)return;
 promise.catch(error=>{
  if(watching!==s||version!==s.sourceVersion||error.name==='AbortError')return;
  if(error.name==='NotAllowedError'){
   stateBox(s,'');
   paintControl('toggle','play','Play');
   wakeControls();
   announce('Ready. Use the Play button to start.');
  }
 });
}
function mediaFail(s){
 clearTimeout(s.deadline);
 if(s.phase==='intro'){beginProgram(s);return}
 if(s.phase==='show')saveTime(s);
 s.phase='error';s.changing=false;s.v.pause();wakeControls();
 $('#watch-sub',s.root).textContent='Playback unavailable';
 stateBox(s,'Couldn’t play this sample','Check the connection, then try again.',button('Retry','replay','data-control="retry"','primary'));
}
function setDeadline(s,ms,onTimeout){clearTimeout(s.deadline);const run=s.run;s.deadline=setTimeout(()=>{if(active(s,run))onTimeout()},ms)}
function prepare(s,withIntro=true,from=0,autoplay=true){
 s.run++;s.changing=true;s.phase='prepare';s.resume=from;s.autoplay=autoplay;clearTimeout(s.deadline);releaseProbe(s);
 coverVideo(s);s.v.pause();s.v.removeAttribute('src');s.v.load();s.v.replaceChildren();s.selected=null;
 s.root.classList.remove('quiet');$('.skip',s.root).hidden=true;$('#seek',s.root).disabled=true;
 $('#watch-sub',s.root).textContent='Preparing sample';stateBox(s,'Preparing playback…','','',true);
 const run=s.run,options=[...s.available].sort((a,b)=>Number(b.id===prefs.format)-Number(a.id===prefs.format));
 function probeNext(){
  if(!active(s,run))return;clearTimeout(s.deadline);releaseProbe(s);
  const next=options.shift();if(!next){mediaFail(s);return}
  const probe=document.createElement('video');s.probe=probe;probe.muted=true;probe.playsInline=true;probe.preload='auto';
  probe.onerror=probeNext;probe.oncanplay=()=>{
   if(!active(s,run))return;clearTimeout(s.deadline);probe.oncanplay=null;probe.onerror=null;s.selected=next;
   if(withIntro&&prefs.intro&&s.resume<.4){
    s.phase='intro';s.changing=false;s.v.playbackRate=1;s.v.src=introUrl;waitForFrame(s);
    $('#watch-sub',s.root).textContent='Flowtainment intro';$('.skip',s.root).hidden=false;stateBox(s,'');tryPlay(s);
    setDeadline(s,8000,()=>{if(s.phase==='intro'&&!s.v.paused)beginProgram(s)});
   }else beginProgram(s);
  };
  setDeadline(s,8500,probeNext);probe.src=next.url;probe.load();
 }
 probeNext();
}
function beginProgram(s){
 if(s.phase==='show'||!s.selected)return;
 clearTimeout(s.deadline);s.phase='show';s.changing=true;coverVideo(s);s.v.pause();s.v.replaceChildren();s.v.src=s.selected.url;
 if(s.t.cc){const track=document.createElement('track');track.kind='captions';track.srclang='en';track.label='English';track.src=media(s.t)+'en.vtt';s.v.append(track)}
 setCaptions(s);s.v.playbackRate=prefs.rate;$('.skip',s.root).hidden=true;
 $('#watch-sub',s.root).textContent=s.t.clipId?'Sample from '+s.t.clip.name:s.t.genre+' · Program sample';$('#seek',s.root).disabled=false;
 stateBox(s,'');s.v.load();waitForFrame(s);if(s.autoplay)tryPlay(s);else paintControl('toggle','play','Play');
 setDeadline(s,12000,()=>{if(s.v.readyState<2)mediaFail(s)});
}
function startWatch(t){
 if(!t)return;
 const root=document.createElement('section');root.className='cinema';root.setAttribute('aria-label','Video player');root.innerHTML=playerMarkup(t);document.body.append(root);
 const v=$('#screen-video',root);
 const s={t,v,root,phase:'prepare',run:0,available:sources(t,v),keyboard:false,selected:null,probe:null,idle:0,deadline:0,changing:false,lastSaved:-1,sourceVersion:0,frameRequest:null};watching=s;
 root.addEventListener('pointermove',()=>{s.keyboard=false;wakeControls()});
 root.addEventListener('keydown',()=>{s.keyboard=true;wakeControls()});
 root.addEventListener('focusin',wakeControls);
 $('.screen',root).addEventListener('click',()=>{wakeControls()});
 v.addEventListener('loadedmetadata',()=>{
  if(s.phase==='show'){if(s.resume>.1&&s.resume<s.v.duration-.15)s.v.currentTime=s.resume;s.v.playbackRate=prefs.rate;setCaptions(s);s.changing=false;releaseProbe(s)}
 });
 v.addEventListener('loadeddata',()=>{if(!v.requestVideoFrameCallback&&s.phase==='show'&&!s.autoplay)revealVideo(s)});
 v.addEventListener('canplay',()=>{if(s.phase==='show'){clearTimeout(s.deadline);if(!s.v.paused)stateBox(s,'')}});
 v.addEventListener('playing',()=>{if(watching!==s||v.paused)return;if(!v.requestVideoFrameCallback)revealVideo(s);stateBox(s,'');paintControl('toggle','pause','Pause');wakeControls()});
 v.addEventListener('pause',()=>{if(watching!==s||!v.paused||s.changing||s.phase==='prepare')return;paintControl('toggle','play','Play');wakeControls();if(!s.v.ended)saveTime(s)});
 v.addEventListener('timeupdate',()=>{
  if(watching!==s)return;
  $('#elapsed',root).textContent=clock(v.currentTime);
  const dur=Number.isFinite(v.duration)?v.duration:t.seconds;$('#duration',root).textContent=clock(dur);
  const seek=$('#seek',root);seek.max=dur;seek.value=v.currentTime||0;
  const sec=Math.floor(v.currentTime);if(s.phase==='show'&&sec!==s.lastSaved&&!v.ended){s.lastSaved=sec;saveTime(s)}
 });
 v.addEventListener('ended',()=>{
  if(watching!==s)return;if(s.phase==='intro'){beginProgram(s);return}
  if(s.phase!=='show')return;saveTime(s,true);s.phase='ended';wakeControls();$('#watch-sub',root).textContent='Sample complete';
  stateBox(s,'Sample complete','',button('Play again','replay','data-control="replay"','primary'));
 });
 v.addEventListener('error',()=>{if(watching===s&&v.error&&['intro','show'].includes(s.phase))mediaFail(s)});
 $('#seek',root).addEventListener('input',e=>{if(s.phase==='show'){v.currentTime=Number(e.target.value);wakeControls()}});
 prepare(s,true,account().progress[t.id]||0);
 $('[data-back]',root).focus({preventScroll:true});
}
function stopWatch(){
 const s=watching;if(!s)return;
 saveTime(s);coverVideo(s);watching=null;clearTimeout(s.deadline);clearTimeout(s.idle);releaseProbe(s);
 s.v.pause();s.v.removeAttribute('src');s.v.load();s.root.remove();
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-control]'),s=watching;if(!b||!s)return;
 const action=b.dataset.control;wakeControls();
 if(action==='toggle'){
  if(s.phase==='ended'){prepare(s,false,0);return}
  if(!['show','intro'].includes(s.phase))return;
  if(s.v.paused){stateBox(s,'');tryPlay(s)}else s.v.pause();
 }
 if(action==='skip'&&s.phase==='intro')beginProgram(s);
 if(action==='replay')prepare(s,false,0);
 if(action==='retry')prepare(s,false,account().progress[s.t.id]||0);
 if(action==='mute'){s.v.muted=!s.v.muted;paintControl('mute',s.v.muted?'mute':'sound',s.v.muted?'Unmute':'Mute')}
 if(action==='full'){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else if(s.v.webkitEnterFullscreen)s.v.webkitEnterFullscreen();else announce('Player fills the current screen')}catch{announce('Fullscreen is unavailable in this view')}}
});
window.addEventListener('pagehide',()=>saveTime(watching));
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveTime(watching)});
