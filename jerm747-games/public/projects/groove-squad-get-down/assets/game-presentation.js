/* v129 · Mirror the live game, including meters, without any on-screen controls. */
(()=>{'use strict';
const root=document.documentElement,api=window.Jerm747GameControls;
if(!api||!document.querySelector('.stage'))return;
let on=false,ownedFullscreen=false,wake=null,previousFocus=null,fullscreenEpoch=0;
const touches=new Set(),buttons=[];
const active=()=>on;
function notify(){if(parent!==window)parent.postMessage({type:'jerm747-presentation-view',on},location.origin);window.dispatchEvent(new CustomEvent('jerm747-presentation-change',{detail:{on}}));}
function paint(){for(const b of buttons)b.hidden=!on;}
function stopInput(){window.Jerm747Controls?.release?.();api.reset?.();api.pad?.({});api.pad2?.({});}
function releaseWake(){const old=wake;wake=null;try{old?.release?.()?.catch?.(()=>{});}catch{}}
async function keepAwake(){if(!on||document.hidden||wake||!navigator.wakeLock?.request)return;try{const lock=await navigator.wakeLock.request('screen');if(!on||document.hidden){lock.release()?.catch?.(()=>{});return;}wake=lock;lock.addEventListener?.('release',()=>{if(wake===lock)wake=null;});}catch{/* Normal when unavailable or denied. */}}
function exit(){if(!on)return;on=false;fullscreenEpoch++;root.classList.remove('game-presentation');stopInput();touches.clear();releaseWake();paint();notify();
 if(ownedFullscreen&&(document.fullscreenElement===root||document.webkitFullscreenElement===root)){try{const result=(document.exitFullscreen||document.webkitExitFullscreen)?.call(document);result?.catch?.(()=>{});}catch{}}
 ownedFullscreen=false;window.dispatchEvent(new Event('resize'));if(previousFocus?.isConnected)previousFocus.focus();else document.getElementById('arena')?.focus();}
function enter(){if(on)return;previousFocus=document.activeElement;stopInput();on=true;root.classList.add('game-presentation');paint();notify();keepAwake();window.dispatchEvent(new Event('resize'));
 // Must run directly from the click. Unsupported fullscreen still fills the available game window.
 const epoch=++fullscreenEpoch,req=root.requestFullscreen||root.webkitRequestFullscreen;
 if(req&&!document.fullscreenElement&&!document.webkitFullscreenElement){try{ownedFullscreen=true;const result=req.call(root);Promise.resolve(result).then(()=>{if(!on||epoch!==fullscreenEpoch){if(document.fullscreenElement===root||document.webkitFullscreenElement===root)(document.exitFullscreen||document.webkitExitFullscreen)?.call(document)?.catch?.(()=>{});}}).catch(()=>{if(epoch===fullscreenEpoch)ownedFullscreen=false;});}catch{ownedFullscreen=false;}}
 document.getElementById('arena')?.focus();}
// Balanced backing-store limit: at most 2560 × 1440 (or its portrait equivalent), never above 2× device pixels.
function pixelRatio(width,height,dpr=window.devicePixelRatio||1){if(!on)return Math.min(dpr,2);if(!(width>0&&height>0))return 1;return Math.min(dpr,2,2560/Math.max(width,height),1440/Math.min(width,height),Math.sqrt(3686400/(width*height)));}
function addExit(container){if(!container)return;const b=document.createElement('button');b.type='button';b.textContent='Exit TV presentation';b.className='presentation-exit';b.hidden=true;b.onclick=exit;container.appendChild(b);buttons.push(b);}
addExit(document.querySelector('#pause-screen .row')||document.getElementById('pause-screen'));
addExit(document.getElementById('lobby'));addExit(document.getElementById('result'));
addExit(document.querySelector('#round-screen .row')||document.getElementById('round-screen'));
document.addEventListener('keydown',e=>{if(on&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();exit();}},true);
function fullscreenChanged(){if(on&&ownedFullscreen&&!document.fullscreenElement&&!document.webkitFullscreenElement)exit();}
document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('webkitfullscreenchange',fullscreenChanged);
// Two fingers open the normal pause menu; no permanent exit/control button is shown over the fight.
document.addEventListener('pointerdown',e=>{if(!on||e.pointerType!=='touch')return;touches.add(e.pointerId);if(touches.size===2){const c=api.context();if(c.screen==='fight'&&!c.paused&&c.canPause!==false){e.preventDefault();stopInput();api.pause();}}},{capture:true,passive:false});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>touches.delete(e.pointerId),true);
document.addEventListener('visibilitychange',()=>{touches.clear();if(document.hidden)releaseWake();else keepAwake();});
window.addEventListener('pagehide',exit);
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='jerm747-presentation-exit')exit();});
window.Jerm747Presentation={active,enter,exit,pixelRatio};
})();
