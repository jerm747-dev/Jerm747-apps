import React from 'react';
const KEY = 'jerm747.arcade.album-match.rounds';
function rounds() { try { const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]; } catch { return []; } }
export function recordRound(game, member, result) { try {localStorage.setItem(KEY,JSON.stringify([...rounds(),{...result,at:Date.now()}].slice(-30)));} catch {} }
export function SquadScoreboard() { const r=rounds();return <p>{r.length ? `${r.length} completed rounds · Best ${Math.max(...r.map(x=>Number(x.score)||0))} points on this device` : 'Complete a round to record a local score.'}</p>; }
export function FullscreenButton() {return <button className="btn btn-ghost" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}}}>Fullscreen</button>;}
