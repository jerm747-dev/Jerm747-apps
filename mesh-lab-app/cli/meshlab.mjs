#!/usr/bin/env node
// 747 Mesh Lab CLI: makes Meshy AI exports game-ready without a browser. No dependencies (Node 18+).
//
//   node cli/meshlab.mjs <input.zip|input.fbx|input.glb> [--target 41460] [--tex 1024] [--out file.glb] [--yup]
//
// Reads a Meshy zip (binary FBX + *_texture/_normal/_metallic/_roughness PNGs), a bare FBX (PNGs beside it)
// or a GLB. Welds seams, vertex-clusters huge meshes down to ~40x the target, then quadric edge collapse to
// --target triangles, keeping per-corner UVs. Writes a GLB with crease-aware normals (60 degrees) and a clean
// PBR material: emissive off, metal/roughness packed (G = roughness, B = metal), textures resized to --tex.
// Geometry stays Meshy's raw Z-up; --yup rotates it to Y-up.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const USAGE = 'usage: node cli/meshlab.mjs <input.zip|.fbx|.glb> [--target 41460] [--tex 1024] [--out out.glb] [--yup]';
const t0 = Date.now();
const log = (...m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...m);

export function parseArgs(argv) {
  const o = { input: null, target: 41460, tex: 1024, out: null, yup: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '--yup') o.yup = true;
    else if (a === '--target' || a === '--tex' || a === '--out') {
      const v = argv[++i]; if (v === undefined) throw new Error(`${a} needs a value`);
      if (a === '--out') o.out = v;
      else { o[a.slice(2)] = Number(v); if (!Number.isInteger(o[a.slice(2)]) || o[a.slice(2)] < 1) throw new Error(`${a} must be a positive whole number`); }
    }
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else if (o.input) throw new Error('give one input file');
    else o.input = a;
  }
  return o;
}

// ---------------------------------------------------------------- input files (zip / folder)
// Only .fbx / .glb / .png entries are kept, copied out so the zip buffer itself can be freed.
function readZip(buf) {
  let eocd = buf.length - 22;
  const stop = Math.max(0, buf.length - 22 - 65535);
  while (eocd >= stop && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < stop) throw new Error('not a zip file');
  const n = buf.readUInt16LE(eocd + 10); let off = buf.readUInt32LE(eocd + 16);
  if (n === 0xffff || off === 0xffffffff) throw new Error('zip64 archives are not supported');
  const files = {};
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
    const nl = buf.readUInt16LE(off + 28), el = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42), name = buf.toString('utf8', off + 46, off + 46 + nl);
    off += 46 + nl + el + cl;
    if (name.endsWith('/') || !/\.(fbx|glb|png)$/i.test(name) || name.includes('__MACOSX')) continue;
    if (csize === 0xffffffff) throw new Error('zip64 entries are not supported');
    const ds = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), raw = buf.subarray(ds, ds + csize);
    if (method !== 0 && method !== 8) throw new Error(`${name}: unsupported zip compression ${method}`);
    const data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    files[path.basename(name)] = () => data;
  }
  return files;
}
function gatherInputs(input) {
  if (input.toLowerCase().endsWith('.zip')) return readZip(fs.readFileSync(input));
  const dir = path.dirname(input), files = {};
  for (const f of fs.readdirSync(dir)) if (/\.(fbx|glb|png)$/i.test(f)) files[f] = () => fs.readFileSync(path.join(dir, f));
  return files;
}

// ---------------------------------------------------------------- FBX (binary) reader
// Array properties are left compressed until asked for, so the normals/tangents layers of a
// 7-million-triangle export never get decoded.
export function parseFBX(b) {
  if (b.toString('latin1', 0, 18) !== 'Kaydara FBX Binary') throw new Error('only binary FBX is supported (re-export as binary)');
  const ver = b.readUInt32LE(23), big = ver >= 7500;
  function node(o) {
    let end, np;
    if (big) { end = Number(b.readBigUInt64LE(o)); np = Number(b.readBigUInt64LE(o + 8)); o += 24; }
    else { end = b.readUInt32LE(o); np = b.readUInt32LE(o + 4); o += 12; }
    const nl = b[o]; o += 1;
    if (end === 0) return [null, o + nl];
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
          props.push({ arr: t, len, enc, raw: b.subarray(o, o + cl) }); o += cl; break;
        }
        case 'S': case 'R': { const len = b.readUInt32LE(o); o += 4; props.push(b.subarray(o, o + len)); o += len; break; }
        default: throw new Error(`bad FBX property type ${t} at byte ${o - 1}`);
      }
    }
    const kids = [];
    while (o < end) { const [k, o2] = node(o); o = o2; if (!k) break; kids.push(k); }
    return [{ name, props, kids }, end];
  }
  const top = []; let o = 27;
  while (o < b.length - (big ? 25 : 13)) { const [n, o2] = node(o); if (!n) break; top.push(n); o = o2; }
  return top;
}
const ARR = { f: Float32Array, d: Float64Array, l: BigInt64Array, i: Int32Array, b: Uint8Array };
function fbxArray(p) {
  if (!p || !p.arr) throw new Error('expected an FBX array property');
  const T = ARR[p.arr], bytes = p.enc === 1 ? zlib.inflateSync(p.raw) : p.raw, out = new T(p.len);
  new Uint8Array(out.buffer).set(bytes.subarray(0, p.len * T.BYTES_PER_ELEMENT));
  return out;
}
const asInt32 = a => a instanceof Int32Array ? a : a instanceof BigInt64Array ? Int32Array.from(a, Number) : Int32Array.from(a);
const findAll = (nodes, name, out = []) => { for (const n of nodes) { if (n.name === name) out.push(n); findAll(n.kids, name, out); } return out; };
const kid = (n, name) => n && n.kids.find(k => k.name === name);
const str = n => (n ? n.props[0].toString('latin1') : '');

// mesh: { P: Float64Array xyz per position, tris: Int32Array position index per corner, UV: Float32Array 2 per corner
//         (FBX convention: v up from the bottom) }
export function meshFromFBX(buf) {
  const top = parseFBX(buf);
  const geos = findAll(top, 'Geometry').filter(g => kid(g, 'Vertices') && kid(g, 'PolygonVertexIndex'));
  if (!geos.length) throw new Error('no mesh geometry in FBX');
  const parts = []; let nP = 0, nT = 0;
  for (const g of geos) {
    const V = fbxArray(kid(g, 'Vertices').props[0]), PI = asInt32(fbxArray(kid(g, 'PolygonVertexIndex').props[0]));
    let tris = 0, start = 0;
    for (let c = 0; c < PI.length; c++) if (PI[c] < 0) { tris += Math.max(0, c - start - 1); start = c + 1; }
    const uvl = findAll(g.kids, 'LayerElementUV')[0];
    let UV = null, UVI = null, map = 'ByPolygonVertex', ref = 'Direct';
    if (uvl) {
      UV = fbxArray(kid(uvl, 'UV').props[0]);
      map = str(kid(uvl, 'MappingInformationType')) || map; ref = str(kid(uvl, 'ReferenceInformationType')) || ref;
      if (ref !== 'Direct' && kid(uvl, 'UVIndex')) UVI = asInt32(fbxArray(kid(uvl, 'UVIndex').props[0]));
    }
    parts.push({ V, PI, UV, UVI, map, tris }); nP += V.length / 3; nT += tris;
  }
  const P = new Float64Array(nP * 3), tris = new Int32Array(nT * 3), UV = new Float32Array(nT * 6);
  let pBase = 0, t = 0;
  for (const g of parts) {
    const { V, PI, UV: guv, UVI, map } = g, nv = V.length / 3;
    P.set(V, pBase * 3);
    const byVert = map === 'ByVertice' || map === 'ByVertex' || map === 'ByControlPoint', byPoly = map === 'ByPolygon', same = map === 'AllSame';
    let start = 0, poly = 0;
    for (let c = 0; c < PI.length; c++) {
      if (PI[c] >= 0) continue;
      const end = c;
      for (let k = start + 1; k < end; k++) {
        const cs = [start, k, k + 1];
        for (let q = 0; q < 3; q++) {
          const ck = cs[q], vi = ck === end ? ~PI[ck] : PI[ck];
          if (vi < 0 || vi >= nv) throw new Error(`FBX vertex index ${vi} out of range`);
          tris[t * 3 + q] = vi + pBase;
          if (guv) {
            let j = byVert ? vi : byPoly ? poly : same ? 0 : ck;
            if (UVI) j = UVI[j];
            UV[t * 6 + q * 2] = guv[j * 2]; UV[t * 6 + q * 2 + 1] = guv[j * 2 + 1];
          }
        }
        t++;
      }
      start = c + 1; poly++;
    }
    pBase += nv;
  }
  return { P, tris, UV };
}

// ---------------------------------------------------------------- GLB reader (re-reducing earlier Mesh Lab exports)
export function meshFromGLB(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');
  const jl = buf.readUInt32LE(12), js = JSON.parse(buf.toString('utf8', 20, 20 + jl));
  const bs = 20 + jl + 8;
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const CT = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array, 5122: Int16Array, 5120: Int8Array };
  const acc = i => {
    const a = js.accessors[i], bv = js.bufferViews[a.bufferView], n = NC[a.type], T = CT[a.componentType];
    if (a.sparse) throw new Error('sparse accessors are not supported');
    const es = T.BYTES_PER_ELEMENT, stride = bv.byteStride || n * es, base = bs + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = new Float64Array(a.count * n), dv = new DataView(buf.buffer, buf.byteOffset);
    const get = { 5126: o => dv.getFloat32(o, true), 5125: o => dv.getUint32(o, true), 5123: o => dv.getUint16(o, true), 5121: o => dv.getUint8(o), 5122: o => dv.getInt16(o, true), 5120: o => dv.getInt8(o) }[a.componentType];
    const norm = a.normalized ? { 5123: 65535, 5121: 255, 5122: 32767, 5120: 127 }[a.componentType] || 1 : 1;
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = get(base + k * stride + c * es) / norm;
    return out;
  };
  const prims = js.meshes[0].primitives.filter(p => (p.mode ?? 4) === 4);
  if (js.meshes.length > 1 || prims.length > 1) console.warn('warning: only the first mesh primitive of the GLB is used');
  const p = prims[0], P = acc(p.attributes.POSITION), nv = P.length / 3;
  const I = p.indices !== undefined ? acc(p.indices) : Float64Array.from({ length: nv }, (_, i) => i);
  const UVv = p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null;
  const tris = Int32Array.from(I), UV = new Float32Array(tris.length * 2);
  if (UVv) for (let c = 0; c < tris.length; c++) { UV[c * 2] = UVv[tris[c] * 2]; UV[c * 2 + 1] = 1 - UVv[tris[c] * 2 + 1]; }
  const image = ti => {
    if (ti === undefined || !js.textures?.[ti]) return null;
    const im = js.images[js.textures[ti].source], bv = js.bufferViews[im.bufferView];
    return { bytes: buf.subarray(bs + (bv.byteOffset || 0), bs + (bv.byteOffset || 0) + bv.byteLength), mime: im.mimeType };
  };
  const m = js.materials?.[p.material] || {}, pbr = m.pbrMetallicRoughness || {};
  return {
    P, tris, UV,
    glb: { base: image(pbr.baseColorTexture?.index), normal: image(m.normalTexture?.index), mr: image(pbr.metallicRoughnessTexture?.index),
           metallic: pbr.metallicFactor ?? 1, roughness: pbr.roughnessFactor ?? 1, alphaMode: m.alphaMode, alphaCutoff: m.alphaCutoff }
  };
}

// ---------------------------------------------------------------- hashing helpers
const pow2 = n => { let c = 1024; while (c < n) c *= 2; return c; };
const hash3 = (a, b, c) => (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791));

function extentOf(P) {
  const ex = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { const v = P[i + a]; if (v < ex[a * 2]) ex[a * 2] = v; if (v > ex[a * 2 + 1]) ex[a * 2 + 1] = v; }
  return ex;
}
const maxSpan = ex => Math.max(ex[1] - ex[0], ex[3] - ex[2], ex[5] - ex[4]) || 1;

// drop triangles that use the same position twice (keeps their corner UVs in step)
function dropDegenerate(mesh) {
  const { tris, UV } = mesh, nt = tris.length / 3; let d = 0;
  for (let t = 0; t < nt; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    if (d !== t) { tris[d * 3] = a; tris[d * 3 + 1] = b; tris[d * 3 + 2] = c; for (let k = 0; k < 6; k++) UV[d * 6 + k] = UV[t * 6 + k]; }
    d++;
  }
  mesh.tris = tris.subarray(0, d * 3); mesh.UV = UV.subarray(0, d * 6);
  return mesh;
}

// ---------------------------------------------------------------- weld positions (so UV seams don't block reduction)
export function weld(mesh) {
  const { P, tris } = mesh, n = P.length / 3, ex = extentOf(P), eps = maxSpan(ex) * 1e-6;
  const cap = pow2(n * 2), mask = cap - 1, table = new Int32Array(cap).fill(-1);
  const q = new Int32Array(n * 3), map = new Int32Array(n), out = new Float64Array(n * 3); let u = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.round((P[i * 3] - ex[0]) / eps), y = Math.round((P[i * 3 + 1] - ex[2]) / eps), z = Math.round((P[i * 3 + 2] - ex[4]) / eps);
    let h = hash3(x, y, z) & mask;
    for (;;) {
      const j = table[h];
      if (j < 0) { table[h] = u; q[u * 3] = x; q[u * 3 + 1] = y; q[u * 3 + 2] = z; out[u * 3] = P[i * 3]; out[u * 3 + 1] = P[i * 3 + 1]; out[u * 3 + 2] = P[i * 3 + 2]; map[i] = u++; break; }
      if (q[j * 3] === x && q[j * 3 + 1] === y && q[j * 3 + 2] === z) { map[i] = j; break; }
      h = (h + 1) & mask;
    }
  }
  for (let c = 0; c < tris.length; c++) tris[c] = map[tris[c]];
  mesh.P = out.slice(0, u * 3); mesh.extent = ex;
  return dropDegenerate(mesh);
}

// ---------------------------------------------------------------- vertex clustering (fast first pass for huge meshes)
function clusterIds(P, ex, cells, ids) {
  const s = maxSpan(ex) / cells, dy = Math.floor((ex[3] - ex[2]) / s) + 1, dz = Math.floor((ex[5] - ex[4]) / s) + 1;
  const n = P.length / 3, cap = pow2(n * 2), mask = cap - 1, keys = new Float64Array(cap).fill(-1), vals = new Int32Array(cap); let k = 0;
  for (let i = 0; i < n; i++) {
    const ix = Math.floor((P[i * 3] - ex[0]) / s), iy = Math.floor((P[i * 3 + 1] - ex[2]) / s), iz = Math.floor((P[i * 3 + 2] - ex[4]) / s);
    const key = (ix * dy + iy) * dz + iz;
    let h = hash3(ix, iy, iz) & mask;
    while (keys[h] !== -1 && keys[h] !== key) h = (h + 1) & mask;
    if (keys[h] === -1) { keys[h] = key; vals[h] = k++; }
    ids[i] = vals[h];
  }
  return k;
}
// UV wedges: corners at the same position with the same UV share a wedge id.
function uvWedges(mesh) {
  const { P, tris, UV } = mesh, nc = tris.length, n = P.length / 3;
  const head = new Int32Array(n).fill(-1), next = new Int32Array(nc), wu = new Float32Array(nc * 2), wedge = new Int32Array(nc); let nw = 0;
  for (let c = 0; c < nc; c++) {
    const v = tris[c], u = UV[c * 2], w = UV[c * 2 + 1];
    let j = head[v];
    while (j >= 0 && !(wu[j * 2] === u && wu[j * 2 + 1] === w)) j = next[j];
    if (j < 0) { j = nw++; wu[j * 2] = u; wu[j * 2 + 1] = w; next[j] = head[v]; head[v] = j; }
    wedge[c] = j;
  }
  return { wedge, nw };
}
export function cluster(mesh, want) {
  const { P, tris, UV } = mesh, ex = mesh.extent || extentOf(P), n = P.length / 3, nt = tris.length / 3, ids = new Int32Array(n);
  const countTris = () => { let c = 0; for (let t = 0; t < nt; t++) { const a = ids[tris[t * 3]], b = ids[tris[t * 3 + 1]], d = ids[tris[t * 3 + 2]]; if (a !== b && b !== d && a !== d) c++; } return c; };
  // Size the grid by occupied cells (a clean surface has ~2 triangles per vertex), not by surviving triangles:
  // small closed pieces spanning a few cells (leaf blobs, grass blades) make many overlapping triangles and
  // would push the grid far too coarse. Occupied cells grow with cells^2 on a surface: a few secant steps.
  let cells = 128, ncell = 0;
  for (let k = 0; k < 8; k++) {
    ncell = clusterIds(P, ex, cells, ids);
    if (Math.abs(ncell / (want / 2) - 1) < 0.15) break;
    cells = Math.max(4, Math.round(cells * Math.sqrt(want / 2 / Math.max(ncell, 1))));
  }
  // Within a cell, only merge vertices joined by edges inside that cell: separate sheets (two touching leaf
  // blobs, both sides of a thin branch) stay separate vertices, which keeps the result close to manifold.
  {
    const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let c = 0; c < nt * 3; c++) {
      const a = tris[c], b = tris[c - (c % 3) + ((c % 3) + 1) % 3];
      if (ids[a] === ids[b]) { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; }
    }
    const dense = new Int32Array(n).fill(-1); ncell = 0;
    for (let i = 0; i < n; i++) { const r = find(i); if (dense[r] < 0) dense[r] = ncell++; ids[i] = dense[r]; }
  }
  // UV islands inside each new vertex: wedges joined by a triangle edge that stays inside the cell piece. Corners
  // on the two sides of a UV seam never join, so they keep separate UVs after clustering.
  const { wedge: chart, nw } = uvWedges(mesh);
  {
    const parent = new Int32Array(nw); for (let i = 0; i < nw; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let c = 0; c < nt * 3; c++) {
      const c2 = c - (c % 3) + ((c % 3) + 1) % 3;
      if (ids[tris[c]] === ids[tris[c2]]) { const ra = find(chart[c]), rb = find(chart[c2]); if (ra !== rb) parent[rb] = ra; }
    }
    for (let c = 0; c < nt * 3; c++) chart[c] = find(chart[c]);
  }
  const got = countTris();
  const NP = new Float64Array(ncell * 3), cnt = new Float64Array(ncell);
  for (let i = 0; i < n; i++) { const c = ids[i]; NP[c * 3] += P[i * 3]; NP[c * 3 + 1] += P[i * 3 + 1]; NP[c * 3 + 2] += P[i * 3 + 2]; cnt[c]++; }
  for (let c = 0; c < ncell; c++) if (cnt[c]) { NP[c * 3] /= cnt[c]; NP[c * 3 + 1] /= cnt[c]; NP[c * 3 + 2] /= cnt[c]; }
  // keep one copy of each surviving triangle (many collapse onto the same three cells)
  const nt2 = new Int32Array(got * 3), nuv = new Float32Array(got * 6), cap = pow2(got * 2), mask = cap - 1, table = new Int32Array(cap).fill(-1);
  let d = 0;
  for (let t = 0; t < nt; t++) {
    const a = ids[tris[t * 3]], b = ids[tris[t * 3 + 1]], c = ids[tris[t * 3 + 2]];
    if (a === b || b === c || a === c) continue;
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi;
    let h = hash3(lo, mid, hi) & mask, dup = false;
    while (table[h] >= 0) {
      const e = table[h], x = nt2[e * 3], y = nt2[e * 3 + 1], z = nt2[e * 3 + 2];
      if (Math.min(x, y, z) === lo && Math.max(x, y, z) === hi && x + y + z - lo - hi === mid) { dup = true; break; }
      h = (h + 1) & mask;
    }
    if (dup) continue;
    table[h] = d; nt2[d * 3] = a; nt2[d * 3 + 1] = b; nt2[d * 3 + 2] = c;
    for (let k = 0; k < 6; k++) nuv[d * 6 + k] = UV[t * 6 + k];
    for (let k = 0; k < 3; k++) chart[d * 3 + k] = chart[t * 3 + k];    // d <= t: safe to compact in place
    d++;
  }
  // every corner of one UV island in one new vertex shares a UV (their average), so seams stay exact
  const gcap = pow2(d * 6), gmask = gcap - 1, gkey = new Float64Array(gcap).fill(-1), gid = new Int32Array(gcap), gsum = new Float64Array(d * 9), grp = new Int32Array(d * 3); let ng = 0;
  for (let c = 0; c < d * 3; c++) {
    const v = nt2[c], key = v * 4294967296 + chart[c];
    let h = hash3(v, chart[c], 7) & gmask;
    while (gkey[h] !== -1 && gkey[h] !== key) h = (h + 1) & gmask;
    if (gkey[h] === -1) { gkey[h] = key; gid[h] = ng++; }
    const g = gid[h]; grp[c] = g; gsum[g * 3] += nuv[c * 2]; gsum[g * 3 + 1] += nuv[c * 2 + 1]; gsum[g * 3 + 2]++;
  }
  for (let c = 0; c < d * 3; c++) { const g = grp[c]; nuv[c * 2] = gsum[g * 3] / gsum[g * 3 + 2]; nuv[c * 2 + 1] = gsum[g * 3 + 1] / gsum[g * 3 + 2]; }
  mesh.P = NP; mesh.tris = nt2.subarray(0, d * 3); mesh.UV = nuv.subarray(0, d * 6); mesh.extent = ex;
  return mesh;
}

// ---------------------------------------------------------------- quadric edge collapse
// After Sven Forstmann's Fast-Quadric-Mesh-Simplification (MIT), with per-corner UVs carried along:
// each moved corner gets the UV of the new position inside its own triangle (barycentric), and an edge
// from a UV-seam vertex to an interior vertex collapses onto the seam vertex so the seam stays put.
export function simplify(mesh, target, aggressiveness = 7) {
  const nv = mesh.P.length / 3, nt0 = mesh.tris.length / 3;
  const ex = extentOf(mesh.P), sc = maxSpan(ex), cx = (ex[0] + ex[1]) / 2, cy = (ex[2] + ex[3]) / 2, cz = (ex[4] + ex[5]) / 2;
  const vp = new Float64Array(nv * 3);
  for (let i = 0; i < nv; i++) { vp[i * 3] = (mesh.P[i * 3] - cx) / sc; vp[i * 3 + 1] = (mesh.P[i * 3 + 1] - cy) / sc; vp[i * 3 + 2] = (mesh.P[i * 3 + 2] - cz) / sc; }
  const vq = new Float64Array(nv * 10), vstart = new Int32Array(nv), vcount = new Int32Array(nv), vborder = new Uint8Array(nv), vseam = new Uint8Array(nv);
  const tv = Int32Array.from(mesh.tris), tuv = Float32Array.from(mesh.UV);
  const terr = new Float64Array(nt0 * 4), tdel = new Uint8Array(nt0), tdirty = new Uint8Array(nt0), tn = new Float64Array(nt0 * 3);
  let refT = new Int32Array(nt0 * 6), refV = new Uint8Array(nt0 * 6), nref = 0;
  const pushRef = (t, v) => {
    if (nref === refT.length) { const a = new Int32Array(refT.length * 2), b = new Uint8Array(refT.length * 2); a.set(refT); b.set(refV); refT = a; refV = b; }
    refT[nref] = t; refV[nref] = v; nref++;
  };
  const Q = new Float64Array(10), p = [0, 0, 0], tmp = [0, 0, 0];
  const qadd = (o, a, b, c, d) => { vq[o] += a * a; vq[o + 1] += a * b; vq[o + 2] += a * c; vq[o + 3] += a * d; vq[o + 4] += b * b; vq[o + 5] += b * c; vq[o + 6] += b * d; vq[o + 7] += c * c; vq[o + 8] += c * d; vq[o + 9] += d * d; };
  const det = (a11, a12, a13, a21, a22, a23, a31, a32, a33) =>
    Q[a11] * Q[a22] * Q[a33] + Q[a13] * Q[a21] * Q[a32] + Q[a12] * Q[a23] * Q[a31] - Q[a13] * Q[a22] * Q[a31] - Q[a11] * Q[a23] * Q[a32] - Q[a12] * Q[a21] * Q[a33];
  const verr = (x, y, z) => Q[0] * x * x + 2 * Q[1] * x * y + 2 * Q[2] * x * z + 2 * Q[3] * x + Q[4] * y * y + 2 * Q[5] * y * z + 2 * Q[6] * y + Q[7] * z * z + 2 * Q[8] * z + Q[9];
  // error of collapsing i0-i1, best position into out. Seam / border vertices restrict where the result may go.
  function calcError(i0, i1, out) {
    for (let k = 0; k < 10; k++) Q[k] = vq[i0 * 10 + k] + vq[i1 * 10 + k];
    const s0 = vseam[i0], s1 = vseam[i1];
    if (s0 !== s1) { const v = s0 ? i0 : i1; out[0] = vp[v * 3]; out[1] = vp[v * 3 + 1]; out[2] = vp[v * 3 + 2]; return verr(out[0], out[1], out[2]); }
    const d = det(0, 1, 2, 1, 4, 5, 2, 5, 7);
    if (d !== 0 && !(vborder[i0] && vborder[i1]) && !s0) {
      out[0] = -1 / d * det(1, 2, 3, 4, 5, 6, 5, 7, 8);
      out[1] = 1 / d * det(0, 2, 3, 1, 5, 6, 2, 7, 8);
      out[2] = -1 / d * det(0, 1, 3, 1, 4, 6, 2, 5, 8);
      return verr(out[0], out[1], out[2]);
    }
    const a = i0 * 3, b = i1 * 3, mx = (vp[a] + vp[b]) / 2, my = (vp[a + 1] + vp[b + 1]) / 2, mz = (vp[a + 2] + vp[b + 2]) / 2;
    const e1 = verr(vp[a], vp[a + 1], vp[a + 2]), e2 = verr(vp[b], vp[b + 1], vp[b + 2]), e3 = verr(mx, my, mz), e = Math.min(e1, e2, e3);
    if (e === e1) { out[0] = vp[a]; out[1] = vp[a + 1]; out[2] = vp[a + 2]; }
    else if (e === e2) { out[0] = vp[b]; out[1] = vp[b + 1]; out[2] = vp[b + 2]; }
    else { out[0] = mx; out[1] = my; out[2] = mz; }
    return e;
  }
  function triNormal(t, out) {
    const a = tv[t * 3] * 3, b = tv[t * 3 + 1] * 3, c = tv[t * 3 + 2] * 3;
    const ux = vp[b] - vp[a], uy = vp[b + 1] - vp[a + 1], uz = vp[b + 2] - vp[a + 2], wx = vp[c] - vp[a], wy = vp[c + 1] - vp[a + 1], wz = vp[c + 2] - vp[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
  }
  const triErr = t => {
    for (let j = 0; j < 3; j++) terr[t * 4 + j] = calcError(tv[t * 3 + j], tv[t * 3 + (j + 1) % 3], p);
    terr[t * 4 + 3] = Math.min(terr[t * 4], terr[t * 4 + 1], terr[t * 4 + 2]);
  };
  let nt = nt0;
  function compact() {
    let d = 0;
    for (let t = 0; t < nt; t++) if (!tdel[t]) {
      if (d !== t) {
        for (let j = 0; j < 3; j++) tv[d * 3 + j] = tv[t * 3 + j];
        for (let k = 0; k < 6; k++) tuv[d * 6 + k] = tuv[t * 6 + k];
        for (let k = 0; k < 4; k++) terr[d * 4 + k] = terr[t * 4 + k];
        for (let k = 0; k < 3; k++) tn[d * 3 + k] = tn[t * 3 + k];
      }
      tdel[d] = 0; d++;
    }
    nt = d;
  }
  function buildRefs() {
    vcount.fill(0);
    for (let c = 0; c < nt * 3; c++) vcount[tv[c]]++;
    let s = 0; for (let i = 0; i < nv; i++) { vstart[i] = s; s += vcount[i]; vcount[i] = 0; }
    if (refT.length < s) { refT = new Int32Array(s * 2); refV = new Uint8Array(s * 2); }
    for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) { const v = tv[t * 3 + j], k = vstart[v] + vcount[v]++; refT[k] = t; refV[k] = j; }
    nref = s;
  }
  function init() {
    buildRefs();
    // border: an edge used by one triangle only. seam: a vertex whose corners disagree on UV.
    const nb = [], nc = [];
    for (let i = 0; i < nv; i++) {
      nb.length = 0; nc.length = 0;
      if (!vcount[i]) continue;
      const r0 = vstart[i], u0 = tuv[refT[r0] * 6 + refV[r0] * 2], w0 = tuv[refT[r0] * 6 + refV[r0] * 2 + 1];
      for (let k = r0; k < r0 + vcount[i]; k++) {
        const t = refT[k], cu = tuv[t * 6 + refV[k] * 2], cw = tuv[t * 6 + refV[k] * 2 + 1];
        if (cu !== u0 || cw !== w0) vseam[i] = 1;
        for (let j = 0; j < 3; j++) {
          const v = tv[t * 3 + j]; if (v === i) continue;
          const m = nb.indexOf(v); if (m < 0) { nb.push(v); nc.push(1); } else nc[m]++;
        }
      }
      for (let m = 0; m < nb.length; m++) if (nc[m] === 1) { vborder[i] = 1; vborder[nb[m]] = 1; }
    }
    for (let t = 0; t < nt; t++) {
      triNormal(t, tmp); tn[t * 3] = tmp[0]; tn[t * 3 + 1] = tmp[1]; tn[t * 3 + 2] = tmp[2];
      const a = tv[t * 3] * 3, d = -(tmp[0] * vp[a] + tmp[1] * vp[a + 1] + tmp[2] * vp[a + 2]);
      for (let j = 0; j < 3; j++) qadd(tv[t * 3 + j] * 10, tmp[0], tmp[1], tmp[2], d);
    }
    for (let t = 0; t < nt; t++) triErr(t);
  }
  let del0 = new Uint8Array(64), del1 = new Uint8Array(64);
  // would moving i0 to (px,py,pz) flip or crush any of its other triangles? marks the ones that vanish.
  function flipped(px, py, pz, i0, i1, del) {
    for (let k = 0; k < vcount[i0]; k++) {
      const r = vstart[i0] + k, t = refT[r]; if (tdel[t]) continue;
      const s = refV[r], id1 = tv[t * 3 + (s + 1) % 3], id2 = tv[t * 3 + (s + 2) % 3];
      if (id1 === i1 || id2 === i1) { del[k] = 1; continue; }
      let ax = vp[id1 * 3] - px, ay = vp[id1 * 3 + 1] - py, az = vp[id1 * 3 + 2] - pz; const la = Math.hypot(ax, ay, az) || 1; ax /= la; ay /= la; az /= la;
      let bx = vp[id2 * 3] - px, by = vp[id2 * 3 + 1] - py, bz = vp[id2 * 3 + 2] - pz; const lb = Math.hypot(bx, by, bz) || 1; bx /= lb; by /= lb; bz /= lb;
      if (Math.abs(ax * bx + ay * by + az * bz) > 0.999) return true;
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, ln = Math.hypot(nx, ny, nz) || 1;
      del[k] = 0;
      if ((nx * tn[t * 3] + ny * tn[t * 3 + 1] + nz * tn[t * 3 + 2]) / ln < 0.2) return true;
    }
    return false;
  }
  // UV of point (px,py,pz) in triangle t's own UV space (barycentric, mildly clamped) → uvOut; false if degenerate
  const uvOut = [0, 0];
  function uvAt(t, px, py, pz) {
    const a = tv[t * 3] * 3, b = tv[t * 3 + 1] * 3, c = tv[t * 3 + 2] * 3;
    const v0x = vp[b] - vp[a], v0y = vp[b + 1] - vp[a + 1], v0z = vp[b + 2] - vp[a + 2], v1x = vp[c] - vp[a], v1y = vp[c + 1] - vp[a + 1], v1z = vp[c + 2] - vp[a + 2];
    const v2x = px - vp[a], v2y = py - vp[a + 1], v2z = pz - vp[a + 2];
    const d00 = v0x * v0x + v0y * v0y + v0z * v0z, d01 = v0x * v1x + v0y * v1y + v0z * v1z, d11 = v1x * v1x + v1y * v1y + v1z * v1z;
    const d20 = v2x * v0x + v2y * v0y + v2z * v0z, d21 = v2x * v1x + v2y * v1y + v2z * v1z, den = d00 * d11 - d01 * d01;
    if (!(Math.abs(den) > 1e-30)) return false;
    let wb = (d11 * d20 - d01 * d21) / den, wc = (d00 * d21 - d01 * d20) / den, wa = 1 - wb - wc;
    wa = Math.min(2, Math.max(-1, wa)); wb = Math.min(2, Math.max(-1, wb)); wc = Math.min(2, Math.max(-1, wc));
    const sum = wa + wb + wc; if (Math.abs(sum) < 1e-9) return false;
    const o = t * 6; uvOut[0] = (wa * tuv[o] + wb * tuv[o + 2] + wc * tuv[o + 4]) / sum; uvOut[1] = (wa * tuv[o + 1] + wb * tuv[o + 3] + wc * tuv[o + 5]) / sum;
    return true;
  }
  // New UVs for the corners of i0 and i1 before i1 is merged into i0 at (px,py,pz). A vertex inside one UV chart
  // gets a single UV for all its corners, read from a triangle on the collapsing edge (an interpolation, not a
  // guess). A seam vertex keeps one UV per triangle, each from that triangle's own corners.
  function updateUVs(i0, i1, px, py, pz) {
    let edgeT = -1;
    for (let k = 0; k < vcount[i0] && edgeT < 0; k++) { const t = refT[vstart[i0] + k]; if (!tdel[t] && del0[k]) edgeT = t; }
    const shared = edgeT >= 0 && uvAt(edgeT, px, py, pz), su = uvOut[0], sw = uvOut[1];
    for (const [v, del] of [[i0, del0], [i1, del1]]) {
      const own = vseam[v] || !shared;
      for (let k = 0; k < vcount[v]; k++) {
        const r = vstart[v] + k, t = refT[r]; if (tdel[t] || del[k]) continue;
        const o = t * 6 + refV[r] * 2;
        if (!own) { tuv[o] = su; tuv[o + 1] = sw; } else if (uvAt(t, px, py, pz)) { tuv[o] = uvOut[0]; tuv[o + 1] = uvOut[1]; }
      }
    }
  }
  let deleted = 0;
  function updateTriangles(i0, v, del) {
    for (let k = 0; k < vcount[v]; k++) {
      const r = vstart[v] + k, t = refT[r]; if (tdel[t]) continue;
      if (del[k]) { tdel[t] = 1; deleted++; continue; }
      tv[t * 3 + refV[r]] = i0; tdirty[t] = 1;
      triNormal(t, tmp); tn[t * 3] = tmp[0]; tn[t * 3 + 1] = tmp[1]; tn[t * 3 + 2] = tmp[2];
      triErr(t);
      pushRef(t, refV[r]);
    }
  }
  init();
  let iter = 0, idle = 0;
  for (; iter < 150; iter++) {
    if (nt0 - deleted <= target) break;
    const before = deleted;
    if (iter > 0 && iter % 5 === 0) { compact(); buildRefs(); }
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
        if (del0.length < c0) del0 = new Uint8Array(c0 * 2);
        if (del1.length < c1) del1 = new Uint8Array(c1 * 2);
        if (flipped(p[0], p[1], p[2], i0, i1, del0) || flipped(p[0], p[1], p[2], i1, i0, del1)) continue;
        updateUVs(i0, i1, p[0], p[1], p[2]);
        vp[i0 * 3] = p[0]; vp[i0 * 3 + 1] = p[1]; vp[i0 * 3 + 2] = p[2];
        for (let k = 0; k < 10; k++) vq[i0 * 10 + k] += vq[i1 * 10 + k];
        vseam[i0] |= vseam[i1];
        const tstart = nref;
        updateTriangles(i0, i0, del0);
        updateTriangles(i0, i1, del1);
        const tcount = nref - tstart;
        if (tcount <= c0) { refT.copyWithin(vstart[i0], tstart, nref); refV.copyWithin(vstart[i0], tstart, nref); nref = tstart; }
        else vstart[i0] = tstart;
        vcount[i0] = tcount;
        break;
      }
      if (nt0 - deleted <= target) break;
    }
    idle = deleted === before && iter > 20 ? idle + 1 : 0;
    if (idle >= 3) break;                     // nothing collapses any more: stop instead of rescanning
  }
  compact();
  if (nt > target * 1.02) console.warn(`warning: stopped at ${nt} triangles (borders/seams block further collapse)`);
  const P = new Float64Array(nv * 3);
  for (let i = 0; i < nv; i++) { P[i * 3] = vp[i * 3] * sc + cx; P[i * 3 + 1] = vp[i * 3 + 1] * sc + cy; P[i * 3 + 2] = vp[i * 3 + 2] * sc + cz; }
  mesh.P = P; mesh.tris = tv.slice(0, nt * 3); mesh.UV = tuv.slice(0, nt * 6);
  return dropDegenerate(mesh);
}

// ---------------------------------------------------------------- output vertices: split by UV, crease-aware normals
export function buildOutput(mesh, yup = false, creaseDeg = 60) {
  const { P, tris, UV } = mesh, nt = tris.length / 3, nv = P.length / 3;
  const fn = new Float64Array(nt * 3), fa = new Float64Array(nt * 3);   // unit and area-weighted face normals
  for (let t = 0; t < nt; t++) {
    const a = tris[t * 3] * 3, b = tris[t * 3 + 1] * 3, c = tris[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
    fa[t * 3] = nx; fa[t * 3 + 1] = ny; fa[t * 3 + 2] = nz; fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l;
  }
  const cnt = new Int32Array(nv + 1); for (let c = 0; c < tris.length; c++) cnt[tris[c] + 1]++;
  for (let i = 0; i < nv; i++) cnt[i + 1] += cnt[i];
  const around = new Int32Array(tris.length), fill = cnt.slice();
  for (let c = 0; c < tris.length; c++) around[fill[tris[c]]++] = (c / 3) | 0;
  const CREASE = Math.cos(creaseDeg * Math.PI / 180), max = tris.length;
  const pos = new Float32Array(max * 3), nor = new Float32Array(max * 3), uv = new Float32Array(max * 2), idx = new Uint32Array(max);
  const head = new Int32Array(nv).fill(-1), next = new Int32Array(max); let n = 0;
  for (let c = 0; c < tris.length; c++) {
    const v = tris[c], t = (c / 3) | 0;
    let nx = 0, ny = 0, nz = 0;
    for (let k = cnt[v]; k < cnt[v + 1]; k++) {
      const s = around[k];
      if (fn[s * 3] * fn[t * 3] + fn[s * 3 + 1] * fn[t * 3 + 1] + fn[s * 3 + 2] * fn[t * 3 + 2] >= CREASE) { nx += fa[s * 3]; ny += fa[s * 3 + 1]; nz += fa[s * 3 + 2]; }
    }
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const u = UV[c * 2], w = 1 - UV[c * 2 + 1];            // glTF UV origin is top-left
    let j = head[v];
    while (j >= 0 && !(Math.abs(uv[j * 2] - u) < 1e-5 && Math.abs(uv[j * 2 + 1] - w) < 1e-5 && nor[j * 3] * nx + nor[j * 3 + 1] * ny + nor[j * 3 + 2] * nz > 0.9999)) j = next[j];
    if (j < 0) {
      j = n++; next[j] = head[v]; head[v] = j;
      pos[j * 3] = P[v * 3]; pos[j * 3 + 1] = P[v * 3 + 1]; pos[j * 3 + 2] = P[v * 3 + 2];
      nor[j * 3] = nx; nor[j * 3 + 1] = ny; nor[j * 3 + 2] = nz; uv[j * 2] = u; uv[j * 2 + 1] = w;
    }
    idx[c] = j;
  }
  const geo = { pos: pos.slice(0, n * 3), nor: nor.slice(0, n * 3), uv: uv.slice(0, n * 2), idx };
  if (yup) for (const a of [geo.pos, geo.nor]) for (let i = 0; i < a.length; i += 3) { const y = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = -y; }   // Z-up → Y-up
  return geo;
}

// ---------------------------------------------------------------- PNG decode / resize / encode
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return ~c >>> 0; }
// any non-interlaced PNG (grey, RGB, palette, grey+alpha, RGBA; 1–16 bit) → RGBA8
export function decodePNG(buf) {
  if (!buf || buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let o = 8, w, h, depth, ctype, inter, plte = null, trns = null; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; inter = d[12]; }
    else if (type === 'PLTE') plte = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
  }
  if (inter) throw new Error('interlaced PNGs are not supported');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = Math.ceil(w * ch * depth / 8), bpp = Math.max(1, ch * depth / 8), out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  const maxv = (1 << depth) - 1, sample = (row, i) => depth === 8 ? row[i] : depth === 16 ? row[i * 2] : Math.round(((row[(i * depth) >> 3] >> (8 - depth - ((i * depth) & 7))) & maxv) * 255 / maxv);
  const sampleRaw = (row, i) => depth === 8 ? row[i] : depth === 16 ? row[i * 2] : (row[(i * depth) >> 3] >> (8 - depth - ((i * depth) & 7))) & maxv;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const d = (y * w + x) * 4;
      if (ctype === 3) { const i = sampleRaw(cur, x); out[d] = plte[i * 3]; out[d + 1] = plte[i * 3 + 1]; out[d + 2] = plte[i * 3 + 2]; out[d + 3] = trns && i < trns.length ? trns[i] : 255; }
      else if (ch === 1) { out[d] = out[d + 1] = out[d + 2] = sample(cur, x); out[d + 3] = 255; }
      else if (ch === 2) { out[d] = out[d + 1] = out[d + 2] = sample(cur, x * 2); out[d + 3] = sample(cur, x * 2 + 1); }
      else { out[d] = sample(cur, x * ch); out[d + 1] = sample(cur, x * ch + 1); out[d + 2] = sample(cur, x * ch + 2); out[d + 3] = ch === 4 ? sample(cur, x * ch + 3) : 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { w, h, data: out };
}
export function resize(img, size) {
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
export function encodePNG(img, alpha) {
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
const hasAlpha = img => { for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) return true; return false; };

// ---------------------------------------------------------------- GLB writer
// tex: { base, normal, mr: { bytes, mime } | null, alpha, metallic, roughness }
export function writeGLB(out, geo, tex, name) {
  const views = [], parts = []; let len = 0;
  const add = (buf, target) => {
    while (len % 4) { parts.push(Buffer.alloc(1)); len++; }
    const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    views.push({ buffer: 0, byteOffset: len, byteLength: b.length, ...(target ? { target } : {}) }); parts.push(b); len += b.length; return views.length - 1;
  };
  const vp = add(geo.pos, 34962), vn = add(geo.nor, 34962), vt = add(geo.uv, 34962), vi = add(geo.idx, 34963);
  const n = geo.pos.length / 3, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], geo.pos[i * 3 + a]); mx[a] = Math.max(mx[a], geo.pos[i * 3 + a]); }
  const images = [], textures = [];
  const mat = { name: 'meshlab', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: tex.metallic, roughnessFactor: tex.roughness }, emissiveFactor: [0, 0, 0] };
  const addTex = im => { images.push({ bufferView: add(im.bytes), mimeType: im.mime }); textures.push({ source: images.length - 1, sampler: 0 }); return textures.length - 1; };
  if (tex.base) mat.pbrMetallicRoughness.baseColorTexture = { index: addTex(tex.base) };
  if (tex.mr) mat.pbrMetallicRoughness.metallicRoughnessTexture = { index: addTex(tex.mr) };
  if (tex.normal) mat.normalTexture = { index: addTex(tex.normal) };
  if (tex.alpha) { mat.alphaMode = 'MASK'; mat.alphaCutoff = tex.alphaCutoff ?? 0.5; mat.doubleSided = true; }
  const gltf = {
    asset: { version: '2.0', generator: '747 Mesh Lab CLI' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    accessors: [{ bufferView: vp, componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx }, { bufferView: vn, componentType: 5126, count: n, type: 'VEC3' },
      { bufferView: vt, componentType: 5126, count: n, type: 'VEC2' }, { bufferView: vi, componentType: 5125, count: geo.idx.length, type: 'SCALAR' }],
    bufferViews: views, buffers: [{ byteLength: 0 }], materials: [mat],
    ...(images.length ? { images, textures, samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }] } : {})
  };
  while (len % 4) { parts.push(Buffer.alloc(1)); len++; }
  gltf.buffers[0].byteLength = len;
  let json = Buffer.from(JSON.stringify(gltf)); if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - json.length % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + len, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(len, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(out, Buffer.concat([head, jh, json, bh, ...parts]));
}

// ---------------------------------------------------------------- textures → clean PBR material
// Meshy: *_texture.png (base colour), *_normal.png, *_metallic.png, *_roughness.png (grey). The browser
// FBXLoader path dropped metal/roughness and left a white emissive; here they are packed into one
// glTF metallicRoughness texture (G = roughness, B = metal) and emissive is always off.
function prepareTextures(files, glb, size) {
  const pick = re => { const k = Object.keys(files).find(f => re.test(f.toLowerCase())); return k ? files[k]() : null; };
  const pngOrPass = (im, alphaOk) => {
    if (!im) return null;
    if (im.mime && im.mime !== 'image/png') return { out: { bytes: im.bytes, mime: im.mime }, img: null };   // e.g. JPEG from a GLB: passed through
    const img = resize(decodePNG(im.bytes), size), alpha = alphaOk && hasAlpha(img);
    return { out: { bytes: encodePNG(img, alpha), mime: 'image/png' }, img, alpha };
  };
  const tex = { metallic: 0, roughness: 0.6 };
  if (glb) {
    const b = pngOrPass(glb.base, true), nm = pngOrPass(glb.normal, false), mr = pngOrPass(glb.mr, false);
    tex.base = b?.out; tex.alpha = (b?.alpha || glb.alphaMode === 'MASK') && glb.alphaMode !== 'OPAQUE'; tex.alphaCutoff = glb.alphaCutoff;
    tex.normal = nm?.out; tex.mr = mr?.out; tex.metallic = glb.metallic; tex.roughness = glb.roughness;
    return tex;
  }
  const baseBuf = pick(/_texture\.png$/) || pick(/(basecolor|base_color|albedo|diffuse)\.png$/) || pick(/^(?!.*(normal|metal|rough)).*\.png$/);
  const b = pngOrPass(baseBuf && { bytes: baseBuf }, true); if (b) { tex.base = b.out; tex.alpha = b.alpha; }
  const nb = pick(/_normal\.png$/), nm = pngOrPass(nb && { bytes: nb }, false); if (nm) tex.normal = nm.out;
  const mb = pick(/_metallic\.png$/), rb = pick(/_roughness\.png$/);
  if (mb || rb) {
    const m = mb ? resize(decodePNG(mb), size) : null, r = rb ? resize(decodePNG(rb), size) : null, a = m || r;
    if (m && r && (m.w !== r.w || m.h !== r.h)) throw new Error('metallic and roughness maps differ in size');
    const img = { w: a.w, h: a.h, data: new Uint8Array(a.w * a.h * 4) };
    for (let i = 0; i < a.w * a.h; i++) { img.data[i * 4] = 255; img.data[i * 4 + 1] = r ? r.data[i * 4] : 255; img.data[i * 4 + 2] = m ? m.data[i * 4] : 0; img.data[i * 4 + 3] = 255; }
    tex.mr = { bytes: encodePNG(img, false), mime: 'image/png' };
    tex.metallic = 1; tex.roughness = r ? 1 : 0.6;
  }
  return tex;
}

// ---------------------------------------------------------------- main
export function loadInput(input) {
  const lower = input.toLowerCase(), files = lower.endsWith('.glb') ? {} : gatherInputs(input);
  let mesh;
  if (lower.endsWith('.glb')) mesh = meshFromGLB(fs.readFileSync(input));
  else {
    const key = lower.endsWith('.fbx') ? null : Object.keys(files).find(f => /\.fbx$/i.test(f));
    if (!lower.endsWith('.fbx') && !key) {
      const g = Object.keys(files).find(f => /\.glb$/i.test(f));
      if (!g) throw new Error(`no .fbx or .glb found in ${input}`);
      return { mesh: meshFromGLB(files[g]()), files };
    }
    let fbx = key ? files[key]() : fs.readFileSync(input);
    if (key) delete files[key];
    log(`reading FBX (${(fbx.length / 1e6).toFixed(0)} MB)`);
    mesh = meshFromFBX(fbx); fbx = null;
  }
  return { mesh, files };
}
export function reduce(mesh, target) {
  weld(mesh);
  log(`welded to ${(mesh.P.length / 3).toLocaleString()} positions, ${(mesh.tris.length / 3).toLocaleString()} triangles`);
  if (mesh.tris.length / 3 > target * 40) {
    cluster(mesh, target * 40);
    log(`clustered to ${(mesh.tris.length / 3).toLocaleString()} triangles`);
  }
  if (mesh.tris.length / 3 > target) { simplify(mesh, target); log(`quadric collapse to ${(mesh.tris.length / 3).toLocaleString()} triangles`); }
  return mesh;
}
function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); console.error(USAGE); process.exit(1); }
  if (o.help || !o.input) { console.log(USAGE); process.exit(o.help ? 0 : 1); }
  const { mesh, files } = loadInput(o.input);
  const startTris = mesh.tris.length / 3;
  log(`loaded ${startTris.toLocaleString()} triangles, ${(mesh.P.length / 3).toLocaleString()} positions`);
  reduce(mesh, o.target);
  const geo = buildOutput(mesh, o.yup);
  log(`output ${(geo.pos.length / 3).toLocaleString()} vertices`);
  const tex = prepareTextures(files, mesh.glb, o.tex);
  const out = o.out || path.join(path.dirname(o.input), path.basename(o.input).replace(/(_\d+tris)?\.(zip|fbx|glb)$/i, '') + `_${geo.idx.length / 3}tris.glb`);
  writeGLB(out, geo, tex, path.basename(out, '.glb'));
  const rss = process.resourceUsage().maxRSS / 1024;
  log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB): ${startTris.toLocaleString()} → ${(geo.idx.length / 3).toLocaleString()} triangles, peak memory ${rss.toFixed(0)} MB`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
