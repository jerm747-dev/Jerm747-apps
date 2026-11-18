import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import RoomArtwork from './chassis/RoomArtwork.jsx';
import './theme/theme.css';
import './theme/gear.css';
import './theme/sections.css';
import './theme/synth.css';
import './theme/lab.css';
import './theme/artwork.css';
import { installBackKey } from './engine/backkey.js';
installBackKey();

function FullscreenButton() {
  let host = document;
  try { host = window.top.document; } catch { /* Cross-origin embeds can use their own surface. */ }
  const [active, setActive] = useState(!!host.fullscreenElement);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const changed = () => { setActive(!!host.fullscreenElement); setNotice(''); };
    host.addEventListener('fullscreenchange', changed);
    return () => host.removeEventListener('fullscreenchange', changed);
  }, [host]);
  if (window.BeatRoomAndroid || window.EncoreAndroid || !host.fullscreenEnabled) return null;
  async function toggle() {
    try {
      if (host.fullscreenElement) await host.exitFullscreen();
      else await host.documentElement.requestFullscreen();
    } catch { setNotice('Fullscreen is unavailable in this browser view.'); }
  }
  return <><button onClick={toggle} aria-pressed={active}>{active ? 'Exit fullscreen' : 'Fullscreen'}</button>
    {notice && <span role="status">{notice}</span>}</>;
}

function BeatRoomEntry(){
  const [started,setStarted]=useState(false);
  useEffect(()=>{
    if(started||window.parent!==window)return;
    let frame=0,held=false;
    const poll=()=>{let down=false;try{down=Array.from(navigator.getGamepads?.()||[]).some(p=>p?.buttons[9]?.pressed)}catch{}
      if(down&&!held)setStarted(true);held=down;frame=requestAnimationFrame(poll)};
    frame=requestAnimationFrame(poll);return()=>cancelAnimationFrame(frame);
  },[started]);
  if(started)return <App />;
  const back=()=>{
    if(window.BeatRoomAndroid?.leaveTitle){window.BeatRoomAndroid.leaveTitle();return}
    if(parent!==window){parent.postMessage({type:'arcade-return'},location.origin);return}
    if(document.referrer && new URL(document.referrer).origin===location.origin){history.back();return}
    location.assign('/'); 
  };
  return (
    <main className="beat-title" aria-label="Jerm747 Beat Room">
      <RoomArtwork />
      <section aria-label="Title controls">
        <button id="beat-start" autoFocus onClick={() => setStarted(true)}>Start</button>
        <button onClick={back}>Back</button>
        <FullscreenButton />
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')).render(<StrictMode><BeatRoomEntry /></StrictMode>);
