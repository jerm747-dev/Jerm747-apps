// Getting files out: a plain download on your own site; inside the Claude preview the platform
// only allows some file types, so .mid / .mp3 / .mlane go out wrapped in a .zip there.
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** One file, stored (no compression). */
export function zip(name, u8) {
  const nm = new TextEncoder().encode(name), crc = crc32(u8);
  const lh = new DataView(new ArrayBuffer(30)); [[0, 0x04034b50, 4], [4, 20, 2], [8, 0, 2], [14, crc, 4], [18, u8.length, 4], [22, u8.length, 4], [26, nm.length, 2]].forEach(([o, v, s]) => (s === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
  const cd = new DataView(new ArrayBuffer(46)); [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [16, crc, 4], [20, u8.length, 4], [24, u8.length, 4], [28, nm.length, 2]].forEach(([o, v, s]) => (s === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true)));
  const cdOff = 30 + nm.length + u8.length;
  const end = new DataView(new ArrayBuffer(22)); [[0, 0x06054b50, 4], [8, 1, 2], [10, 1, 2], [12, 46 + nm.length, 4], [16, cdOff, 4]].forEach(([o, v, s]) => (s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  return new Blob([lh, nm, u8, cd, nm, end], { type: 'application/zip' });
}

const inClaude = () => typeof window.claude === 'object' && window.claude && typeof window.claude.use === 'function';
let dlP = null;
/** Save bytes as a file. Returns a short message for the status line. */
export async function saveFile(name, u8) {
  if (inClaude()) {
    dlP = dlP || window.claude.use('downloads');
    const dl = await dlP;
    if (!dl) throw new Error('Saving files isn’t available in this view.');
    try { await dl.save({ filename: name + '.zip', data: zip(name, u8) }); return `Saved ${name} (zipped for the preview).`; }
    catch (e) { if (e?.code === 'declined') return 'Save cancelled.'; throw new Error(e?.message || 'Couldn’t save the file.'); }
  }
  const url = URL.createObjectURL(new Blob([u8]));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return `Saved ${name}.`;
}

// ---------- MP3 (lamejs, bundled in vendor/) ----------
let lameP = null;
function lame() {
  if (window.lamejs) return Promise.resolve(window.lamejs);
  // bundled copy first (works offline / in the APK), cdnjs as the fallback
  const get = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => (window.lamejs ? res(window.lamejs) : rej()); s.onerror = rej; document.head.appendChild(s); });
  lameP = lameP || get('vendor/lame.min.js').catch(() => get('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'))
    .catch(() => { lameP = null; throw new Error('The MP3 encoder didn’t load.'); });
  return lameP;
}
export async function encodeMp3(buf, onProgress = () => {}) {
  const L = await lame();
  const enc = new L.Mp3Encoder(2, buf.sampleRate, 192);
  const a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
  // trim trailing silence (keep 0.3 s)
  let last = a.length - 1; while (last > 0 && Math.abs(a[last]) < 0.0005 && Math.abs(b[last]) < 0.0005) last--;
  const n = Math.min(a.length, last + Math.floor(buf.sampleRate * 0.3));
  const toI16 = (src, from, to) => { const o = new Int16Array(to - from); for (let i = from; i < to; i++) { const x = Math.max(-1, Math.min(1, src[i])); o[i - from] = x < 0 ? x * 0x8000 : x * 0x7fff; } return o; };
  const parts = [], BLOCK = 1152 * 20;
  for (let i = 0; i < n; i += BLOCK) {
    const j = Math.min(n, i + BLOCK), mp = enc.encodeBuffer(toI16(a, i, j), toI16(b, i, j));
    if (mp.length) parts.push(new Uint8Array(mp));
    if ((i / BLOCK) % 20 === 0) { onProgress(0.7 + 0.3 * (i / n)); await new Promise((r) => setTimeout(r)); }
  }
  const fin = enc.flush(); if (fin.length) parts.push(new Uint8Array(fin));
  const total = parts.reduce((s, p) => s + p.length, 0), outU = new Uint8Array(total);
  let o = 0; for (const p of parts) { outU.set(p, o); o += p.length; }
  return outU;
}
