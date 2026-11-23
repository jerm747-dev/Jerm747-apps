// Standard MIDI files. Grown from the Beat Room's smf.js: reads every track and channel
// (drums on channel 10 included) and writes type 1 with one MTrk per MIDI Lane track.
const PPQ = 480;
function vlq(n) { n = Math.max(0, Math.round(n)); const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; }
const text = (s) => [...new TextEncoder().encode(String(s).slice(0, 60))];
const chunk = (id, bytes) => { const l = bytes.length; return [...id.split('').map((c) => c.charCodeAt(0)), (l >>> 24) & 255, (l >>> 16) & 255, (l >>> 8) & 255, l & 255, ...bytes]; };

/** project -> Uint8Array (type 1, 480 PPQ). Notes past the song length are left out. */
export function writeMidi(P, lenTicks) {
  const out = [];
  const t0 = [0, 0xff, 0x03, ...vlq(text(P.name).length), ...text(P.name)];
  const us = Math.round(60000000 / P.bpm);
  t0.push(0, 0xff, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xff, 0x58, 0x04, 4, 2, 24, 8);
  t0.push(...vlq(lenTicks), 0xff, 0x2f, 0x00);
  out.push(...chunk('MTrk', t0));
  for (const tr of P.tracks) {
    const ch = tr.ch & 15, evs = [];
    for (const x of tr.notes) {
      const on = Math.round(x.t); if (on >= lenTicks) continue;
      const off = Math.max(on + 1, Math.min(lenTicks, Math.round(x.t + x.d)));
      evs.push({ t: on, k: 1, b: [0x90 | ch, x.n & 127, Math.max(1, Math.min(127, Math.round(x.v)))] }, { t: off, k: 0, b: [0x80 | ch, x.n & 127, 0] });
    }
    evs.sort((a, b) => a.t - b.t || a.k - b.k);
    const b = [0, 0xff, 0x03, ...vlq(text(tr.name).length), ...text(tr.name)];
    let last = 0;
    for (const e of evs) { b.push(...vlq(e.t - last), ...e.b); last = e.t; }
    b.push(...vlq(Math.max(0, lenTicks - last)), 0xff, 0x2f, 0x00);
    out.push(...chunk('MTrk', b));
  }
  const head = chunk('MThd', [0, 1, 0, P.tracks.length + 1, (PPQ >> 8) & 255, PPQ & 255]);
  return new Uint8Array([...head, ...out]);
}

/** ArrayBuffer -> { bpm, name, parts: [{ name, ch, notes: [{t,d,n,v}] in 480 PPQ }] } one part per track+channel. */
export function readMidi(buf) {
  const d = new DataView(buf); let o = 0;
  const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(o + i)); return s; };
  if (d.byteLength < 14 || str(4) !== 'MThd') throw new Error('That file isn’t a MIDI file.');
  const hlen = d.getUint32(4), ntrk = d.getUint16(10), div = d.getUint16(12);
  if (div & 0x8000) throw new Error('That MIDI file uses SMPTE timing. Re-save it with beats (PPQ) timing.');
  const k = PPQ / div;
  o = 8 + hlen;
  const parts = new Map(); let bpm = null, name = '';
  const readVlq = () => { let v = 0, b; do { b = d.getUint8(o++); v = (v << 7) | (b & 0x7f); } while (b & 0x80 && o < d.byteLength); return v; };
  for (let ti = 0; ti < ntrk && o + 8 <= d.byteLength; ti++) {
    const id = str(4), len = d.getUint32(o + 4); o += 8;
    const end = Math.min(d.byteLength, o + len);
    if (id !== 'MTrk') { o = end; continue; }
    let t = 0, status = 0, tname = '';
    const open = new Map();
    try {
      while (o < end) {
        t += readVlq();
        const b = d.getUint8(o);
        if (b & 0x80) { status = b; o++; } else if (!status) break;
        const type = status & 0xf0, ch = status & 15;
        if (status === 0xff) {
          const meta = d.getUint8(o++), ml = readVlq();
          if (meta === 0x51 && ml === 3 && bpm == null) bpm = 60000000 / ((d.getUint8(o) << 16) | (d.getUint8(o + 1) << 8) | d.getUint8(o + 2));
          if (meta === 0x03 && !tname) tname = new TextDecoder().decode(new Uint8Array(buf, o, Math.min(ml, end - o))).trim();
          o += ml; status = 0;
        } else if (status === 0xf0 || status === 0xf7) { o += readVlq(); status = 0; }
        else if (type === 0x90 || type === 0x80) {
          const n = d.getUint8(o), v = d.getUint8(o + 1); o += 2;
          const key = ch * 128 + n;
          if (type === 0x90 && v > 0) { const l = open.get(key) || []; l.push({ t, v }); open.set(key, l); }
          else {
            const st = open.get(key)?.shift();
            if (st) {
              const pk = `${ti}:${ch}`;
              if (!parts.has(pk)) parts.set(pk, { name: '', ch, notes: [] });
              parts.get(pk).notes.push({ t: st.t * k, d: Math.max(1, (t - st.t) * k), n, v: st.v });
            }
          }
        } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) o += 2;
        else if (type === 0xc0 || type === 0xd0) o += 1;
        else break;
      }
    } catch { /* truncated track: keep what we read */ }
    for (const [pk, p] of parts) if (pk.startsWith(`${ti}:`) && !p.name) p.name = tname;
    if (!name && tname && ti === 0) name = tname;
    o = end;
  }
  const list = [...parts.values()].filter((p) => p.notes.length);
  list.forEach((p) => p.notes.sort((a, b) => a.t - b.t));
  return { bpm: bpm ? Math.round(bpm * 10) / 10 : null, name, parts: list };
}
