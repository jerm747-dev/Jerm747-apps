// Fallback production build without Vite (same output layout as `vite build`):
// dist/index.html + dist/assets/index-<hash>.{js,css} + everything in public/.
// Used when Vite can't be installed; `npm run build` remains the normal path.
import { build } from 'esbuild';
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });
const r = await build({
  entryPoints: { index: 'src/main.jsx' }, bundle: true, minify: true, format: 'esm', target: 'es2020',
  outdir: 'dist/assets', entryNames: '[name]-[hash]', jsx: 'automatic', metafile: true,
  loader: { '.svg': 'dataurl', '.png': 'file', '.jpg': 'file' }, external: ['/cabinet/*', '/projects/*', '/favicon.svg'],
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
});
const outs = Object.keys(r.metafile.outputs).map(p => p.replace(/^dist\//, '/'));
const js = outs.find(p => p.endsWith('.js')), css = outs.find(p => p.endsWith('.css'));
let html = readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="/src/main.jsx"></script>', '')
  .replace('</head>', `    <script type="module" crossorigin src="${js}"></script>\n${css ? `    <link rel="stylesheet" crossorigin href="${css}">\n` : ''}  </head>`);
cpSync('public', 'dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log('built', js, css);
