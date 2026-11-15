// Drum lane: the Rhythm Composer's section on a timeline, one lane per channel. Opened with
// "Send to lane" and hidden otherwise. Tap empty space to add a hit, tap a hit to pick it
// (Shift adds), drag across hits to select several, drag a hit to move the selection (it can
// change lanes too), and nudge by the lane grid: 1/16, 1/32 or 1/64. Always snapped, so a hat
// can sit a 1/64 late without fiddling. Faint lines mark every grid division, beats and bars.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pads from '../engine/pads.js';
import { onStep } from '../engine/clock.js';
import { blip } from '../engine/audio.js';
import { useExternal } from '../ui/parts.jsx';

const GRIDS = { '1/16': 1, '1/32': 0.5, '1/64': 0.25 };
const GRID_KEY = 'beatroom.drumlane.grid';
const NAME_W = 64; // px, channel-name column
const ROW_PX = 34;
const snap = (x, g) => Math.round(Math.round(x / g) * g * 1000) / 1000;
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* off */ } } };
const keyOf = (h) => h.ri + ':' + h.i;
// where a hit lands (same rule as the engine): within half a step it keeps its own step
const landIdx = (i, x, len) => { const w = ((x % len) + len) % len; return Math.abs(w - i) <= 0.5 ? i : Math.round(w) % len; };

export default function DrumLane({ onClose }) {
  const rows = useExternal(pads.subscribe, pads.getRows);
  const len = useExternal(pads.subscribe, pads.getLength);
  const song = useExternal(pads.onSong, pads.getSong);
  const [grid, setGridState] = useState(() => (store.get(GRID_KEY, '1/32') in GRIDS ? store.get(GRID_KEY, '1/32') : '1/32'));
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState([]);       // keys "ri:i"
  const [box, setBox] = useState(null);
  const svgRef = useRef(null), scrollRef = useRef(null), head = useRef(null), drag = useRef(null), gest = useRef({});
  const g = GRIDS[grid];
  const hits = pads.laneHits();
  const selSet = new Set(sel);
  const W = 1000, H = rows.length * 10;
  const setGrid = (x) => { setGridState(x); store.set(GRID_KEY, x); };

  useEffect(() => { setSel([]); }, [song?.edit, len]);
  useEffect(() => onStep((i, abs) => {
    const el = head.current; if (!el) return;
    const m = i >= 0 && pads.isPlaying() ? pads.posAt(abs) : null;
    if (!m || m.sec !== pads.getEdit()) { el.style.opacity = 0; return; }
    el.style.opacity = 1; el.setAttribute('x', ((m.pos / m.len) * W).toFixed(1));
  }), []);
  // keep the middle in place when zooming
  const anchor = useRef(null);
  const zoomBy = (f) => { const el = scrollRef.current; if (el) anchor.current = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth; setZoom((z) => Math.max(1, Math.min(8, z * f))); };
  useLayoutEffect(() => { const el = scrollRef.current; if (el && anchor.current != null) { el.scrollLeft = anchor.current * el.scrollWidth - el.clientWidth / 2; anchor.current = null; } }, [zoom]);

  const at = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * len, ri: Math.max(0, Math.min(rows.length - 1, Math.floor(((e.clientY - r.top) / r.height) * rows.length))), px: r.width / len };
  };

  function hitDown(e, h) {
    e.stopPropagation(); e.preventDefault();
    const k = keyOf(h);
    if (e.shiftKey || e.ctrlKey || e.metaKey) { setSel(selSet.has(k) ? sel.filter((x) => x !== k) : [...sel, k]); return; }
    const group = selSet.has(k) ? sel : [k];
    setSel(group); pads.laneHear(h.ri);
    const list = hits.filter((x) => group.includes(keyOf(x)));
    drag.current = { lead: h, list, start: at(e), moved: false, dx: 0, dr: 0 };
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* fine */ }
  }
  function down(e) {
    if (drag.current) return;
    const p = at(e);
    gest.current = { x: e.clientX, y: e.clientY, p, tap: true };
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* fine */ }
  }
  function move(e) {
    const d = drag.current;
    if (d) {
      const p = at(e);
      const dx = snap(d.lead.x + (p.x - d.start.x), g) - d.lead.x, dr = p.ri - d.start.ri;
      if (!d.moved && Math.abs((p.x - d.start.x) * p.px) < 3 && dr === 0) return;
      d.moved = true; d.dx = dx; d.dr = dr; setBox({ ghost: true, dx, dr }); return;
    }
    const G = gest.current; if (!G.p) return;
    if (G.tap && Math.hypot(e.clientX - G.x, e.clientY - G.y) > 6) G.tap = false;
    if (!G.tap) { const p = at(e); setBox({ x0: G.p.x, r0: G.p.ri, x1: p.x, r1: p.ri }); }
  }
  function up(e) {
    const d = drag.current; drag.current = null;
    if (d) {
      setBox(null);
      if (d.moved && (d.dx || d.dr)) {
        const moves = d.list.map((h) => ({ ri: h.ri, i: h.i, x: h.x + d.dx, to: Math.max(0, Math.min(rows.length - 1, h.ri + d.dr)) }));
        pads.laneBegin(); pads.laneMove(moves); blip(620);
        setSel(moves.map((m) => m.to + ':' + landIdx(m.i, m.x, len)));
      }
      return;
    }
    const G = gest.current; gest.current = {};
    if (!G.p) return;
    if (G.tap) {
      // tapping empty space adds a hit, snapped to the lane grid
      if (!rows[G.p.ri]?.src) { blip(260); return; }
      pads.laneAdd(G.p.ri, Math.max(0, Math.min(len - g, snap(G.p.x - g / 2, g))));
      setSel([]);
    } else {
      const p = at(e), x0 = Math.min(G.p.x, p.x), x1 = Math.max(G.p.x, p.x), r0 = Math.min(G.p.ri, p.ri), r1 = Math.max(G.p.ri, p.ri);
      const picked = hits.filter((h) => h.ri >= r0 && h.ri <= r1 && h.x + 0.25 >= x0 && h.x <= x1).map(keyOf);
      setSel(e.shiftKey ? [...new Set([...sel, ...picked])] : picked);
      if (picked.length) blip(760);
    }
    setBox(null);
  }
  const selected = () => hits.filter((h) => selSet.has(keyOf(h)));
  function nudge(dx) {
    const list = selected(); if (!list.length) return;
    pads.laneBegin(); pads.laneMove(list.map((h) => ({ ri: h.ri, i: h.i, x: snap(h.x + dx, g) }))); blip(dx > 0 ? 700 : 560);
    setSel(list.map((h) => h.ri + ':' + landIdx(h.i, snap(h.x + dx, g), len)));
  }
  function del() { const list = selected(); if (!list.length) return; pads.laneRemove(list); setSel([]); blip(300); }
  function key(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); nudge(e.key === 'ArrowLeft' ? -g : g); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(hits.map(keyOf)); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); pads.laneUndo(); setSel([]); }
    else if (e.key === 'Escape') setSel([]);
  }

  // time lines: every grid division (faint), beats, bars
  const lines = [];
  for (let k = 1; k * g < len; k++) {
    const x = k * g, bar = Math.abs(x % 16) < 1e-6, beat = Math.abs(x % 4) < 1e-6, step = Math.abs(x % 1) < 1e-6;
    lines.push(<rect key={'t' + k} className={`dl-line ${bar ? 'bar' : beat ? 'beat' : step ? 'step' : 'sub'}`} x={(x / len) * W - (bar ? 0.9 : 0.5)} y="0" width={bar ? 1.8 : 1} height={H} />);
  }
  const hitW = Math.max(3, Math.min(10, (0.5 / len) * W));
  const one = sel.length === 1 ? selected()[0] : null;
  const nudgedCount = hits.filter((h) => Math.abs(h.x - h.i) > 0.001).length;
  return (
    <div className="panel drum-lane">
      <div className="lane-head">
        <span className="engrave">Drum lane · Section {pads.SECTIONS[song?.edit ?? 0]} · {len} steps · {hits.length} hit{hits.length === 1 ? '' : 's'}{nudgedCount ? ` · ${nudgedCount} nudged` : ''}</span>
        <div className="lane-btns">
          <span className="engrave">Grid</span>
          <select className="grid-pick" value={grid} onChange={(e) => { blip(660); setGrid(e.target.value); }} aria-label="Nudge grid">
            {Object.keys(GRIDS).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <button type="button" className="switch" aria-label="Zoom out time" onClick={() => zoomBy(1 / 1.4)} disabled={zoom <= 1}>−</button>
          <button type="button" className="switch" aria-label="Zoom in time" onClick={() => zoomBy(1.4)} disabled={zoom >= 8}>+</button>
          <button type="button" className="switch" onClick={() => setSel(hits.map(keyOf))} disabled={!hits.length}>All</button>
          <button type="button" className="switch" onClick={() => { blip(520); pads.laneUndo(); setSel([]); }} disabled={!pads.laneCanUndo()}>Undo</button>
          <button type="button" className="switch" onClick={() => { blip(440); onClose(); }}>Hide lane</button>
        </div>
      </div>
      <div ref={scrollRef} className="dl-scroll">
        <div className="dl-canvas" style={{ width: `calc(${NAME_W}px + (100% - ${NAME_W}px) * ${zoom})` }}>
          <div className="dl-names" aria-hidden="true">
            {rows.map((r) => <span key={r.id} className={r.src ? '' : 'empty'} style={{ height: ROW_PX }}>{r.src ? r.name : '—'}</span>)}
          </div>
          <div className="dl-roll">
            <div className="dl-ruler" aria-hidden="true">
              {Array.from({ length: len / 4 }, (_, b) => <span key={b} style={{ left: `${(b * 4 / len) * 100}%` }} className={b % 4 === 0 ? 'bar' : ''}>{b % 4 === 0 ? `${Math.floor(b / 4) + 1}` : `${Math.floor(b / 4) + 1}.${(b % 4) + 1}`}</span>)}
            </div>
            <svg ref={svgRef} className="dl-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: rows.length * ROW_PX }} tabIndex={0} role="img"
              aria-label={`Drum lane, ${hits.length} hits. Tap to add, drag to move, arrow keys nudge by ${grid}.`}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
              {rows.map((r, ri) => <rect key={r.id} className={`dl-row ${ri % 2 ? 'b' : 'a'} ${r.src ? '' : 'empty'}`} x="0" y={ri * 10} width={W} height="10" />)}
              {lines}
              {hits.map((h) => {
                const k = keyOf(h), on = selSet.has(k), nudged = Math.abs(h.x - h.i) > 0.001;
                return <rect key={k} className={`dl-hit ${on ? 'pick' : ''} ${nudged ? 'nudged' : ''}`} x={(h.x / len) * W - hitW / 2} y={h.ri * 10 + 1.5} width={hitW} height="7" rx="1.2"
                  style={{ opacity: 0.45 + (h.v / 100) * 0.55 }} onPointerDown={(e) => hitDown(e, h)} />;
              })}
              {box?.ghost && selected().map((h) => {
                const to = Math.max(0, Math.min(rows.length - 1, h.ri + box.dr)), x = h.x + box.dx;
                return <rect key={'gh' + keyOf(h)} className="dl-ghost" x={(x / len) * W - hitW / 2} y={to * 10 + 1.5} width={hitW} height="7" rx="1.2" />;
              })}
              {box && !box.ghost && (() => { const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), r0 = Math.min(box.r0, box.r1), r1 = Math.max(box.r0, box.r1);
                return <rect className="roll-box" x={(x0 / len) * W} y={r0 * 10} width={((x1 - x0) / len) * W} height={(r1 - r0 + 1) * 10} />; })()}
              <rect ref={head} className="roll-head" x="0" y="0" width="3" height={H} style={{ opacity: 0 }} />
            </svg>
          </div>
        </div>
      </div>
      <div className="lane-foot">
        <p className="hint">{one ? `${rows[one.ri].name} at step ${(one.x + 1).toFixed(2).replace(/\.?0+$/, '')}${Math.abs(one.x - one.i) > 0.001 ? ` (${one.x > one.i ? 'late' : 'early'} by ${Math.abs(one.x - one.i) === 0.25 ? '1/64' : Math.abs(one.x - one.i) === 0.5 ? '1/32' : `${Math.abs(one.x - one.i).toFixed(2)} step`})` : ''}`
          : sel.length ? `${sel.length} hits selected. Drag one to move them all, or nudge.`
          : `Tap to add a hit, drag a hit to move it, drag across hits to select. Snaps to ${grid}.`}</p>
        {sel.length > 0 && <span className="note-tools" role="group" aria-label="Selected hits">
          <button type="button" className="switch" title={`Earlier by ${grid}`} onClick={() => nudge(-g)}>◀ {grid}</button>
          <button type="button" className="switch" title={`Later by ${grid}`} onClick={() => nudge(g)}>{grid} ▶</button>
          <button type="button" className="btn" onClick={del}>Delete{sel.length > 1 ? ` ${sel.length}` : ''}</button>
        </span>}
      </div>
    </div>
  );
}
