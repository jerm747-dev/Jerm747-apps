/* Small, optional feedback. Unsupported devices simply stay silent. */
(() => {
 'use strict';
 let enabled=true;
 try{enabled=localStorage.getItem('encore-haptics')!=='off'}catch{}
 const patterns={confirm:14,fire:12,lootBreak:[24,18,36],poundImpact:36};
 const cdPulses={
  cdLift:{ms:14,amplitude:45},cdThrow:{ms:25,amplitude:58},cdDisc:{ms:24,amplitude:55},
  cdCheckpoint:{ms:34,amplitude:65},cdFinish:{ms:65,amplitude:95}
 };
 function pulse(kind){
  const cue=cdPulses[kind];
  const pattern=cue?.ms || patterns[kind];
  if(!enabled||!pattern)return;
  if(globalThis.EncoreAndroid?.vibrate){
   try{
    if(cue && globalThis.EncoreAndroid.rumble)globalThis.EncoreAndroid.rumble(cue.ms,cue.amplitude);
    else globalThis.EncoreAndroid.vibrate(kind==='lootBreak'?42:pattern);
   }catch{}
   return;
  }
  try{navigator.vibrate?.(pattern)}catch{}
  const duration=cue?cue.ms:kind==='fire'?25:90;
  const weak=cue?cue.amplitude/255:kind==='fire'?.16:.28;
  const strong=cue?weak*.48:kind==='fire'?0:.16;
  try{
   for(const pad of navigator.getGamepads?.()||[]){
    if(!pad?.connected)continue;
    const actuator=pad.vibrationActuator;
    if(actuator?.playEffect){
     Promise.resolve(actuator.playEffect('dual-rumble',{startDelay:0,duration,weakMagnitude:weak,strongMagnitude:strong})).catch(()=>{});
    }else if(pad.hapticActuators?.[0]?.pulse){Promise.resolve(pad.hapticActuators[0].pulse(weak,duration)).catch(()=>{})}
   }
  }catch{}
 }
 function stop(){try{globalThis.EncoreAndroid?.vibrate(0)}catch{}try{navigator.vibrate?.(0)}catch{}try{for(const p of navigator.getGamepads?.()||[])Promise.resolve(p?.vibrationActuator?.reset?.()).catch(()=>{})}catch{}}
 function setEnabled(value){enabled=!!value;try{localStorage.setItem('encore-haptics',enabled?'on':'off')}catch{}if(!enabled)stop()}
 globalThis.EncoreHaptics={pulse,stop,setEnabled,get enabled(){return enabled}};
})();
