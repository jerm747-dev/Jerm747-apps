import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './arcade-music.css';

// A single audio frame survives opening and closing the pop-up and changing games.
export default function ArcadeMusic({api, live, onVisibility, inGame = false}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState({playing: false, title: ''});
  const frame = useRef(null);
  const visible = useRef(false);
  const originFocus = useRef(null);
  const heldGame = useRef(null);
  const latest = useRef(null);
  const pendingClient = useRef(null);
  latest.current = {live, onVisibility};

  function send(data) { frame.current?.contentWindow?.postMessage(data,location.origin); }
  function trustedGame(source) {
    function contains(windowRef) {
      if (!windowRef) return false;
      if (windowRef === source) return true;
      try {
        for (let i = 0; i < windowRef.frames.length; i++) {
          if (contains(windowRef.frames[i])) return true;
        }
      } catch { /* Independent origins own their player. */ }
      return false;
    }
    return contains(latest.current.live.current?.contentWindow);
  }
  function show() {
    if (visible.current) return;
    originFocus.current = document.activeElement;
    const game = latest.current.live.current;
    if (game) { heldGame.current = game; window.ArcadeSessions?.hold(game); }
    visible.current = true;
    setMounted(true);
    setOpen(true);
    latest.current.onVisibility(true);
    send({type: 'sound-test-visibility', visible: true, inGame: !!game});
    frame.current?.focus();
  }
  function hide(destination) {
    if(!visible.current)return;
    visible.current = false;
    setOpen(false);
    latest.current.onVisibility(false);
    send({type: 'sound-test-visibility', visible: false});
    if (destination === 'shelf' && latest.current.live.current) window.Arcade?.returnToCabinet?.();
    else if (heldGame.current) window.ArcadeSessions?.release(heldGame.current);
    heldGame.current = null;
    if (pendingClient.current) {
      pendingClient.current.postMessage({type: 'jerm747-music-closed'},location.origin);
      pendingClient.current = null;
    }
    if (['#/play/sound-test','#/play/game-music'].includes(location.hash)) history.replaceState(null,'',location.pathname + location.search);
    const target=latest.current.live.current;
    requestAnimationFrame(()=>{
      if(visible.current)return;
      if(destination!=='shelf'&&target?.isConnected&&target===latest.current.live.current){window.ArcadeSessions?.release(target);target.contentWindow?.focus()}
      else if(originFocus.current?.isConnected)originFocus.current.focus({preventScroll:true});
    });
  }
  useLayoutEffect(() => {
    api.current = {open: show, close: hide};
    return () => { api.current = null; };
  }, []);
  useEffect(() => {
    function receive(event) {
      if (event.origin !== location.origin) return;
      const data = event.data;
      if (event.source === frame.current?.contentWindow) {
        if (data?.type === 'sound-test-close') hide(data.destination);
        if (data?.type === 'sound-test-status') setStatus(data);
        if (data?.type === 'sound-test-ready') send({type:'sound-test-visibility',visible:visible.current,inGame:!!latest.current.live.current});
        return;
      }
      if (!trustedGame(event.source)) return;
      if (data?.type === 'jerm747-music-open') {
        pendingClient.current = event.source;
        event.source.postMessage({type: 'jerm747-music-ack'},location.origin);
        show();
        event.source.postMessage({type: 'jerm747-music-opened'},location.origin);
      }
      if (data?.type === 'jerm747-music-close') hide();
      if (data?.type === 'jerm747-music-action') send({type:'sound-test-action',action:data.action});
    }
    window.addEventListener('message',receive);
    return () => window.removeEventListener('message',receive);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function key(event) {
      if (event.key === 'Escape') { event.preventDefault(); hide(); }
    }
    window.addEventListener('keydown',key);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown',key); };
  }, [open]);

  return createPortal(<>
    {mounted && <div className="arcade-music-layer" hidden={!open}>
      <button type="button" className="arcade-music-scrim" aria-label="Close music player" tabIndex={-1} onClick={hide} />
      <section className="arcade-music-window" role="dialog" aria-modal="true" aria-label="Game Music player">
        <iframe ref={frame} title="Game Music player" src="/projects/sound-test/index.html?widget=1" allow="autoplay; gamepad"
          onLoad={() => { send({type:'sound-test-visibility',visible:visible.current,inGame:!!latest.current.live.current}); if (visible.current) frame.current.focus(); }} />
      </section>
    </div>}
    {mounted && !open && !inGame && status.title && <div className="arcade-music-dock">
      <button type="button" className="arcade-music-open" onClick={show} aria-label={'Open music player, '+status.title}>
        <img src="/projects/sound-test/case.webp" alt="" /><span><small>Game Music</small><strong>{status.title}</strong></span>
      </button>
      <button type="button" className="arcade-music-toggle" onClick={() => send({type:'sound-test-action',action:'toggle'})} aria-label={status.playing?'Pause music':'Play music'}>{status.playing?'Ⅱ':'▶'}</button>
    </div>}
  </>,document.body);
}
