/**
 * Groove Squad scorekeeper — one tally per mini-game per squad member, saved on this device.
 * Every replayable game records its rounds here, so players can pick a character, play again,
 * and see everyone's numbers side by side.
 *
 * Stored as { [gameId]: { [memberId]: { plays, wins, best, total, last } } }
 */
import { useSyncExternalStore } from "react";

const KEY = "jerm747.squad.scores";

/** What each game counts. best: "high" (bigger is better), "low" (faster is better) or null. */
export const SCORE_GAMES = {
  "find-key":      { title: "Find the Key",    level: 1,  best: "high", unit: "keys",   total: "keys found" },
  "tempo":         { title: "Find the Tempo",  level: 2,  best: "high", unit: "in a row", total: "tempo locks" }, // best: hardest clear (3 Medium, 5 Hard)
  "album-match":   { title: "Album Match",     level: 3,  best: "high", unit: "points" },
  "flashcards":    { title: "Flashcards",      level: 4,  best: "high", unit: "words",  total: "words studied" },
  "word-search":   { title: "Word Search",     level: 5,  best: "low",  unit: "time" },
  "power":         { title: "Lights Back Up",  level: 6,  best: "low",  unit: "time" },
  "plugin-twist":  { title: "Plugin Twist",    level: 7,  best: "high", unit: "points" },
  "follow-kiana":  { title: "Follow Kiana",    level: 9,  best: "low",  unit: "time" },
  "follow-kiana-medium": { title: "Follow Kiana · Medium", level: 9, best: "low", unit: "time" },
  "catalog-clash": { title: "Catalog Clash",   level: 10, best: "high", unit: "HP left" },
  "catalog-arcade-easy": {"title": "Squad Arcade \u00b7 Easy", "level": 10, "best": "high", "unit": "points"},
  "catalog-arcade-medium": {"title": "Squad Arcade \u00b7 Medium", "level": 10, "best": "high", "unit": "points"},
  "catalog-arcade-hard": {"title": "Squad Arcade \u00b7 Hard", "level": 10, "best": "high", "unit": "points"},

};

const clean = (raw) => {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [game, members] of Object.entries(raw)) {
    if (!SCORE_GAMES[game] || !members || typeof members !== "object") continue;
    out[game] = {};
    for (const [id, s] of Object.entries(members)) {
      if (!s || typeof s !== "object") continue;
      const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
      out[game][id] = { plays: n(s.plays), wins: n(s.wins), total: n(s.total), best: Number.isFinite(s.best) ? s.best : null, last: Number.isFinite(s.last) ? s.last : null };
    }
  }
  return out;
};

let scores = {};
try { scores = clean(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { scores = {}; }
const listeners = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(scores)); } catch { /* private mode */ } listeners.forEach((l) => l()); };
const entry = (game, id) => scores[game]?.[id] || { plays: 0, wins: 0, total: 0, best: null, last: null };

/**
 * One finished round for a member.
 *   score: the round's number (points, keys, seconds…) — compared with best per SCORE_GAMES
 *   won:   counts toward wins
 *   total: added to the running total (defaults to score for "high" games)
 */
export function recordRound(game, memberId, { score = null, won = false, total } = {}) {
  const cfg = SCORE_GAMES[game];
  if (!cfg || !memberId) return;
  const e = { ...entry(game, memberId) };
  e.plays += 1;
  if (won) e.wins += 1;
  if (Number.isFinite(score)) {
    e.last = score;
    if (cfg.best && (won || cfg.best === "high")) {
      if (e.best == null || (cfg.best === "high" ? score > e.best : score < e.best)) e.best = score;
    }
  }
  const add = total ?? (cfg.best === "high" && Number.isFinite(score) ? score : 0);
  if (Number.isFinite(add)) e.total += add;
  scores = { ...scores, [game]: { ...(scores[game] || {}), [memberId]: e } };
  save();
}

/** Add to a member's running total without finishing a round (e.g. one flashcard studied). */
export function addToTotal(game, memberId, amount = 1) {
  if (!SCORE_GAMES[game] || !memberId) return;
  const e = { ...entry(game, memberId), total: entry(game, memberId).total + amount };
  scores = { ...scores, [game]: { ...(scores[game] || {}), [memberId]: e } };
  save();
}

export function resetGameScores(game) {
  const { [game]: _, ...rest } = scores;
  scores = rest;
  save();
}

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const useSquadScores = () => useSyncExternalStore(subscribe, () => scores, () => scores);

/** "1:42" for seconds, plain numbers otherwise */
export function formatScore(game, value) {
  if (value == null) return "—";
  if (SCORE_GAMES[game]?.unit === "time") {
    const s = Math.round(value);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  return Math.round(value).toLocaleString("en-US");
}

/** Everything a member has played, for the squad page */
export function memberSummary(all, memberId) {
  let plays = 0, wins = 0;
  for (const g of Object.keys(SCORE_GAMES)) { const e = all[g]?.[memberId]; if (e) { plays += e.plays; wins += e.wins; } }
  return { plays, wins };
}
