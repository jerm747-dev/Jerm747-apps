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

## Command line (747 Mesh Lab CLI)

For exports too big for the browser (Meshy FBX zips of 250–380 MB, millions of triangles).
Plain Node 18+, no `npm install` needed.

```bash
node cli/meshlab.mjs <input.zip|.fbx|.glb> --target 4000 [--tex 1024] [--out x.glb] [--yup] [--bake] [--card]
```

- `input`: a Meshy zip (binary FBX + `*_texture/_normal/_metallic/_roughness.png`), a bare
  binary FBX with its PNGs beside it, or a GLB (for example an earlier Mesh Lab export).
- `--target`: triangle count to reduce to (default 41460).
- `--tex`: largest texture side in pixels (default 1024).
- `--out`: output file (default: next to the input, named `<name>_<tris>tris.glb`).
- `--yup`: rotate Meshy's Z-up geometry to Y-up. Without it the raw Z-up geometry is kept.
- `--bake`: give the reduced mesh its own UV atlas and rebake its textures from the full-detail
  model: base colour, metal/roughness, and a tangent-space normal map (geometry detail plus Meshy's
  normal map). Tangents are written into the GLB. Inputs over 1.5M triangles bake from a ~300k-triangle
  intermediate to keep memory down.
- `--card`: also render the full-detail model from 4 side angles (0/45/90/135°) into trimmed,
  transparent PNGs (`<name>_card000.png`…, `--tex` pixels across) for crossed-card billboards.
  This is the main path for plants. `<name>_cards.json` gives each card's world size and where it
  goes: a quad from `origin` (bottom-left), `width` along `right` and `height` along `up`.

What it does: welds seams, vertex-clusters huge meshes to about 40x the target, then quadric
edge collapse to the target, keeping UVs. Normals are smoothed except across 60° creases. The
material is clean PBR: emissive off, base colour, normal map, and Meshy's metallic/roughness
packed into one texture (G = roughness, B = metal).

### Settings on the page, and handing big files to the CLI

The page's **Settings** card holds your **baseline**, the triangle count every batch is reduced to
and where single models start; the "My baseline" preset follows it. It also holds the **size
limit** above which files go to the CLI instead of the browser (default 150 MB). Both are saved in
your browser.

Files over the limit (a zip, FBX or GLB) are not opened in the browser:

- **With `npm run dev` (or `npm run preview`)**, the page sends them to `cli/meshlab.mjs` on your
  computer (through `cli/vite-plugin.mjs`), reduces them to your baseline with `--yup`, and shows
  the result in the viewer. "Download GLB" then saves the CLI's file unchanged, unless you move the
  slider lower first. Big files in a batch are handled the same way.
- **Anywhere else** (the single-file `dist/index.html`, or the page inside Claude), the page shows
  the exact command to run, plus a "Try it in the browser anyway" button.

