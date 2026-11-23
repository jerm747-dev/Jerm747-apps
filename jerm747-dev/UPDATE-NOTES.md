# Returnity Arcade update · 2026-11-23

What this update adds to Nige's arcade on jerm747.dev (`sites/nige-hood/games/`):

- **Returnity: After Hours v0.3.0**, first on the shelf, next to Highway Encore and Flight Control Deck.
- **747 Pocket Player** for every game. **Returnity Edition (amber orange)** is the default finish;
  **Returnity Violet** and Classic Gray are in the Pocket menu.

**Violet revision.** If you already uploaded the first build, these are the only files that
changed: `sites/nige-hood/site.config.json`, `sites/nige-hood/games/site.config.json`,
`games/index.html` (loads `pocket.js?v=2`), `games/pocket/pocket.js`, the new
`games/pocket/pocket-violet.css`, and `games/projects/README.txt`.

## Upload (cPanel File Manager)

The folders in this zip line up with the jerm747.dev web root (the folder that holds `index.html`
and `sites/`). Upload over the top. Don't delete anything first.

```
sites/nige-hood/site.config.json                  games.pocket settings added
sites/nige-hood/games/index.html                  loads pocket/pocket.js and the new bundle
sites/nige-hood/games/site.config.json            same settings as above
sites/nige-hood/games/assets/index-BH6SCTDJ.js    new cabinet bundle (Pocket support)
sites/nige-hood/games/assets/index-Z6AI4AZC.css
sites/nige-hood/games/api/games.php               passes each game's "pocket" settings through
sites/nige-hood/games/pocket/                     the shell: pocket.js, shell/ice/amber/violet CSS, art
sites/nige-hood/games/projects/returnity/         the game, project.json, cover.webp
sites/nige-hood/games/projects/highway-encore/project.json   Pocket button names and hint
sites/nige-hood/games/projects/index.json         fallback list (games.php is used on GoDaddy)
sites/nige-hood/games/projects/README.txt         docs for the new "pocket" block
```

The old bundle (`assets/index-DNl_gcpS.js`, `index-3AbDtr2k.css`) is no longer referenced. It's
harmless to leave on the server and safe to delete. Nothing in `uploads/`, `audio/`, `admin/` or
the music player changed.

For the repo, copy the same `sites/nige-hood/` files into `jerm747-dev/public/sites/nige-hood/`
(I removed the old bundle there).

## How it plays

| Pocket | What it does |
|---|---|
| D-pad (or joystick) | Move. In Returnity, A also confirms menus |
| A / B / X / Y | Returnity: Jump / Fire / Strike (hold to lift) / Backup · Highway Encore: A Jump, X Lift, R Speed |
| START | Pause / resume |
| SELECT | Pocket menu: theme, D-pad or joystick, Music (Highway Encore), full game view, shelf |
| SCREEN | Back to the full game view (the toolbar's **Pocket** button brings it back) |
| ⏏ / CABINET | Eject to the shelf |
| ? | Controls guide |

- Returnity opens in the Pocket the first time. After that, each game remembers whether the
  player last used the Pocket or the full view.
- The theme choice is saved per browser. "Returnity Edition" is the site default, so it follows
  `games.pocket.defaultFinish` if that ever changes.
- A keyboard and real controllers still work while the Pocket is on.

## Site settings (`site.config.json` → `games.pocket`)

```json
"pocket": {
  "enabled": true,
  "defaultFinish": "returnity-amber",
  "finishes": ["auto", "returnity-violet", "classic"],
  "labels": { "auto": "Returnity Edition" },
  "bezelTitle": "JERM747 ARCADE"
}
```

## Checked here

Tested in Chrome at desktop (1280×800) and phone (412×860, touch) sizes:
- Returnity: intro skip, walking and jumping from the Pocket, START pauses and resumes, SELECT
  menu, theme cycling (Returnity Edition → Returnity Violet → Classic Gray), SCREEN to full view and back,
  eject to the shelf, keyboard play while the Pocket is on.
- Highway Encore: start from the title, run and jump, pause.
- `games.php` lists all three games with their Pocket settings.

Not tested here: a physical controller, and real iPhone/Android Safari or Chrome. Try those on
your devices first.
