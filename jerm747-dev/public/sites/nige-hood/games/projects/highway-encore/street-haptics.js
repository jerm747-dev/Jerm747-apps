/* Small, optional feedback. Unsupported devices simply stay silent. */
(() => {
 'use strict';
 let enabled=true;
 try{enabled=localStorage.getItem('encore-haptics')!=='off'}catch{}
 const patterns={fire:12,lootBreak:[24,18,36],poundImpact:36};
 function pulse(kind){
  if(!enabled||!patterns[kind])return;
  try{navigator.vibrate?.(patterns[kind])}catch{}
  try{
   for(const pad of navigator.getGamepads?.()||[]){
    if(!pad?.connected)continue;
    const actuator=pad.vibrationActuator;
    if(actuator?.playEffect){
     Promise.resolve(actuator.playEffect('dual-rumble',{startDelay:0,duration:kind==='fire'?25:90,weakMagnitude:kind==='fire'?.16:.28,strongMagnitude:kind==='fire'?0:.16})).catch(()=>{});
    }else if(pad.hapticActuators?.[0]?.pulse){Promise.resolve(pad.hapticActuators[0].pulse(kind==='fire'?.15:.3,kind==='fire'?25:90)).catch(()=>{})}
   }
  }catch{}
 }
 function stop(){try{navigator.vibrate?.(0)}catch{}try{for(const p of navigator.getGamepads?.()||[])Promise.resolve(p?.vibrationActuator?.reset?.()).catch(()=>{})}catch{}}
 function setEnabled(value){enabled=!!value;try{localStorage.setItem('encore-haptics',enabled?'on':'off')}catch{}if(!enabled)stop()}
 globalThis.EncoreHaptics={pulse,stop,setEnabled,get enabled(){return enabled}};
})();
