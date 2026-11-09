import {useEffect, useLayoutEffect, useRef} from 'react';

// Older game folders on GoDaddy can gain suspension without replacing their installed builds.
let installedClock;
function prepareLegacyGames() {
  if(!('serviceWorker' in navigator))return Promise.resolve();
  if(!installedClock)installedClock=(async()=>{
    const path='/projects/arcade-clock-worker.js';
    const previous=await navigator.serviceWorker.getRegistration('/projects/');
    if(previous && (previous.active||previous.waiting||previous.installing)?.scriptURL!==new URL(path,location.href).href)return;
    const reg=await navigator.serviceWorker.register(path,{scope:'/projects/'});
    const worker=reg.installing||reg.waiting;
    if(reg.active||!worker)return;
    await new Promise(resolve=>{
      function done(){clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve();}
      function changed(){if(worker.state==='activated'||worker.state==='redundant')done();}
      const timer=setTimeout(done,1200);
      worker.addEventListener('statechange',changed);changed();
    });
  })().catch(()=>{});
  return installedClock;
}

// Keep one visor alive across the shelf, live games and the Open games list.
export function useVisor({projects, playing, launch, onExit, live, onVisibility}) {
  const host = useRef(null), latest = useRef(null);
  latest.current = {projects, playing, launch, onExit};
  useLayoutEffect(() => {
    const sessions = window.ArcadeSessions;
    const bridge = {
      holding(w) {
        try {while (w && w !== window) {if (w.frameElement?.hidden) return true; w=w.parent;}} catch {}
        return !!host.current?.isOpen;
      },
      pads: () => navigator.getGamepads?.() || [],
      returnToCabinet: () => latest.current.onExit(),
      pause: () => host.current?.open()
    };
    window.Arcade = bridge;prepareLegacyGames();
    host.current = window.Jerm747HUD.mount(document.body, {
      context: 'cabinet',
      getMenu() {
        const {projects,playing} = latest.current;
        return {name: playing?.title, active: playing?.slug, canHold: sessions.supported(live.current),
          catalog: (projects||[]).map(p => ({id:p.slug,title:p.title}))};
      },
      getScene() {
        try {return live.current?.contentDocument?.querySelector('canvas') || document.querySelector('.sb-case[aria-current=true] img,.sb-slide[aria-hidden=false] .art-img');} catch {return null;}
      },
      onOpening() {sessions.hold(live.current);onVisibility(true);},
      onAction(action, {command}) {
        onVisibility(false);
        const {projects, playing, launch, onExit} = latest.current;
        if (action === 'command' && command?.startsWith('launch:')) {
          const next = projects?.find(p=>p.slug===command.slice(7));
          if (next && next.slug !== playing?.slug) {launch(next);return;}
        }
        if (action === 'cabinet' && playing) {onExit();return;}
        if (action === 'title' && playing && live.current) {live.current.src=playing.url;return;}
        sessions.release(live.current);
        if (playing) live.current?.focus();
        else document.querySelector('.web-visor-open')?.focus({preventScroll:true});
      }
    });
    return () => {
      host.current.destroy();host.current=null;
      for (const id of sessions.ids()) sessions.close(id);
      if(window.Arcade===bridge)delete window.Arcade;
    };
  }, []);
  useEffect(() => {host.current?.setContext(playing?'game':'cabinet',playing?.slug||'cabinet');}, [playing?.slug]);
  return host;
}

export function useGameFrame(project, stage, live) {
  useLayoutEffect(() => {
    if (!project) return;
    const sessions=window.ArcadeSessions;
    const kept=sessions.take(project.slug);
    const frame=kept?.frame || document.createElement('iframe');
    live.current=frame;
    const focus=()=>{
      if(live.current===frame && !window.Arcade?.holding(frame.contentWindow))frame.focus();
      else sessions.hold(frame);
    };
    frame.addEventListener('load',focus);
    if (kept) {sessions.release(frame);frame.focus();}
    else {
      frame.title=project.title;
      frame.allow='gamepad; fullscreen; autoplay; screen-wake-lock'+(project.slug==='beat-room'?'; microphone':'');
      frame.allowFullscreen=true;
      prepareLegacyGames().then(()=>{if(live.current===frame && stage.current){frame.src=project.url;stage.current.append(frame);}});
    }
    return () => {
      frame.removeEventListener('load',focus);
      if (!sessions.park(project.slug,frame,null))frame.remove();
      live.current=null;
    };
  },[project?.slug]);
}
