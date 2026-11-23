const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'..','street-haptics.js'),'utf8');
function run(navigator={},stored=null){const values=[];const c=vm.createContext({navigator,localStorage:{getItem:()=>stored,setItem:(k,v)=>values.push(v)}});vm.runInContext(source,c);return {h:c.EncoreHaptics,values}}
(async()=>{
 const pulses=[],effects=[],resets=[];
 const {h,values}=run({vibrate:p=>pulses.push(p),getGamepads:()=>[null,{connected:true,vibrationActuator:{playEffect:(type,options)=>{effects.push({type,options});return Promise.resolve()},reset:()=>resets.push(1)}}]});
 h.pulse('fire');h.pulse('lootBreak');assert.equal(pulses[0],12);assert.deepEqual(Array.from(pulses[1]),[24,18,36]);assert.equal(effects.length,2);assert.ok(effects[0].options.duration<effects[1].options.duration);assert.equal(effects[1].type,'dual-rumble');
 h.setEnabled(false);const count=pulses.length;h.pulse('fire');assert.equal(pulses.length,count);assert.equal(values.at(-1),'off');assert.ok(resets.length);assert.equal(run({},'off').h.enabled,false);
 const unsupported=run().h;unsupported.pulse('fire');unsupported.stop();
 const denied=run({vibrate:()=>{throw Error('unsupported')},getGamepads:()=>{throw Error('policy')}}).h;denied.pulse('lootBreak');denied.stop();
 run({getGamepads:()=>[{connected:true,vibrationActuator:{playEffect:()=>Promise.reject(Error('not allowed'))}}]}).h.pulse('fire');await Promise.resolve();
 console.log('PASS haptic patterns, intensity, opt-out, saved preference, unsupported APIs and rejected controller effects');
})().catch(e=>{console.error(e);process.exitCode=1});
