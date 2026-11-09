/* Android 1.0.2: quiet opening, arcade results and return-to-title flow. */
(()=>{'use strict';
if(!window.GSAndroid||!window.GSSelectionEngine)return;
const root=document.documentElement,engine=window.GSSelectionEngine,$=id=>document.getElementById(id),boot=$('gs-boot');
let opening=true,stage='black',elapsed=0,last=null,lossLeft=null,countdown=null;
const counter=document.createElement('p');counter.className='gs-return-countdown';counter.hidden=true;counter.setAttribute('role','status');$('result').append(counter);
function clearCountdown(){lossLeft=null;counter.hidden=true;if(countdown){clearInterval(countdown);countdown=null;}}
function title(initial=false){clearCountdown();opening=true;stage='black';elapsed=0;last=null;boot.className='';boot.querySelector('p').textContent='';root.classList.add('gs-boot');engine.lobby();window.GSAndroidSelect.reset();window.Jerm747Controls?.release();if(!initial){stage='logo';boot.classList.add('gs-logo');}}
function reveal(){window.GSSound?.play('navigate');opening=false;stage='done';root.classList.remove('gs-boot');boot.hidden=true;window.GSAndroidSelect.reset();$('fighters')?.scrollIntoView({block:'nearest'});document.querySelector('.gs-confirm-blue')?.focus({preventScroll:true});}
function tick(now){if(!opening){last=null;requestAnimationFrame(tick);return;}boot.hidden=false;if(document.hidden){last=null;requestAnimationFrame(tick);return;}if(last!==null)elapsed+=Math.min(.1,(now-last)/1000);last=now;
if(stage==='black'&&elapsed>=3){stage='logo';elapsed=0;boot.classList.add('gs-logo');}
if(stage==='logo'&&elapsed>=2.6){const image=boot.querySelector('img');if(engine.state().assetReady===engine.state().artTotal&&image.complete&&image.naturalWidth>0)reveal();else if(elapsed>=20){boot.classList.add('gs-boot-error');boot.querySelector('p').textContent='Unable to load artwork. Please retry.';}}
requestAnimationFrame(tick);}
function scoreText(s){return s.score.toLocaleString()+' POINTS';}
function label(s){if(s.outcome==='draw')return 'DRAW';if(s.human.every(Boolean))return s.outcome==='win'?'PLAYER 1 WINS':'PLAYER 2 WINS';return s.outcome==='win'?'YOU WON':'YOU LOST';}
function round(){clearCountdown();const s=engine.state();$('round-title').textContent=label(s);$('round-title').dataset.outcome=s.outcome;$('round-stat').textContent=scoreText(s);$('next-round').textContent='Finish round';}
function result(){clearCountdown();const s=engine.state();$('result-title').textContent=label(s);$('result-title').dataset.outcome=s.outcome;$('result-copy').textContent=s.wins+' – '+s.losses+' · MATCH FINISHED';$('result-stat').textContent=scoreText(s);$('again').textContent='Play again';$('result-choose').textContent='Finish round';$('return').textContent='Title screen';
if(s.outcome==='loss'){lossLeft=10;counter.hidden=false;const paint=()=>{counter.innerHTML='TITLE SCREEN IN <strong>'+Math.max(0,Math.ceil(lossLeft))+'</strong>';};paint();let previous=performance.now();countdown=setInterval(()=>{const now=performance.now(),dt=(now-previous)/1000;previous=now;if(engine.state().screen!=='result'){clearCountdown();return;}if(document.hidden)return;lossLeft-=Math.min(.25,dt);paint();if(lossLeft<=0)title();},100);}}
$('result-choose').onclick=()=>title();$('return').onclick=()=>title();
// Initial boot blocks all input, including mapped buttons, until the reveal.
document.addEventListener('keydown',e=>{if(opening){e.preventDefault();e.stopImmediatePropagation();}},true);
window.GSArcadePresentation={blocked:()=>opening,title,round,result,state:()=>({opening,stage,lossLeft})};
title(true);requestAnimationFrame(tick);
})();
