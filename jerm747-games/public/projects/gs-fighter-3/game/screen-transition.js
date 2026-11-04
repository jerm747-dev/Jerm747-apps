/* GS Fighter — one opaque curtain shared by every screen handoff. */
(function(){
'use strict';
const script=document.currentScript,base=new URL('.',script.src);
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration=()=>reduced()?0:260;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const painted=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const root=document.createElement('section');
root.id='gsf-loading';root.setAttribute('role','status');root.setAttribute('aria-live','polite');root.setAttribute('aria-label','Loading GS Fighter');
root.innerHTML='<div class="gsf-loading-mark"><img alt="GS Fighter" width="176" height="112"><div class="gsf-loading-status"><span class="gsf-loading-ring" aria-hidden="true"></span><span class="gsf-loading-label">LOADING</span></div></div>';
root.querySelector('img').src=new URL('loading-logo.png',base);
document.body.prepend(root);
let busy=true,leaving=false,shownAt=performance.now(),epoch=0;
const style=document.createElement('style');style.textContent=`
#gsf-loading{position:fixed;inset:0;z-index:2147483647;background:#000;opacity:1;display:block;pointer-events:auto;transition:opacity 260ms ease;isolation:isolate;color:#ddd;touch-action:none}
#gsf-loading[hidden]{display:none!important}
#gsf-loading.is-clear{opacity:0}
#gsf-loading .gsf-loading-mark{position:absolute;right:max(28px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:9px;width:132px;max-width:30vw}
#gsf-loading img{display:block;width:100%;height:auto;max-height:116px;object-fit:contain}
#gsf-loading .gsf-loading-status{display:flex;align-items:center;justify-content:center;gap:9px;min-height:16px}
#gsf-loading .gsf-loading-label{font:500 9px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.26em;color:#90969b}
#gsf-loading .gsf-loading-ring{box-sizing:border-box;display:block;width:14px;height:14px;border:1.5px solid #292e32;border-top-color:#dce1e3;border-right-color:#75818a;border-radius:50%;animation:gsf-load-spin .9s linear infinite}
html.gsf-transitioning body{cursor:wait}
html.gsf-transitioning body>*:not(#gsf-loading){pointer-events:none!important}
@keyframes gsf-load-spin{to{transform:rotate(360deg)}}
@media(max-height:450px){#gsf-loading .gsf-loading-mark{width:110px;gap:8px}}
@media(prefers-reduced-motion:reduce){#gsf-loading{transition:none}#gsf-loading .gsf-loading-ring{animation:none}}
`;document.head.append(style);
function lock(){document.documentElement.classList.add('gsf-transitioning');window.FighterLab?.clearInput();window.GSFGameShell?.releasePad();document.activeElement?.blur?.();}
function unlock(){document.documentElement.classList.remove('gsf-transitioning','gsf-boot');window.GSFGameShell?.releasePad();}
async function show({instant=false}={}){
 const token=++epoch;
 if(!busy){lock();busy=true;root.hidden=false;root.classList.add('is-clear');void root.offsetWidth;}
 shownAt=performance.now();root.style.transitionDuration=instant?'0ms':duration()+'ms';root.classList.remove('is-clear');
 await delay(instant?0:duration());await painted();return token;
}
async function hide({instant=false}={}){
 const token=++epoch;
 await delay(reduced()?0:1000);await painted();
 if(token!==epoch||leaving)return;
 // Release the boot-only visibility guard while the curtain is still opaque.
 document.documentElement.classList.remove('gsf-boot');
 root.style.transitionDuration=instant?'0ms':duration()+'ms';root.classList.add('is-clear');await delay(instant?0:duration());
 if(token!==epoch||leaving)return;root.hidden=true;busy=false;unlock();
}
async function navigate(url,{before}={}){
 if(leaving)return;leaving=true;await show();before?.();location.assign(url);
}
async function run(change){if(busy)return;await show();try{await change();await ready();}catch(error){fail(error);}}
function fail(error){leaving=false;++epoch;root.hidden=false;root.classList.remove('is-clear');root.querySelector('.gsf-loading-label').textContent='UNABLE TO LOAD · RELOAD TO RETRY';root.querySelector('.gsf-loading-ring').style.animation='none';console.error('GS Fighter screen loading:',error);}
function imageReady(img){if(img.complete)return img.naturalWidth?img.decode?.().catch(()=>{}):Promise.resolve();return new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});}
async function assets(){await Promise.all([...document.images].map(imageReady));if(document.fonts)await document.fonts.ready;}
// Element load events never reach window listeners, so listen on document (capture).
(document.addEventListener?document:window).addEventListener('load',event=>{if(event.target.id==='intro')event.target.dataset.loaded=event.target.src;},true);
function frameDone(frame){try{const d=frame.contentDocument;return !!d&&d.readyState==='complete'&&d.URL===frame.src;}catch(e){return false;}}
async function ready(){
 try{await assets();const frame=document.getElementById('intro');
 if(frame&&window.FighterLab?.titleOpen&&!window.GSFPlayerMenu?.isOpen&&frame.src&&frame.dataset.loaded!==frame.src&&!frameDone(frame))await new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
 await hide();}catch(error){fail(error);}
}
// Capture before game handlers: loading has no actionable controls.
for(const name of ['keydown','keyup','pointerdown','pointerup','click','wheel'])addEventListener(name,event=>{if(busy){event.preventDefault();event.stopImmediatePropagation();}},{capture:true,passive:false});
window.GSFLoading={show,hide,navigate,run,ready,assets,fail,get busy(){return busy;}};
lock();
addEventListener('DOMContentLoaded',()=>{if(new URLSearchParams(location.search).get('crest')!=='1'&&!document.documentElement.hasAttribute('data-loading-preview'))ready();},{once:true});
addEventListener('pageshow',event=>{if(event.persisted){leaving=false;show({instant:true}).then(ready);}});
})();
