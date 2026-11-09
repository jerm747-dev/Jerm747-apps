/* Keep the site's existing music player alive while browsing the showcase. v88: steps aside for the in-game music panel (GameMusicPanel.jsx). */
(()=>{'use strict';
if(window.Jerm747ShowcaseBridgeReady)return;window.Jerm747ShowcaseBridgeReady=true;
const path='/groove-squad/showcase/';
const gamePaths=new Set(['/groove-squad-arcade.html','/groove-squad-get-down.html','/catalog-clash-level10.html']);
if(location.pathname.startsWith(path)){
 if(parent===window)return;
 document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||(a.target&&a.target!=='_self'))return;const u=new URL(a.href,location.href);if(u.origin!==location.origin)return;if(gamePaths.has(u.pathname)){e.preventDefault();parent.postMessage({type:'jerm747-showcase-game',url:u.href},location.origin);}else if(['/','/index.html','/groove-squad','/groove-squad/'].includes(u.pathname)){e.preventDefault();parent.postMessage({type:'jerm747-showcase-close'},location.origin);}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage({type:'jerm747-showcase-close'},location.origin);});return;
}
let panel=null,frame=null,focusBefore=null,overflowBefore='',observer=null,resizeObserver=null,player=null,hasMusic=false;
const style=document.createElement('style');style.textContent=`
.j747-showcase-panel{position:fixed;inset:0 0 var(--showcase-player-gap,0px);z-index:100000;background:#0e0f13;display:flex;flex-direction:column;color:#fff}
.j747-showcase-panel>header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;padding-top:max(10px,env(safe-area-inset-top));border-bottom:1px solid #363347;background:#171920}
.j747-showcase-panel>header button{font:inherit;background:#2a273a;border:1px solid #655679;border-radius:8px;color:#fff;padding:9px 14px;cursor:pointer}
.j747-showcase-panel>iframe{border:0;width:100%;flex:1;min-height:0;background:#0e0f13}
body.j747-showcase-open .player-bar{z-index:100001!important}
body.j747-showcase-silent .player-bar{display:none!important}`;
document.head.appendChild(style);
function resize(){if(!panel)return;const next=document.querySelector('.player-bar');if(next!==player){if(player)resizeObserver?.unobserve(player);player=next;if(player)resizeObserver?.observe(player);}panel.style.setProperty('--showcase-player-gap',hasMusic&&player?Math.ceil(player.getBoundingClientRect().height)+'px':'0px');}
function close(){if(!panel)return;panel.remove();panel=frame=null;observer?.disconnect();resizeObserver?.disconnect();observer=resizeObserver=null;document.body.classList.remove('j747-showcase-open','j747-showcase-silent');document.body.style.overflow=overflowBefore;window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);focusBefore?.isConnected&&focusBefore.focus();player=null;}
function open(url){if(panel)return;const bar=document.querySelector('.player-bar');hasMusic=bar?.querySelector('.pb-main')?.getAttribute('aria-label')==='Pause';focusBefore=document.activeElement;overflowBefore=document.body.style.overflow;
 panel=document.createElement('section');panel.className='j747-showcase-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-label','Character showcase');
 const header=document.createElement('header'),title=document.createElement('strong'),back=document.createElement('button');title.textContent='Groove Squad Showcase';back.type='button';back.textContent='Close showcase';back.onclick=close;header.append(title,back);
 frame=document.createElement('iframe');frame.title='Groove Squad character artwork and motions';frame.allow='fullscreen; gamepad';frame.onload=()=>{try{const child=frame.contentWindow;if(child.location.pathname.startsWith(path)&&!child.Jerm747ShowcaseBridgeReady){const s=child.document.createElement('script');s.src='/assets/showcase-player-bridge.js?v=95';child.document.head.appendChild(s);}}catch{}};frame.src=url;panel.append(header,frame);document.body.classList.add('j747-showcase-open');document.body.classList.toggle('j747-showcase-silent',!hasMusic);document.body.style.overflow='hidden';document.body.appendChild(panel);
 observer=new MutationObserver(()=>{resize();/* v95: music started while the showcase is open → show the player again */const m=document.querySelector('.player-bar .pb-main');if(m&&m.getAttribute('aria-label')==='Pause'&&document.body.classList.contains('j747-showcase-silent')){document.body.classList.remove('j747-showcase-silent');hasMusic=true;resize();}});observer.observe(document.body,{childList:true,subtree:true});resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();back.focus();
}
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!u.pathname.startsWith(path))return;e.preventDefault();e.stopPropagation();open(u.href);},true);
document.addEventListener('keydown',e=>{if(panel&&e.key==='Escape'&&!document.documentElement.classList.contains('game-music-open')){e.preventDefault();e.stopPropagation();close();}},true);
document.addEventListener('focusin',e=>{if(panel&&!panel.contains(e.target)&&!e.target.closest?.('.gm-layer,.sheet-layer,.art-view')&&!(hasMusic&&player?.contains(e.target)))panel.querySelector('button').focus();});
window.addEventListener('popstate',close);
window.addEventListener('message',e=>{if(!panel||e.origin!==location.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='jerm747-showcase-close'||e.data?.type==='jerm747-catalog-close')close();if(e.data?.type==='jerm747-showcase-game'){try{const u=new URL(e.data.url,location.href);if(u.origin===location.origin&&gamePaths.has(u.pathname)){frame.src=u.href;frame.title='Groove Squad game';}}catch{}}});
window.Jerm747Showcase={open,close};
})();
