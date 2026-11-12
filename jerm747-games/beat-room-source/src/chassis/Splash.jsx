import { useEffect, useState } from 'react';
import artwork from '../assets/splash-boombox.jpg';

export default function Splash({ readyToEnter = true }) {
  const [phase, setPhase] = useState('show');
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
    <img src={artwork} alt="Jerm747 Beat Room — Find your frequency. A vintage boombox with a vinyl record in amber and teal studio light." draggable="false" fetchPriority="high" decoding="async" onLoad={() => setReady(true)} onError={leave} />
    <span className="studio-opening"><span className="studio-record" aria-hidden="true"><i /></span><span>Opening Beat Room</span><small>Tap to skip</small></span>
  </button>;
}
