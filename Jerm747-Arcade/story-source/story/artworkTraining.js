import { useSyncExternalStore } from "react";
import { setColorfulCovers } from "./covers.js";
let state = null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());
export const REVEAL_KEY = "jerm747.games.manager.revealed";
export function openArtworkMatch(member, image) {
  let unlocked = state?.phase === "won";
  try { unlocked ||= localStorage.getItem(REVEAL_KEY) === "1"; } catch {}
  if (!unlocked) return;
  state = { phase: "match", member, image, original: true }; emit();
}
export function startArtworkTraining(member, image) {
  if (state) return;
  let original = true;
  try { original = localStorage.getItem("jerm747.covers.colorful") !== "0"; } catch {}
  state = { phase: "story", step: 0, member, image, original };
  setColorfulCovers(false);
  emit();
}
export function advanceArtworkTraining() {
  if (!state) return;
  state = state.step < 2 ? { ...state, step: state.step + 1 } : { ...state, phase: "hunt" };
  emit();
}
export function recoverArtworkMenu() {
  if (state?.phase !== "hunt" || state.menuRecovered) return;
  state = { ...state, menuRecovered: true }; emit();
}
export function restoreArtworkColors() {
  if (state?.phase !== "hunt" || !state.menuRecovered) return;
  setColorfulCovers(true); winArtworkTraining();
}
export function winArtworkTraining() {
  if (state?.phase !== "hunt") return;
  state = { ...state, phase: "won" };
  try { localStorage.setItem(REVEAL_KEY, "1"); } catch {}
  emit();
}
export function closeArtworkTraining() {
  if (!state) return;
  if (state.phase !== "won" && state.phase !== "match") setColorfulCovers(state.original);
  state = null; emit();
}
export const useArtworkTraining = () => useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state, () => null);
