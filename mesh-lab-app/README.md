# 747 Mesh Lab (offline build)

Reduces Meshy models to a target triangle count in the browser.
Drop in GLB, FBX, OBJ or a zip (model + textures) and get a GLB back.
You can drop several files at once to run them as a batch at the baseline (41,460).

## Build

```bash
npm install
npm run build
```

The result is a single file: `dist/index.html`. Copy it anywhere (rename it to
`747-mesh-lab.html` if you like) and double-click it. It works with no internet.

## Develop

```bash
npm run dev
```

Opens a local server with hot reload. The app code is in `src/main.js`.
The page layout and styles are in `index.html`.

## Change the baseline

Edit `DEFAULT_TARGET` near the top of `src/main.js`, then rebuild.
The batch box default is the `value="41460"` on `#batchTarget` in `index.html`.

## Notes

- Fonts fall back to your system fonts so nothing loads from the web.
- Downloads use a normal browser download outside Claude.
- Draco-compressed GLBs aren't supported yet. Export from Meshy without compression.
