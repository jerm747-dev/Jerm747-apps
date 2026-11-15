// After `vite build`: replace the Android app's web files with the fresh build in dist/.
// Run from beat-room-source:  npm run android
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const assets = fileURLToPath(new URL('../../app/src/main/assets/', import.meta.url));
if (!existsSync(dist)) { console.error('No dist/ yet. Run npm run build first.'); process.exit(1); }
rmSync(assets, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });
cpSync(dist, assets, { recursive: true });
console.log('Android assets updated from dist/');
