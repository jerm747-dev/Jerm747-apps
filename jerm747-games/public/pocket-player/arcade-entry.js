(() => {
  'use strict';
  const key = 'jerm747.pocket.intro.seen.v1';
  const pocket = window.Jerm747Pocket;
  const card = document.getElementById('pocket-intro');
  if (!card || !pocket) return;
  let sessionSeen = false, returnTo = null, timer = 0, removeTimer = 0, endAt = 0, remaining = 10000;
  let showing = false, hovering = false;
  function seen() {
    if (sessionSeen) return true;
    for (const storage of ['localStorage','sessionStorage']) {
      try { if (window[storage].getItem(key)==='1') return true; } catch {}
    }
    return false;
  }
  function remember() {
    sessionSeen = true;
    try { localStorage.setItem(key,'1'); }
    catch { try { sessionStorage.setItem(key,'1'); } catch {} }
  }
  function syncFinish() {
    const match = location.hash.match(/^#\/play\/([a-z0-9._-]+)/i);
    const choice = pocket.getFinish();
    const ice = choice === 'auto' ? (!match || pocket.skinFor(match[1]) === 'ice') : choice === 'ice';
    document.documentElement.dataset.pocketMenu = ice ? 'ice' : 'classic';
  }
  const cabinet = () => document.querySelector('.cabinet');
  function allowed() {
    return !document.hidden && !location.hash.startsWith('#/admin') && !location.hash.startsWith('#/play/')
      && !!cabinet() && !cabinet().classList.contains('cabinet--playing')
      && !document.querySelector('dialog[open],iframe[title="Jerm747 Arcade Settings"][aria-hidden="false"]');
  }
  function dismiss(restore=false) {
    if (!showing) return;
    showing = false;
    clearTimeout(timer);
    card.classList.remove('is-visible');
    card.inert = true;
    if (restore) (returnTo?.isConnected && returnTo !== document.body ? returnTo : document.querySelector('.cabinet-site-menu'))?.focus({preventScroll:true});
    removeTimer = setTimeout(()=>{card.hidden=true;},240);
  }
  function pause() {
    if (!showing || !timer) return;
    remaining = Math.max(0,endAt-performance.now());
    clearTimeout(timer); timer=0;
  }
  function resume() {
    if (!showing || timer || hovering || card.contains(document.activeElement) || document.hidden) return;
    endAt=performance.now()+remaining;
    timer=setTimeout(()=>dismiss(),remaining);
  }
  function show() {
    if (!allowed() || seen()) return;
    remember();
    showing=true;returnTo=document.activeElement;
    clearTimeout(removeTimer);card.inert=false;card.hidden=false;
    requestAnimationFrame(()=>{if(showing)card.classList.add('is-visible');});
    resume();
  }
  let pending=0;
  function reconcile(){
    syncFinish();
    if (!allowed()) {
      clearTimeout(pending);pending=0;
      if (!document.hidden) dismiss();
      else pause();
      return;
    }
    if (showing) {resume();return;}
    if (!seen()&&!pending) pending=setTimeout(()=>{pending=0;show();},900);
  }
  card.querySelector('button').addEventListener('click',()=>dismiss(true));
  card.querySelector('a').addEventListener('click',()=>dismiss());
  card.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovering=true;pause();}});
  card.addEventListener('pointerleave',()=>{hovering=false;resume();});
  card.addEventListener('focusin',pause);
  card.addEventListener('focusout',()=>queueMicrotask(resume));
  card.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss(true);}});
  window.addEventListener('storage',e=>{if(e.key===key && e.newValue==='1')dismiss();});
  window.addEventListener('pocket-finish-change',syncFinish);
  window.addEventListener('hashchange',reconcile);
  window.addEventListener('popstate',reconcile);
  window.addEventListener('pageshow',reconcile);
  document.addEventListener('visibilitychange',reconcile);
  // React attaches the cabinet and HUD after this document has loaded.
  function bindCabinet() {
    const host = cabinet(); if (!host) return false;
    const ui = new MutationObserver(reconcile);
    ui.observe(host,{attributes:true,attributeFilter:['class']});
    const menu=host.querySelector('.site-drawer');
    if(menu)ui.observe(menu,{attributes:true,attributeFilter:['open']});
    const hud=document.querySelector('iframe[title="Jerm747 Arcade Settings"]');
    if(hud)ui.observe(hud,{attributes:true,attributeFilter:['aria-hidden']});
    reconcile();return true;
  }
  if(!bindCabinet()){
    const waiting=new MutationObserver(()=>{if(bindCabinet())waiting.disconnect();});
    waiting.observe(document.getElementById('root'),{childList:true,subtree:true});
  }
})();
