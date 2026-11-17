#!/usr/bin/env node
// 747 Mesh Lab CLI: makes Meshy AI exports game-ready without a browser. No dependencies (Node 18+).
//
//   node cli/meshlab.mjs <input.zip|input.fbx|input.glb> [--target 41460] [--tex 1024] [--out file.glb] [--yup] [--bake] [--card]
//
// Reads a Meshy zip (binary FBX + *_texture/_normal/_metallic/_roughness PNGs), a bare FBX (PNGs beside it)
// or a GLB. Welds seams, vertex-clusters huge meshes down to ~40x the target, then quadric edge collapse to
// --target triangles, keeping per-corner UVs. Writes a GLB with crease-aware normals (60 degrees) and a clean
// PBR material: emissive off, metal/roughness packed (G = roughness, B = metal), textures resized to --tex.
// Geometry stays Meshy's raw Z-up; --yup rotates it to Y-up.
// --bake gives the reduced mesh its own UV atlas and rebakes base colour, metal/roughness and a tangent-space normal map
// from the full-detail model. --card also renders the full-detail model into trimmed, transparent side views for
// crossed-card billboards.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const USAGE = 'usage: node cli/meshlab.mjs <input.zip|.fbx|.glb> [--target 41460] [--tex 1024] [--out out.glb] [--yup] [--bake] [--card]';
const t0 = Date.now();
const log = (...m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...m);

export function parseArgs(argv) {
  const o = { input: null, target: 41460, tex: 1024, out: null, yup: false, card: false, bake: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '--yup') o.yup = true;
    else if (a === '--card') o.card = true;
    else if (a === '--bake') o.bake = true;
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
  mesh.P = out.slice(0, u * 3); mesh.extent = ex; mesh.welded = true;
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
export function buildOutput(mesh, creaseDeg = 60) {
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
  return { pos: pos.slice(0, n * 3), nor: nor.slice(0, n * 3), uv: uv.slice(0, n * 2), idx };
}
// Meshy Z-up → Y-up: (x, y, z) → (x, z, -y) on positions, normals and tangents
export function toYup(geo) {
  for (const [a, st] of [[geo.pos, 3], [geo.nor, 3], [geo.tan, 4]]) if (a) for (let i = 0; i < a.length; i += st) { const y = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = -y; }
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
  const vp = add(geo.pos, 34962), vn = add(geo.nor, 34962), vt = add(geo.uv, 34962), vi = add(geo.idx, 34963), vg = geo.tan ? add(geo.tan, 34962) : -1;
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
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, ...(geo.tan ? { TANGENT: 4 } : {}) }, indices: 3, material: 0 }] }],
    accessors: [{ bufferView: vp, componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx }, { bufferView: vn, componentType: 5126, count: n, type: 'VEC3' },
      { bufferView: vt, componentType: 5126, count: n, type: 'VEC2' }, { bufferView: vi, componentType: 5125, count: geo.idx.length, type: 'SCALAR' },
      ...(geo.tan ? [{ bufferView: vg, componentType: 5126, count: n, type: 'VEC4' }] : [])],
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
const pickFile = (files, re) => { const k = Object.keys(files).find(f => re.test(f.toLowerCase())); return k ? files[k]() : null; };
const findBase = files => pickFile(files, /_texture\.png$/) || pickFile(files, /(basecolor|base_color|albedo|diffuse)\.png$/) || pickFile(files, /^(?!.*(normal|metal|rough)).*\.png$/);
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
  const baseBuf = findBase(files);
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

// ---------------------------------------------------------------- --card: billboard cutouts of the full-detail model
// Orthographic side views from level, turning about the up axis (Meshy Z), transparent background, 2x supersampled.
// All angles share one scale; each image is trimmed to its silhouette and its colour is bled into the transparent
// border so mipmapped cutouts don't get dark fringes. A JSON file records each card's size and placement.
const CARD_YAWS = [0, 45, 90, 135];
export function renderView(mesh, tex, yawDeg, frame, size, ss = 2) {
  const { P, tris, UV } = mesh, W = size * ss, nt = tris.length / 3, nv = P.length / 3;
  const yaw = yawDeg * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw), { cx, cyy, cz, span } = frame, k = W / span;
  const SX = new Float32Array(nv), SY = new Float32Array(nv), SZ = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3] - cx, y = P[i * 3 + 1] - cyy;
    SX[i] = (x * cy + y * sy) * k + W / 2; SY[i] = W / 2 - (P[i * 3 + 2] - cz) * k; SZ[i] = -x * sy + y * cy;   // camera looks along +SZ
  }
  const zb = new Float32Array(W * W).fill(Infinity), col = new Uint8Array(W * W * 4), px = [0, 0, 0, 0];
  const sample = (u, v) => {   // bilinear, wrapping; v up (FBX convention)
    if (!tex) { px[0] = px[1] = px[2] = 190; px[3] = 255; return; }
    const x = (u - Math.floor(u)) * tex.w - 0.5, y = (1 - (v - Math.floor(v))) * tex.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const X0 = (x0 + tex.w) % tex.w, X1 = (x0 + 1) % tex.w, Y0 = (y0 + tex.h) % tex.h, Y1 = (y0 + 1) % tex.h, d = tex.data;
    for (let c = 0; c < 4; c++) px[c] = (d[(Y0 * tex.w + X0) * 4 + c] * (1 - fx) + d[(Y0 * tex.w + X1) * 4 + c] * fx) * (1 - fy) + (d[(Y1 * tex.w + X0) * 4 + c] * (1 - fx) + d[(Y1 * tex.w + X1) * 4 + c] * fx) * fy;
  };
  for (let t = 0; t < nt; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    const x0 = SX[a], y0 = SY[a], x1 = SX[b], y1 = SY[b], x2 = SX[c], y2 = SY[c];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (!(Math.abs(area) > 1e-12)) continue;
    const minX = Math.max(0, Math.ceil(Math.min(x0, x1, x2) - 0.5)), maxX = Math.min(W - 1, Math.floor(Math.max(x0, x1, x2) - 0.5));
    const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - 0.5)), maxY = Math.min(W - 1, Math.floor(Math.max(y0, y1, y2) - 0.5));
    if (minX > maxX || minY > maxY) continue;
    // headlight shading from the world-space face normal: no fixed light direction baked into the card
    const ax = P[b * 3] - P[a * 3], ay = P[b * 3 + 1] - P[a * 3 + 1], az = P[b * 3 + 2] - P[a * 3 + 2], bx = P[c * 3] - P[a * 3], by = P[c * 3 + 1] - P[a * 3 + 1], bz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, nl = Math.hypot(nx, ny, nz) || 1;
    const shade = 0.6 + 0.4 * Math.abs((-nx * sy + ny * cy) / nl);
    const z0 = SZ[a], z1 = SZ[b], z2 = SZ[c], o = t * 6;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((x1 - qx) * (y2 - qy) - (x2 - qx) * (y1 - qy)) / area, w1 = ((x2 - qx) * (y0 - qy) - (x0 - qx) * (y2 - qy)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2, pi = y * W + x; if (z >= zb[pi]) continue;
      sample(w0 * UV[o] + w1 * UV[o + 2] + w2 * UV[o + 4], w0 * UV[o + 1] + w1 * UV[o + 3] + w2 * UV[o + 5]);
      if (px[3] < 128) continue;   // alpha-cut texels are holes
      zb[pi] = z; col[pi * 4] = px[0] * shade; col[pi * 4 + 1] = px[1] * shade; col[pi * 4 + 2] = px[2] * shade; col[pi * 4 + 3] = 255;
    }
  }
  const out = new Uint8Array(size * size * 4);   // downsample: coverage → alpha, colour averaged over covered samples
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const q = ((y * ss + j) * W + x * ss + i) * 4; if (col[q + 3]) { r += col[q]; g += col[q + 1]; b += col[q + 2]; n++; } }
    const d = (y * size + x) * 4; if (n) { out[d] = r / n; out[d + 1] = g / n; out[d + 2] = b / n; out[d + 3] = Math.round(255 * n / (ss * ss)); }
  }
  return { w: size, h: size, data: out };
}
// colour of transparent pixels ← nearest covered pixel (breadth-first), so filtering never pulls in black
function bleed(img) {
  const { w, h, data } = img, q = new Int32Array(w * h), seen = new Uint8Array(w * h); let qh = 0, qt = 0;
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3]) { seen[i] = 1; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0 || seen[j]) continue;
      seen[j] = 1; data[j * 4] = data[i * 4]; data[j * 4 + 1] = data[i * 4 + 1]; data[j * 4 + 2] = data[i * 4 + 2]; q[qt++] = j;
    }
  }
  return img;
}
function trim(img, pad = 2) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { img, x0: 0, y0: 0 };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(img.w - 1, x1 + pad); y1 = Math.min(img.h - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) data.set(img.data.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4), y * w * 4);
  return { img: { w, h, data }, x0, y0 };
}
export function renderCards(mesh, tex, base, size, yup = false) {
  const ex = extentOf(mesh.P), cx = (ex[0] + ex[1]) / 2, cyy = (ex[2] + ex[3]) / 2, cz = (ex[4] + ex[5]) / 2;
  const span = Math.max(Math.hypot(ex[1] - ex[0], ex[3] - ex[2]), ex[5] - ex[4]) * 1.02, ppu = size / span;
  const frame = v => (yup ? [v[0], v[2], -v[1]] : v).map(c => +c.toFixed(5));   // same Z-up → Y-up turn as the GLB
  const meta = { pxPerUnit: +ppu.toFixed(4), cards: [] };
  for (const yaw of CARD_YAWS) {
    const { img, x0, y0 } = trim(renderView(mesh, tex, yaw, { cx, cyy, cz, span }, size));
    const file = `${base}_card${String(yaw).padStart(3, '0')}.png`;
    fs.writeFileSync(file, encodePNG(bleed(img), true));
    // card = quad from `origin` (bottom-left), `width` along `right`, `height` along `up`; texture unflipped
    const a = yaw * Math.PI / 180, rx = Math.cos(a), ry = Math.sin(a), left = (x0 - size / 2) / ppu, bottom = cz + (size / 2 - y0 - img.h) / ppu;
    meta.cards.push({ file: path.basename(file), yaw, widthPx: img.w, heightPx: img.h, width: +(img.w / ppu).toFixed(4), height: +(img.h / ppu).toFixed(4),
      origin: frame([cx + rx * left, cyy + ry * left, bottom]), right: frame([rx, ry, 0]), up: frame([0, 0, 1]) });
    log(`card ${yaw}°: ${path.basename(file)} ${img.w}x${img.h}`);
  }
  fs.writeFileSync(`${base}_cards.json`, JSON.stringify(meta, null, 2) + '\n');
}

// ---------------------------------------------------------------- --bake: new UV atlas on the low-poly, textures rebaked from the high-poly
// The bake source is the welded full model, or a ~300k-triangle reduction of it when the input is huge (keeps
// memory near the plain reduce). Base colour, metal/roughness and a tangent-space normal map (geometry detail plus
// the source normal map) are transferred texel by texel: ray along the low-poly normal, else the closest point.
const BAKE_DIRECT_MAX = 1500000, BAKE_INTERMEDIATE = 300000, CHART_COS = Math.cos(55 * Math.PI / 180);
export function unwrap(mesh, size, pad = 2) {
  const { P, tris } = mesh, nt = tris.length / 3, nv = P.length / 3;
  const fn = new Float64Array(nt * 3), fa = new Float64Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = tris[t * 3] * 3, b = tris[t * 3 + 1] * 3, c = tris[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
    fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l; fa[t] = l / 2;
  }
  // edge neighbours (first two triangles on each edge)
  const nb = new Int32Array(nt * 3).fill(-1), edges = new Map();
  for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) {
    const a = tris[t * 3 + j], b = tris[t * 3 + (j + 1) % 3], key = Math.min(a, b) * nv + Math.max(a, b), o = edges.get(key);
    if (o === undefined) edges.set(key, t * 3 + j); else if (o >= 0) { nb[t * 3 + j] = (o / 3) | 0; nb[o] = t; edges.set(key, -1); }
  }
  const order = Int32Array.from({ length: nt }, (_, i) => i).sort((x, y) => fa[y] - fa[x]);
  const chartOf = new Int32Array(nt).fill(-1), cuv = new Float64Array(nt * 6), charts = [], queue = new Int32Array(nt);
  for (const seed of order) {
    if (chartOf[seed] >= 0) continue;
    const id = charts.length, nx = fn[seed * 3], ny = fn[seed * 3 + 1], nz = fn[seed * 3 + 2]; let qh = 0, qt = 0;
    chartOf[seed] = id; queue[qt++] = seed;
    while (qh < qt) {
      const t = queue[qh++];
      for (let j = 0; j < 3; j++) { const f = nb[t * 3 + j]; if (f >= 0 && chartOf[f] < 0 && fn[f * 3] * nx + fn[f * 3 + 1] * ny + fn[f * 3 + 2] * nz > CHART_COS) { chartOf[f] = id; queue[qt++] = f; } }
    }
    // project onto the seed plane (u × v = normal, so faces keep their winding), then turn to the tightest box
    const ax = Math.abs(nx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let ux = ny * ax[2] - nz * ax[1], uy = nz * ax[0] - nx * ax[2], uz = nx * ax[1] - ny * ax[0]; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux, faces = queue.slice(0, qt);
    for (const t of faces) for (let k = 0; k < 3; k++) { const p = tris[t * 3 + k] * 3; cuv[t * 6 + k * 2] = P[p] * ux + P[p + 1] * uy + P[p + 2] * uz; cuv[t * 6 + k * 2 + 1] = P[p] * vx + P[p + 1] * vy + P[p + 2] * vz; }
    let best = Infinity, ba = 0;
    for (let deg = 0; deg < 90; deg += 5) {
      const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const t of faces) for (let k = 0; k < 3; k++) { const x = cuv[t * 6 + k * 2], y = cuv[t * 6 + k * 2 + 1], rx = x * c - y * s, ry = x * s + y * c; if (rx < x0) x0 = rx; if (rx > x1) x1 = rx; if (ry < y0) y0 = ry; if (ry > y1) y1 = ry; }
      if ((x1 - x0) * (y1 - y0) < best) { best = (x1 - x0) * (y1 - y0); ba = deg; }
    }
    const c = Math.cos(ba * Math.PI / 180), sn = Math.sin(ba * Math.PI / 180); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const t of faces) for (let k = 0; k < 3; k++) { const o = t * 6 + k * 2, x = cuv[o], y = cuv[o + 1]; cuv[o] = x * c - y * sn; cuv[o + 1] = x * sn + y * c; x0 = Math.min(x0, cuv[o]); x1 = Math.max(x1, cuv[o]); y0 = Math.min(y0, cuv[o + 1]); y1 = Math.max(y1, cuv[o + 1]); }
    for (const t of faces) for (let k = 0; k < 3; k++) { cuv[t * 6 + k * 2] -= x0; cuv[t * 6 + k * 2 + 1] -= y0; }
    charts.push({ faces, w: x1 - x0, h: y1 - y0, x: 0, y: 0 });
  }
  // skyline-pack all charts (tallest first, each where it ends lowest) at one texel density; binary-search the
  // largest density that still fits the square
  const padUV = pad / size, byH = charts.slice().sort((a, b) => b.h - a.h || b.w - a.w);
  const pack = (scale, place) => {
    let sky = [{ x: 0, y: 0, w: 1 }], top = 0;
    for (const c of byH) {
      const w = c.w * scale + padUV * 2, h = c.h * scale + padUV * 2;
      if (w > 1) return Infinity;
      let bi = -1, by = Infinity, bx = 0;
      for (let i = 0; i < sky.length; i++) {
        const x = sky[i].x; if (x + w > 1 + 1e-12) break;
        let y = 0, cov = 0;
        for (let j = i; j < sky.length && cov < w - 1e-12; j++) { y = Math.max(y, sky[j].y); cov = sky[j].x + sky[j].w - x; }
        if (y < by) { by = y; bi = i; bx = x; }
      }
      if (bi < 0) return Infinity;
      if (place) { c.x = bx + padUV; c.y = by + padUV; }
      top = Math.max(top, by + h);
      // raise the skyline over [bx, bx + w)
      const nsky = [];
      for (const sgm of sky) {
        const a = sgm.x, b = sgm.x + sgm.w;
        if (b <= bx + 1e-12 || a >= bx + w - 1e-12) { nsky.push(sgm); continue; }
        if (a < bx) nsky.push({ x: a, y: sgm.y, w: bx - a });
        if (!nsky.length || nsky[nsky.length - 1].x + nsky[nsky.length - 1].w <= bx + 1e-12) nsky.push({ x: bx, y: by + h, w });
        if (b > bx + w) nsky.push({ x: bx + w, y: sgm.y, w: b - bx - w });
      }
      sky = nsky.filter(q => q.w > 1e-12);
      for (let i = sky.length - 1; i > 0; i--) if (sky[i].y === sky[i - 1].y) { sky[i - 1].w += sky[i].w; sky.splice(i, 1); }
    }
    return top;
  };
  let lo = 0, hi = 2 * Math.sqrt(1 / charts.reduce((s, c) => s + c.w * c.h, 0));
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (pack(mid, false) <= 1) lo = mid; else hi = mid; }
  const scale = lo; pack(scale, true);
  const UV = new Float32Array(nt * 6);
  for (const c of charts) for (const t of c.faces) for (let k = 0; k < 3; k++) { UV[t * 6 + k * 2] = c.x + cuv[t * 6 + k * 2] * scale; UV[t * 6 + k * 2 + 1] = c.y + cuv[t * 6 + k * 2 + 1] * scale; }
  mesh.UV = UV;   // v-up, like the input UVs; buildOutput flips to glTF
  return charts.length;
}

// per-vertex tangents (xyz + handedness) from the UVs; bitangent = cross(N, T) * w follows +v up the image (glTF/MikkTSpace)
export function tangents(geo) {
  const { pos, nor, uv, idx } = geo, n = pos.length / 3, S = new Float64Array(n * 3), Tt = new Float64Array(n * 3), tan = new Float32Array(n * 4);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const e1x = pos[b * 3] - pos[a * 3], e1y = pos[b * 3 + 1] - pos[a * 3 + 1], e1z = pos[b * 3 + 2] - pos[a * 3 + 2], e2x = pos[c * 3] - pos[a * 3], e2y = pos[c * 3 + 1] - pos[a * 3 + 1], e2z = pos[c * 3 + 2] - pos[a * 3 + 2];
    const du1 = uv[b * 2] - uv[a * 2], dv1 = -(uv[b * 2 + 1] - uv[a * 2 + 1]), du2 = uv[c * 2] - uv[a * 2], dv2 = -(uv[c * 2 + 1] - uv[a * 2 + 1]);
    const d = du1 * dv2 - du2 * dv1; if (Math.abs(d) < 1e-20) continue; const r = 1 / d;
    const sx = (e1x * dv2 - e2x * dv1) * r, sy = (e1y * dv2 - e2y * dv1) * r, sz = (e1z * dv2 - e2z * dv1) * r;
    const tx = (e2x * du1 - e1x * du2) * r, ty = (e2y * du1 - e1y * du2) * r, tz = (e2z * du1 - e1z * du2) * r;
    for (const v of [a, b, c]) { S[v * 3] += sx; S[v * 3 + 1] += sy; S[v * 3 + 2] += sz; Tt[v * 3] += tx; Tt[v * 3 + 1] += ty; Tt[v * 3 + 2] += tz; }
  }
  for (let v = 0; v < n; v++) {
    const nx = nor[v * 3], ny = nor[v * 3 + 1], nz = nor[v * 3 + 2], d = S[v * 3] * nx + S[v * 3 + 1] * ny + S[v * 3 + 2] * nz;
    let x = S[v * 3] - nx * d, y = S[v * 3 + 1] - ny * d, z = S[v * 3 + 2] - nz * d, l = Math.hypot(x, y, z);
    if (l < 1e-12) { if (Math.abs(nx) < 0.9) { x = 0; y = -nz; z = ny; } else { x = nz; y = 0; z = -nx; } l = Math.hypot(x, y, z); }
    x /= l; y /= l; z /= l;
    const bx = ny * z - nz * y, by = nz * x - nx * z, bz = nx * y - ny * x;
    tan[v * 4] = x; tan[v * 4 + 1] = y; tan[v * 4 + 2] = z; tan[v * 4 + 3] = bx * Tt[v * 3] + by * Tt[v * 3 + 1] + bz * Tt[v * 3 + 2] < 0 ? -1 : 1;
  }
  geo.tan = tan;
  return geo;
}

// BVH over triangles: midpoint splits on the longest centroid axis, leaves of up to 4
export function buildBVH(P, tris) {
  const nt = tris.length / 3, order = new Int32Array(nt), cen = new Float32Array(nt * 3), tb = new Float32Array(nt * 6);
  for (let t = 0; t < nt; t++) {
    order[t] = t;
    for (let a = 0; a < 3; a++) {
      const v0 = P[tris[t * 3] * 3 + a], v1 = P[tris[t * 3 + 1] * 3 + a], v2 = P[tris[t * 3 + 2] * 3 + a], lo = Math.min(v0, v1, v2), hi = Math.max(v0, v1, v2);
      tb[t * 6 + a] = lo; tb[t * 6 + 3 + a] = hi; cen[t * 3 + a] = (lo + hi) / 2;
    }
  }
  const maxN = Math.max(1, 2 * Math.ceil(nt / 2)), bb = new Float32Array(maxN * 6), first = new Int32Array(maxN), count = new Int32Array(maxN);
  let nn = 1; const stack = [[0, 0, nt]];
  while (stack.length) {
    const [node, lo, hi] = stack.pop();
    let b0 = Infinity, b1 = Infinity, b2 = Infinity, b3 = -Infinity, b4 = -Infinity, b5 = -Infinity, c0 = Infinity, c1 = Infinity, c2 = Infinity, c3 = -Infinity, c4 = -Infinity, c5 = -Infinity;
    for (let i = lo; i < hi; i++) {
      const t = order[i], o = t * 6;
      b0 = Math.min(b0, tb[o]); b1 = Math.min(b1, tb[o + 1]); b2 = Math.min(b2, tb[o + 2]); b3 = Math.max(b3, tb[o + 3]); b4 = Math.max(b4, tb[o + 4]); b5 = Math.max(b5, tb[o + 5]);
      c0 = Math.min(c0, cen[t * 3]); c1 = Math.min(c1, cen[t * 3 + 1]); c2 = Math.min(c2, cen[t * 3 + 2]); c3 = Math.max(c3, cen[t * 3]); c4 = Math.max(c4, cen[t * 3 + 1]); c5 = Math.max(c5, cen[t * 3 + 2]);
    }
    bb[node * 6] = b0; bb[node * 6 + 1] = b1; bb[node * 6 + 2] = b2; bb[node * 6 + 3] = b3; bb[node * 6 + 4] = b4; bb[node * 6 + 5] = b5;
    if (hi - lo <= 4) { first[node] = lo; count[node] = hi - lo; continue; }
    const ext = [c3 - c0, c4 - c1, c5 - c2], ax = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2, mid = [c0 + c3, c1 + c4, c2 + c5][ax] / 2;
    let i = lo, j = hi - 1;
    while (i <= j) { if (cen[order[i] * 3 + ax] < mid) i++; else { const x = order[i]; order[i] = order[j]; order[j] = x; j--; } }
    if (i === lo || i === hi) i = (lo + hi) >> 1;
    const l = nn++, r = nn++; first[node] = l; count[node] = 0;
    stack.push([l, lo, i], [r, i, hi]);
  }
  // triangle vertices in leaf order for fast tests
  const V = new Float32Array(nt * 9);
  for (let i = 0; i < nt; i++) { const t = order[i]; for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) V[i * 9 + k * 3 + a] = P[tris[t * 3 + k] * 3 + a]; }
  return { bb, first, count, order, V, stack: new Int32Array(256) };
}
const hit = { t: 0, tri: -1, u: 0, v: 0 };
// nearest two-sided hit along +dir within tmax → hit (tri index in mesh order, barycentric u,v of corners 1,2)
function rayCast(bvh, ox, oy, oz, dx, dy, dz, tmax) {
  const { bb, first, count, V, order, stack } = bvh, ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  let sp = 0, best = tmax, found = -1, bu = 0, bv = 0; stack[sp++] = 0;
  while (sp) {
    const n = stack[--sp], o = n * 6;
    let t0 = ((ix >= 0 ? bb[o] : bb[o + 3]) - ox) * ix, t1 = ((ix >= 0 ? bb[o + 3] : bb[o]) - ox) * ix;
    const ty0 = ((iy >= 0 ? bb[o + 1] : bb[o + 4]) - oy) * iy, ty1 = ((iy >= 0 ? bb[o + 4] : bb[o + 1]) - oy) * iy;
    if (ty0 > t0) t0 = ty0; if (ty1 < t1) t1 = ty1;
    const tz0 = ((iz >= 0 ? bb[o + 2] : bb[o + 5]) - oz) * iz, tz1 = ((iz >= 0 ? bb[o + 5] : bb[o + 2]) - oz) * iz;
    if (tz0 > t0) t0 = tz0; if (tz1 < t1) t1 = tz1;
    if (!(t0 <= t1) || t1 < 0 || t0 > best) continue;
    if (count[n]) {
      for (let i = first[n]; i < first[n] + count[n]; i++) {
        const q = i * 9, e1x = V[q + 3] - V[q], e1y = V[q + 4] - V[q + 1], e1z = V[q + 5] - V[q + 2], e2x = V[q + 6] - V[q], e2y = V[q + 7] - V[q + 1], e2z = V[q + 8] - V[q + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-14) continue;
        const inv = 1 / det, sx = ox - V[q], sy = oy - V[q + 1], sz = oz - V[q + 2], u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t >= 0 && t < best) { best = t; found = i; bu = u; bv = v; }
      }
    } else { stack[sp++] = first[n]; stack[sp++] = first[n] + 1; }
  }
  if (found < 0) return false;
  hit.t = best; hit.tri = order[found]; hit.u = bu; hit.v = bv; return true;
}
// closest point on the mesh → hit (Ericson, Real-Time Collision Detection 5.1.5)
function closestPoint(bvh, px, py, pz) {
  const { bb, first, count, V, order, stack } = bvh; let sp = 0, best = Infinity, found = -1, bu = 0, bv = 0; stack[sp++] = 0;
  const boxD = o => { const dx = Math.max(bb[o] - px, 0, px - bb[o + 3]), dy = Math.max(bb[o + 1] - py, 0, py - bb[o + 4]), dz = Math.max(bb[o + 2] - pz, 0, pz - bb[o + 5]); return dx * dx + dy * dy + dz * dz; };
  while (sp) {
    const n = stack[--sp]; if (boxD(n * 6) >= best) continue;
    if (count[n]) {
      for (let i = first[n]; i < first[n] + count[n]; i++) {
        const q = i * 9, ax = V[q], ay = V[q + 1], az = V[q + 2];
        const abx = V[q + 3] - ax, aby = V[q + 4] - ay, abz = V[q + 5] - az, acx = V[q + 6] - ax, acy = V[q + 7] - ay, acz = V[q + 8] - az, apx = px - ax, apy = py - ay, apz = pz - az;
        const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
        const bpx = px - V[q + 3], bpy = py - V[q + 4], bpz = pz - V[q + 5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
        const cpx = px - V[q + 6], cpy = py - V[q + 7], cpz = pz - V[q + 8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
        let u, v;   // weights of b and c
        if (d1 <= 0 && d2 <= 0) { u = 0; v = 0; }
        else if (d3 >= 0 && d4 <= d3) { u = 1; v = 0; }
        else if (vc <= 0 && d1 >= 0 && d3 <= 0) { u = d1 / (d1 - d3); v = 0; }
        else if (d6 >= 0 && d5 <= d6) { u = 0; v = 1; }
        else if (vb <= 0 && d2 >= 0 && d6 <= 0) { u = 0; v = d2 / (d2 - d6); }
        else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { v = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 1 - v; }
        else { const den = 1 / (va + vb + vc); u = vb * den; v = vc * den; }
        const cx = ax + abx * u + acx * v - px, cy = ay + aby * u + acy * v - py, cz = az + abz * u + acz * v - pz, d = cx * cx + cy * cy + cz * cz;
        if (d < best) { best = d; found = i; bu = u; bv = v; }
      }
    } else {
      const l = first[n], r = l + 1, dl = boxD(l * 6), dr = boxD(r * 6);
      if (dl < dr) { stack[sp++] = r; stack[sp++] = l; } else { stack[sp++] = l; stack[sp++] = r; }
    }
  }
  hit.tri = order[found]; hit.u = bu; hit.v = bv; return found >= 0;
}

function vertexNormals(P, tris) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const v of [a, b, c]) { N[v] += nx; N[v + 1] += ny; N[v + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}
// source maps for the bake: images RGBA + which channel holds metal / roughness
function sourceMaps(files, glb) {
  const dec = im => im && (!im.mime || im.mime === 'image/png') ? decodePNG(im.bytes) : null;
  if (glb) {
    if ([glb.base, glb.normal, glb.mr].some(im => im && im.mime && im.mime !== 'image/png')) console.warn('warning: non-PNG source textures are not rebaked');
    const mr = dec(glb.mr);
    return { base: dec(glb.base), normal: dec(glb.normal), metal: mr && { img: mr, ch: 2 }, rough: mr && { img: mr, ch: 1 }, mf: glb.metallic, rf: glb.roughness };
  }
  const f = re => { const b = pickFile(files, re); return b && decodePNG(b); }, m = f(/_metallic\.png$/), r = f(/_roughness\.png$/), b = findBase(files);
  return { base: b && decodePNG(b), normal: f(/_normal\.png$/), metal: m && { img: m, ch: 0 }, rough: r && { img: r, ch: 0 }, mf: m || r ? (m ? 1 : 0) : 0, rf: m || r ? (r ? 1 : 0.6) : 0.6 };
}
export function bake(geo, hi, src, size) {
  const { pos, nor, tan, uv, idx } = geo, bvh = buildBVH(hi.P, hi.tris), HN = vertexNormals(hi.P, hi.tris);
  const maxd = maxSpan(extentOf(hi.P)) * 0.05, N2 = size * size;
  const base = new Uint8Array(N2 * 4), nrm = new Uint8Array(N2 * 4), mr = new Uint8Array(N2 * 4);
  const s4 = [0, 0, 0, 0];
  const sample = (img, u, v) => {   // bilinear; u,v with v up
    const x = (u - Math.floor(u)) * img.w - 0.5, y = (1 - (v - Math.floor(v))) * img.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const X0 = (x0 + img.w) % img.w, X1 = (x0 + 1) % img.w, Y0 = (y0 + img.h) % img.h, Y1 = (y0 + 1) % img.h, d = img.data;
    for (let c = 0; c < 4; c++) s4[c] = (d[(Y0 * img.w + X0) * 4 + c] * (1 - fx) + d[(Y0 * img.w + X1) * 4 + c] * fx) * (1 - fy) + (d[(Y1 * img.w + X0) * 4 + c] * (1 - fx) + d[(Y1 * img.w + X1) * 4 + c] * fx) * fy;
    return s4;
  };
  let rays = 0, fallback = 0, cutout = false;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const x0 = uv[a * 2] * size, y0 = uv[a * 2 + 1] * size, x1 = uv[b * 2] * size, y1 = uv[b * 2 + 1] * size, x2 = uv[c * 2] * size, y2 = uv[c * 2 + 1] * size;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (!(Math.abs(area) > 1e-12)) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((x1 - qx) * (y2 - qy) - (x2 - qx) * (y1 - qy)) / area, w1 = ((x2 - qx) * (y0 - qy) - (x0 - qx) * (y2 - qy)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const pi = y * size + x; if (nrm[pi * 4 + 3]) continue;
      const L = (arr, k, st) => w0 * arr[a * st + k] + w1 * arr[b * st + k] + w2 * arr[c * st + k];
      const px = L(pos, 0, 3), py = L(pos, 1, 3), pz = L(pos, 2, 3);
      let nx = L(nor, 0, 3), ny = L(nor, 1, 3), nz = L(nor, 2, 3); const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // matching point on the high-poly: nearest hit along ±normal, else the closest point
      rays++;
      let ok = rayCast(bvh, px, py, pz, nx, ny, nz, maxd), tri = hit.tri, hu = hit.u, hv = hit.v, ht = ok ? hit.t : Infinity;
      if (rayCast(bvh, px, py, pz, -nx, -ny, -nz, Math.min(maxd, ht))) { ok = true; tri = hit.tri; hu = hit.u; hv = hit.v; }
      if (!ok) { closestPoint(bvh, px, py, pz); tri = hit.tri; hu = hit.u; hv = hit.v; fallback++; }
      const ha = hi.tris[tri * 3], hb = hi.tris[tri * 3 + 1], hc = hi.tris[tri * 3 + 2], hw0 = 1 - hu - hv, o = tri * 6, HU = hi.UV;
      const su = hw0 * HU[o] + hu * HU[o + 2] + hv * HU[o + 4], sv = hw0 * HU[o + 1] + hu * HU[o + 3] + hv * HU[o + 5];
      if (src.base) { const s = sample(src.base, su, sv); base[pi * 4] = s[0]; base[pi * 4 + 1] = s[1]; base[pi * 4 + 2] = s[2]; base[pi * 4 + 3] = s[3] < 128 ? 0 : 255; if (s[3] < 128) cutout = true; } else base[pi * 4 + 3] = 255;
      mr[pi * 4] = 255; mr[pi * 4 + 1] = src.rough ? sample(src.rough.img, su, sv)[src.rough.ch] * src.rf : 255 * src.rf; mr[pi * 4 + 2] = src.metal ? sample(src.metal.img, su, sv)[src.metal.ch] * src.mf : 255 * src.mf; mr[pi * 4 + 3] = 255;
      // high-poly normal: smooth normal, bent by the source normal map in that triangle's own tangent frame
      let hx = hw0 * HN[ha * 3] + hu * HN[hb * 3] + hv * HN[hc * 3], hy = hw0 * HN[ha * 3 + 1] + hu * HN[hb * 3 + 1] + hv * HN[hc * 3 + 1], hz = hw0 * HN[ha * 3 + 2] + hu * HN[hb * 3 + 2] + hv * HN[hc * 3 + 2];
      let hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
      if (src.normal) {
        const P = hi.P, e1x = P[hb * 3] - P[ha * 3], e1y = P[hb * 3 + 1] - P[ha * 3 + 1], e1z = P[hb * 3 + 2] - P[ha * 3 + 2], e2x = P[hc * 3] - P[ha * 3], e2y = P[hc * 3 + 1] - P[ha * 3 + 1], e2z = P[hc * 3 + 2] - P[ha * 3 + 2];
        const du1 = HU[o + 2] - HU[o], dv1 = HU[o + 3] - HU[o + 1], du2 = HU[o + 4] - HU[o], dv2 = HU[o + 5] - HU[o + 1], d = du1 * dv2 - du2 * dv1;
        if (Math.abs(d) > 1e-20) {
          const r = 1 / d; let Tx = (e1x * dv2 - e2x * dv1) * r, Ty = (e1y * dv2 - e2y * dv1) * r, Tz = (e1z * dv2 - e2z * dv1) * r;
          const Bx0 = (e2x * du1 - e1x * du2) * r, By0 = (e2y * du1 - e1y * du2) * r, Bz0 = (e2z * du1 - e1z * du2) * r;
          const td = Tx * hx + Ty * hy + Tz * hz; Tx -= hx * td; Ty -= hy * td; Tz -= hz * td; const tl = Math.hypot(Tx, Ty, Tz);
          if (tl > 1e-20) {
            Tx /= tl; Ty /= tl; Tz /= tl;
            const sgn = (hy * Tz - hz * Ty) * Bx0 + (hz * Tx - hx * Tz) * By0 + (hx * Ty - hy * Tx) * Bz0 < 0 ? -1 : 1;
            const Bx = (hy * Tz - hz * Ty) * sgn, By = (hz * Tx - hx * Tz) * sgn, Bz = (hx * Ty - hy * Tx) * sgn;
            const s = sample(src.normal, su, sv), mx = s[0] / 127.5 - 1, my = s[1] / 127.5 - 1, mz = s[2] / 127.5 - 1;
            hx = Tx * mx + Bx * my + hx * mz; hy = Ty * mx + By * my + hy * mz; hz = Tz * mx + Bz * my + hz * mz;
            hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
          }
        }
      }
      // into the low-poly tangent space exactly as the shader rebuilds it: [T B N] from interpolated, normalised vectors
      let Tx = L(tan, 0, 4), Ty = L(tan, 1, 4), Tz = L(tan, 2, 4);
      let Bx = 0, By = 0, Bz = 0;
      for (const [v, w] of [[a, w0], [b, w1], [c, w2]]) { const vx = nor[v * 3], vy = nor[v * 3 + 1], vz = nor[v * 3 + 2], tx = tan[v * 4], ty = tan[v * 4 + 1], tz = tan[v * 4 + 2], tw = tan[v * 4 + 3]; Bx += w * (vy * tz - vz * ty) * tw; By += w * (vz * tx - vx * tz) * tw; Bz += w * (vx * ty - vy * tx) * tw; }
      const tl = Math.hypot(Tx, Ty, Tz) || 1, bl = Math.hypot(Bx, By, Bz) || 1; Tx /= tl; Ty /= tl; Tz /= tl; Bx /= bl; By /= bl; Bz /= bl;
      const det = Tx * (By * nz - Bz * ny) - Bx * (Ty * nz - Tz * ny) + nx * (Ty * Bz - Tz * By);
      let ex = 0, ey = 0, ez = 1;
      if (Math.abs(det) > 1e-9) {
        ex = (hx * (By * nz - Bz * ny) - Bx * (hy * nz - hz * ny) + nx * (hy * Bz - hz * By)) / det;
        ey = (Tx * (hy * nz - hz * ny) - hx * (Ty * nz - Tz * ny) + nx * (Ty * hz - Tz * hy)) / det;
        ez = (Tx * (By * hz - Bz * hy) - Bx * (Ty * hz - Tz * hy) + hx * (Ty * Bz - Tz * By)) / det;
        if (ez < 0.05) ez = 0.05;
        const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el;
      }
      nrm[pi * 4] = Math.round((ex + 1) * 127.5); nrm[pi * 4 + 1] = Math.round((ey + 1) * 127.5); nrm[pi * 4 + 2] = Math.round((ez + 1) * 127.5); nrm[pi * 4 + 3] = 255;
    }
  }
  log(`baked ${rays.toLocaleString()} texels (${((fallback / Math.max(rays, 1)) * 100).toFixed(1)}% by closest point)`);
  // fill everything outside the charts from the nearest baked texel so mips and filtering stay clean
  const covered = nrm.map((v, i) => (i % 4 === 3 ? v : 0));
  const fill = img => { const t = { w: size, h: size, data: img }; for (let i = 3; i < img.length; i += 4) img[i] = covered[i]; bleed(t); for (let i = 3; i < img.length; i += 4) img[i] = 255; return t; };
  // (with alpha cut-outs, every transparent texel — outside the charts or cut — takes its neighbour's colour)
  const baseImg = cutout ? bleed({ w: size, h: size, data: base }) : fill(base);
  const out = { metallic: src.mf, roughness: src.rf, alpha: cutout };
  if (src.base) out.base = { bytes: encodePNG(baseImg, cutout), mime: 'image/png' };
  out.normal = { bytes: encodePNG(fill(nrm), false), mime: 'image/png' };
  if (src.metal || src.rough) { out.mr = { bytes: encodePNG(fill(mr), false), mime: 'image/png' }; out.metallic = 1; out.roughness = 1; }
  return out;
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
  if (!mesh.welded) weld(mesh);
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
  const out = o.out || path.join(path.dirname(o.input), path.basename(o.input).replace(/(_\d+tris)?\.(zip|fbx|glb)$/i, '') + '_TRIStris.glb');
  if (o.card) {
    const b = mesh.glb ? mesh.glb.base : (findBase(files) && { bytes: findBase(files) });
    if (b && b.mime && b.mime !== 'image/png') console.warn('warning: base colour is not PNG; cards rendered untextured');
    const tex = b && (!b.mime || b.mime === 'image/png') ? decodePNG(b.bytes) : null;
    renderCards(mesh, tex, path.join(path.dirname(out), path.basename(o.input).replace(/(_\d+tris)?\.(zip|fbx|glb)$/i, '')), o.tex, o.yup);
  }
  let hi = null;
  if (o.bake) {
    weld(mesh);
    hi = { P: mesh.P.slice(), tris: mesh.tris.slice(), UV: mesh.UV.slice() };
    if (startTris > BAKE_DIRECT_MAX) {
      hi.extent = mesh.extent;
      if (startTris > BAKE_INTERMEDIATE * 2) cluster(hi, BAKE_INTERMEDIATE * 2);
      simplify(hi, BAKE_INTERMEDIATE);
      log(`bake source: ${(hi.tris.length / 3).toLocaleString()}-triangle intermediate`);
    }
  }
  reduce(mesh, o.target);
  let tex;
  if (o.bake) log(`unwrapped into ${unwrap(mesh, o.tex)} charts`);
  const geo = buildOutput(mesh);
  log(`output ${(geo.pos.length / 3).toLocaleString()} vertices`);
  if (o.bake) { tangents(geo); tex = bake(geo, hi, sourceMaps(files, mesh.glb), o.tex); hi = null; }
  else tex = prepareTextures(files, mesh.glb, o.tex);
  if (o.yup) toYup(geo);
  const file = out.replace('_TRIStris.glb', `_${geo.idx.length / 3}tris.glb`);
  writeGLB(file, geo, tex, path.basename(file, '.glb'));
  const rss = process.resourceUsage().maxRSS / 1024;
  log(`wrote ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB): ${startTris.toLocaleString()} → ${(geo.idx.length / 3).toLocaleString()} triangles, peak memory ${rss.toFixed(0)} MB`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();
