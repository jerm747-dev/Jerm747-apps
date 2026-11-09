/* Android-only integration; the portable browser ZIP is not changed. */
(()=>{'use strict';
if(!window.GSAndroid)return;
document.documentElement.classList.add('gs-android');document.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('selectstart',e=>{if(!e.target.closest?.('input,textarea,[contenteditable=true]'))e.preventDefault();});document.addEventListener('dragstart',e=>e.preventDefault());
if(!window.structuredClone)window.structuredClone=value=>JSON.parse(JSON.stringify(value));
const originalGet=navigator.getGamepads?.bind(navigator);let pads=[],autoAssigned=false;
const pulse=ms=>{try{GSAndroid.vibrate(Math.max(0,Math.min(150,ms|0)))}catch{}};
window.GSAndroidPads={update(values){const previous=pads;pads=values.slice().sort((a,b)=>a.index-b.index).map(p=>({...p,vibrationActuator:{type:'dual-rumble',playEffect:async(type,parameters)=>{pulse(parameters?.duration||12);return'complete'},reset:async()=>{pulse(0);return'complete'}},hapticActuators:[{pulse:async(value,duration)=>{pulse(duration);return true}}]}));
for(const p of previous)if(!pads.some(v=>v.index===p.index&&v.id===p.id)){const e=new Event('gamepaddisconnected');Object.defineProperty(e,'gamepad',{value:p});window.dispatchEvent(e);}
for(const p of pads)if(!previous.some(v=>v.index===p.index&&v.id===p.id)){const e=new Event('gamepadconnected');Object.defineProperty(e,'gamepad',{value:p});window.dispatchEvent(e);}
const setup=window.Jerm747PlayerSetup,state=setup?.getState();if(!autoAssigned&&state&&pads.length){autoAssigned=true;if(state.human[0]&&!state.padBindings[0])setup.assignPad(pads[0].index,0);}if(pads.some(p=>p.buttons.some(b=>b.pressed))){window.GSSound?.unlock();}}
};
try{Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{if(!pads.length)return originalGet?.()||[];const out=[null,null,null,null];for(const p of pads)out[p.index]=p;return out;}});}catch{}
try{Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{pulse(Array.isArray(pattern)?pattern[0]:pattern);return true;}});}catch{}
const blobs=new Map(),makeURL=URL.createObjectURL.bind(URL),revokeURL=URL.revokeObjectURL.bind(URL);
URL.createObjectURL=blob=>{const url=makeURL(blob);blobs.set(url,blob);return url;};
URL.revokeObjectURL=url=>{blobs.delete(url);revokeURL(url);};
let exporting=false;
async function save(blob,name){if(exporting){alert('Finish the current save first.');return;}exporting=true;let token='';try{token=GSAndroid.beginExport(name,blob.type||'application/octet-stream');if(!token)throw Error('Finish the current save first.');for(let offset=0;offset<blob.size;offset+=196608){const bytes=new Uint8Array(await blob.slice(offset,offset+196608).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));if(!GSAndroid.appendExport(token,btoa(binary)))throw Error('The export is too large or could not be written.');}GSAndroid.finishExport(token);}catch(e){if(token)GSAndroid.cancelExport(token);alert(e.message||'Export failed.');}finally{exporting=false;}}
const click=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download&&blobs.has(this.href)){save(blobs.get(this.href),this.download);return;}return click.call(this);};
document.addEventListener('click',e=>{const a=e.target.closest?.('a');if(!a)return;if(a.download&&blobs.has(a.href)){e.preventDefault();save(blobs.get(a.href),a.download);return;}if(a.target==='_blank'){const u=new URL(a.href,location.href);e.preventDefault();if(u.origin===location.origin)location.href=u.href;}},true);
let pausedByAndroid=false,runnerPausedByAndroid=false,workshopPaused=false;
window.GSAndroidLifecycle={pause(){const api=window.Jerm747GameControls,c=api?.context();if(c?.screen==='fight'&&!c.paused&&c.canPause){api.pause();pausedByAndroid=true;}api?.reset();api?.pad?.({});api?.pad2?.({});const runner=window.GSRunner?.state();if(runner&&!runner.paused){document.getElementById('pause')?.click();runnerPausedByAndroid=true;}const play=document.getElementById('play');if(play?.textContent.includes('Pause')){play.click();workshopPaused=true;}window.GSSound?.suspend?.();},resume(){const api=window.Jerm747GameControls,c=api?.context();if(pausedByAndroid&&c?.paused)api.pause();pausedByAndroid=false;if(runnerPausedByAndroid&&window.GSRunner?.state().paused)document.getElementById('pause')?.click();runnerPausedByAndroid=false;if(workshopPaused)document.getElementById('play')?.click();workshopPaused=false;window.GSSound?.unlock();}};
document.addEventListener('DOMContentLoaded',()=>{const menu=document.createElement('button');menu.type='button';menu.textContent='GS MENU';menu.setAttribute('aria-label','Android game menu');menu.className='gs-native-menu';menu.onclick=()=>GSAndroid.menu();const target=document.querySelector('.gs-tools')||document.querySelector('header');target?.append(menu);GSAndroid.requestPads();});
})();
