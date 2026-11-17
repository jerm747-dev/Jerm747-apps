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
node cli/meshlab.mjs <input.zip|.fbx|.glb> --target 4000 [--tex 1024] [--out x.glb] [--yup]
```

- `input`: a Meshy zip (binary FBX + `*_texture/_normal/_metallic/_roughness.png`), a bare
  binary FBX with its PNGs beside it, or a GLB (for example an earlier Mesh Lab export).
- `--target`: triangle count to reduce to (default 41460).
- `--tex`: largest texture side in pixels (default 1024).
- `--out`: output file (default: next to the input, named `<name>_<tris>tris.glb`).
- `--yup`: rotate Meshy's Z-up geometry to Y-up. Without it the raw Z-up geometry is kept.

What it does: welds seams, vertex-clusters huge meshes to about 40x the target, then quadric
edge collapse to the target, keeping UVs. Normals are smoothed except across 60° creases. The
material is clean PBR: emissive off, base colour, normal map, and Meshy's metallic/roughness
packed into one texture (G = roughness, B = metal).
