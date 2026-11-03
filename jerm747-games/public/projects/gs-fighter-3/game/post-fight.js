/* GS Fighter III • Post-fight v7. One visible-time state machine owns the
   showcase, score, winner quote and continuation. Combat resumes only on launch. */
(function(){'use strict';
const L=window.FighterLab,T=THREE,$=id=>document.getElementById(id),roster=window.GSFPostFightRoster||FighterRoster;
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const record=id=>roster.find(f=>f.id===id)||roster[0],num=n=>Math.round(n).toLocaleString('en-US');
const QUOTES={
 Akeem:['Train the mind. The hands will follow.','Your next round starts in practice.','Respect the guard. Then break it.'],
 Nika:['Move with purpose. Every time.','Find your balance. Then try again.','Gold is earned one round at a time.'],
 Rokr:['Strong is good. Ready is better.','Hit hard. Stay humble.','Turn it up next time.'],
 Cyon:['Read the rhythm before you rush.','Stay cool. The tempo is mine.','Find the beat, then find the opening.'],
 Major:['Championships are earned in practice.','Class is in session.','Dress for the win. Fight for it too.'],
 Tank:['Bring more than power next time.','You hit the wall. I am the wall.','Heavy hands. Steady feet.'],
 Billie:['Keep your guard up. And your focus.','Clean lines. Clean hits.','One more lesson from the dojo.'],
 Sheila:['There is always another lesson.','Grace wins rounds.','Breathe. Then strike.'],
 Rayburn:['Patience lands the cleaner hit.','Slow down. See everything.','The storm waits for its moment.'],
 Mike:['Put in the work. Then come back.','No shortcuts in this ring.','Keep swinging. Keep learning.'],
 Cyborg:['Adapt. Repeat. Improve.','Target neutralized. Recalibrate.','Arc Lance: charged. Opponent: grounded.'],
 Shadow:['You cannot hit what you cannot read.','Silence was my warning.','Watch the shadows next time.'],
 Tye:['Better timing. Better chances.','Pink jacket, hard lessons.','Style counts. So does the win.'],
 Static:['Stay grounded. Keep the spark.','Feel that? That was the current.','Charged up and still standing.']
};
let state=null,serial=0,run={player:null,beaten:[],total:0},lastButtons=[],navCooldown=0;
const ui=document.createElement('section');ui.id='post-fight';ui.hidden=true;ui.setAttribute('role','dialog');ui.setAttribute('aria-modal','true');ui.setAttribute('aria-label','Post-fight results');
ui.innerHTML=`<div class="pf-letterbox" aria-hidden="true"><i></i><i></i></div><div class="pf-shade"></div><div class="pf-veil" aria-hidden="true"></div>
 <header class="pf-header"><span class="pf-brand">GS <i>FIGHTER</i> <b>III</b></span><span id="pf-context">MATCH COMPLETE</span></header>
 <div class="pf-score" hidden><small id="pf-score-label">MATCH POINTS</small><strong id="pf-points">0</strong><span id="pf-score-detail"></span><span id="pf-run-total"></span></div>
 <div class="pf-result" hidden><p id="pf-fighter-name"></p><h1 id="pf-word"></h1><p id="pf-result-note"></p><div class="pf-sparks" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div></div>
 <div class="pf-quote" hidden><p class="pf-eyebrow">A WORD FROM THE WINNER</p><div class="pf-speaker"><div id="pf-speaker-diamond"></div><span><small>WINNER</small><strong id="pf-speaker-name"></strong></span></div><blockquote id="pf-quote-text"></blockquote></div>
 <section class="pf-journey" hidden aria-labelledby="pf-journey-title"><p class="pf-eyebrow" id="pf-route-label">THE JOURNEY CONTINUES</p><h2 id="pf-journey-title">Next challenger</h2><div class="pf-pair"><div class="pf-contender"><small>YOUR FIGHTER</small><div id="pf-player-diamond"></div><strong id="pf-player-label"></strong></div><div class="pf-route" aria-hidden="true"><i></i><i></i><i></i><span>VS</span></div><div class="pf-contender"><small id="pf-rival-role">UP NEXT</small><div id="pf-rival-diamond"></div><strong id="pf-rival-label"></strong></div></div><p class="pf-journey-note" id="pf-journey-note"></p><div class="pf-actions"><button data-pf="fight" id="pf-fight">NEXT FIGHT <b>›</b></button><button data-pf="select">FIGHTER SELECT</button><button data-pf="title" class="pf-quiet">TITLE SCREEN</button></div><p id="pf-error" role="alert"></p></section>
 <footer class="pf-footer"><span id="pf-footer-note">TAKE IN THE MOMENT</span><button data-pf="advance" id="pf-advance">NEXT <b>›</b></button></footer>
 <p id="pf-live" class="pf-sr" role="status" aria-live="polite"></p>`;
document.body.append(ui);
let fallbackArt=null;
function loadFallbackArt(){if(fallbackArt||!L.renderer.isFighterCanvasRenderer)return;fallbackArt={};window.GSFQuality?.ready?.then(assets=>{for(const key of ['river','stone']){const im=new Image();im.onload=()=>{fallbackArt[key]=im;};im.src=assets[key];}});}
const camera=new T.PerspectiveCamera(32,1,.1,300),focus=new T.Vector3();
function diamond(host,id){const f=record(id),el=$(host);el.textContent='';el.style.setProperty('--energy',f.energy.color);const frame=document.createElement('div');frame.className='pf-diamond';const face=document.createElement('div');face.className='pf-diamond-face';const img=document.createElement('img');img.alt=f.name;img.src=f.portrait.head;if(f.portrait.headFromBody)img.className='clean-head';face.append(img);frame.append(face);el.append(frame);}
function setPhase(name){if(!state)return;state.phase=name;state.age=0;ui.dataset.phase=name;const titles={showcase:'Fighter showcase',result:state.label,quote:'A word from '+state.speaker,journey:state.win?'Choose your next fight':'Choose how to continue'};$('pf-live').textContent=titles[name]||'';}
function scoreFor(result){const rounds=result.wins[0]*1000,finish=result.win?3000:0,health=result.win?Math.round(result.hp[0])*20:0,time=result.win?Math.ceil(result.time)*10:0;return{rounds,finish,health,time,total:rounds+finish+health+time};}
function pickNext(player,current,beaten,random=Math.random){let pool=roster.filter(f=>f.id!==player&&f.id!==current&&!beaten.includes(f.id));if(!pool.length)pool=roster.filter(f=>f.id!==player&&f.id!==current);if(!pool.length)return current;return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))].id;}
function playClip(name,{start=0,end,speed=1,loop=false}={}){const s=state;if(!s||!s.rig.clips.some(c=>c.name===name))return false;s.rig.setLift(0);s.rig.play(name,{start,end,speed,loop,root:'pinned',instant:s.pose==='opening'||s.pose==='down'});s.speed=speed;return true;}
function readyPose(){const s=state;if(!s)return;playClip(s.defaults.idle[0],{speed:1,loop:true});s.pose='ready';}

/* 1.4 Victory cinematic. CinemaScope bars, then one continuous shot on the real final moment: low along the fallen
   fighter, across to the winner's feet, and up to the winner's face, where YOU WIN / YOU LOSE lands. The score and
   quote follow inside the letterbox. Skippable after 1 s. Draws, reduced motion and the compatibility renderer keep
   the original apron showcase. ?cine=test (with ?postfight) previews it on demand. */
const CINE={length:6,skipAfter:1};
function cineWorld(rig,group){const v=new T.Vector3();(rig?.root||group).getWorldPosition(v);return v;}
function prepareCine(){const s=state;loadFallbackArt();if(!s||s.prepared)return;s.prepared=true;
 s.objects=[L.playerGroup,L.opponentGroup,L.scenery.backdrop,...L.scene.children.filter(o=>o.isLight)].map(o=>({o,pos:o.position.clone(),rotation:o.rotation.clone(),scale:o.scale.clone(),visible:o.visible}));
 s.targets=L.scene.children.filter(o=>o.isDirectionalLight||o.isSpotLight).map(o=>({target:o.target,pos:o.target.position.clone()}));
 s.fog=L.scene.fog;
 const winnerIsP1=!s.loss;
 s.rig=winnerIsP1?L.playerRig:L.opponentRig;s.cineGroup=winnerIsP1?L.playerGroup:L.opponentGroup;s.loserRig=winnerIsP1?L.opponentRig:L.playerRig;
 s.defaults=L.defaults[winnerIsP1?s.player:s.opponent];s.originalPosition=s.rig.root.position.clone();
 L.clearInput();L.vwave.reset();L.finishClock.reset();L.playerGroup.visible=true;L.opponentGroup.visible=true;
 // Time-out loser: drop to one knee (an early frame of their get-up), held still.
 const loserHp=L.health[winnerIsP1?1:0],ld=L.defaults[winnerIsP1?s.opponent:s.player],q=new URLSearchParams(location.search);
 const hold=(name,at)=>{const clip=s.loserRig.clips.find(c=>c.name===name);if(clip){s.loserRig.play(clip.name,{speed:0,root:'pinned',instant:true});s.loserRig.seek(clip.duration*at);}};
 if(q.get('postfight')&&q.get('ko')!==null&&q.get('ko')!=='0')hold(ld?.fall?.[0],.999); // preview switch: loser flat out
 else if(loserHp>0)hold(ld?.recover?.[0],.42); // time-out: loser down on one knee
 readyPose();s.pose='ready';
 const w=cineWorld(s.rig,winnerIsP1?L.playerGroup:L.opponentGroup),d=cineWorld(s.loserRig,winnerIsP1?L.opponentGroup:L.playerGroup);
 s.cineW=w;s.cineD=d;s.cineDir=Math.sign(w.x-d.x)||1;
 ui.classList.add('pf-cine');
}
const _cp=new T.Vector3(),_cl=new T.Vector3();
function smoothSeg(t){return t<=0?0:t>=1?1:t*t*(3-2*t);}
function cineCamera(s,aspect){
 const W=s.cineW,D=s.cineD,dir=s.cineDir,portrait=aspect<1.05,back=portrait?1.9:1,lift=portrait?.15:0;
 const t=reduce()?5.6:Math.min(s.cineT,9);
 // Follow the winner's head (stances differ a lot in height); fall back to a standing face height.
 if(s.cineHead===undefined)s.cineHead=s.rig.root.getObjectByProperty?.('isBone',true)&&(()=>{let h=null;s.rig.root.traverse(o=>{if(!h&&o.isBone&&/head/i.test(o.name))h=o;});return h;})()||null;
 let fy=1.45;if(s.cineHead){const v=new T.Vector3();s.cineHead.getWorldPosition(v);fy=Math.min(1.9,Math.max(.8,v.y+.06));}
 // The winner turns toward the lens as the camera rises (right-side stances otherwise show their back).
 // Facing comes from the shoulder line, which is the same on every rig whatever its bone axes.
 const dl=Math.hypot(dir*.45,.9),cx=-dir*.45/dl,cz=.9/dl;
 if(s.cineTurn===undefined&&s.cineT>=3){s.cineTurn=0;const g=s.cineGroup;s.cineRot0=g.rotation.y;let Ls=null,Rs=null;
  s.rig.root.traverse(o=>{if(!o.isBone)return;if(!Ls&&/left(shoulder|arm)$/i.test(o.name))Ls=o;if(!Rs&&/right(shoulder|arm)$/i.test(o.name))Rs=o;});
  if(Ls&&Rs){const a=new T.Vector3(),b=new T.Vector3();Ls.getWorldPosition(a);Rs.getWorldPosition(b);a.sub(b);const f=new T.Vector3().crossVectors(a,new T.Vector3(0,1,0));
   if(Math.hypot(f.x,f.z)>1e-3){let th=Math.atan2(cx,cz)-Math.atan2(f.x,f.z);th=Math.atan2(Math.sin(th),Math.cos(th));if(Math.abs(th)>.3)s.cineTurn=Math.max(-1.9,Math.min(1.9,th));}}}
 if(s.cineTurn)s.cineGroup.rotation.y=s.cineRot0+s.cineTurn*smoothSeg((t-3.4)/2.2);
 s.cineFace=s.cineFace==null?fy:s.cineFace+(fy-s.cineFace)*.08;const F=s.cineFace,fx=W.x+dir*.05;s.cineFx=cx;s.cineFz=cz;
 // Keyframes: [time, camera x,y,z, look x,y]. The rise ends in front of the winner (three-quarter view of the face).
 const K=[[0,D.x-dir*1.7,.5+lift,3.5*back,D.x-dir*.7,.16],[2.4,D.x+dir*1.0,.52+lift,3.1*back,D.x+dir*.9,.16],
  [3.8,W.x-dir*.55,.5+lift,2.9*back,W.x,.14],[5.6,W.x+s.cineFx*2.6*back,F+.05,s.cineFz*2.6*back,fx,F],[9,W.x+s.cineFx*2.3*back,F+.04,s.cineFz*2.3*back,fx,F]];
 let i=0;while(i<K.length-2&&t>K[i+1][0])i++;
 const a=K[i],b=K[i+1],u=smoothSeg((t-a[0])/(b[0]-a[0]));
 _cp.set(a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u,a[3]+(b[3]-a[3])*u);_cl.set(a[4]+(b[4]-a[4])*u,a[5]+(b[5]-a[5])*u,0);
 camera.aspect=aspect;camera.fov=portrait?44:30;camera.position.copy(_cp);camera.lookAt(_cl);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
function prepareScene(){if(state?.cine){prepareCine();return;}loadFallbackArt();const s=state;if(!s||s.prepared)return;s.prepared=true;
 s.objects=[L.playerGroup,L.opponentGroup,L.scenery.backdrop,...L.scene.children.filter(o=>o.isLight)].map(o=>({o,pos:o.position.clone(),rotation:o.rotation.clone(),scale:o.scale.clone(),visible:o.visible}));
 s.targets=L.scene.children.filter(o=>o.isDirectionalLight||o.isSpotLight).map(o=>({target:o.target,pos:o.target.position.clone()}));
 s.fog=L.scene.fog;s.rig=L.playerRig;s.defaults=L.defaults[s.player];s.originalPosition=s.rig.root.position.clone();
 L.clearInput();L.vwave.reset();L.finishClock.reset();L.opponentGroup.visible=false;
 L.playerGroup.visible=true;L.playerGroup.position.set(0,0,12.8);L.playerGroup.rotation.set(0,.12,0);
 L.scenery.setViewAspect(16/9);L.scenery.backdrop.scale.set(2.8,1.8,1);L.scene.fog=null;
 // Move key light to the apron outside the ring, so skin and clothing stay lit.
 for(const o of L.scene.children)if(o.isDirectionalLight||o.isSpotLight){o.position.z+=12.8;o.target.position.z+=12.8;}
 s.pose='opening';
 if(s.loss){const clip=s.rig.clips.find(c=>c.name===s.defaults.recover[0]);if(clip){playClip(clip.name);s.rig.seek(0);s.pose='down';}else readyPose();}
 else if(!s.draw){const name=s.defaults.sweep?.[0],clip=s.rig.clips.find(c=>c.name===name);if(clip){playClip(name,{start:0,end:Math.min(2.9,clip.duration),speed:1.5});s.pose='kungfu';}else readyPose();}
 else readyPose();
}
function begin(options={}){if(state)return;const m=L.match;if(m.state!=='over'&&!options.preview)return;
 const player=L.PLAYER,opponent=L.PARTNER,win=m.winner===0,loss=m.winner===1,draw=m.winner==null;
 if(run.player!==player)run={player,beaten:[],total:0};
 state={id:++serial,phase:'fade',age:0,elapsed:0,cineT:0,prepared:false,player,opponent,win,loss,draw,preview:!!options.preview,wins:[...m.wins],hp:L.health,time:m.time,label:draw?'DRAW':win?'YOU WIN':'YOU LOSE',speaker:win?player:opponent,scoreDone:false,loading:false,speed:1};
 const s=state;s.cine=!s.draw&&!L.renderer.isFighterCanvasRenderer&&!reduce();ui.classList.remove('pf-cine');s.score=scoreFor(s);s.baseTotal=run.total;s.next=win?pickNext(player,opponent,run.beaten.concat(opponent)):opponent;
 if(!s.preview){run.total+=s.score.total;if(win&&!run.beaten.includes(opponent))run.beaten.push(opponent);}
 ui.querySelectorAll('button').forEach(b=>b.disabled=false);
 L.clearInput();window.GSFPaused=false;document.body.classList.add('post-fight-on');ui.hidden=false;ui.dataset.outcome=draw?'draw':win?'win':'lose';ui.dataset.phase='fade';
 for(const cls of ['pf-score','pf-result','pf-quote','pf-journey'])ui.querySelector('.'+cls).hidden=true;
 ui.classList.remove('pf-word-in','pf-score-in');$('pf-advance').disabled=false;$('pf-advance').textContent='SKIP INTRO ›';$('pf-advance').focus();$('pf-error').textContent='';
 $('pf-context').textContent=s.preview?'POST-FIGHT PREVIEW':'MATCH COMPLETE';$('pf-fighter-name').textContent=player.toUpperCase();$('pf-word').textContent=s.label;$('pf-word').dataset.text=s.label;
 $('pf-result-note').textContent=draw?'ANOTHER ROUND. ANOTHER CHANCE.':win?'THE VICTORY IS YOURS.':'GET UP. COME BACK STRONGER.';
 $('pf-footer-note').textContent='TAKE IN THE MOMENT';$('pf-points').textContent='0';$('pf-score-detail').textContent='';$('pf-run-total').textContent='';
 $('results').hidden=true;$('start-menu').hidden=true;const ann=$('announce');if(ann)ann.firstChild.className='';
 lastButtons=Array.from(navigator.getGamepads?.()||[]).find(Boolean)?.buttons.map(x=>x.pressed)||[];
}
function revealResult(){const s=state;if(!s)return;prepareScene();setPhase('result');ui.querySelector('.pf-result').hidden=false;ui.classList.add('pf-word-in');$('pf-advance').textContent='COUNT POINTS ›';window.GSFAudio?.[s.win?'win':'bell']?.();if(s.win)window.GSFUI?.rumble(100,.4);}
function finishScore(){const s=state;if(!s||s.scoreDone)return;s.scoreDone=true;ui.querySelector('.pf-score').hidden=false;ui.classList.add('pf-score-in');window.GSFAudio?.tallyDone?.();$('pf-points').textContent=num(s.score.total);$('pf-score-detail').textContent=`ROUNDS ${num(s.score.rounds)} · RESULT ${num(s.score.finish)}\nHEALTH ${num(s.score.health)} · TIME ${num(s.score.time)}`;$('pf-run-total').textContent=s.preview?'PREVIEW POINTS':`RUN TOTAL ${num(run.total)}`;$('pf-advance').textContent='NEXT ›';$('pf-footer-note').textContent=`${s.wins[0]} – ${s.wins[1]}  MATCH RESULT`;$('pf-live').textContent=s.label+'. '+num(s.score.total)+' points.';}
function showQuote(){const s=state;if(!s)return;if(s.draw){showJourney();return;}setPhase('quote');ui.querySelector('.pf-result').hidden=true;ui.querySelector('.pf-score').hidden=true;ui.querySelector('.pf-quote').hidden=false;diamond('pf-speaker-diamond',s.speaker);$('pf-speaker-name').textContent=s.speaker.toUpperCase();const pool=QUOTES[s.speaker]||['Keep learning. Keep coming back.'];s.quote=pool[Math.floor(Math.random()*pool.length)];{const q=$('pf-quote-text');q.textContent='“'+s.quote.replace(/^…\s*/,'')+'”';q.classList.remove('pf-quote-in');void q.offsetWidth;q.classList.add('pf-quote-in');}$('pf-advance').textContent='CONTINUE ›';$('pf-footer-note').textContent='ONE LESSON. THEN THE NEXT FIGHT.';$('pf-advance').focus();}
function showJourney(){const s=state;if(!s)return;setPhase('journey');ui.classList.remove('pf-cine');ui.querySelector('.pf-result').hidden=true;ui.querySelector('.pf-score').hidden=true;ui.querySelector('.pf-quote').hidden=true;ui.querySelector('.pf-journey').hidden=false;
 diamond('pf-player-diamond',s.player);diamond('pf-rival-diamond',s.next);$('pf-player-label').textContent=s.player.toUpperCase();$('pf-rival-label').textContent=s.next.toUpperCase();$('pf-route-label').textContent=s.win?'THE JOURNEY CONTINUES':'THE JOURNEY IS STILL YOURS';$('pf-journey-title').textContent=s.win?'Next challenger':s.draw?'Settle the score':'Ready for another round?';$('pf-rival-role').textContent=s.win?'UP NEXT':'REMATCH';$('pf-journey-note').textContent=s.win?'Your fighter. A new challenge.':s.draw?'Same matchup. A fresh start.':'Stand back up. Try again.';$('pf-fight').innerHTML=(s.win?'NEXT FIGHT':'RETRY FIGHT')+' <b>›</b>';$('pf-fight').disabled=false;$('pf-fight').focus();}
function advance(){const s=state;if(!s||s.loading)return;window.GSFAudio?.ui?.();if(s.phase==='cine'){if(s.age<CINE.skipAfter)return;s.cineT=Math.max(s.cineT,5.6);revealResult();return;}if(s.phase==='fade'||s.phase==='showcase'){revealResult();return;}if(s.phase==='result'){if(!s.scoreDone){s.age=Math.max(s.age,3.7);finishScore();return;}if(s.loss&&s.pose!=='ready'){s.wantQuote=true;$('pf-advance').disabled=true;$('pf-advance').textContent='GETTING BACK UP…';return;}showQuote();}else if(s.phase==='quote')showJourney();}
function restoreScene(){const s=state;if(!s?.prepared)return;for(const {o,pos,rotation,scale,visible} of s.objects){o.position.copy(pos);o.rotation.copy(rotation);o.scale.copy(scale);o.visible=visible;}
 // Light targets are separate scene nodes and must be restored too.
 for(const {target,pos} of s.targets||[])target.position.copy(pos);
 L.scene.fog=s.fog;s.rig.setLift(0);s.rig.root.position.copy(s.originalPosition);L.scenery.setViewAspect(innerWidth/Math.max(1,innerHeight));}
function close(){if(!state)return;ui.classList.remove('pf-cine');restoreScene();state=null;serial++;ui.hidden=true;document.body.classList.remove('post-fight-on');L.renderer.setViewport?.(0,0,innerWidth,innerHeight);}
async function launch(){const s=state;if(!s||s.loading)return;s.loading=true;const token=s.id;ui.querySelectorAll('button').forEach(b=>b.disabled=true);$('pf-error').textContent='';$('pf-fight').textContent='LOADING FIGHTERS…';
 try{const rigs=await Promise.all([s.player,s.next].map(id=>L.ensureRig(id)));await Promise.all(rigs.map(rig=>rig.ready));if(!state||state.id!==token)return;
  const ids=[s.player,s.next];close();const u=new URL(location.href);u.searchParams.delete('postfight');u.searchParams.set('p1',ids[0]);u.searchParams.set('p2',ids[1]);try{history.replaceState(null,'',u);}catch{}L.configureMatchup(...ids);L.startMatch();
 }catch(e){if(!state||state.id!==token)return;s.loading=false;ui.querySelectorAll('button').forEach(b=>b.disabled=false);$('pf-fight').textContent='TRY AGAIN';$('pf-error').textContent='That fighter could not load. Try again or choose Fighter Select.';console.error('Post-fight launch:',e);}
}
ui.addEventListener('click',e=>{const action=e.target.closest('[data-pf]')?.dataset.pf;if(!action||!state||state.loading)return;if(action==='advance')advance();else if(action==='fight')launch();else{const ids=[state.player,state.opponent];close();L.endMatch();if(action==='select'){run={player:null,beaten:[],total:0};L.selection.open(ids);}else{run={player:null,beaten:[],total:0};L.openTitle();}}});
function buttons(){return [...ui.querySelectorAll('button')].filter(b=>!b.disabled&&!b.closest('[hidden]')&&(state?.phase==='journey'?b.dataset.pf!=='advance':b.dataset.pf==='advance'));}
function moveFocus(dir){const items=buttons(),i=items.indexOf(document.activeElement);items[(i+dir+items.length)%items.length]?.focus();}
addEventListener('keydown',e=>{if(!state)return;const handled=['Tab','Enter',' ','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key);if(!handled){e.stopImmediatePropagation();return;}e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(e.key==='Tab')moveFocus(e.shiftKey?-1:1);else if(e.key.startsWith('Arrow'))moveFocus(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1);else if(e.key==='Escape'){if(state.phase!=='journey')advance();}else if(document.activeElement?.closest('#post-fight'))document.activeElement.click();else buttons()[0]?.click();},true);
function padTick(dt){const p=Array.from(navigator.getGamepads?.()||[]).find(p=>p&&p.connected);if(!p){lastButtons=[];return;}const b=i=>!!p.buttons[i]?.pressed;navCooldown-=dt;const direction=b(13)||(p.axes[1]||0)>.6||b(15)?1:b(12)||(p.axes[1]||0)<-.6||b(14)?-1:0;if(direction&&navCooldown<=0){moveFocus(direction);navCooldown=.23;}if(!direction)navCooldown=0;if((b(0)&&!lastButtons[0])||(b(9)&&!lastButtons[9])){if(document.activeElement?.closest('#post-fight'))document.activeElement.click();else buttons()[0]?.click();}lastButtons=p.buttons.map(x=>x.pressed);}
function render(dt){const s=state;if(!s?.prepared){L.renderer.render(L.scene,L.camera);return;}
 const w=$('stage').clientWidth,h=Math.max(1,$('stage').clientHeight),aspect=w/h,portrait=aspect<1.05;
 if(L.renderer.domElement.width!==Math.round(w*(L.renderer.getPixelRatio?.()||1))||s.width!==w||s.height!==h){L.renderer.setSize(w,h);s.width=w;s.height=h;}
 if(s.cine&&s.cineW){cineCamera(s,aspect);L.courtyard.userData.updateForeground(camera,s.cineW.x,{groundExtent:200,depthOffset:0});s.rig.update(dt,s.speed);L.scenery.update(dt);L.renderer.render(L.scene,camera);return;}
 // True perspective: close foreground fighter, receding arena, sharp painted scenery.
 L.scenery.backdrop.scale.set(portrait?1:2.8,portrait?1.4:1.8,1);
 const u=reduce()?1:Math.min(1,s.elapsed/2.5),ease=1-Math.pow(1-u,3),dist=portrait?7.1:5.5;
 camera.aspect=aspect;camera.fov=portrait?32:32;focus.set(portrait?0:.88,portrait?1.25:1.0,12.8);
 camera.position.set((1-ease)*.8+.12,focus.y+.18+(1-ease)*1.35,12.8+dist+(1-ease)*.8);camera.lookAt(focus);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 L.courtyard.userData.updateForeground(camera,0,{groundExtent:200,depthOffset:0});L.scene.fog=null;
 if(s.pose==='kungfu'&&!s.rig.playing)readyPose();
 if(s.loss&&s.phase==='result'&&s.age>1.25&&s.pose==='down'){playClip(s.defaults.recover[0],{speed:1.5});s.pose='recover';}
 if(s.pose==='recover'&&!s.rig.playing){readyPose();if(s.wantQuote){$('pf-advance').disabled=false;showQuote();}}s.rig.update(dt,s.speed);L.scenery.update(dt);
 if(L.renderer.isFighterCanvasRenderer){
  // The compatibility rasterizer cannot texture panoramic panels or clip the
  // enormous floor like WebGL. Keep the same animated rig over sharp artwork.
  const visibility=L.scene.children.map(o=>[o,o.visible]);for(const o of L.scene.children)if(o!==L.playerGroup)o.visible=false;
  try{L.renderer.render(L.scene,camera,true);}finally{for(const[o,v]of visibility)o.visible=v;}
  const c=L.renderer.ctx,W=L.renderer.domElement.width,H=L.renderer.domElement.height,bottom=H*(portrait?.54:.68);c.save();c.globalCompositeOperation='destination-over';
  focus.set(0,0,12.8).project(camera);c.fillStyle='#02081155';c.beginPath();c.ellipse((focus.x*.5+.5)*W,(-focus.y*.5+.5)*H,W*(portrait?.15:.07),H*.015,0,0,Math.PI*2);c.fill();
  if(fallbackArt?.river){const im=fallbackArt.river,sy=im.height*.45,sh=im.height-sy,dh=W*sh/im.width;c.drawImage(im,0,sy,im.width,sh,0,bottom-dh,W,dh);}
  if(fallbackArt?.stone){const pattern=c.createPattern(fallbackArt.stone,'repeat');c.fillStyle=pattern||'#778078';}else c.fillStyle='#778078';c.fillRect(0,bottom,W,H-bottom);
  c.fillStyle='#1689ef';c.fillRect(0,0,W,H);c.restore();
 }else L.renderer.render(L.scene,camera);
}
function tick(dt){if(!state)return;dt=document.hidden?0:Math.min(.1,Math.max(0,dt));const s=state;s.age+=dt;s.elapsed+=dt;if(s.prepared&&s.cine)s.cineT+=dt;padTick(dt);if(!state||state!==s)return;
 if(s.phase==='fade'&&s.cine&&s.age>.25){prepareScene();setPhase('cine');$('pf-advance').disabled=true;$('pf-advance').textContent='SKIP ›';}
 else if(s.phase==='fade'&&!s.cine&&s.age>(reduce()?.08:.4)){prepareScene();setPhase('showcase');}
 else if(s.phase==='cine'){if(s.age>CINE.skipAfter)$('pf-advance').disabled=false;if(s.cineT>=CINE.length)revealResult();}
 else if(s.phase==='showcase'&&s.age>(reduce()?.25:1.85))revealResult();
 else if(s.phase==='result'){
  if(s.age>1.25){ui.querySelector('.pf-score').hidden=false;ui.classList.add('pf-score-in');const t=reduce()?1:Math.min(1,(s.age-1.25)/1.75);$('pf-points').textContent=num(s.score.total*(1-Math.pow(1-t,3)));if(!s.scoreDone&&s.age-(s.lastTick||0)>.11){s.lastTick=s.age;window.GSFAudio?.tally?.();}if(t>=1)finishScore();}
 }
 render(dt);
}
window.GSFPostFight={begin,close,tick,advance,get active(){return!!state;},get state(){return state;},scoreFor,pickNext,quotes:QUOTES,camera};
})();
