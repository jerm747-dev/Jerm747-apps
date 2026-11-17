import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { unzipSync } from 'three/addons/libs/fflate.module.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const $ = id => document.getElementById(id);

// ---------- downloads capability ----------
let downloads = null;
try { if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { downloads = d; }).catch(()=>{}); } catch(e){}

// ---------- three setup ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(2, 1.5, 3);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(3,5,4); scene.add(sun);
const grid = new THREE.GridHelper(10, 20, 0x333944, 0x1e232b); scene.add(grid);

function resize(){
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(h,1); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

let spin = false;
renderer.setAnimationLoop(() => {
  if (spin && root) root.rotation.y += 0.006;
  controls.update(); renderer.render(scene, camera);
});

// ---------- state ----------
let root = null;            // loaded scene graph
let entries = [];           // {mesh, orig, origFaces, simplified, material}
let totalFaces = 0;
let baseName = 'model';
let viewOrig = false, wire = false, clay = false;
const clayMat = new THREE.MeshStandardMaterial({ color:0xb8bcc4, roughness:.75, metalness:0, flatShading:true });

const DEFAULT_TARGET = 41460; // Jeremy's baseline (wheel sample); change it on the page under Settings
const EXPORT_TEX_SIZE = 1024;  // longest side of exported textures (Meshy ships 2048-4096)

// ---------- settings (saved in this browser) ----------
const settings = { baseline: DEFAULT_TARGET, cliMB: 150 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('meshlab.settings') || '{}')); } catch(e){}
const saveSettings = () => { try { localStorage.setItem('meshlab.settings', JSON.stringify(settings)); } catch(e){} };
const baseline = () => Math.max(4, Math.round(+settings.baseline) || DEFAULT_TARGET);
const cliLimitMB = () => +settings.cliMB > 0 ? +settings.cliMB : 150;
function showSettings(){
  $('setBaseline').value = baseline(); $('setCliMB').value = cliLimitMB();
  const pb = $('presetBaseline'); pb.dataset.t = baseline(); pb.querySelector('small').textContent = baseline().toLocaleString();
  $('batchTargetNote').textContent = `Target: your baseline, ${baseline().toLocaleString()} triangles`;
}
$('setBaseline').onchange = () => { const v = Math.round(+$('setBaseline').value); if (v >= 4) { settings.baseline = v; saveSettings(); } showSettings(); };
$('setCliMB').onchange = () => { const v = +$('setCliMB').value; if (v > 0) { settings.cliMB = v; saveSettings(); } showSettings(); };
showSettings();
let simplifierReady = false;
MeshoptSimplifier.ready.then(() => {
  simplifierReady = true;
  try { MeshoptSimplifier.useExperimentalFeatures = true; } catch(e){}
});

// ---------- loading ----------
const drop = $('drop'), fileIn = $('file');
drop.onclick = () => fileIn.click();
$('btnNew').onclick = () => fileIn.click();
fileIn.onchange = () => { if (fileIn.files.length) loadFiles([...fileIn.files]); fileIn.value=''; };
['dragenter','dragover'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hover'); }));
['dragleave','drop'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hover'); }));
stage.addEventListener('drop', e => { const fs = [...e.dataTransfer.files]; if (fs.length) loadFiles(fs); });

function setMsg(el, text, cls=''){ el.textContent = text; el.className = 'msg ' + cls; }

const MODEL_EXTS = ['glb','gltf','fbx','obj'];
const extOf = n => n.split('.').pop().toLowerCase();
const isModel = f => MODEL_EXTS.includes(extOf(f.name));
const stem = n => n.replace(/\.[^.]+$/, '').toLowerCase();

function unzipToFiles(u8){
  const entries = unzipSync(u8), out = [];
  for (const path in entries){
    if (path.endsWith('/') || path.includes('__MACOSX') || path.split('/').pop().startsWith('.')) continue;
    out.push(new File([entries[path]], path.split('/').pop()));
  }
  return out;
}
// one model per base name, best format first (glb > gltf > fbx > obj)
function pickModels(files){
  const best = {};
  files.filter(isModel).forEach(f => {
    const k = stem(f.name), cur = best[k];
    if (!cur || MODEL_EXTS.indexOf(extOf(f.name)) < MODEL_EXTS.indexOf(extOf(cur.name))) best[k] = f;
  });
  return Object.values(best);
}
// each zip keeps its own textures; loose models share loose textures.
// Zips / FBX / GLB over the CLI size limit are marked big and left unopened: the CLI reads them.
const tooBig = f => f.size > cliLimitMB() * 1048576;
async function buildGroups(files, routeBig = true){
  const groups = [], loose = [];
  for (const f of files){
    if (extOf(f.name) === 'zip' && routeBig && tooBig(f)) { groups.push({ file:f, side:[], big:true }); continue; }
    if (extOf(f.name) === 'zip'){
      const inner = unzipToFiles(new Uint8Array(await f.arrayBuffer()));
      const side = inner.filter(x => !isModel(x));
      pickModels(inner).forEach(m => groups.push({ file:m, side }));
    } else loose.push(f);
  }
  const side = loose.filter(x => !isModel(x));
  pickModels(loose).forEach(m => groups.push({ file:m, side, big: routeBig && tooBig(m) && ['fbx','glb'].includes(extOf(m.name)) }));
  return groups;
}

// a loading manager that finds side files by name and tells us when textures are done
function makeManager(side){
  const urls = [], byName = {};
  side.forEach(f => { const u = URL.createObjectURL(f); urls.push(u); byName[f.name.toLowerCase()] = u; });
  let started = false, resolveDone;
  const done = new Promise(r => resolveDone = r);
  const manager = new THREE.LoadingManager(() => resolveDone(), undefined, () => {});
  manager.onStart = () => { started = true; };
  manager.setURLModifier(url => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    const base = decodeURIComponent(url).split(/[\\/]/).pop().toLowerCase();
    return byName[base] || url;
  });
  const settle = () => started ? Promise.race([done, new Promise(r => setTimeout(r, 15000))]) : new Promise(r => setTimeout(r, 300));
  return { manager, settle, cleanup: () => urls.forEach(u => URL.revokeObjectURL(u)) };
}

async function parseModel(file, manager){
  const ext = extOf(file.name);
  const buf = await file.arrayBuffer();
  try {
    if (ext === 'obj') return new OBJLoader(manager).parse(new TextDecoder().decode(buf));
    if (ext === 'fbx') return new FBXLoader(manager).parse(buf, '');
    const loader = new GLTFLoader(manager); loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
    return gltf.scene;
  } catch (err) {
    const m = String(err && err.message || err);
    if (m.includes('DRACO')) throw new Error('This file uses Draco compression, which this page can\'t open yet. Re-download it from Meshy without compression, or import it into Blender and export it again as a regular .glb.');
    if (/FBX version|Unknown format|ASCII/i.test(m) && ext === 'fbx') throw new Error('This FBX is in an older or text-based format that the reader can\'t open. Export it from Meshy (or Blender) as binary FBX 7.x, or use .glb instead.');
    throw err;
  }
}
const nameFor = file => file.name.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g,'_').slice(0,60) || 'model';

let activeCleanup = null;
async function loadFiles(files){
  showBusy(files.some(f => extOf(f.name) === 'zip') ? 'Unzipping…' : 'Loading…');
  let groups;
  try { groups = await buildGroups(files); }
  catch (err) { hideBusy(); return showLoadError('Couldn\'t open that zip: ' + (err.message || err)); }
  if (!groups.length) { hideBusy(); return showLoadError('No model file found. Drop a .glb, .fbx, .obj, or a .zip that contains one (plus any texture images).'); }
  if (groups.length > 1) { hideBusy(); return startBatch(groups); }
  $('cBatch').style.display = 'none';
  hideCliHelp();
  if (groups[0].big) { hideBusy(); return loadBig(groups[0]); }
  await loadGroup(groups[0], true);
  hideBusy();
}
function showLoadError(text){ setMsg($('statusMsg'), text, 'err'); $('cStats').classList.remove('disabled'); }

// loads one model into the viewer; returns true on success
async function loadGroup(group, auto){
  if (activeCleanup) { activeCleanup(); activeCleanup = null; }
  const { manager, settle, cleanup } = makeManager(group.side);
  try {
    const obj = await parseModel(group.file, manager);
    await settle();
    await fixMaterials(obj, group.side);
    baseName = nameFor(group.file);
    await setModel(obj, auto);
    activeCleanup = cleanup;
    return true;
  } catch (err) {
    console.error(err); cleanup();
    showLoadError(group.file.name + ': ' + (err.message || err));
    group.error = err.message || String(err);
    return false;
  }
}

async function setModel(obj, auto = true){
  cliResult = null;
  if (root) { scene.remove(root); entries.forEach(e => { e.orig.dispose(); e.simplified && e.simplified.dispose(); }); }
  root = obj; entries = []; totalFaces = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    let g = o.geometry;
    if (g.morphAttributes && Object.keys(g.morphAttributes).length) { g = g.clone(); g.morphAttributes = {}; }
    if (!g.index) g = mergeVertices(g);
    const faces = g.index.count / 3;
    o.geometry = g;
    entries.push({ mesh:o, orig:g, origFaces:faces, simplified:null, material:o.material });
    totalFaces += faces;
  });
  if (!entries.length) throw new Error('No meshes found in this file.');
  scene.add(root);
  frame();
  drop.classList.add('hidden');
  ['cTarget','cOpts','cStats','cExport'].forEach(id => $(id).classList.remove('disabled'));
  setMsg($('exportMsg'), 'Saves a .zip with the reduced .glb inside, with textures included. In Blender, unzip it, then use File → Import → glTF 2.0.');
  applyView();
  if (!simplifierReady) await MeshoptSimplifier.ready;
  if (auto) setTarget(Math.min(totalFaces, baseline()), true);
}

function frame(){
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) || 1;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(r*0.9, r*0.5, r*1.4));
  camera.near = r/200; camera.far = r*200; camera.updateProjectionMatrix();
  grid.position.y = box.min.y; grid.scale.setScalar(r/4);
}

// ---------- CLI hand-off for files too big for the browser ----------
// When the page is served by `npm run dev` / `npm run preview`, cli/vite-plugin.mjs runs cli/meshlab.mjs on this
// computer. Anywhere else (single-file build, inside Claude) the page shows the command to run instead.
let cliOK = null, cliResult = null, pendingBig = null;
async function cliAvailable(){
  if (cliOK === null) {
    try { const r = await fetch('/api/meshlab/ping', { cache:'no-store' }); cliOK = r.ok && (await r.json()).ok === true; } catch(e){ cliOK = false; }
    setMsg($('cliStatus'), cliOK ? 'CLI helper connected: big files are reduced by cli/meshlab.mjs on this computer.'
      : 'CLI helper not running, so big files show the command to run instead. Open this page with npm run dev to hand them off automatically.', cliOK ? 'good' : '');
  }
  return cliOK;
}
cliAvailable();
const safeName = n => n.replace(/[^\w .()+-]/g, '_');
const cliCommand = (g, t) => `node cli/meshlab.mjs "${g.file.name}" --target ${t} --yup`;
async function runCLI(g, t){
  const job = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  for (const f of [g.file, ...g.side.filter(x => /\.(png|jpe?g)$/i.test(x.name))]){
    const r = await fetch(`/api/meshlab/file?job=${job}&name=${encodeURIComponent(safeName(f.name))}`, { method:'PUT', body:f });
    if (!r.ok) throw new Error(`upload of ${f.name} failed: ${await r.text()}`);
  }
  const r = await fetch(`/api/meshlab/run?job=${job}&input=${encodeURIComponent(safeName(g.file.name))}&target=${t}&tex=${EXPORT_TEX_SIZE}&yup=1`, { method:'POST' });
  if (!r.ok) throw new Error((await r.text()).replace(/^error:\s*/, ''));
  return { data: new Uint8Array(await r.arrayBuffer()), faces: +r.headers.get('X-Meshlab-Tris') || 0, orig: +r.headers.get('X-Meshlab-From') || 0 };
}
async function parseGLBBytes(u8){
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => loader.parse(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength), '', res, rej));
  return gltf.scene;
}
function hideCliHelp(){ $('cliCmd').style.display = 'none'; $('btnTryBrowser').style.display = 'none'; pendingBig = null; }
// one big file: reduce it to the baseline with the CLI, then show the result in the viewer
async function loadBig(g){
  const mb = Math.round(g.file.size / 1048576), t = baseline();
  if (!(await cliAvailable())) {
    showLoadError(`${g.file.name} is ${mb} MB, over your ${cliLimitMB()} MB limit for the browser. Run this in the mesh-lab-app folder (with the file there), then drop the .glb it makes back in here:`);
    $('cliCmd').textContent = cliCommand(g, t); $('cliCmd').style.display = '';
    $('btnTryBrowser').style.display = ''; pendingBig = g;
    return;
  }
  showBusy(`${mb} MB file: reducing with the CLI…`);
  try {
    const r = await runCLI(g, t);
    const obj = await parseGLBBytes(r.data);
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
    baseName = nameFor(g.file);
    await setModel(obj, false);
    setTarget(totalFaces, false); lastMs = 0; updateStats();
    cliResult = { data: r.data, faces: totalFaces };
    setMsg($('statusMsg'), `The CLI reduced this ${mb} MB file` + (r.orig ? ` from ${r.orig.toLocaleString()}` : '') + ` to ${totalFaces.toLocaleString()} triangles. ` +
      'Download GLB saves the CLI\'s file as is; move the slider to go lower in the browser.', 'good');
  } catch (err) { console.error(err); showLoadError(`The CLI couldn't reduce ${g.file.name}: ${err.message || err}`); }
  hideBusy();
}
$('btnTryBrowser').onclick = async () => {
  const g = pendingBig; hideCliHelp(); if (!g) return;
  showBusy('Loading in the browser…');
  try {
    const gs = extOf(g.file.name) === 'zip' ? await buildGroups([g.file], false) : [{ ...g, big:false }];
    if (!gs.length) showLoadError('No model file found in that zip.'); else await loadGroup(gs[0], true);
  } catch (err) { showLoadError(String(err.message || err)); }
  hideBusy();
};

// ---------- target slider (log scale) ----------
const slider = $('slider'), numT = $('numTarget');
let target = 0;
const minT = () => Math.min(100, totalFaces);
function sliderToT(v){ const a=Math.log(minT()), b=Math.log(totalFaces); return Math.round(Math.exp(a + (b-a)*v/1000)); }
function tToSlider(t){ const a=Math.log(minT()), b=Math.log(totalFaces); return b===a ? 1000 : Math.round(1000*(Math.log(t)-a)/(b-a)); }

function setTarget(t, run){
  target = Math.max(4, Math.min(totalFaces, Math.round(t)));
  $('bigTarget').textContent = target.toLocaleString();
  slider.value = tToSlider(target);
  numT.value = target;
  if (run) scheduleSimplify();
}
slider.oninput = () => { target = sliderToT(+slider.value); $('bigTarget').textContent = target.toLocaleString(); numT.value = target; if (totalFaces < 250000) scheduleSimplify(); };
slider.onchange = () => { setTarget(sliderToT(+slider.value), true); };
numT.onchange = () => { if (+numT.value > 0) setTarget(+numT.value, true); };
document.querySelectorAll('.presets button').forEach(b => b.onclick = () => setTarget(+b.dataset.t, true));
['optGuard','optBorder','optNormals'].forEach(id => $(id).onchange = scheduleSimplify);
$('tolSel').onchange = updateStats;

let timer = null;
function scheduleSimplify(){ clearTimeout(timer); timer = setTimeout(() => { showBusy('Reducing…'); requestAnimationFrame(() => setTimeout(runSimplify, 0)); }, 90); }

// ---------- simplification ----------
function toFloatArray(attr){
  const n = attr.count, s = attr.itemSize, out = new Float32Array(n*s);
  const get = [attr.getX, attr.getY, attr.getZ, attr.getW];
  for (let i=0;i<n;i++) for (let c=0;c<s;c++) out[i*s+c] = get[c].call(attr, i);
  return out;
}

function simplifyRange(indices, pos, nrm, targetIdx){
  const flags = [];
  if ($('optBorder').checked) flags.push('LockBorder');
  const err = $('optGuard').checked ? 0.02 : 1.0;
  if (nrm && $('optNormals').checked && MeshoptSimplifier.simplifyWithAttributes) {
    try {
      const [res] = MeshoptSimplifier.simplifyWithAttributes(indices, pos, 3, nrm, 3, [0.5,0.5,0.5], null, targetIdx, err, flags);
      return res;
    } catch(e) { /* fall back below */ }
  }
  const [res] = MeshoptSimplifier.simplify(indices, pos, 3, targetIdx, err, flags);
  return res;
}

// copy only used vertices into a fresh geometry, keeping each attribute's type
function compact(src, newIndex, groups){
  const remap = new Int32Array(src.attributes.position.count).fill(-1);
  let n = 0;
  for (let i=0;i<newIndex.length;i++){ const v=newIndex[i]; if (remap[v] < 0) remap[v] = n++; }
  const g = new THREE.BufferGeometry();
  for (const name in src.attributes){
    const a = src.attributes[name], s = a.itemSize;
    const srcArr = a.isInterleavedBufferAttribute ? a.data.array : a.array;
    const stride = a.isInterleavedBufferAttribute ? a.data.stride : s;
    const off = a.isInterleavedBufferAttribute ? a.offset : 0;
    const out = new srcArr.constructor(n*s);
    for (let v=0; v<remap.length; v++){ const d = remap[v]; if (d<0) continue;
      for (let c=0;c<s;c++) out[d*s+c] = srcArr[v*stride+off+c]; }
    g.setAttribute(name, new THREE.BufferAttribute(out, s, a.normalized));
  }
  const idx = n > 65535 ? new Uint32Array(newIndex.length) : new Uint16Array(newIndex.length);
  for (let i=0;i<newIndex.length;i++) idx[i] = remap[newIndex[i]];
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  groups.forEach(gr => g.addGroup(gr.start, gr.count, gr.materialIndex));
  return g;
}

function runSimplify(){
  if (!entries.length) return hideBusy();
  const t0 = performance.now();
  for (const e of entries){
    const src = e.orig;
    const meshTarget = Math.max(4, Math.round(target * e.origFaces / totalFaces));
    if (e.simplified) { e.simplified.dispose(); e.simplified = null; }
    if (meshTarget >= e.origFaces) { e.simplified = null; continue; }
    const pos = toFloatArray(src.attributes.position);
    const nrm = src.attributes.normal ? toFloatArray(src.attributes.normal) : null;
    const allIdx = Uint32Array.from(src.index.array);
    const ranges = src.groups.length > 1 ? src.groups : [{ start:0, count:allIdx.length, materialIndex:0 }];
    const parts = [], newGroups = [];
    let cursor = 0;
    for (const r of ranges){
      const slice = allIdx.subarray(r.start, r.start + r.count);
      const tIdx = Math.max(3, Math.round(meshTarget * (r.count / allIdx.length)) * 3);
      const res = simplifyRange(slice, pos, nrm, tIdx);
      parts.push(res);
      if (src.groups.length > 1) newGroups.push({ start:cursor, count:res.length, materialIndex:r.materialIndex });
      cursor += res.length;
    }
    const merged = new Uint32Array(cursor); let o = 0; parts.forEach(p => { merged.set(p, o); o += p.length; });
    e.simplified = compact(src, merged, newGroups);
  }
  lastMs = performance.now() - t0;
  applyView(); updateStats(); hideBusy();
}
let lastMs = 0;

// ---------- view toggles ----------
function applyView(){
  for (const e of entries){
    e.mesh.geometry = (viewOrig || !e.simplified) ? e.orig : e.simplified;
    e.mesh.material = clay ? clayMat : e.material;
    const mats = Array.isArray(e.mesh.material) ? e.mesh.material : [e.mesh.material];
    mats.forEach(m => { m.wireframe = wire; m.needsUpdate = true; });
  }
  renderHud();
}
function toggle(btn, fn){ btn.onclick = () => { fn(); btn.classList.toggle('on'); applyView(); }; }
toggle($('tWire'), () => wire = !wire);
toggle($('tClay'), () => clay = !clay);
toggle($('tOrig'), () => viewOrig = !viewOrig);
$('tSpin').onclick = () => { spin = !spin; $('tSpin').classList.toggle('on'); };

// ---------- stats ----------
function currentCounts(){
  let f=0, v=0;
  for (const e of entries){ const g = e.simplified || e.orig; f += g.index.count/3; v += g.attributes.position.count; }
  return { f, v };
}
function origVerts(){ return entries.reduce((s,e)=>s+e.orig.attributes.position.count,0); }

function renderHud(){
  if (!entries.length) { $('hud').innerHTML=''; return; }
  const c = currentCounts(), tol = +$('tolSel').value;
  const ok = Math.abs(c.f - target) <= Math.max(2, target*tol);
  const shown = viewOrig ? totalFaces : c.f;
  $('hud').innerHTML = `<span class="chip">${viewOrig?'ORIGINAL':'REDUCED'} · ${Math.round(shown).toLocaleString()} tris</span>` +
    (viewOrig ? '' : `<span class="chip ${ok?'ok':'warn'}">${ok?'on target':'off target'}</span>`);
}

function updateStats(){
  const c = currentCounts(), tol = +$('tolSel').value;
  const delta = c.f - target, band = Math.max(2, Math.round(target*tol));
  const pct = (100*(1 - c.f/totalFaces)).toFixed(1);
  $('stats').innerHTML = `
    <span>Original triangles</span><span>${totalFaces.toLocaleString()}</span>
    <span>Original vertices</span><span>${origVerts().toLocaleString()}</span>
    <span>Target</span><span>${target.toLocaleString()} ± ${band.toLocaleString()}</span>
    <span>Result triangles</span><span>${Math.round(c.f).toLocaleString()}</span>
    <span>Result vertices</span><span>${c.v.toLocaleString()}</span>
    <span>Off by</span><span>${delta>0?'+':''}${Math.round(delta).toLocaleString()}</span>
    <span>Reduced by</span><span>${pct}%</span>
    <span>Meshes · time</span><span>${entries.length} · ${Math.round(lastMs)} ms</span>`;
  if (Math.abs(delta) <= band) setMsg($('statusMsg'), 'Within your tolerance.', 'good');
  else if (delta > 0) setMsg($('statusMsg'), `Stopped ${Math.round(delta).toLocaleString()} above target. ` +
      ($('optGuard').checked || $('optBorder').checked ? 'Try turning off Shape guard or Lock open edges to get closer.' : 'The mesh may have many small separate pieces or UV seams that limit how far it can go.'), 'err');
  else setMsg($('statusMsg'), 'Landed a bit under target. That\'s normal at low counts.', '');
  renderHud();
}

// ---------- material cleanup ----------
// The FBX reader turns Meshy's materials into Phong materials with a white emissive colour and never attaches
// Meshy's _metallic / _roughness images, so exports came out glowing and matte. Convert to a standard PBR
// material, zero the glow unless there is a real emissive map, and attach metal/roughness from the side files.
async function loadSideTexture(side, suffix, flipY){
  const f = side.find(x => x.name.toLowerCase().replace(/\.(png|jpe?g|webp)$/, '').endsWith(suffix));
  if (!f) return null;
  const url = URL.createObjectURL(f);
  try {
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.flipY = flipY; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
    return tex;
  } catch(e){ return null; } finally { URL.revokeObjectURL(url); }
}
async function fixMaterials(obj, side){
  const mats = new Map();
  obj.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && mats.set(m, null)); });
  const anyMap = [...mats.keys()].find(m => m.map);
  const flipY = anyMap ? anyMap.map.flipY : false;
  const metal = await loadSideTexture(side, '_metallic', flipY);
  const rough = await loadSideTexture(side, '_roughness', flipY);
  for (const m of mats.keys()){
    let n = m;
    if (!m.isMeshStandardMaterial){
      n = new THREE.MeshStandardMaterial({ name:m.name, color:m.color ? m.color.clone() : 0xffffff, map:m.map || null,
        normalMap:m.normalMap || null, transparent:m.transparent, opacity:m.opacity, alphaTest:m.alphaTest || 0, side:m.side,
        metalness:0, roughness:1 });
      if (m.normalScale) n.normalScale.copy(m.normalScale);
    }
    if (!n.emissiveMap) { n.emissive.setRGB(0,0,0); n.emissiveIntensity = 1; }
    if (metal && !n.metalnessMap) { n.metalnessMap = metal; n.metalness = 1; }
    if (rough && !n.roughnessMap) { n.roughnessMap = rough; n.roughness = 1; }
    n.needsUpdate = true;
    mats.set(m, n);
  }
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => mats.get(m) || m) : (mats.get(o.material) || o.material);
  });
}

// ---------- export ----------
// builds a GLB of what's in the viewer (reduced geometry, real materials)
async function exportCurrentGLB(){
  const prev = { viewOrig, clay, wire };
  viewOrig = false; clay = false; wire = false; applyView();
  const savedRot = root.rotation.y; root.rotation.y = 0;
  try {
    // colour + normal maps go out as JPEG (no alpha needed); everything is capped at EXPORT_TEX_SIZE
    root.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      ['map','normalMap'].forEach(k => { if (m && m[k] && !m.transparent) m[k].userData.mimeType = 'image/jpeg'; });
    }); });
    const glb = await new GLTFExporter().parseAsync(root, { binary:true, onlyVisible:true, maxTextureSize:EXPORT_TEX_SIZE });
    return { data: new Uint8Array(glb), faces: Math.round(currentCounts().f) };
  } finally {
    root.rotation.y = savedRot;
    viewOrig = prev.viewOrig; clay = prev.clay; wire = prev.wire; applyView();
  }
}

// saves through Claude when inside Claude; otherwise a normal browser download (offline copy)
async function saveFile(filename, bytes, msgEl){
  const mb = (bytes.length/1048576).toFixed(2);
  if (downloads) {
    try {
      await downloads.save({ filename, data: new Blob([bytes]) });
      setMsg(msgEl, `Saved ${filename} (${mb} MB). In Blender: unzip it, then File → Import → glTF 2.0.`, 'good');
    } catch (err) {
      const code = err && err.code;
      setMsg(msgEl, code === 'declined' ? 'Download cancelled.' :
        code === 'rate_limited' ? 'A save prompt is already open. Finish that one first.' :
        'Couldn\'t save the file here (' + (code || 'unknown') + ').', code === 'declined' ? '' : 'err');
    }
    return;
  }
  try {
    const url = URL.createObjectURL(new Blob([bytes], { type:'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setMsg(msgEl, `Downloaded ${filename} (${mb} MB).`, 'good');
  } catch (err) {
    setMsg(msgEl, 'Couldn\'t download here. Open this page inside Claude, or save the page and open it from your computer.', 'err');
  }
}

$('btnExport').onclick = async () => {
  if (!entries.length) return;
  const btn = $('btnExport'); btn.disabled = true; showBusy('Building GLB…');
  try {
    // a CLI result that wasn't reduced further here is saved byte for byte
    const { data, faces } = cliResult && target >= totalFaces ? cliResult : await exportCurrentGLB();
    const name = `${baseName}_${faces}tris`;
    await saveFile(name + '.zip', makeZip([{ name: name + '.glb', data }]), $('exportMsg'));
  } catch (err) {
    console.error(err); setMsg($('exportMsg'), 'Export failed: ' + (err.message || err), 'err');
  }
  btn.disabled = false; hideBusy();
};

// ---------- batch ----------
let batchGroups = [], batchResults = [];
function renderBatch(current = -1){
  $('batchList').innerHTML = batchGroups.map((g, i) => {
    const r = batchResults[i];
    let st = 'waiting', cls = '';
    if (i === current) { st = 'working…'; cls = 'run'; }
    else if (r && r.error) { st = 'failed'; cls = 'bad'; }
    else if (r) { st = (r.orig ? `${r.orig.toLocaleString()} → ` : '') + r.faces.toLocaleString() + (r.cli ? ' · CLI' : ''); cls = r.onTarget ? 'good' : 'off'; }
    return `<div class="bitem ${cls}"><span class="bname">${g.file.name.replace(/[<&]/g,'')}</span><span class="bst">${st}</span></div>` +
      (r && r.cmd ? `<div class="cmd">${r.cmd.replace(/[<&]/g,'')}</div>` : '');
  }).join('');
}
async function startBatch(groups){
  batchGroups = groups;
  $('cBatch').style.display = '';
  showSettings();
  $('cBatch').scrollIntoView({ behavior:'smooth', block:'start' });
  await runBatch();
}
async function runBatch(){
  const bt = baseline();
  batchResults = [];
  $('btnBatchDl').disabled = true; $('btnRerun').disabled = true;
  if (!simplifierReady) await MeshoptSimplifier.ready;
  for (let i = 0; i < batchGroups.length; i++){
    renderBatch(i);
    showBusy(`Batch ${i+1} of ${batchGroups.length}…`);
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    const g = batchGroups[i];
    g.error = null;
    if (g.big) {   // too big for the browser: the CLI does it, or we show the command
      if (!(await cliAvailable())) { batchResults[i] = { error: `over ${cliLimitMB()} MB`, cmd: cliCommand(g, bt) }; continue; }
      try {
        const r = await runCLI(g, bt);
        batchResults[i] = { name: `${nameFor(g.file)}_${r.faces}tris.glb`, data: r.data, faces: r.faces, orig: r.orig, cli: true,
                            onTarget: Math.abs(r.faces - bt) <= Math.max(2, bt * +$('tolSel').value) || r.faces <= bt };
      } catch (err) { console.error(err); batchResults[i] = { error: err.message || String(err) }; }
      continue;
    }
    const ok = await loadGroup(g, false);
    if (!ok) { batchResults[i] = { error: g.error }; continue; }
    try {
      setTarget(Math.min(totalFaces, bt), false);
      runSimplify();
      const { data, faces } = await exportCurrentGLB();
      const tol = +$('tolSel').value;
      batchResults[i] = { name: `${baseName}_${faces}tris.glb`, data, faces, orig: totalFaces,
                          onTarget: Math.abs(faces - target) <= Math.max(2, target*tol) };
    } catch (err) { console.error(err); batchResults[i] = { error: err.message || String(err) }; }
  }
  renderBatch(); hideBusy();
  const good = batchResults.filter(r => r && !r.error);
  const bad = batchResults.length - good.length;
  const needCli = batchResults.some(r => r && r.cmd);
  setMsg($('batchMsg'), `${good.length} done at ${bt.toLocaleString()} target` + (bad ? `, ${bad} failed (tap Load another model to try those one at a time).` : '.') +
    (needCli ? ' Files over your CLI limit need the command shown under them (or open this page with npm run dev).' : '') +
    ' Models already under the target are kept at their full count.', bad ? 'err' : 'good');
  $('btnBatchDl').disabled = !good.length; $('btnRerun').disabled = false;
}
$('btnRerun').onclick = () => { if (batchGroups.length) runBatch(); };
$('btnBatchDl').onclick = async () => {
  const good = batchResults.filter(r => r && !r.error);
  if (!good.length) return;
  const used = {};
  const files = good.map(r => { let n = r.name; while (used[n]) n = n.replace(/\.glb$/, '_2.glb'); used[n] = 1; return { name:n, data:r.data }; });
  const bt = baseline();
  await saveFile(`meshlab_batch_${files.length}models_${bt}tris.zip`, makeZip(files), $('batchMsg'));
};

// minimal "stored" ZIP writer
const CRC = (() => { const t = new Uint32Array(256); for (let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
function crc32(u8){ let c = 0xFFFFFFFF; for (let i=0;i<u8.length;i++) c = CRC[(c^u8[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function makeZip(files){
  const parts = [], cens = []; let offset = 0;
  for (const f of files){
    const { local, cen } = zipEntry(f.name, f.data, offset);
    parts.push(local, f.data); cens.push(cen); offset += local.length + f.data.length;
  }
  const cenSize = cens.reduce((s,c)=>s+c.length,0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true); end.setUint16(8,files.length,true); end.setUint16(10,files.length,true);
  end.setUint32(12,cenSize,true); end.setUint32(16,offset,true);
  const all = [...parts, ...cens, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s,p)=>s+p.length,0)); let p = 0;
  all.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}
function zipEntry(fname, data, offset){
  const nameB = new TextEncoder().encode(fname), crc = crc32(data), size = data.length;
  const d = new Date(), dosTime = (d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),
        dosDate = ((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0,0x04034b50,true); local.setUint16(4,20,true); local.setUint16(6,0,true); local.setUint16(8,0,true);
  local.setUint16(10,dosTime,true); local.setUint16(12,dosDate,true); local.setUint32(14,crc,true);
  local.setUint32(18,size,true); local.setUint32(22,size,true); local.setUint16(26,nameB.length,true); local.setUint16(28,0,true);
  const cen = new DataView(new ArrayBuffer(46));
  cen.setUint32(0,0x02014b50,true); cen.setUint16(4,20,true); cen.setUint16(6,20,true); cen.setUint16(8,0,true); cen.setUint16(10,0,true);
  cen.setUint16(12,dosTime,true); cen.setUint16(14,dosDate,true); cen.setUint32(16,crc,true); cen.setUint32(20,size,true); cen.setUint32(24,size,true);
  cen.setUint16(28,nameB.length,true); cen.setUint16(30,0,true); cen.setUint16(32,0,true); cen.setUint16(34,0,true); cen.setUint16(36,0,true);
  cen.setUint32(38,0,true); cen.setUint32(42,offset,true);
  const l = new Uint8Array(30 + nameB.length); l.set(new Uint8Array(local.buffer)); l.set(nameB, 30);
  const c = new Uint8Array(46 + nameB.length); c.set(new Uint8Array(cen.buffer)); c.set(nameB, 46);
  return { local: l, cen: c };
}

// ---------- busy indicator ----------
function showBusy(t){ const b=$('busy'); b.textContent=t; b.classList.add('show'); }
function hideBusy(){ $('busy').classList.remove('show'); }
