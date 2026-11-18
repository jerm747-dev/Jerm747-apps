import { useEffect, useState } from 'react';
import RoomArtwork from './RoomArtwork.jsx';

export default function Splash({ readyToEnter = true }) {
  // opening a project reloads the room; skip the splash that one time
  const [phase, setPhase] = useState(() => { try { if (sessionStorage.getItem('beatroom.skipSplash')) { sessionStorage.removeItem('beatroom.skipSplash'); return 'gone'; } } catch { /* off */ } return 'show'; });
  const [ready, setReady] = useState(false);
  const [lingerDone, setLingerDone] = useState(false);
  useEffect(() => {
    if (!ready || phase !== 'show') return;
    const timer = setTimeout(() => setLingerDone(true), 3200);
    return () => clearTimeout(timer);
  }, [ready, phase]);
  useEffect(() => {
    if (lingerDone && readyToEnter && phase === 'show') setPhase('leaving');
  }, [lingerDone, readyToEnter, phase]);
  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = setTimeout(() => setPhase('gone'), 800);
    return () => clearTimeout(timer);
  }, [phase]);
  if (phase === 'gone') return null;
  const leave = () => setPhase('leaving');
  return <button type="button" className={`studio-splash ${phase === 'leaving' ? 'is-leaving' : ''}`} onPointerDown={leave} onClick={leave} aria-label="Enter Jerm747 Beat Room" onTransitionEnd={e => { if (phase === 'leaving' && e.target === e.currentTarget && e.propertyName === 'opacity') setPhase('gone'); }}>
    <RoomArtwork onLoad={() => setReady(true)} onError={leave} />
    <span className="studio-opening"><span className="studio-record" aria-hidden="true"><i /></span><span>Opening Beat Room</span><small>Tap to skip</small></span>
  </button>;
}
