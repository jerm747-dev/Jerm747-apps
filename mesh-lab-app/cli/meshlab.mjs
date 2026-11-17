#!/usr/bin/env node
// 747 Mesh Lab CLI: headless polygon reducer for Meshy exports. No browser, no dependencies (Node 18+).
//
//   node cli/meshlab.mjs <input.zip|input.fbx|input.glb> [--target 41460] [--tex 1024] [--out file.glb]
//
// Reads a Meshy zip (binary FBX + PNG textures), a bare FBX (textures beside it) or a GLB, reduces it to
// --target triangles with quadric edge collapse (fast vertex clustering first when the input is huge),
// and writes a GLB with clean PBR materials: no stray glow, Meshy's _metallic/_roughness packed in, and
// textures resized to --tex pixels.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) {
  console.log('usage: node cli/meshlab.mjs <input.zip|.fbx|.glb> [--target 41460] [--tex 1024] [--out out.glb]');
  process.exit(args.length ? 0 : 1);
}
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const INPUT = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const TARGET = parseInt(opt('--target', '41460'), 10);
const TEX = parseInt(opt('--tex', '1024'), 10);
const t0 = Date.now();
const log = (...m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...m);

// ---------------------------------------------------------------- input files (zip / folder)
function readZip(buf) {
  // central directory → entries; stored (0) or deflate (8)
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  let n = buf.readUInt16LE(eocd + 10), off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
    const nl = buf.readUInt16LE(off + 28), el = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42), name = buf.toString('utf8', off + 46, off + 46 + nl);
    off += 46 + nl + el + cl;
    if (name.endsWith('/')) continue;
    const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(ds, ds + csize);
    files[path.basename(name)] = () => method === 0 ? raw : zlib.inflateRawSync(raw);
  }
  return files;
}
function gatherInputs(input) {
  if (input.toLowerCase().endsWith('.zip')) return readZip(fs.readFileSync(input));
  const dir = path.dirname(input), files = {};
  for (const f of fs.readdirSync(dir)) files[f] = () => fs.readFileSync(path.join(dir, f));
  return files;
}
const files = gatherInputs(INPUT);
const pick = re => { const k = Object.keys(files).find(f => re.test(f.toLowerCase())); return k ? files[k]() : null; };

// ---------------------------------------------------------------- FBX (binary) reader
function parseFBX(b) {
  if (b.toString('latin1', 0, 18) !== 'Kaydara FBX Binary') throw new Error('only binary FBX is supported');
  const ver = b.readUInt32LE(23), big = ver >= 7500;
  const arrType = { f: Float32Array, d: Float64Array, l: BigInt64Array, i: Int32Array, b: Uint8Array };
  function node(o) {
    let end, np, plen;
    if (big) { end = Number(b.readBigUInt64LE(o)); np = Number(b.readBigUInt64LE(o + 8)); o += 24; }
    else { end = b.readUInt32LE(o); np = b.readUInt32LE(o + 4); o += 12; }
    const nl = b[o]; o += 1;
    if (end === 0) return [null, o];
    const name = b.toString('latin1', o, o + nl); o += nl;
    const props = [];
    for (let i = 0; i < np; i++) {
      const t = String.fromCharCode(b[o]); o += 1;
      switch (t) {
        case 'Y': props.push(b.readInt16LE(o)); o += 2; break;
        case 'C': props.push(!!b[o]); o += 1; break;
        case 'I': props.push(b.readInt32LE(o)); o += 4; break;
        case 'F': props.push(b.readFloatLE(o)); o += 4; break;
        case 'D': props.push(b.readDoubleLE(o)); o += 8; break;
        case 'L': props.push(Number(b.readBigInt64LE(o))); o += 8; break;
        case 'f': case 'd': case 'l': case 'i': case 'b': {
          const len = b.readUInt32LE(o), enc = b.readUInt32LE(o + 4), cl = b.readUInt32LE(o + 8); o += 12;
          let raw = b.subarray(o, o + cl); o += cl;
          if (enc === 1) raw = zlib.inflateSync(raw);
          const T = arrType[t], copy = new Uint8Array(raw.length); copy.set(raw);
          props.push(new T(copy.buffer, 0, len)); break;
        }
        case 'S': case 'R': { const len = b.readUInt32LE(o); o += 4; props.push(b.subarray(o, o + len)); o += len; break; }
        default: throw new Error('bad FBX property type ' + t);
      }
    }
    const kids = [];
    while (o < end) { const [k, o2] = node(o); o = o2; if (!k) break; kids.push(k); }
    return [{ name, props, kids }, end];
  }
  const top = []; let o = 27;
  while (o < b.length - 160) { const [n, o2] = node(o); if (!n) break; top.push(n); o = o2; }
  return top;
}
const findAll = (nodes, name, out = []) => { for (const n of nodes) { if (n.name === name) out.push(n); findAll(n.kids, name, out); } return out; };
const kid = (n, name) => n.kids.find(k => k.name === name);

// Returns { P: Float64Array xyz per position, tris: Int32Array (position index per corner),
//           UV: Float32Array per corner (2 per corner) }
function meshFromFBX(buf) {
  const top = parseFBX(buf), geos = findAll(top, 'Geometry').filter(g => kid(g, 'Vertices'));
  let Pall = [], trisAll = [], uvAll = [], base = 0;
  for (const g of geos) {
    const V = kid(g, 'Vertices').props[0], PI = kid(g, 'PolygonVertexIndex').props[0];
    const uvl = kid(g, 'LayerElementUV');
    let UV = null, UVI = null, uvMap = 'ByPolygonVertex', uvRef = 'IndexToDirect';
    if (uvl) {
      UV = kid(uvl, 'UV').props[0]; const ui = kid(uvl, 'UVIndex'); UVI = ui ? ui.props[0] : null;
      uvMap = kid(uvl, 'MappingInformationType').props[0].toString(); uvRef = kid(uvl, 'ReferenceInformationType').props[0].toString();
    }
    // polygons → triangle fans, carrying the per-corner UV
    let start = 0;
    for (let c = 0; c < PI.length; c++) {
      if (PI[c] >= 0) continue;
      const end = c;
      const vi = k => (k === end ? -PI[k] - 1 : PI[k]);
      const uvOf = k => {
        if (!UV) return [0, 0];
        let j = uvMap === 'ByPolygonVertex' ? k : vi(k);
        if (uvRef !== 'Direct' && UVI) j = UVI[j];
        return [UV[j * 2], UV[j * 2 + 1]];
      };
      for (let k = start + 1; k < end; k++) {
        for (const q of [start, k, k + 1]) { trisAll.push(vi(q) + base); const u = uvOf(q); uvAll.push(u[0], u[1]); }
      }
      start = c + 1;
    }
    Pall.push(V); base += V.length / 3;
  }
  const P = new Float64Array(base * 3); let o = 0; for (const V of Pall) { P.set(V, o); o += V.length; }
  return { P, tris: Int32Array.from(trisAll), UV: Float32Array.from(uvAll), uvFlipV: false };
}

// ---------------------------------------------------------------- GLB reader (for re-reducing Mesh Lab exports)
function meshFromGLB(buf) {
  const jl = buf.readUInt32LE(12), js = JSON.parse(buf.toString('utf8', 20, 20 + jl)), bs = 20 + jl + 8;
  const acc = i => {
    const a = js.accessors[i], bv = js.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    const off = bs + (bv.byteOffset || 0) + (a.byteOffset || 0), bytes = a.count * n * T.BYTES_PER_ELEMENT;
    const copy = new Uint8Array(bytes); copy.set(buf.subarray(off, off + bytes)); return new T(copy.buffer);
  };
  const p = js.meshes[0].primitives[0], P32 = acc(p.attributes.POSITION), I = acc(p.indices), UVv = acc(p.attributes.TEXCOORD_0);
  const tris = Int32Array.from(I), UV = new Float32Array(tris.length * 2);
  for (let c = 0; c < tris.length; c++) { UV[c * 2] = UVv[tris[c] * 2]; UV[c * 2 + 1] = 1 - UVv[tris[c] * 2 + 1]; }
  const images = (js.images || []).map(im => { const bv = js.bufferViews[im.bufferView]; return buf.subarray(bs + bv.byteOffset, bs + bv.byteOffset + bv.byteLength); });
  return { P: Float64Array.from(P32), tris, UV, glbImages: images };
}

// ---------------------------------------------------------------- weld positions (so seams don't block reduction)
function weld(mesh) {
  const { P, tris } = mesh, n = P.length / 3, map = new Int32Array(n), keyMap = new Map(), out = [];
  let ex = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { ex[a * 2] = Math.min(ex[a * 2], P[i * 3 + a]); ex[a * 2 + 1] = Math.max(ex[a * 2 + 1], P[i * 3 + a]); }
  const eps = Math.max(ex[1] - ex[0], ex[3] - ex[2], ex[5] - ex[4]) * 1e-6;
  for (let i = 0; i < n; i++) {
    const k = Math.round(P[i * 3] / eps) + ',' + Math.round(P[i * 3 + 1] / eps) + ',' + Math.round(P[i * 3 + 2] / eps);
    let j = keyMap.get(k); if (j === undefined) { j = out.length / 3; keyMap.set(k, j); out.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
    map[i] = j;
  }
  for (let c = 0; c < tris.length; c++) tris[c] = map[tris[c]];
  mesh.P = Float64Array.from(out); mesh.extent = ex;
  return mesh;
}

// ---------------------------------------------------------------- vertex clustering (fast first pass for huge meshes)
function cluster(mesh, cells) {
  const { P, tris, UV, extent: ex } = mesh, n = P.length / 3;
  const size = Math.max(ex[1] - ex[0], ex[3] - ex[2], ex[5] - ex[4]) / cells;
  const cellOf = new Int32Array(n), sum = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor((P[i * 3] - ex[0]) / size) + Math.floor((P[i * 3 + 1] - ex[2]) / size) * 4096 + Math.floor((P[i * 3 + 2] - ex[4]) / size) * 16777216;
    let s = sum.get(k); if (!s) { s = { id: sum.size, x: 0, y: 0, z: 0, c: 0 }; sum.set(k, s); }
    s.x += P[i * 3]; s.y += P[i * 3 + 1]; s.z += P[i * 3 + 2]; s.c++; cellOf[i] = s.id;
  }
  const NP = new Float64Array(sum.size * 3);
  for (const s of sum.values()) { NP[s.id * 3] = s.x / s.c; NP[s.id * 3 + 1] = s.y / s.c; NP[s.id * 3 + 2] = s.z / s.c; }
  const nt = [], nuv = [];
  for (let t = 0; t < tris.length / 3; t++) {
    const a = cellOf[tris[t * 3]], b = cellOf[tris[t * 3 + 1]], c = cellOf[tris[t * 3 + 2]];
    if (a === b || b === c || a === c) continue;
    nt.push(a, b, c); for (let k = 0; k < 6; k++) nuv.push(UV[t * 6 + k]);
  }
  mesh.P = NP; mesh.tris = Int32Array.from(nt); mesh.UV = Float32Array.from(nuv);
  return mesh;
}

// ---------------------------------------------------------------- quadric edge collapse (after Sven Forstmann's Fast-Quadric-Mesh-Simplification, MIT)
function simplify(mesh, target, aggressiveness = 7) {
  const nv = mesh.P.length / 3, nt0 = mesh.tris.length / 3;
  const vp = Float64Array.from(mesh.P), vq = new Float64Array(nv * 10), vstart = new Int32Array(nv), vcount = new Int32Array(nv), vborder = new Uint8Array(nv);
  const tv = Int32Array.from(mesh.tris), terr = new Float64Array(nt0 * 4), tdel = new Uint8Array(nt0), tdirty = new Uint8Array(nt0), tn = new Float64Array(nt0 * 3);
  const tuv = Float32Array.from(mesh.UV);
  let refT = new Int32Array(nt0 * 3), refV = new Int8Array(nt0 * 3);
  const p = [0, 0, 0], tmp = [0, 0, 0];
  const qset = (o, a, b, c, d) => { vq[o] += a * a; vq[o + 1] += a * b; vq[o + 2] += a * c; vq[o + 3] += a * d; vq[o + 4] += b * b; vq[o + 5] += b * c; vq[o + 6] += b * d; vq[o + 7] += c * c; vq[o + 8] += c * d; vq[o + 9] += d * d; };
  const det = (q, a11, a12, a13, a21, a22, a23, a31, a32, a33) =>
    q[a11] * q[a22] * q[a33] + q[a13] * q[a21] * q[a32] + q[a12] * q[a23] * q[a31] - q[a13] * q[a22] * q[a31] - q[a11] * q[a23] * q[a32] - q[a12] * q[a21] * q[a33];
  const Q = new Float64Array(10);
  const vertexError = (x, y, z) => Q[0] * x * x + 2 * Q[1] * x * y + 2 * Q[2] * x * z + 2 * Q[3] * x + Q[4] * y * y + 2 * Q[5] * y * z + 2 * Q[6] * y + Q[7] * z * z + 2 * Q[8] * z + Q[9];
  function calcError(i0, i1, out) {
    for (let k = 0; k < 10; k++) Q[k] = vq[i0 * 10 + k] + vq[i1 * 10 + k];
    const border = vborder[i0] && vborder[i1];
    const d = det(Q, 0, 1, 2, 1, 4, 5, 2, 5, 7);
    if (d !== 0 && !border) {
      out[0] = -1 / d * det(Q, 1, 2, 3, 4, 5, 6, 5, 7, 8);
      out[1] = 1 / d * det(Q, 0, 2, 3, 1, 5, 6, 2, 7, 8);
      out[2] = -1 / d * det(Q, 0, 1, 3, 1, 4, 6, 2, 5, 8);
      return vertexError(out[0], out[1], out[2]);
    }
    const e1 = vertexError(vp[i0 * 3], vp[i0 * 3 + 1], vp[i0 * 3 + 2]), e2 = vertexError(vp[i1 * 3], vp[i1 * 3 + 1], vp[i1 * 3 + 2]);
    const mx = (vp[i0 * 3] + vp[i1 * 3]) / 2, my = (vp[i0 * 3 + 1] + vp[i1 * 3 + 1]) / 2, mz = (vp[i0 * 3 + 2] + vp[i1 * 3 + 2]) / 2, e3 = vertexError(mx, my, mz);
    const e = Math.min(e1, e2, e3);
    if (e === e1) { out[0] = vp[i0 * 3]; out[1] = vp[i0 * 3 + 1]; out[2] = vp[i0 * 3 + 2]; }
    else if (e === e2) { out[0] = vp[i1 * 3]; out[1] = vp[i1 * 3 + 1]; out[2] = vp[i1 * 3 + 2]; }
    else { out[0] = mx; out[1] = my; out[2] = mz; }
    return e;
  }
  let nt = nt0;
  function updateRefs() {
    vstart.fill(0); vcount.fill(0);
    for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) vcount[tv[t * 3 + j]]++;
    let s = 0; for (let i = 0; i < nv; i++) { vstart[i] = s; s += vcount[i]; vcount[i] = 0; }
    if (refT.length < s) { refT = new Int32Array(s); refV = new Int8Array(s); }
    for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) { const v = tv[t * 3 + j], k = vstart[v] + vcount[v]++; refT[k] = t; refV[k] = j; }
  }
  function compact() {
    let dst = 0;
    for (let t = 0; t < nt; t++) if (!tdel[t]) {
      for (let j = 0; j < 3; j++) tv[dst * 3 + j] = tv[t * 3 + j];
      for (let k = 0; k < 6; k++) tuv[dst * 6 + k] = tuv[t * 6 + k];
      for (let k = 0; k < 4; k++) terr[dst * 4 + k] = terr[t * 4 + k];
      for (let k = 0; k < 3; k++) tn[dst * 3 + k] = tn[t * 3 + k];
      tdel[dst] = 0; dst++;
    }
    nt = dst;
  }
  function triNormal(t, out) {
    const a = tv[t * 3] * 3, b = tv[t * 3 + 1] * 3, c = tv[t * 3 + 2] * 3;
    const ux = vp[b] - vp[a], uy = vp[b + 1] - vp[a + 1], uz = vp[b + 2] - vp[a + 2], wx = vp[c] - vp[a], wy = vp[c + 1] - vp[a + 1], wz = vp[c + 2] - vp[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
  }
  function init() {
    updateRefs();
    // borders: an edge used by only one triangle
    vborder.fill(0);
    for (let i = 0; i < nv; i++) {
      const seen = new Map();
      for (let k = vstart[i]; k < vstart[i] + vcount[i]; k++) {
        const t = refT[k];
        for (let j = 0; j < 3; j++) { const v = tv[t * 3 + j]; if (v !== i) seen.set(v, (seen.get(v) || 0) + 1); }
      }
      for (const [v, c] of seen) if (c === 1) { vborder[i] = 1; vborder[v] = 1; }
    }
    vq.fill(0);
    for (let t = 0; t < nt; t++) {
      triNormal(t, tmp); tn[t * 3] = tmp[0]; tn[t * 3 + 1] = tmp[1]; tn[t * 3 + 2] = tmp[2];
      const a = tv[t * 3] * 3, d = -(tmp[0] * vp[a] + tmp[1] * vp[a + 1] + tmp[2] * vp[a + 2]);
      for (let j = 0; j < 3; j++) qset(tv[t * 3 + j] * 10, tmp[0], tmp[1], tmp[2], d);
    }
    for (let t = 0; t < nt; t++) {
      for (let j = 0; j < 3; j++) terr[t * 4 + j] = calcError(tv[t * 3 + j], tv[t * 3 + (j + 1) % 3], p);
      terr[t * 4 + 3] = Math.min(terr[t * 4], terr[t * 4 + 1], terr[t * 4 + 2]);
    }
  }
  const deleted0 = [], deleted1 = [];
  function flipped(px, py, pz, i0, i1, del) {
    for (let k = 0; k < vcount[i0]; k++) {
      const r = vstart[i0] + k, t = refT[r]; if (tdel[t]) continue;
      const s = refV[r], id1 = tv[t * 3 + (s + 1) % 3], id2 = tv[t * 3 + (s + 2) % 3];
      if (id1 === i1 || id2 === i1) { del[k] = 1; continue; }
      let ax = vp[id1 * 3] - px, ay = vp[id1 * 3 + 1] - py, az = vp[id1 * 3 + 2] - pz; let la = Math.hypot(ax, ay, az) || 1; ax /= la; ay /= la; az /= la;
      let bx = vp[id2 * 3] - px, by = vp[id2 * 3 + 1] - py, bz = vp[id2 * 3 + 2] - pz; let lb = Math.hypot(bx, by, bz) || 1; bx /= lb; by /= lb; bz /= lb;
      if (Math.abs(ax * bx + ay * by + az * bz) > 0.999) return true;
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const ln = Math.hypot(nx, ny, nz) || 1;
      del[k] = 0;
      if ((nx / ln) * tn[t * 3] + (ny / ln) * tn[t * 3 + 1] + (nz / ln) * tn[t * 3 + 2] < 0.2) return true;
    }
    return false;
  }
  let pendingRefT = [], pendingRefV = [];
  function updateTriangles(i0, vcountI, del, counter) {
    for (let k = 0; k < vcountI; k++) {
      const r = vstart[i0] + k, t = refT[r]; if (tdel[t]) continue;
      if (del[k]) { tdel[t] = 1; counter.n++; continue; }
      tv[t * 3 + refV[r]] = counter.i0;
      tdirty[t] = 1;
      for (let j = 0; j < 3; j++) terr[t * 4 + j] = calcError(tv[t * 3 + j], tv[t * 3 + (j + 1) % 3], p);
      terr[t * 4 + 3] = Math.min(terr[t * 4], terr[t * 4 + 1], terr[t * 4 + 2]);
      pendingRefT.push(t); pendingRefV.push(refV[r]);
    }
  }
  init();
  let deletedCount = 0;
  for (let iter = 0; iter < 200; iter++) {
    if (nt0 - deletedCount <= target) break;
    if (iter % 5 === 0) { compact(); updateRefs(); }
    tdirty.fill(0, 0, nt);
    const threshold = 1e-9 * Math.pow(iter + 3, aggressiveness);
    for (let t = 0; t < nt; t++) {
      if (terr[t * 4 + 3] > threshold || tdel[t] || tdirty[t]) continue;
      for (let j = 0; j < 3; j++) {
        if (terr[t * 4 + j] >= threshold) continue;
        const i0 = tv[t * 3 + j], i1 = tv[t * 3 + (j + 1) % 3];
        if (vborder[i0] !== vborder[i1]) continue;
        calcError(i0, i1, p);
        const c0 = vcount[i0], c1 = vcount[i1];
        deleted0.length = c0; deleted1.length = c1;
        if (flipped(p[0], p[1], p[2], i0, i1, deleted0)) continue;
        if (flipped(p[0], p[1], p[2], i1, i0, deleted1)) continue;
        // corner UVs: the corner that moves takes the UV of the corner it lands on, on triangles that share the edge
        vp[i0 * 3] = p[0]; vp[i0 * 3 + 1] = p[1]; vp[i0 * 3 + 2] = p[2];
        for (let k = 0; k < 10; k++) vq[i0 * 10 + k] += vq[i1 * 10 + k];
        const tstart = pendingRefT.length, counter = { n: 0, i0 };
        pendingRefT.length = tstart; pendingRefV.length = tstart;
        updateTriangles(i0, c0, deleted0, counter);
        updateTriangles(i1, c1, deleted1, counter);
        deletedCount += counter.n;
        const added = pendingRefT.length - tstart;
        if (added <= c0) {
          for (let k = 0; k < added; k++) { refT[vstart[i0] + k] = pendingRefT[tstart + k]; refV[vstart[i0] + k] = pendingRefV[tstart + k]; }
        } else {
          // grow the reference list: append at the end (refs are rebuilt every few iterations)
          const need = refT.length + added;
          const nT = new Int32Array(need), nV = new Int8Array(need); nT.set(refT); nV.set(refV);
          vstart[i0] = refT.length; refT = nT; refV = nV;
          for (let k = 0; k < added; k++) { refT[vstart[i0] + k] = pendingRefT[tstart + k]; refV[vstart[i0] + k] = pendingRefV[tstart + k]; }
        }
        vcount[i0] = added;
        pendingRefT.length = tstart; pendingRefV.length = tstart;
        break;
      }
      if (nt0 - deletedCount <= target) break;
    }
  }
  compact();
  mesh.P = vp; mesh.tris = tv.slice(0, nt * 3); mesh.UV = tuv.slice(0, nt * 6);
  return mesh;
}

// ---------------------------------------------------------------- output vertices: split by UV, crease-aware normals
function buildOutput(mesh) {
  const { P, tris, UV } = mesh, nt = tris.length / 3, nv = P.length / 3;
  const fn = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = tris[t * 3] * 3, b = tris[t * 3 + 1] * 3, c = tris[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
    fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l;
  }
  // triangles around each vertex
  const cnt = new Int32Array(nv + 1); for (let c = 0; c < tris.length; c++) cnt[tris[c] + 1]++;
  for (let i = 0; i < nv; i++) cnt[i + 1] += cnt[i];
  const around = new Int32Array(tris.length), fill = cnt.slice();
  for (let c = 0; c < tris.length; c++) around[fill[tris[c]]++] = (c / 3) | 0;
  const CREASE = Math.cos(60 * Math.PI / 180);
  const keyMap = new Map(), pos = [], nor = [], uv = [], idx = new Uint32Array(tris.length);
  for (let c = 0; c < tris.length; c++) {
    const v = tris[c], t = (c / 3) | 0;
    let nx = 0, ny = 0, nz = 0;
    for (let k = cnt[v]; k < cnt[v + 1]; k++) {
      const s = around[k];
      if (fn[s * 3] * fn[t * 3] + fn[s * 3 + 1] * fn[t * 3 + 1] + fn[s * 3 + 2] * fn[t * 3 + 2] >= CREASE) { nx += fn[s * 3]; ny += fn[s * 3 + 1]; nz += fn[s * 3 + 2]; }
    }
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const u = UV[c * 2], w = 1 - UV[c * 2 + 1];            // glTF UV origin is top-left
    const key = v + '|' + u.toFixed(5) + '|' + w.toFixed(5) + '|' + Math.round(nx * 100) + ',' + Math.round(ny * 100) + ',' + Math.round(nz * 100);
    let j = keyMap.get(key);
    if (j === undefined) { j = pos.length / 3; keyMap.set(key, j); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); nor.push(nx, ny, nz); uv.push(u, w); }
    idx[c] = j;
  }
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: Float32Array.from(uv), idx };
}

// ---------------------------------------------------------------- PNG decode / resize / encode (8-bit, non-interlaced)
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let o = 8, w, h, depth, ctype, inter, idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; inter = d[12]; }
    else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
  }
  if (depth !== 8 || inter) return null;
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype]; if (!ch) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      if (ch === 1) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = 255; }
      else if (ch === 2) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = cur[s + 1]; }
      else { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = ch === 4 ? cur[s + 3] : 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, data: out };
}
function resize(img, size) {
  if (img.w <= size && img.h <= size) return img;
  const s = size / Math.max(img.w, img.h), W = Math.max(1, Math.round(img.w * s)), H = Math.max(1, Math.round(img.h * s)), out = new Uint8Array(W * H * 4);
  const fx = img.w / W, fy = img.h / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // box filter (area average)
    const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx)), y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * img.w + xx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; a += img.data[i + 3]; n++; }
    const o = (y * W + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
  }
  return { w: W, h: H, data: out };
}
function encodePNG(img, alpha) {
  const ch = alpha ? 4 : 3, stride = img.w * ch, raw = Buffer.alloc((stride + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    const o = y * (stride + 1); raw[o] = 1;   // "sub" filter
    for (let x = 0; x < img.w; x++) for (let c = 0; c < ch; c++) {
      const v = img.data[(y * img.w + x) * 4 + c], left = x ? img.data[(y * img.w + x - 1) * 4 + c] : 0;
      raw[o + 1 + x * ch + c] = (v - left) & 255;
    }
  }
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function hasAlpha(img) { for (let i = 3; i < img.data.length; i += 4 * 97) if (img.data[i] < 250) return true; return false; }

// ---------------------------------------------------------------- GLB writer
function writeGLB(out, geo, tex) {
  const views = [], parts = []; let len = 0;
  const add = (buf, target) => { while (len % 4) { parts.push(Buffer.alloc(1)); len++; } views.push({ buffer: 0, byteOffset: len, byteLength: buf.length, ...(target ? { target } : {}) }); parts.push(Buffer.from(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength ?? buf.length)); len += buf.byteLength ?? buf.length; return views.length - 1; };
  const vp = add(geo.pos, 34962), vn = add(geo.nor, 34962), vt = add(geo.uv, 34962), vi = add(geo.idx, 34963);
  const n = geo.pos.length / 3, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], geo.pos[i * 3 + a]); mx[a] = Math.max(mx[a], geo.pos[i * 3 + a]); }
  const images = [], textures = [], mat = { name: 'meshlab', pbrMetallicRoughness: { metallicFactor: 1, roughnessFactor: 1 }, emissiveFactor: [0, 0, 0] };
  const addTex = png => { images.push({ bufferView: add(png), mimeType: 'image/png' }); textures.push({ source: images.length - 1, sampler: 0 }); return textures.length - 1; };
  if (tex.base) mat.pbrMetallicRoughness.baseColorTexture = { index: addTex(tex.base) };
  if (tex.normal) mat.normalTexture = { index: addTex(tex.normal) };
  if (tex.mr) mat.pbrMetallicRoughness.metallicRoughnessTexture = { index: addTex(tex.mr) };
  else { mat.pbrMetallicRoughness.metallicFactor = 0; mat.pbrMetallicRoughness.roughnessFactor = 0.6; }
  if (tex.alpha) { mat.alphaMode = 'MASK'; mat.alphaCutoff = 0.35; mat.doubleSided = true; }
  const gltf = {
    asset: { version: '2.0', generator: '747 Mesh Lab CLI' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: path.basename(out, '.glb') }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    accessors: [{ bufferView: vp, componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx }, { bufferView: vn, componentType: 5126, count: n, type: 'VEC3' },
      { bufferView: vt, componentType: 5126, count: n, type: 'VEC2' }, { bufferView: vi, componentType: 5125, count: geo.idx.length, type: 'SCALAR' }],
    bufferViews: views, buffers: [{ byteLength: 0 }], materials: [mat],
    ...(images.length ? { images, textures, samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }] } : {})
  };
  while (len % 4) { parts.push(Buffer.alloc(1)); len++; }
  gltf.buffers[0].byteLength = len;
  let json = Buffer.from(JSON.stringify(gltf)); while (json.length % 4) json = Buffer.concat([json, Buffer.from(' ')]);
  const bin = Buffer.concat(parts), head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(out, Buffer.concat([head, jh, json, bh, bin]));
}

// ---------------------------------------------------------------- main
const lower = INPUT.toLowerCase();
let mesh;
if (lower.endsWith('.glb')) mesh = meshFromGLB(fs.readFileSync(INPUT));
else {
  const fbx = lower.endsWith('.fbx') ? fs.readFileSync(INPUT) : pick(/\.fbx$/);
  if (!fbx) throw new Error('no .fbx found in ' + INPUT);
  log(`reading FBX (${(fbx.length / 1e6).toFixed(0)} MB)`);
  mesh = meshFromFBX(fbx);
}
const startTris = mesh.tris.length / 3;
log(`loaded ${startTris.toLocaleString()} triangles, ${(mesh.P.length / 3).toLocaleString()} positions`);
weld(mesh);
if (startTris > TARGET * 40) {
  // shrink fast to ~40x the target with vertex clustering, then let the quadric pass do the careful part
  let cells = Math.round(Math.sqrt(TARGET * 40 / 2) * 1.2);
  for (let k = 0; k < 6; k++) {
    const trial = cluster({ P: mesh.P, tris: mesh.tris.slice(), UV: mesh.UV, extent: mesh.extent }, cells);
    const n = trial.tris.length / 3;
    if (n < TARGET * 8) { cells = Math.round(cells * 1.5); continue; }
    if (n > TARGET * 80) { cells = Math.round(cells / 1.4); continue; }
    mesh = trial; break;
  }
  log(`clustered to ${(mesh.tris.length / 3).toLocaleString()} triangles`);
}
if (mesh.tris.length / 3 > TARGET) { simplify(mesh, TARGET); log(`reduced to ${(mesh.tris.length / 3).toLocaleString()} triangles`); }
const geo = buildOutput(mesh);
log(`output ${geo.pos.length / 3} vertices`);

const tex = {};
const loadImg = buf => buf && decodePNG(buf);
const baseBuf = mesh.glbImages ? mesh.glbImages[0] : pick(/(texture|_tri|basecolor|base_color|albedo|diffuse)\.png$/) || pick(/\.png$/);
const base = loadImg(baseBuf);
if (base) { const r = resize(base, TEX); tex.alpha = hasAlpha(r); tex.base = encodePNG(r, tex.alpha); }
const nrm = loadImg(mesh.glbImages ? mesh.glbImages[1] : pick(/_normal\.png$/));
if (nrm) tex.normal = encodePNG(resize(nrm, TEX), false);
const met = loadImg(pick(/_metallic\.png$/)), rou = loadImg(pick(/_roughness\.png$/));
if (met || rou) {
  const a = resize(met || rou, Math.min(TEX, 1024)), b = rou ? resize(rou, Math.min(TEX, 1024)) : null, m = met ? resize(met, Math.min(TEX, 1024)) : null;
  const img = { w: a.w, h: a.h, data: new Uint8Array(a.w * a.h * 4) };
  for (let i = 0; i < a.w * a.h; i++) { img.data[i * 4] = 255; img.data[i * 4 + 1] = b ? b.data[i * 4] : 150; img.data[i * 4 + 2] = m ? m.data[i * 4] : 0; img.data[i * 4 + 3] = 255; }
  tex.mr = encodePNG(img, false);
}
const out = opt('--out', path.join(path.dirname(INPUT), path.basename(INPUT).replace(/(_\d+tris)?\.(zip|fbx|glb)$/i, '') + `_${geo.idx.length / 3}tris.glb`));
writeGLB(out, geo, tex);
log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB) — ${startTris.toLocaleString()} → ${(geo.idx.length / 3).toLocaleString()} triangles`);
