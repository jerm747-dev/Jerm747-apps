// Settings, under the brand plate. One option for now: button click sounds.
import { useEffect, useRef, useState } from 'react';
import { getSettings, onSettings, setSetting, blip } from '../engine/audio.js';
import { Led, useExternal } from '../ui/parts.jsx';

export default function Settings() {
  const s = useExternal(onSettings, getSettings);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="settings" ref={ref}>
      <button type="button" className="settings-btn" aria-expanded={open} aria-controls="br-settings" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
        Settings
      </button>
      {open && (
        <div className="settings-panel" id="br-settings" role="group" aria-label="Settings">
          <div className="set-row">
            <span><b>Button clicks</b><em>The little beep when you press a button</em></span>
            <button type="button" role="switch" aria-label="Button clicks" aria-checked={s.clicks} className={`switch ${s.clicks ? 'on' : ''}`}
              onClick={() => { const v = !s.clicks; setSetting('clicks', v); if (v) blip(880); }}>
              <Led on={s.clicks} />{s.clicks ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
