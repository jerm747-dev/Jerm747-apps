# Returnity (game) · workshop notes

Placeholder started 2026-11-21. The folder is live on jerm747.games so the shelf tile, link and
cover exist while the game is built. Everything here is a starting point to work from.

## What's in the folder now

| File | What it is |
|---|---|
| `returnity/index.html` | Placeholder title page (cover art, short pitch, buttons to Encore and CD Man) |
| `projects/returnity/` | Shelf entry: `project.json` (status `prototype`, order 10, ahead of Encore and CD Man), redirect `index.html`, placeholder `cover.webp` (Encore and CD Man art split; swap for real Returnity art) |

Shelf link: `jerm747.games/#/play/returnity`. To hide it while you work, add `"hidden": true` to
`projects/returnity/project.json`.

## The idea

Returnity = CD Man's world and pacing + Encore's hero and moves.

- **Keep from Encore (the hero):** the full move set in `encore/street-game.js`
  - run with speed latch and skid, coyote time + jump buffer (`hop`)
  - double hop (`doubleHop`, one air jump)
  - front flip (`flip`, rotates through the jump) and flip + down = ground pound (`startPound` / `poundImpact`)
  - dive (`dive`)
  - duck / squat, drop through wood platforms (`dropDown`, `dropSurface`)
  - throw fire (`throwFire`, ammo + cooldown), flashlight after the party, talk to NPCs (`talk`)
- **Keep from CD Man (the world):** `encore/cd-man/routes.js` legs (highway → subway), critters
  (cocoa, crown, peach, marker, shield, spike), bump blocks, music notes, thrown discs, crates and
  checkpoints from `cd-man/game.js`.
- **Replace / merge:** CD Man's disc throw vs Encore's fire throw. Pick one as the main projectile
  (discs fit the album theme), or let the fire stay as a power-up.

## Scale (the main technical job)

The two games run at different sizes, so the moves need re-tuning, not just copying.

| | Encore | CD Man |
|---|---|---|
| Hero height | 128 px | 58 px (duck 43) |
| Ground line | y 770 in a 1672 × 941 area | y 340, 850 px view |
| Feel | big, roomy chapters | fast, long runs |

Options to decide:
1. **Encore scale** (hero 128 px): rebuild CD Man routes ~2.2× larger. Best for the hero art and moves;
   fewer critters on screen.
2. **CD Man scale** (hero 58 px): scale Encore's jump heights, run speed, dive and pound distances by
   ~0.45. Keeps CD Man's long routes; the hero sprite gets small on phones.
3. **Middle** (~80–90 px hero, view ~1100 px wide): both sides scale, likely the best compromise for
   portrait phones and the Pocket Player.

Whatever the scale, move the physics numbers (gravity, hop speed, double-hop speed, dive, pound) into
one tuning table so they scale from a single `HERO_SCALE`.

## Suggested build order

1. Copy CD Man into `returnity/` as the base (routes, critters, blocks, camera, HUD).
2. Swap in Encore's player update and input (flip, double hop, dive, pound, drop-through) at the
   chosen scale.
3. Hero sprites: Nige as the Returnity hero (Encore art direction), plus the disc throw.
4. Music: Returnity album tracks through the arcade game-music player.
5. Controls: same controller / keyboard / touch layouts as Encore, plus Pocket Player buttons.
6. When it's ready: decide whether Encore and CD Man stay on the shelf or move to an archive.

## Open questions

- Which scale (1, 2 or 3)?
- Is Returnity one long run like CD Man, or chapters like Encore (day → night after the party)?
- Projectile: discs, fire, or both?
- Does this also become the game on Nige's Returnity site (returnity.live) through Sound Arcade?
