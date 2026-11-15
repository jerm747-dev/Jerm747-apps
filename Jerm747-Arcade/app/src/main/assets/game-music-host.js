'use strict';
// The cabinet owns this frame. Game sessions can be parked or discarded independently.
const gameMusic = (() => {
  const layer = byId('music-panel'), player = byId('music-frame');
  const dock = byId('music-dock'), title = byId('music-title'), toggle = byId('music-toggle');
  let open = false, sourceFocus, status = {}, closeClient = null;
  function send(data) { player.contentWindow?.postMessage(data, location.origin); }
  function tellVisibility() {
    send({type:'sound-test-visibility', visible:open, inGame:!!frame});
  }
  function refresh() {
    dock.hidden = !status.title || open || cabinet.hidden;
    title.textContent = status.title || '';
    toggle.textContent = status.playing ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', status.playing ? 'Pause music' : 'Play music');
  }
  function show() {
    if (open) return;
    sourceFocus = document.activeElement;
    if(frameHook)for(const code of activeKeys)key(frameHook,code,false);
    activeKeys.clear();releasePadGate=true;open = true;
    ArcadeSessions.hold(frame);
    pocketView?.setHeld(true);
    if (!player.hasAttribute('src')) player.src = 'projects/sound-test/index.html?widget=1';
    layer.showModal();
    tellVisibility();
    player.focus();
    refresh();
  }
  function hide(shelf = false) {
    if (!open) return;
    open = false;
    releasePadGate=true;layer.close();
    tellVisibility();
    if (closeClient) {
      closeClient.postMessage({type:'jerm747-music-closed'}, location.origin);
      closeClient = null;
    }
    if (shelf && (frame || titleShowing)) returnToCabinet();
    pocketView?.setHeld(backgroundReasons.size > 0 || heldByVisor);
    if (frame) { const target=frame;ArcadeSessions.release(target);target.contentWindow.focus();
      requestAnimationFrame(()=>{if(!open&&frame===target&&!visor.isOpen){ArcadeSessions.release(target);target.contentWindow.focus()}}); }
    else if (sourceFocus?.isConnected && !sourceFocus.closest('[hidden]')) sourceFocus.focus({preventScroll:true});
    refresh();
    releasePadGate = true;
  }
  function back() {
    const doc = player.contentDocument;
    const dialog = doc?.querySelector('dialog[open]');
    if (dialog?.open) { dialog.close(); return; }
    const song = doc?.getElementById('song');
    if (song && !song.hidden) { doc.getElementById('songBack').click(); return; }
    hide();
  }
  function background(away) { player.contentWindow?.GameMusicLifecycle?.setHostAway(away); }
  player.addEventListener('load', () => {
    if (window.EncoreAndroid) Object.defineProperty(player.contentWindow.navigator,'getGamepads',{configurable:true,value:()=> open && !releasePadGate ? pads() : []});
    background(backgroundReasons.size > 0);
    tellVisibility();
  });
  addEventListener('message', e => {
    if (e.origin !== location.origin) return;
    const data = e.data;
    if (e.source === player.contentWindow) {
      if (data?.type === 'sound-test-close') hide(data.destination === 'shelf');
      if (data?.type === 'sound-test-ready') tellVisibility();
      if (data?.type === 'sound-test-status') { status = data; refresh(); }
      return;
    }
    if (!frame || e.source !== frame.contentWindow) return;
    if (data?.type === 'jerm747-music-open') {
      closeClient = e.source;
      closeClient.postMessage({type:'jerm747-music-ack'},location.origin);
      show();
      closeClient.postMessage({type:'jerm747-music-opened'},location.origin);
    }
    if (data?.type === 'jerm747-music-close') hide();
    if (data?.type === 'jerm747-music-action') send({type:'sound-test-action',action:data.action});
  });
  layer.addEventListener('cancel', e => { e.preventDefault(); back(); });
  layer.addEventListener('click', e => { if (e.target === layer) hide(); });
  byId('music-open').onclick = show;
  toggle.onclick = () => send({type:'sound-test-action',action:'toggle'});
  new MutationObserver(refresh).observe(cabinet, {attributes:true,attributeFilter:['hidden']});
  return {show, back, background, get visible(){return open;}, get player(){return player;}};
})();
