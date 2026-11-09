import { useFullSquad } from "../fullSquad.js";
import { useState } from "react";
import { SCORE_GAMES, formatScore, resetGameScores, useSquadScores } from "../squadScores.js";
import { SQUAD, faceStyle, isUnlocked, squadById } from "../squad.js";
import { useListeningSeconds } from "../squadUnlocks.js";

/** A member's face: framed from their artwork when we know where the face is, otherwise the picture itself */
function Face({ m, src, className = "" }) {
  const known = m && squadById.get(m.id);
  if (known?.face && (!src || src === known.image)) return <span className={`${className} face-crop`} style={faceStyle(known)} aria-hidden="true" />;
  return <img className={className} src={src || m?.image} alt="" />;
}

/**
 * Score cards for one mini-game: every squad member this visitor has unlocked, with their plays,
 * best and wins on this device. Tap a card to play the next round as that character.
 */
export function SquadScoreboard({ game, member, image, roster = [], onChoose }) {
  const all = useSquadScores();
  const listening = useListeningSeconds();
  const full = useFullSquad(); // v68.4: re-render when a subscriber turns Full squad on/off
  const cfg = SCORE_GAMES[game];
  const [confirm, setConfirm] = useState(false);
  if (!cfg) return null;
  // No roster given: everyone this visitor has unlocked (the Manager isn't a player)
  const list = [...(roster.length ? roster : SQUAD.filter((m) => m.id !== "manager" && isUnlocked(m, listening)))];
  if (member && !list.some((m) => m.id === member.id)) list.unshift(member);
  const stat = (e) => {
    if (cfg.best) return e?.best != null ? `Best ${formatScore(game, e.best)}${cfg.unit && cfg.unit !== "time" ? ` ${cfg.unit}` : ""}` : "No best yet";
    return `${e?.wins || 0} ${cfg.total || "wins"}`;
  };
  return (
    <section className="squad-scoreboard" aria-label={`${cfg.title} scores by character`}>
      <h2>Squad scores · {cfg.title}</h2>
      <div className="squad-score-row">
        {list.map((m) => {
          const e = all[game]?.[m.id];
          const on = m.id === member?.id;
          return (
            <button key={m.id} type="button" className={`squad-score-card${on ? " is-selected" : ""}`} aria-pressed={on}
              disabled={!onChoose} onClick={() => onChoose?.(m)}>
              <Face m={m} src={on && image ? image : m.image} />
              <strong>{m.name}</strong>
              <span className="squad-score-main">{stat(e)}</span>
              <span className="squad-score-sub">{e?.plays || 0} {e?.plays === 1 ? "round" : "rounds"}{cfg.best && e?.wins ? ` · ${e.wins} ${e.wins === 1 ? "win" : "wins"}` : ""}</span>
            </button>
          );
        })}
      </div>
      <p className="squad-score-note">Saved on this browser{onChoose ? " · Tap a character to play as them" : ""}</p>
      {confirm ? (
        <div className="squad-score-confirm" role="group" aria-label="Confirm score reset">
          <span>Clear every character’s {cfg.title} scores?</span>
          <button type="button" className="btn btn-ghost" onClick={() => { resetGameScores(game); setConfirm(false); }}>Clear</button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>Keep</button>
        </div>
      ) : <button type="button" className="text-btn squad-score-reset" onClick={() => setConfirm(true)}>Reset scores…</button>}
    </section>
  );
}

/**
 * Challenge mode start screen — shown once the level's story has been completed.
 * Pick a character on the scoreboard, start a round, or replay the story.
 */
export function ChallengeLobby({ game, level, blurb, member, image, roster, onChoose, onStart, onStory, startRef, startLabel = "Start challenge" }) {
  return (
    <section className="challenge-lobby">
      <p className="eyebrow">Level {level} · Challenge mode</p>
      <div className="challenge-player">
        {image && <Face m={member} src={image} />}
        <div><strong>Playing as {member?.name}</strong><p>{blurb}</p></div>
      </div>
      <div className="challenge-actions">
        <button ref={startRef} type="button" className="btn btn-play" onClick={onStart}>{startLabel}</button>
        {onStory && <button type="button" className="btn btn-ghost" onClick={onStory}>Replay story</button>}
      </div>
      <SquadScoreboard game={game} member={member} image={image} roster={roster} onChoose={onChoose} />
    </section>
  );
}
