// Moves big inline base64 pictures and models out of a single-file game into an assets/ folder,
// so the game page loads in a few hundred KB and the art streams in after it.
// Usage: node scripts/split-assets.mjs public/projects/nova-swarm [public/projects/destination-chess ...]
// The game keeps working the same; only data: URIs of 4 KB or more are moved. Safe to run again.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'model/gltf-binary': 'glb' };
const MIN = 4096;

for (const dir of process.argv.slice(2)) {
  const file = join(dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  let moved = 0, bytes = 0;
  const out = html.replace(/data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g, (all, type, b64) => {
    if (!EXT[type] || b64.length < MIN) return all;
    const buf = Buffer.from(b64, 'base64');
    const name = `${createHash('sha1').update(buf).digest('hex').slice(0, 12)}.${EXT[type]}`;
    writeFileSync(join(dir, 'assets', name), buf);
    moved++; bytes += buf.length;
    return `assets/${name}`;
  });
  writeFileSync(file, out);
  console.log(`${dir}: moved ${moved} files (${(bytes / 1048576).toFixed(1)} MB); page ${(html.length / 1048576).toFixed(1)} MB -> ${(out.length / 1048576).toFixed(2)} MB`);
}
