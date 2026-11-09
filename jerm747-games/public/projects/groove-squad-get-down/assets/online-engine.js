/* v137: deterministic online round lifecycle, shared by the shipped game and simulation tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Jerm747OnlineEngine=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
function create(E,{host,guest,seed},environment={}){
 const saved=[environment.__gdPool,environment.__gdRanked,environment.JERM747_ROUND_SCALE];
 environment.__gdPool=null;environment.__gdRanked=false;environment.JERM747_ROUND_SCALE=1;
 const run=E.createArcadeRun(host,'easy',seed,{opponent:guest,local:true,human1:true,human2:true});run.slotMatch=true;run.battle.timeLeft=60;run.battle.readyTime=0;run.battle.fightBanner=1;
 let wait=0;
 return {run,
  step(one,two){if(run.mode==='complete')return;if(run.mode==='round-over'){if(++wait>=120){E.arcadeAdvance(run);wait=0;if(run.mode!=='complete'){run.battle.timeLeft=60;run.battle.readyTime=0;run.battle.fightBanner=1;}}}else E.arcadeStep(run,{...one,player2:{...two}},1/60);},
  hash(){const copy=JSON.parse(JSON.stringify({run,wait},(k,v)=>k==='renderTrail'||k==='seats'||k==='selectedLooks'?undefined:v));return E.arcadeSyncHash(copy);},
  done:()=>run.mode==='complete',
  dispose(){[environment.__gdPool,environment.__gdRanked,environment.JERM747_ROUND_SCALE]=saved;}
 };
}
return {create};});
