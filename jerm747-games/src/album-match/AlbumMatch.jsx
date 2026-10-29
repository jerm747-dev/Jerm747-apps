import { flushSync } from "react-dom";
import React, { useState, useRef, useEffect } from "react";
import { FullscreenButton, SquadScoreboard, recordRound } from "./standalone.jsx";
import { adjacent, matches, swapped, validSwap, hasMove, refillWithMotion, newBoard, neighbor, outcome, START_MOVES } from "./albumMatchEngine.js";
import tiles, { ALBUM_COLORS } from "./albumCoverStyles.js";
import "./AlbumMatch.css";

const COMPLETION_KEY = "jerm747.games.album-match.complete";
const BEST_KEY = "jerm747.games.album-match.best";
const KEYS_KEY = "jerm747.games.album-match.keys";
const COLORS = ALBUM_COLORS;
const PRESETS = [
  { name: "A S Z X", keys: { left: "a", up: "s", down: "z", right: "x" } },
  { name: "Q W A S", keys: { left: "q", up: "w", down: "a", right: "s" } },
  { name: "W A S D", keys: { left: "a", up: "w", down: "s", right: "d" } },
];
const DIRECTIONS = ["left", "up", "down", "right"];
const ARROWS = { left: "←", up: "↑", down: "↓", right: "→" };
const validKeys = keys => DIRECTIONS.every(d => /^[a-z]$/.test(keys?.[d])) && new Set(DIRECTIONS.map(d => keys[d])).size === 4;
const readKeys = () => { try { const keys = JSON.parse(localStorage.getItem(KEYS_KEY)); if (validKeys(keys)) return keys; } catch {} return PRESETS[0].keys; };

export default function AlbumMatch({ member, image, onClose }) {
  const [board, setBoard] = useState(newBoard);
  const [cursor, setCursor] = useState(0);
  const [armed, setArmed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState([]);
  const [motion, setMotion] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(START_MOVES);
  const [phase, setPhase] = useState("play");
  const [message, setMessage] = useState("Match 3 identical symbols in a row or column.");
  const [gap, setGap] = useState(0);
  const [settings, setSettings] = useState(false);
  const [keys, setKeys] = useState(readKeys);
  const [draft, setDraft] = useState(readKeys);
  const [keyError, setKeyError] = useState("");
  const [best, setBest] = useState(() => { try { return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0); } catch { return 0; } });
  const buttonRefs = useRef([]), resultRef = useRef(null), alive = useRef(true), lock = useRef(false);
  const timers = useRef(new Map()), saved = useRef(false), pointer = useRef(null), suppressClick = useRef(0), sequence = useRef(0);
  const fallAnimations = useRef(new Set());
  const origin = useRef(document.activeElement);
  const wait = ms => new Promise(resolve => { const id = setTimeout(() => { timers.current.delete(id); resolve(); }, ms); timers.current.set(id, resolve); });
  const delay = ms => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
  useEffect(() => {
    alive.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRefs.current[0]?.focus();
    const update = () => setGap(Math.ceil(document.querySelector(".player-bar")?.getBoundingClientRect().height || 0));
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    const bar = document.querySelector(".player-bar"); if (bar) observer?.observe(bar);
    window.addEventListener("resize", update);
    return () => {
      alive.current = false;
      fallAnimations.current.forEach(a=>a.cancel());fallAnimations.current.clear();
      for (const [id, resolve] of timers.current) { clearTimeout(id); resolve(); }
      timers.current.clear(); observer?.disconnect(); window.removeEventListener("resize", update);
      document.body.style.overflow = previous; origin.current?.focus();
    };
  }, []);
  useEffect(() => { if (phase !== "play") resultRef.current?.focus(); }, [phase]);
  const flash = (index, direction, label) => setPulse({ index, direction, label, sequence: ++sequence.current });
  const finish = (points, remaining) => {
    const result = outcome(points, remaining);
    if (result === "play" || saved.current) return false;
    saved.current = true;
    recordRound("album-match", member.id, { score: points, won: result === "won" });
    if (result === "won") {
      try { localStorage.setItem(COMPLETION_KEY, "1"); } catch {}
      window.dispatchEvent(new Event("jerm747-journey-complete"));
    }
    setPhase(result); return true;
  };
  const swap = async (from, to, direction, label = "Swap") => {
    flash(from, direction, label);
    if (phase !== "play" || settings) return;
    if (lock.current) { setMessage("Covers settling…"); return; }
    if (to === null || !adjacent(from, to)) { setMessage("Edge of the board."); return; }
    lock.current = true; setBusy(true); setArmed(null); setClearing([]);
    let remaining = moves;
    setMotion({ from, to, returning: false });
    setMessage("Swapping…");
    await wait(delay(180)); if (!alive.current) return;
    if (!validSwap(board, from, to)) {
      setMotion({ from, to, returning: true });
      setMessage("No match. Try another swap.");
      await wait(delay(180)); if (!alive.current) return;
      setMotion(null); lock.current = false; setBusy(false);
      if (!finish(score, remaining)) buttonRefs.current[from]?.focus();
      return;
    }
    remaining = moves - 1; setMoves(remaining);
    let next = swapped(board, from, to), gained = 0, cascades = 0;
    setBoard(next); setMotion(null); setCursor(to);
    while (alive.current) {
      const found = matches(next); if (!found.length) break;
      gained += found.length * 10 * ++cascades;
      setClearing(found); setMessage(`${found.length} covers matched${cascades > 1 ? ` · cascade ×${cascades}` : ""}!`);
      await wait(delay(240)); if (!alive.current) return;
      const fall = refillWithMotion(next, found); next = fall.board;
      flushSync(()=>{setBoard(next);setClearing([]);});
      if (cascades >= 30) { next = newBoard(); setBoard(next); break; }
      if (delay(1) > 0) {
        const animations=[];
        fall.drops.forEach((drop,index)=>{
          const el=buttonRefs.current[index];if(!el||!drop.distance)return;
          const gap=parseFloat(getComputedStyle(el.closest('.match-row')).gap)||7;
          const distance=drop.distance*(el.getBoundingClientRect().height+gap);
          const animation=el.animate([{transform:`translateY(-${distance}px)`,opacity:drop.fresh?.25:1},{transform:'translateY(0)',opacity:1}],{duration:540+drop.distance*65,easing:'cubic-bezier(.2,.55,.25,1)',fill:'both'});
          fallAnimations.current.add(animation);animations.push(animation.finished.catch(()=>{}).then(()=>{animation.cancel();fallAnimations.current.delete(animation);}));
        });
        await Promise.all(animations);
      }
      await wait(delay(120));
    }
    if (!alive.current) return;
    const points = score + gained; setScore(points);
    if (points > best) { setBest(points); try { localStorage.setItem(BEST_KEY, String(points)); } catch {} }
    let refreshed = false;
    if (!hasMove(next)) { next = newBoard(); setBoard(next); refreshed = true; }
    setMessage(`+${gained} points${cascades > 1 ? ` · ${cascades} cascades` : ""}${refreshed ? " · fresh crate" : ""}`);
    lock.current = false; setBusy(false);
    if (!finish(points, remaining)) buttonRefs.current[to]?.focus();
  };
  const select = index => {
    if (Date.now() < suppressClick.current || lock.current || settings || phase !== "play") return;
    if (armed !== null && adjacent(armed, index)) {
      const direction = index === armed - 1 ? "left" : index === armed + 1 ? "right" : index < armed ? "up" : "down";
      swap(armed, index, direction, "Tap");
    } else if (armed === index) { setArmed(null); setMessage("Choose a tile."); }
    else { setCursor(index); setArmed(index); setMessage("Choose a neighbor."); }
  };
  const restart = () => {
    if (lock.current) return;
    saved.current = false; setBoard(newBoard()); setScore(0); setMoves(START_MOVES); setCursor(0); setArmed(null);
    setPulse(null); setClearing([]); setMotion(null); setSettings(false); setPhase("play");
    setMessage("Fresh crate. Match 3 identical symbols.");
    requestAnimationFrame(() => buttonRefs.current[0]?.focus());
  };
  const saveKeys = () => {
    if (!validKeys(draft)) { setKeyError("Choose four different letter keys."); return; }
    setKeys({ ...draft }); try { localStorage.setItem(KEYS_KEY, JSON.stringify(draft)); } catch {}
    setKeyError(""); setSettings(false); buttonRefs.current[cursor]?.focus();
  };
  const keyboard = event => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); settings ? setSettings(false) : onClose(); return; }
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName) || settings || phase !== "play") return;
    const direction = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[event.key];
    if (direction) {
      event.preventDefault(); if (lock.current) return;
      const next = neighbor(cursor, direction); if (next !== null) { setCursor(next); setArmed(null); buttonRefs.current[next]?.focus(); }
      return;
    }
    const swapDirection = DIRECTIONS.find(d => keys[d] === event.key.toLowerCase());
    if (swapDirection) { event.preventDefault(); if (!event.repeat) swap(cursor, neighbor(cursor, swapDirection), swapDirection, keys[swapDirection].toUpperCase()); }
  };
  const displacement = index => {
    if (!motion || motion.returning || (index !== motion.from && index !== motion.to)) return undefined;
    const target = index === motion.from ? motion.to : motion.from;
    return { transform: `translate(calc(${target % 6 - index % 6} * (100% + var(--am-gap))), calc(${Math.floor(target / 6) - Math.floor(index / 6)} * (100% + var(--am-gap))))` };
  };
  return <div className="album-match am-v33" role="dialog" aria-modal="true" aria-label="Level 3 challenge: Album Match" style={{ "--match-gap": `${gap}px` }} onKeyDown={keyboard}>
    <header><div><small>LEVEL 3 · ALBUM MATCH</small><h1>Album Match</h1></div><div className="game-head-actions"><FullscreenButton /><button type="button" className="btn btn-ghost" onClick={onClose}>✕ Close</button></div></header>
    <div className="am-objective"><strong>Sort the crate: {START_MOVES} matching swaps</strong></div>
    <div className="match-status"><span>Score <strong>{score}</strong></span><span>Swaps left <strong>{moves}</strong></span><span>Best <strong>{best}</strong></span></div>
    <progress className="am-progress" value={START_MOVES - moves} max={START_MOVES} aria-label="Matching swaps toward sorting the crate" />
    <p className="match-message" role="status" aria-live="polite">{message}</p>
    {phase === "play" ? <>
      <div className="match-grid" role="grid" aria-label="Album tiles" aria-busy={busy}>{Array.from({ length: 6 }, (_, row) => <div role="row" className="match-row" key={row}>{board.slice(row * 6, row * 6 + 6).map((type, col) => {
        const index = row * 6 + col, tile = tiles[type], activePulse = pulse?.index === index;
        return <div role="gridcell" key={index}><button type="button" ref={el => buttonRefs.current[index] = el} tabIndex={cursor === index ? 0 : -1}
          className={`match-tile${cursor === index ? " is-cursor" : ""}${armed === index ? " is-armed" : ""}${clearing.includes(index) ? " is-clearing" : ""}${motion && [motion.from, motion.to].includes(index) ? " is-swapping" : ""}`}
          style={{ "--tile-color": COLORS[type], ...displacement(index) }} aria-label={`${tile.title} ${tile.symbol}, row ${row + 1}, column ${col + 1}`} aria-pressed={armed === index}
          onFocus={() => { if (!lock.current) setCursor(index); }} onClick={() => select(index)}
          onPointerDown={event => { if (event.pointerType !== "mouse" && !lock.current) { pointer.current = { x: event.clientX, y: event.clientY, index }; event.currentTarget.setPointerCapture(event.pointerId); } }}
          onPointerCancel={() => pointer.current = null}
          onPointerUp={event => {
            const start = pointer.current; pointer.current = null; if (!start || start.index !== index) return;
            const dx = event.clientX - start.x, dy = event.clientY - start.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
            suppressClick.current = Date.now() + 400;
            const direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "up" : "down";
            setCursor(index); swap(index, neighbor(index, direction), direction, "Swipe");
          }}>
          <img src={tile.src} alt="" draggable="false" /><span className="am-symbol" aria-hidden="true">{tile.symbol}</span>
          {activePulse && <span key={pulse.sequence} className="am-key-flash" aria-hidden="true">{pulse.label} {ARROWS[pulse.direction]}</span>}
        </button></div>;
      })}</div>)}</div>
      <div className="am-controls"><div className="am-swap-pad" role="group" aria-label="Swap selected tile">{DIRECTIONS.map(direction => <button key={direction} type="button" aria-label={`Swap ${direction}`} onClick={() => swap(cursor, neighbor(cursor, direction), direction, "Button")} disabled={busy}>{ARROWS[direction]} <kbd>{keys[direction].toUpperCase()}</kbd></button>)}</div></div>
      <p className="am-selection">Selected: row {Math.floor(cursor / 6) + 1}, column {cursor % 6 + 1} · {member.name}</p>
    </> : <section className={`am-result am-result--${phase}`} tabIndex={-1} ref={resultRef} aria-labelledby="am-result-title">
      <div className="am-result-mark" aria-hidden="true">✓</div><h2 id="am-result-title">Crate sorted!</h2>
      <p>✓ Level 3 · Album Match complete</p>
      <p><strong>{score} points</strong> · {START_MOVES - moves} matching swaps</p><div className="match-actions"><button type="button" className="btn" onClick={restart}>Play again</button><button type="button" className="btn btn-ghost" onClick={onClose}>Back to arcade</button></div>
    </section>}
    <details className="am-how"><summary>Controls</summary><p>Tap two neighbors or swipe a cover. Arrow keys move the cursor. {DIRECTIONS.map(d => `${keys[d].toUpperCase()} = swap ${d}`).join(" · ")}. Match 3 identical symbols in a line. Only matching swaps count.</p></details>
    <div className="match-actions"><button type="button" className="btn btn-ghost" disabled={busy} onClick={restart}>New game</button><button type="button" className="btn btn-ghost" disabled={busy || phase !== "play"} onClick={() => { setDraft(keys); setSettings(!settings); setKeyError(""); }}>Configure keys</button></div>
    {settings && <section className="match-settings"><h2>Swap controls</h2><div>{PRESETS.map(p => <button type="button" className="btn btn-ghost" key={p.name} onClick={() => setDraft(p.keys)}>{p.name}</button>)}</div><div className="match-key-fields">{DIRECTIONS.map(d => <label key={d}>{d}<input value={draft[d]} maxLength={1} onChange={event => setDraft({ ...draft, [d]: event.target.value.toLowerCase() })} /></label>)}</div>{keyError && <p role="alert">{keyError}</p>}<button type="button" className="btn" onClick={saveKeys}>Save keys</button><button type="button" className="btn btn-ghost" onClick={() => setSettings(false)}>Cancel</button></section>}
    <details className="am-scores"><summary>Local scores</summary><SquadScoreboard game="album-match" member={member} image={image} /></details>
  </div>;
}
