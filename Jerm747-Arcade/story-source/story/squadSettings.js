/**
 * v72.2 · Groove Squad site settings (api/squad-settings.php), switched on /admin/chart.
 *   lineupArrivals — non-subscribers keep meeting new members from the subscriber lineup every 10 minutes
 *   of listening (after the story members). Default on.
 *   arrivalMinutes — v95: minutes of listening between those arrivals. Default 30. Cached on the device so it works offline.
 */
import { createElement as h, useSyncExternalStore } from "react";
import { getToken as getAdminToken } from "./admin.js";

const API = "/api", KEY = "jerm747.squad.settings";
/* v95: minutes of listening between lineup arrivals (after the story members). Default 30. */
export const ARRIVAL_MINUTE_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120];
function okMinutes(m) { return Number.isInteger(m) && m >= 5 && m <= 240; }
const subs = new Set();
let state = { lineupArrivals: true, arrivalMinutes: 30, loaded: false, save: "idle", error: "" };
try { const c = JSON.parse(localStorage.getItem(KEY) || "null"); if (c && typeof c.lineupArrivals === "boolean") state = { ...state, lineupArrivals: c.lineupArrivals }; if (c && okMinutes(c.arrivalMinutes)) state = { ...state, arrivalMinutes: c.arrivalMinutes }; } catch { /* private mode */ }
const set = (p) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const cache = () => { try { localStorage.setItem(KEY, JSON.stringify({ lineupArrivals: state.lineupArrivals, arrivalMinutes: state.arrivalMinutes })); } catch { /* fine */ } };

export const lineupArrivalsOn = () => state.lineupArrivals;
export const arrivalStepSeconds = () => (okMinutes(state.arrivalMinutes) ? state.arrivalMinutes : 30) * 60;
export const useSquadSettings = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state, () => state);



/** Admin: minutes of listening between arrivals (saved for the whole site). v95 */
export async function setArrivalMinutes(minutes, getToken = getAdminToken) {
  const m = Number(minutes); if (!okMinutes(m)) return;
  const before = state.arrivalMinutes;
  set({ arrivalMinutes: m, save: "saving", error: "" });
  const token = getToken?.() || "";
  try {
    if (!token) throw new Error("Please sign in again to save.");
    const r = await fetch(`${API}/squad-settings.php`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "X-Admin-Token": token }, body: JSON.stringify({ arrivalMinutes: m }) });
    const d = (r.headers.get("content-type") || "").includes("json") ? await r.json() : null;
    if (!r.ok || !d || !okMinutes(d.arrivalMinutes)) throw new Error(d?.error || (r.ok ? "Upload the new api/squad-settings.php (v95) to save this." : `The server answered ${r.status}.`));
    set({ arrivalMinutes: d.arrivalMinutes, save: "saved" }); cache();
    setTimeout(() => { if (state.save === "saved") set({ save: "idle" }); }, 3000);
  } catch (e) { set({ arrivalMinutes: before, save: "error", error: e.message || "Couldn't save." }); }
}

/** Admin: switch arrivals on/off for non-subscribers (saved for the whole site). */
export async function setLineupArrivals(on, getToken = getAdminToken) {
  const before = state.lineupArrivals;
  set({ lineupArrivals: !!on, save: "saving", error: "" });
  const token = getToken?.() || "";
  try {
    if (!token) throw new Error("Please sign in again to save.");
    const r = await fetch(`${API}/squad-settings.php`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "X-Admin-Token": token }, body: JSON.stringify({ lineupArrivals: !!on }) });
    const d = (r.headers.get("content-type") || "").includes("json") ? await r.json() : null;
    if (!r.ok || !d || typeof d.lineupArrivals !== "boolean") throw new Error(d?.error || `The server answered ${r.status}.`);
    set({ lineupArrivals: d.lineupArrivals, save: "saved" }); cache();
    setTimeout(() => { if (state.save === "saved") set({ save: "idle" }); }, 3000);
  } catch (e) { set({ lineupArrivals: before, save: "error", error: e.message || "Couldn't save." }); }
}

/** Admin chart panel: "Squad arrivals" on/off. */
export function SquadArrivalsSetting() {
  const s = useSquadSettings();
  const note = s.save === "saving" ? "Saving…" : s.save === "saved" ? "Saved ✓" : s.save === "error" ? `Not saved — ${s.error}` : "";
  return h("section", { className: "squad-setting", "aria-label": "Groove Squad arrivals" },
    h("label", { className: "squad-setting-row" },
      h("input", { type: "checkbox", checked: s.lineupArrivals, disabled: s.save === "saving", onChange: (e) => setLineupArrivals(e.target.checked) }),
      h("span", null, h("b", null, "Squad arrivals for non-subscribers"),
        h("small", null, s.lineupArrivals
          ? `On · after the story members, a random member of the subscriber lineup arrives every ${s.arrivalMinutes} minutes of listening (shown with a ★, not playable).`
          : "Off · non-subscribers keep the story squad. Members who already arrived stay. Subscribers always have all 40."))),
    h("label", { className: "squad-setting-row squad-setting-minutes" },
      h("span", null, h("b", null, "Minutes of listening between arrivals"),
        h("small", null, "After the first four story members (Honest, SimCity, Nige Hood, LyfeLong). Default 30.")),
      h("select", { value: s.arrivalMinutes, disabled: s.save === "saving" || !s.lineupArrivals, onChange: (e) => setArrivalMinutes(Number(e.target.value)), "aria-label": "Minutes between arrivals" },
        ...[...new Set([...ARRIVAL_MINUTE_CHOICES, s.arrivalMinutes])].sort((x, y) => x - y).map((m) => h("option", { key: m, value: m }, `${m} min`)))),
    note && h("span", { className: `squad-setting-note is-${s.save}`, role: "status" }, note));
}
