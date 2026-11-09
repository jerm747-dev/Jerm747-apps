import { useSyncExternalStore } from "react";
import { LINEUP_EXTRAS } from "./fullLineup.js";
import { subscriberNow } from "./fullSquad.js";
import { lineupArrivalsOn, arrivalStepSeconds } from "./squadSettings.js";
export const LISTEN_KEY = "jerm747.squad.listen-seconds";
export const LISTEN_UNLOCKS = [{name:"Honest",at:600},{name:"SimCity",at:1200},{name:"Nige Hood",at:1800},{name:"LyfeLong",at:2400}];
let arrivals = [];
/*
 * v72.2 · After the story members (LyfeLong at 40 min), every further 30 minutes of listening (set on /admin/chart, v95) brings one
 * random member of the subscriber lineup (numbers 11–40) to non-subscribers: an arrival pop-up, then a ★ card
 * on the Groove Squad carousel. They aren't playable until you subscribe. Switched on/off for the whole site on
 * /admin/chart (squadSettings.js). Members who arrived stay; their order is saved on this browser.
 */
export const LINEUP_START = 2400;
/* v95: minutes between lineup arrivals come from /admin/chart (default 30, was a fixed 10) */
export const lineupStep = () => arrivalStepSeconds();
/* v95: "Silence new-member pop-ups": members still arrive (carousel, squad bubble), the pop-up just doesn't show */
const QUIET_KEY = "jerm747.squad.arrivalsQuiet";
let arrivalsQuiet = false; try { arrivalsQuiet = localStorage.getItem(QUIET_KEY) === "1"; } catch {}
const quietListeners = new Set();
export function setArrivalsQuiet(on) { arrivalsQuiet = !!on; try { localStorage.setItem(QUIET_KEY, on ? "1" : "0"); } catch {} quietListeners.forEach(fn => fn()); }
export const useArrivalsQuiet = () => useSyncExternalStore(fn => { quietListeners.add(fn); return () => quietListeners.delete(fn); }, () => arrivalsQuiet, () => arrivalsQuiet);
const ARRIVED_KEY = "jerm747.squad.lineup-arrived";
const lineupIds = new Set(LINEUP_EXTRAS.map(m => m.id));
let lineupArrived = [];
try { const a = JSON.parse(localStorage.getItem(ARRIVED_KEY) || "[]"); if (Array.isArray(a)) lineupArrived = a.filter(id => lineupIds.has(id)); } catch {}
const lineupListeners = new Set();
export const useLineupArrived = () => useSyncExternalStore(fn => { lineupListeners.add(fn); return () => lineupListeners.delete(fn); }, () => lineupArrived, () => lineupArrived);
export const lineupArrivalsActive = () => lineupArrivalsOn() && !subscriberNow() && lineupArrived.length < LINEUP_EXTRAS.length;
function lineupArrive() {
  const left = LINEUP_EXTRAS.filter(m => !lineupArrived.includes(m.id));
  if (!left.length) return;
  const m = left[Math.floor(Math.random() * left.length)];
  lineupArrived = [...lineupArrived, m.id];
  try { localStorage.setItem(ARRIVED_KEY, JSON.stringify(lineupArrived)); } catch {}
  lineupListeners.forEach(fn => fn());
  arrivals = [...arrivals, { name: m.name, id: m.id, lineup: true }]; saveArrivals(); arrivalListeners.forEach(fn => fn());
}
const arrivalListeners = new Set();
const saveArrivals = () => { try { localStorage.setItem("jerm747.squad.arrivals", JSON.stringify(arrivals)); } catch {} };
export function dismissArrival() { arrivals = arrivals.slice(1); saveArrivals(); arrivalListeners.forEach(fn => fn()); }
export const useSquadArrivals = () => useSyncExternalStore(fn => { arrivalListeners.add(fn); return () => arrivalListeners.delete(fn); }, () => arrivals, () => arrivals);
let seconds = 0;
try { const v = Number(localStorage.getItem(LISTEN_KEY)); if (Number.isFinite(v) && v > 0) seconds = v; } catch {}
try { const pending = JSON.parse(localStorage.getItem("jerm747.squad.arrivals") || "[]"); if (Array.isArray(pending)) arrivals = pending.map(p => p?.lineup ? (lineupArrived.includes(p.id) ? { name: p.name, id: p.id, lineup: true } : null) : LISTEN_UNLOCKS.find(u => u.at === p?.at && u.name === p?.name && seconds >= u.at)).filter(Boolean); } catch {}
const listeners = new Set();
let lastSaved = seconds;
export function saveListening() { try { localStorage.setItem(LISTEN_KEY, String(seconds)); lastSaved = seconds; } catch {} }
export function addListening(amount) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 30) return;
  const before = seconds; seconds += amount;
  for (const u of LISTEN_UNLOCKS) if (before < u.at && seconds >= u.at) { saveListening(); arrivals = [...arrivals, u]; saveArrivals(); arrivalListeners.forEach(fn => fn()); }
  // One lineup member per 10 minutes crossed (never a flood, even after a long time with arrivals off)
  const STEP = lineupStep();
  if (seconds >= LINEUP_START + STEP && Math.floor((before - LINEUP_START) / STEP) < Math.floor((seconds - LINEUP_START) / STEP) && lineupArrivalsActive()) { saveListening(); lineupArrive(); }
  if (seconds - lastSaved >= 5) saveListening();
  listeners.forEach(fn => fn());
}
export const useListeningSeconds = () => useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => seconds, () => 0);
// Use audio progress and elapsed time together: seeking, pauses and buffering earn no time.
export function heardSeconds(previous, current, elapsed, rate = 1) {
  const delta = current - previous;
  if (!Number.isFinite(delta) || !Number.isFinite(elapsed) || delta <= 0 || elapsed <= 0 || elapsed > 30 || delta > elapsed * Math.max(rate, 1) + 0.75) return 0;
  return Math.min(elapsed, delta / Math.max(rate, 0.1));
}
