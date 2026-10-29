import { useEffect, useRef, useState } from 'react';
import PadIcon from './PadIcon.jsx';

const LINGER_MS = 2500; // how long the label stays open after hover or a tap
const INTRO_MS = 2800; // first-visit peek
const NARROW = '(max-width: 560px)';

// Controller button at the left of the header. Rolls open to "Dev Sandbox" on hover,
// focus, first tap, or once per visit, then rolls back up.
export default function SandboxButton() {
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const pointer = useRef('mouse');

  const closeLater = (ms = LINGER_MS) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), ms);
  };

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('j747-sandbox-peek') === '1'; sessionStorage.setItem('j747-sandbox-peek', '1'); } catch { /* storage off */ }
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia(NARROW).matches;
    if (!seen && !calm) {
      const start = setTimeout(() => { setOpen(true); closeLater(INTRO_MS); }, 900);
      return () => { clearTimeout(start); clearTimeout(timer.current); };
    }
    return () => clearTimeout(timer.current);
  }, []);

  const onClick = (e) => {
    const narrow = window.matchMedia(NARROW).matches;
    // Touch on a roomy screen: first tap shows the label, second tap goes in.
    if (pointer.current !== 'mouse' && !narrow && !open) {
      e.preventDefault();
      setOpen(true);
      closeLater(3500);
    }
  };

  return (
    <a
      className={`sandbox-pill ${open ? 'is-open' : ''}`}
      href="/sandbox/"
      aria-label="Dev Sandbox: works in progress"
      onPointerDown={(e) => { pointer.current = e.pointerType; }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { clearTimeout(timer.current); setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') closeLater(); }}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) { clearTimeout(timer.current); setOpen(true); } }}
      onBlur={() => closeLater(800)}
      onClick={onClick}
    >
      <PadIcon />
      <span className="sandbox-pill-label" aria-hidden="true">Dev Sandbox</span>
    </a>
  );
}
