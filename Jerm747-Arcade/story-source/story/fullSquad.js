/**
 * v68.4 · Full squad for subscribers.
 *
 * Everyone starts on the story squad: OG Jerm, Kiana, Jado and Eli, plus whoever the story and
 * listening minutes have brought in. Subscribers also get a "Full squad" switch at the top of the
 * squad pick window. Turning it on opens every Groove Squad member at once (picks, playlists,
 * scoreboard, the Groove Squad page). The story keeps running underneath: listening minutes still
 * count and new-member announcements still play, and switching back shows the story squad again.
 *
 * Subscriber status comes from /assets/jerm747-account.js (window.Jerm747Account). If that script
 * isn't on the page or the account server isn't set up yet, nobody is a subscriber and nothing changes.
 * The on/off choice is saved on this device.
 */
import { useSyncExternalStore } from "react";

const FULL_KEY = "jerm747.squad.fullSquad";
let fullSubscribed = false;
let fullChosen = false;
try { fullChosen = localStorage.getItem(FULL_KEY) === "1"; } catch { /* private mode */ }

const fullListeners = new Set();
const emitFull = () => fullListeners.forEach((fn) => fn());
let fullSnap = { available: false, on: false };
const refreshFull = () => {
  const next = { available: fullSubscribed, on: fullSubscribed && fullChosen };
  if (next.available !== fullSnap.available || next.on !== fullSnap.on) { fullSnap = next; emitFull(); }
};

/** Is this visitor a subscriber right now? (plain function, for squad arrivals) */
export const subscriberNow = () => fullSubscribed;

/** Is the full squad open right now? (plain function, for squad.js isUnlocked) */
export const fullSquadActive = () => fullSnap.on;

export function setFullSquad(on) {
  fullChosen = !!on;
  try { on ? localStorage.setItem(FULL_KEY, "1") : localStorage.removeItem(FULL_KEY); } catch { /* fine */ }
  refreshFull();
}

/** { available: subscriber?, on: full squad showing? } and re-renders when either changes */
export const useFullSquad = () =>
  useSyncExternalStore((fn) => { fullListeners.add(fn); return () => fullListeners.delete(fn); }, () => fullSnap, () => fullSnap);

// Follow the account script. It may load after the app, so wait for it briefly.
if (typeof window !== "undefined") {
  const hook = (A) => {
    const read = () => { try { fullSubscribed = !!A.state()?.subscribed; } catch { fullSubscribed = false; } refreshFull(); };
    A.on("change", read);
    read();
  };
  if (window.Jerm747Account) hook(window.Jerm747Account);
  else {
    let tries = 0;
    const t = setInterval(() => {
      if (window.Jerm747Account) { clearInterval(t); hook(window.Jerm747Account); }
      else if (++tries > 40) clearInterval(t); // ~10 s: the account script isn't on this page
    }, 250);
  }
}
