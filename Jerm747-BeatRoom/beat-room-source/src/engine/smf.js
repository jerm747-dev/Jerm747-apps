// Standard MIDI files for the note lane.
//   writeMidi(notes, { bpm, name }) -> Blob (type 0, 480 ticks per quarter)
//   readMidi(arrayBuffer) -> { notes: [{ t, d, n, v }] in quarter notes, bpm, name }
// The lane works in 16th-note steps: 1 step = 1/4 quarter = 120 ticks here.
const PPQ = 480;

// ---------- write ----------
function vlq(n) {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}
/** notes: [{ p, d, n, v }] in steps. */
export function writeMidi(notes, { bpm = 120, name = 'Beat Room' } = {}) {
  const STEP = PPQ / 4;
  const evs = [];
  for (const x of notes) {
    const on = Math.round(x.p * STEP), off = Math.max(on + 1, Math.round((x.p + x.d) * STEP));
    const vel = Math.max(1, Math.min(127, Math.round((x.v ?? 0.8) * 127)));
    evs.push({ t: on, k: 1, b: [0x90, x.n & 0x7f, vel] }, { t: off, k: 0, b: [0x80, x.n & 0x7f, 0] });
  }
  evs.sort((a, b) => a.t - b.t || a.k - b.k); // note-offs before note-ons on the same tick
  const tr = [];
  const text = [...new TextEncoder().encode(name.slice(0, 60))];
  tr.push(0, 0xff, 0x03, ...vlq(text.length), ...text);                       // track name
  const us = Math.round(60000000 / bpm);
  tr.push(0, 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff); // tempo
  tr.push(0, 0xff, 0x58, 0x04, 4, 2, 24, 8);                                   // 4/4
  let last = 0;
  for (const e of evs) { tr.push(...vlq(e.t - last), ...e.b); last = e.t; }
  tr.push(0, 0xff, 0x2f, 0x00);                                                // end of track
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
  const len = tr.length;
  const trkHead = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
  return new Blob([new Uint8Array([...head, ...trkHead, ...tr])], { type: 'audio/midi' });
}

// ---------- read ----------
/** Parse a type 0 or 1 MIDI file. All tracks and channels are merged (drum channel 10 skipped). */
export function readMidi(buf) {
  const d = new DataView(buf);
  let o = 0;
  const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(o + i)); return s; };
  if (d.byteLength < 14 || str(4) !== 'MThd') throw new Error('That file isn’t a MIDI file.');
  const hlen = d.getUint32(4), ntrk = d.getUint16(10), div = d.getUint16(12);
  if (div & 0x8000) throw new Error('That MIDI file uses SMPTE timing, which isn’t supported. Re-save it with beats (PPQ) timing.');
  o = 8 + hlen;
  const notes = [], open = new Map();
  let bpm = null, name = '';
  const readVlq = () => { let v = 0, b; do { b = d.getUint8(o++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  for (let k = 0; k < ntrk && o + 8 <= d.byteLength; k++) {
    const id = str(4), len = d.getUint32(o + 4); o += 8;
    const end = Math.min(d.byteLength, o + len);
    if (id !== 'MTrk') { o = end; continue; }
    let t = 0, status = 0;
    while (o < end) {
      t += readVlq();
      let b = d.getUint8(o);
      if (b & 0x80) { status = b; o++; } else if (!status) break; // running status
      const type = status & 0xf0, ch = status & 0x0f;
      if (status === 0xff) {
        const meta = d.getUint8(o++), ml = readVlq();
        if (meta === 0x51 && ml === 3 && bpm == null) bpm = 60000000 / ((d.getUint8(o) << 16) | (d.getUint8(o + 1) << 8) | d.getUint8(o + 2));
        if (meta === 0x03 && !name) name = new TextDecoder().decode(new Uint8Array(buf, o, ml));
        o += ml; status = 0;
      } else if (status === 0xf0 || status === 0xf7) { o += readVlq(); status = 0; }
      else if (type === 0x90 || type === 0x80) {
        const n = d.getUint8(o), v = d.getUint8(o + 1); o += 2;
        if (ch === 9) continue; // drum channel
        const key = `${ch}:${n}`;
        if (type === 0x90 && v > 0) { const list = open.get(key) || []; list.push({ t, v }); open.set(key, list); }
        else { const list = open.get(key); const st = list?.shift(); if (st) notes.push({ t: st.t / div, d: Math.max(1, t - st.t) / div, n, v: st.v / 127 }); }
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) o += 2;
      else if (type === 0xc0 || type === 0xd0) o += 1;
      else break;
    }
    o = end;
  }
  notes.sort((a, b) => a.t - b.t);
  return { notes, bpm: bpm ? Math.round(bpm * 10) / 10 : null, name };
}
