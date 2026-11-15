// Project button under the brand plate: name the project, save it on this device or as a
// .beatroom file, open one, or start a new one. Opening reloads the room at the top.
import { useEffect, useRef, useState } from 'react';
import * as project from '../engine/project.js';
import { saveFile } from '../engine/export.js';
import { blip } from '../engine/audio.js';
import { useExternal } from '../ui/parts.jsx';

const when = (t) => { const d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const mb = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

export default function ProjectMenu() {
  const cur = useExternal(project.subscribe, project.getCurrent);
  const list = useExternal(project.onList, project.getList);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(cur.name);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { label, run }
  const fileIn = useRef(null), card = useRef(null);
  useEffect(() => { if (open) { setName(cur.name); setMsg(''); setConfirm(null); project.loadList(); setTimeout(() => card.current?.focus(), 30); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) return; const esc = (e) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, [open]);

  const task = async (fn) => { setBusy(true); setMsg(''); try { await fn(); } catch (e) { setMsg(e?.message === 'Save cancelled.' ? 'Save cancelled.' : e?.message || 'Something went wrong.'); } finally { setBusy(false); } };
  const commitName = () => { if (name.trim() !== cur.name) project.rename(name); };
  const saveHere = () => task(async () => { commitName(); const r = await project.saveHere(name.trim() || 'Untitled'); blip(980); setMsg(`Saved “${r.name}” on this device${r.sounds ? ` with ${r.sounds} sound${r.sounds === 1 ? '' : 's'}` : ''}.`); });
  const saveAsFile = () => task(async () => {
    commitName(); const nm = name.trim() || 'Untitled';
    const { blob, sounds } = await project.build(nm);
    const where = await saveFile(nm, project.EXT, blob);
    blip(1100); setMsg(`Saved ${nm}.${project.EXT} (${mb(blob.size)}${sounds ? `, ${sounds} sound${sounds === 1 ? '' : 's'}` : ''})${typeof where === 'string' && where !== 'saved' ? ` to ${where}` : ''}.`);
  });
  const ask = (label, run) => setConfirm({ label, run });
  const pickFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    task(async () => { const { manifest } = await project.read(f); ask(`Open “${manifest.name || f.name}”? The room you have now is replaced. Save it first if you want to keep it.`, () => task(() => project.open(f))); });
  };

  return (
    <div className="project">
      <button type="button" className="settings-btn project-btn" aria-haspopup="dialog" onClick={() => { blip(800); setOpen(true); }} title="New, open and save projects">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        <span>Project</span><em>{cur.name}</em>
      </button>
      {open && (
        <div className="pop-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div ref={card} className="pop-card pop-project" role="dialog" aria-modal="true" aria-label="Project" tabIndex={-1}>
            <div className="pop-head"><h3>Project</h3>
              <div className="pop-tools"><button type="button" className="mini pop-x" aria-label="Close" onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
            </div>
            <label className="proj-name"><span className="engrave">Name</span>
              <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }} aria-label="Project name" />
            </label>
            {confirm ? (
              <div className="proj-confirm" role="alertdialog" aria-label="Confirm">
                <p>{confirm.label}</p>
                <div className="proj-row">
                  <button type="button" className="btn" onClick={() => setConfirm(null)}>Cancel</button>
                  <button type="button" className="btn" onClick={() => { const r = confirm.run; setConfirm(null); saveHere().then(() => r()); }}>Save this one, then go</button>
                  <button type="button" className="btn primary" onClick={() => { const r = confirm.run; setConfirm(null); r(); }}>Go</button>
                </div>
              </div>
            ) : (
              <div className="proj-actions">
                <button type="button" className="btn primary" disabled={busy} onClick={saveHere}>Save</button>
                <button type="button" className="btn" disabled={busy} onClick={saveAsFile}>Save file</button>
                <button type="button" className="btn" disabled={busy} onClick={() => fileIn.current?.click()}>Open file</button>
                <button type="button" className="btn" disabled={busy} onClick={() => ask('Start a new project? The room clears (tempo, patterns, notes, mixer, Drive). Your sounds stay in the Sample bin.', () => project.fresh())}>New</button>
                <input ref={fileIn} type="file" accept=".beatroom,application/x-beatroom,application/zip,application/octet-stream" hidden onChange={pickFile} />
              </div>
            )}
            <p className="hint proj-msg" role="status" aria-live="polite">{busy ? 'Working…' : msg || 'Save keeps the project on this device. Save file makes a .beatroom file with every sound in it, to keep or share.'}</p>
            <div className="proj-list">
              <span className="engrave">On this device</span>
              {list.length ? list.map((p) => (
                <div key={p.id} className={`proj-item ${p.id === cur.id ? 'cur' : ''}`}>
                  <span><b>{p.name}</b><em>{when(p.updated)} · {p.sounds} sound{p.sounds === 1 ? '' : 's'} · {mb(p.size)}</em></span>
                  <button type="button" className="switch" disabled={busy} onClick={() => ask(`Open “${p.name}”? The room you have now is replaced.`, () => task(() => project.openSaved(p.id)))}>Open</button>
                  <button type="button" className="switch" disabled={busy} onClick={() => ask(`Delete “${p.name}” from this device? Files you saved stay where they are.`, () => task(async () => { await project.removeSaved(p.id); setMsg(`Deleted “${p.name}”.`); }))}>Delete</button>
                </div>
              )) : <p className="hint">No saved projects yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
