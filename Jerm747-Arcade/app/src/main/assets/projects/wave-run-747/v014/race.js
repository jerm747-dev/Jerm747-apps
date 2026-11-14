'use strict';
(async()=>{
const $=id=>document.getElementById(id);
let canvas=$('gfx'),renderer=null,drawFlat=null,device=null;
const coarse=matchMedia('(pointer:coarse)').matches;
const controller=new AbortController();
let closed=false;
const params=new URLSearchParams(location.search);
function flatView(why) {
  if (closed || drawFlat) return;
  console.info('Wave Run top-down view:',why);
  controller.abort();
  if(device){const previous=device;device=null;previous.destroy();}
  const replacement=canvas.cloneNode(false);
  canvas.replaceWith(replacement);
  canvas=replacement;renderer=null;
  drawFlat=makeFlatView(canvas);
  document.documentElement.dataset.renderer='top-down';
  $('viewLabel').textContent='Top-down view';
  $('viewLabel').title=why;
}
/* ================= WGSL ================= */
const PRELUDE = /* wgsl */`
struct Scene {
  viewProj: mat4x4f, invViewProj: mat4x4f,
  camPos: vec4f, params: vec4f, sun: vec4f, misc: vec4f, camRight: vec4f, camUp: vec4f,
  waves: array<vec4f, 12>, wake: array<vec4f, 24>
};
// params: time, waveScale, chop, wakeCount · sun: dir, day · misc: storm, gridOffX, gridOffZ
@group(0) @binding(0) var<uniform> scene: Scene;

fn sunDir() -> vec3f { return normalize(scene.sun.xyz); }
fn sunCol() -> vec3f { return mix(vec3f(1.0, 0.55, 0.28), vec3f(1.0, 0.95, 0.86), scene.sun.w) * mix(1.0, 0.35, scene.misc.x); }
fn hash21(p: vec2f) -> f32 { var q = fract(p * vec2f(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
fn hash31(p: vec3f) -> f32 { var q = fract(p * 0.1031); q += dot(q, q.zyx + 31.32); return fract((q.x + q.y) * q.z); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i); let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0)); let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn fbm(p0: vec2f) -> f32 {
  var p = p0; var a = 0.5; var s = 0.0;
  for (var i = 0; i < 5; i++) { s += a * vnoise(p); p = mat2x2f(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return s;
}
fn sky(d: vec3f, t: f32) -> vec3f {
  let day = scene.sun.w; let storm = scene.misc.x; let S = sunDir();
  let y = d.y;
  let zen = mix(vec3f(0.015, 0.02, 0.07), vec3f(0.06, 0.2, 0.52), day);
  let mid = mix(vec3f(0.08, 0.05, 0.18), vec3f(0.22, 0.42, 0.72), day);
  let hor = mix(vec3f(0.85, 0.36, 0.22), vec3f(0.62, 0.76, 0.9), day);
  var col = mix(mid, zen, smoothstep(0.0, 0.6, y));
  col = mix(hor, col, smoothstep(-0.02, 0.22, y));
  if (y < 0.0) { col = mix(hor * 0.6, vec3f(0.03, 0.02, 0.05), smoothstep(0.0, -0.3, y)); }
  let night = (1.0 - day) * (1.0 - storm);
  if (y > 0.02 && night > 0.01) {
    let q = d.xz / (y + 0.25);
    let a = fbm(q * 1.2 + vec2f(t * 0.03, t * 0.015));
    let band = smoothstep(0.45, 0.75, a) * smoothstep(0.05, 0.35, y) * (1.0 - smoothstep(0.5, 0.95, y));
    col += mix(vec3f(0.1, 0.9, 0.6), vec3f(0.45, 0.3, 1.0), a) * band * 0.45 * night;
    let h = hash31(floor(d * 220.0));
    if (h > 0.9965) { col += vec3f((h - 0.9965) * 280.0 * (0.6 + 0.4 * sin(t * 3.0 + h * 100.0)) * smoothstep(0.05, 0.3, y) * night); }
  }
  if (y > 0.01) {
    let cq = d.xz / (y + 0.1) * 0.6 + vec2f(t * 0.01, 0.0);
    let cl = smoothstep(0.5 - storm * 0.35, 0.85, fbm(cq)) * smoothstep(0.01, 0.15, y);
    let cloudCol = mix(hor * 0.8 + vec3f(0.05), vec3f(0.95), day) * mix(1.0, 0.4, storm);
    col = mix(col, cloudCol, cl * 0.6);
  }
  let sd = max(dot(d, S), 0.0);
  let sc = sunCol();
  col += sc * (pow(sd, 48.0) * 0.6 + pow(sd, 6.0) * 0.15);
  col += sc * smoothstep(0.9994, 0.9997, sd) * 6.0 * (1.0 - storm);
  let grey = vec3f(dot(col, vec3f(0.3, 0.5, 0.2))) * 0.5 + mix(vec3f(0.03, 0.035, 0.045), vec3f(0.22, 0.25, 0.28), day);
  return mix(col, grey, storm * 0.7);
}
fn finish(c: vec3f) -> vec3f {
  let x = c * 0.9;
  let m = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
  return pow(m, vec3f(1.0 / 2.2));
}
struct Wave { pos: vec3f, nrm: vec3f, fold: f32 };
fn gerstner(xz: vec2f, t0: f32, count: i32) -> Wave {
  let scale = scene.params.y; let chop = scene.params.z;
  let t = t0 * 0.8;
  var p = vec3f(xz.x, 0.0, xz.y);
  var tg = vec3f(1.0, 0.0, 0.0); var bn = vec3f(0.0, 0.0, 1.0);
  var fold = 0.0;
  for (var i = 0; i < count; i++) {
    let wv = scene.waves[i];
    let d = wv.xy;
    let k = 6.28318 / (wv.z * scale);
    let c = sqrt(9.8 / k);
    let steep = chop * wv.w;
    let a = steep / k;
    let f = k * (dot(d, xz) - c * t) + f32(i) * 1.7;
    let s = sin(f); let co = cos(f);
    p += vec3f(d.x * a * co, a * s, d.y * a * co);
    tg += vec3f(-d.x * d.x * steep * s, d.x * steep * co, -d.x * d.y * steep * s);
    bn += vec3f(-d.x * d.y * steep * s, d.y * steep * co, -d.y * d.y * steep * s);
    fold += steep * s;
  }
  var r: Wave; r.pos = p; r.nrm = normalize(cross(bn, tg)); r.fold = fold; return r;
}
fn fogMix(col: vec3f, world: vec3f, t: f32) -> vec3f {
  let to = world - scene.camPos.xyz;
  let dist = length(to);
  let fogc = sky(normalize(vec3f(to.x, 0.0, to.z) + vec3f(1e-4, 0.0, 0.0)), t);
  return mix(col, fogc, 1.0 - exp(-dist * dist * (0.00007 + scene.misc.x * 0.0003)));
}
`;

const SKY_WGSL = PRELUDE + /* wgsl */`
struct SOut { @builtin(position) pos: vec4f, @location(0) ndc: vec2f };
@vertex fn vsSky(@builtin(vertex_index) vi: u32) -> SOut {
  var ps = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: SOut; o.pos = vec4f(ps[vi], 1.0, 1.0); o.ndc = ps[vi]; return o;
}
@fragment fn fsSky(s: SOut) -> @location(0) vec4f {
  let p = scene.invViewProj * vec4f(s.ndc, 1.0, 1.0);
  let d = normalize(p.xyz / p.w - scene.camPos.xyz);
  return vec4f(finish(sky(d, scene.params.x)), 1.0);
}`;

const WATER_WGSL = PRELUDE + /* wgsl */`
struct WOut { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) base: vec2f };
@vertex fn vsWater(@location(0) gxz: vec2f) -> WOut {
  let xz = gxz + scene.misc.yz;
  let w = gerstner(xz, scene.params.x, 8);
  var o: WOut;
  o.pos = scene.viewProj * vec4f(w.pos, 1.0);
  o.world = w.pos; o.base = xz;
  return o;
}
fn ripple(p0: vec2f, t: f32) -> f32 {
  let p1 = mat2x2f(0.8, 0.6, -0.6, 0.8) * p0;
  let p2 = mat2x2f(0.28, 0.96, -0.96, 0.28) * p0;
  return vnoise(p0 * 1.4 + vec2f(t * 0.55, t * 0.2)) * 0.5
       + vnoise(p1 * 3.1 - vec2f(t * 0.4, -t * 0.65)) * 0.3
       + vnoise(p2 * 6.7 + vec2f(-t * 0.9, t * 0.5)) * 0.2;
}
@fragment fn fsWater(f: WOut) -> @location(0) vec4f {
  let t = scene.params.x; let chop = scene.params.z;
  let day = scene.sun.w; let storm = scene.misc.x;
  let fw = max(fwidth(f.base), vec2f(1e-4));
  let lod = max(fw.x, fw.y);
  let W = gerstner(f.base, t, 12);
  var n = W.nrm;
  let detail = 1.0 - smoothstep(0.04, 0.5, lod);
  if (detail > 0.0) {
    let e = 0.04;
    let h0 = ripple(f.base, t);
    let hx = ripple(f.base + vec2f(e, 0.0), t);
    let hz = ripple(f.base + vec2f(0.0, e), t);
    n = normalize(n + vec3f(-(hx - h0) / e, 0.0, -(hz - h0) / e) * (0.06 + storm * 0.05) * detail);
  }
  let v = normalize(scene.camPos.xyz - f.world);
  let S = sunDir(); let sc = sunCol();
  let ndv = max(dot(n, v), 0.0);
  let F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  var r = reflect(-v, n); r.y = abs(r.y);
  let refl = sky(r, t);
  let deep = mix(vec3f(0.003, 0.016, 0.03), vec3f(0.006, 0.06, 0.11), day) * mix(1.0, 0.7, storm);
  let scatter = mix(vec3f(0.02, 0.2, 0.17), vec3f(0.04, 0.42, 0.38), day);
  let hgt = W.pos.y / max(scene.params.y, 0.3);
  let vh = normalize(vec2f(-v.x, -v.z) + vec2f(1e-5));
  let toward = max(dot(vh, normalize(S.xz + vec2f(1e-5))), 0.0);
  let sss = pow(toward, 4.0) * clamp(hgt * 0.5 + 0.4, 0.0, 1.5) * (0.3 + 0.7 * (1.0 - ndv)) * length(sc);
  let water = deep + scatter * (sss * 0.9 + clamp(hgt, 0.0, 2.0) * 0.08 + 0.06 * (dot(n, S) * 0.5 + 0.5));
  var col = mix(water, refl, F);
  let hS = normalize(S + v);
  let nh = max(dot(n, hS), 0.0);
  let far = smoothstep(0.0, 1.2, lod);
  col += sc * (pow(nh, mix(1400.0, 90.0, far)) * mix(10.0, 2.0, far) + pow(nh, 60.0) * 0.12) * (1.0 - storm * 0.8);

  // jet ski wake
  var wake = 0.0;
  let wc = i32(scene.params.w);
  for (var j = 0; j < 24; j++) {
    if (j >= wc) { break; }
    let wk = scene.wake[j];
    let rad = 0.55 + wk.z * 2.6;
    let dd = f.world.xz - wk.xy;
    wake += exp(-dot(dd, dd) / (rad * rad)) * (1.0 - wk.z) * wk.w;
  }
  let fn0 = fbm(f.base * 0.9 + vec2f(W.fold * 3.0, t * 0.15));
  let foam = smoothstep(chop * 0.42, chop * 0.8, W.fold + (fn0 - 0.5) * 0.35) * smoothstep(0.3, 0.75, chop);
  let streak = smoothstep(0.62, 0.8, fbm(f.base * vec2f(0.5, 2.2) + t * 0.05)) * smoothstep(0.55, 0.9, chop) * 0.35;
  let wakeFoam = clamp(wake * (0.5 + fn0), 0.0, 1.0);
  let foamCol = mix(vec3f(0.55, 0.58, 0.66), vec3f(0.92, 0.95, 0.97), day) * (0.45 + 0.55 * max(dot(W.nrm, S), 0.0) + 0.3 * day);
  col = mix(col, foamCol, clamp(max(foam * 0.9 + streak * (1.0 - foam), wakeFoam * 0.85), 0.0, 1.0));
  return vec4f(finish(fogMix(col, f.world, t)), 1.0);
}`;

const MESH_WGSL = PRELUDE + /* wgsl */`
struct Obj { model: mat4x4f };
@group(1) @binding(0) var<uniform> obj: Obj;
struct MOut { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) col: vec3f };
fn shade(world: vec3f, n0: vec3f, base: vec3f, ff: bool) -> vec3f {
  let t = scene.params.x;
  var n = normalize(n0); if (!ff) { n = -n; }
  let v = normalize(scene.camPos.xyz - world);
  let S = sunDir(); let sc = sunCol(); let day = scene.sun.w;
  let albedo = min(base, vec3f(1.0));
  let emit = max(base - vec3f(1.0), vec3f(0.0));
  let amb = mix(vec3f(0.12, 0.1, 0.2), vec3f(0.35, 0.42, 0.55), day) * (0.6 + 0.4 * n.y) + mix(vec3f(0.06, 0.03, 0.02), vec3f(0.05), day) * (0.5 - 0.5 * n.y);
  let diff = max(dot(n, S), 0.0);
  let spec = pow(max(dot(n, normalize(S + v)), 0.0), 48.0) * 0.35;
  let rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.25;
  let col = albedo * (amb + sc * diff * 1.3) + sc * spec + sky(reflect(-v, n), t) * rim + emit;
  return fogMix(col, world, t);
}
@vertex fn vsSki(@location(0) p: vec3f, @location(1) nrm: vec3f, @location(2) col: vec3f) -> MOut {
  let wp = obj.model * vec4f(p, 1.0);
  var o: MOut;
  o.pos = scene.viewProj * wp; o.world = wp.xyz; o.n = (obj.model * vec4f(nrm, 0.0)).xyz; o.col = col;
  return o;
}
@vertex fn vsBuoy(@location(0) p: vec3f, @location(1) nrm: vec3f, @location(2) col: vec3f, @location(3) inst: vec4f) -> MOut {
  let t = scene.params.x;
  let w = gerstner(inst.xy, t, 8);
  let a = t * 1.2 + inst.x;
  let c = cos(a); let s = sin(a);
  let lp = p * inst.w;
  let rp = vec3f(lp.x * c - lp.z * s, lp.y, lp.x * s + lp.z * c);
  let rn = vec3f(nrm.x * c - nrm.z * s, nrm.y, nrm.x * s + nrm.z * c);
  let wp = rp + w.pos + vec3f(0.0, 0.55 * inst.w / 0.6, 0.0);
  let pulse = 0.5 + 0.5 * sin(t * 6.0);
  var tint = vec3f(1.0, 0.42, 0.08) * 1.6;                       // regular gate
  if (inst.z > 1.5) { tint = vec3f(1.6, 1.6, 1.7); }             // start/finish
  if (inst.z > 0.5 && inst.z < 1.5) { tint = vec3f(0.3, 1.0, 1.1) * (1.6 + pulse * 1.4); } // next gate
  var o: MOut;
  o.pos = scene.viewProj * vec4f(wp, 1.0); o.world = wp; o.n = rn; o.col = tint * col;
  return o;
}
@fragment fn fsMesh(m: MOut, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  return vec4f(finish(shade(m.world, m.n, m.col, ff)), 1.0);
}`;

/* Rider + ski model (Meshy FBX, Z-up local space). Paint is evaluated per pixel from local position,
   so panel edges, stripes and the 747 decal stay crisp regardless of triangle size. */
const MODEL_WGSL = PRELUDE + /* wgsl */`
struct Obj { model: mat4x4f };
@group(1) @binding(0) var<uniform> obj: Obj;
struct VO { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) wn: vec3f, @location(2) lp: vec3f, @location(3) ln: vec3f, @location(4) rider: f32 };
@vertex fn vsModel(@location(0) p: vec4f, @location(1) n: vec4f) -> VO {
  let wp = obj.model * vec4f(p.xyz, 1.0);
  var o: VO;
  o.pos = scene.viewProj * wp; o.world = wp.xyz; o.wn = (obj.model * vec4f(n.xyz, 0.0)).xyz;
  o.lp = p.xyz; o.ln = n.xyz; o.rider = n.w;
  return o;
}
fn sdSeg(p: vec2f, a: vec2f, b: vec2f) -> f32 { let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
fn text747(u0: vec2f) -> f32 {
  var p = u0; p.x -= p.y * 0.2;
  var d = 1e3;
  d = min(d, sdSeg(p, vec2f(0.0, 1.0), vec2f(0.85, 1.0)));
  d = min(d, sdSeg(p, vec2f(0.85, 1.0), vec2f(0.3, 0.0)));
  let q = p - vec2f(1.15, 0.0);
  d = min(d, sdSeg(q, vec2f(0.62, 0.0), vec2f(0.62, 1.0)));
  d = min(d, sdSeg(q, vec2f(0.62, 1.0), vec2f(0.0, 0.32)));
  d = min(d, sdSeg(q, vec2f(0.0, 0.32), vec2f(0.88, 0.32)));
  let r = p - vec2f(2.35, 0.0);
  d = min(d, sdSeg(r, vec2f(0.0, 1.0), vec2f(0.85, 1.0)));
  d = min(d, sdSeg(r, vec2f(0.85, 1.0), vec2f(0.3, 0.0)));
  return d;
}
struct Mat { alb: vec3f, emit: vec3f, pearl: f32, gloss: f32 };
fn skiMat(p: vec3f, n: vec3f) -> Mat {
  var m: Mat; m.alb = vec3f(0.93, 0.92, 0.96); m.emit = vec3f(0.0); m.pearl = 1.0; m.gloss = 1.0;
  let x = p.x; let z = p.z; let ay = abs(p.y);
  let outer = ay > 0.2 && n.y * sign(p.y) > 0.25;
  let fTop = -0.17 + (x + 0.55) * 0.28;
  let rTop = -0.17 + (x - 0.2) * 0.29;
  if (outer && z > -0.205 && ((x > -0.55 && x < 0.05 && z < fTop) || (x > 0.2 && z < rTop))) { m.alb = vec3f(0.34, 0.07, 0.7); m.pearl = 0.45; }
  if (outer && ((x > -0.62 && x < 0.05 && z >= fTop && z < fTop + 0.016) || (x > 0.2 && z >= rTop && z < rTop + 0.016))) {
    m.alb = vec3f(1.0, 0.1, 0.75); m.emit = vec3f(0.45, 0.03, 0.32); m.pearl = 0.0;
  }
  if (outer && x > 0.5 && x < 0.82) {
    let ux = select(0.8 - x, x - 0.52, p.y < 0.0) / 0.28 * 3.3;
    let uy = (z + 0.01) / 0.06;
    if (uy > -0.3 && uy < 1.3) {
      let k = 1.0 - smoothstep(0.08, 0.12, text747(vec2f(ux, uy)));
      m.alb = mix(m.alb, vec3f(0.05, 0.05, 0.07), k); m.pearl *= 1.0 - k;
    }
  }
  if (x > -0.75 && x < -0.22 && ay < 0.14 + (x + 0.75) * 0.15 && z > 0.0 && n.z > -0.2) {
    m.alb = vec3f(0.03, 0.78, 0.76); m.pearl = 0.2; m.gloss = 1.4;
    if (n.x < -0.5 && ay < 0.11) { m.alb = vec3f(1.0); m.emit = vec3f(2.4, 2.5, 2.7); }
  }
  if (x < -0.75 && ay < 0.04 && n.z > 0.5) { m.alb = vec3f(0.05); m.pearl = 0.0; }
  if (x > 0.05 && x < 0.76 && ay < 0.17 && z > 0.02) {                // seat
    m.alb = vec3f(0.055, 0.055, 0.065) * (0.85 + 0.15 * step(0.5, fract(x * 40.0))); m.pearl = 0.0; m.gloss = 0.3;
  }
  if (x > -0.15 && x < 0.42 && ay > 0.1 && ay < 0.3 && z < -0.05 && n.z > 0.6) { // footwell mat
    m.alb = vec3f(0.07) * (0.7 + 0.3 * step(0.5, fract((x + p.y) * 70.0))); m.pearl = 0.0; m.gloss = 0.1;
  }
  if (x > -0.28 && x < -0.1 && (z > 0.2 || (ay < 0.08 && z > 0.12))) { m.alb = vec3f(0.12, 0.13, 0.15); m.pearl = 0.0; m.gloss = 0.6; }
  if (z < -0.215) { m.alb = vec3f(0.05, 0.05, 0.06); m.pearl = 0.0; m.gloss = 0.9; }
  else if (z < -0.2 && abs(n.z) < 0.6) { m.alb = vec3f(0.16, 0.17, 0.19); m.pearl = 0.0; }
  return m;
}
fn riderMat(p: vec3f, n: vec3f) -> Mat {
  var m: Mat; m.alb = vec3f(0.55, 0.31, 0.17); m.emit = vec3f(0.0); m.pearl = 0.0; m.gloss = 0.35;
  let x = p.x; let z = p.z; let ay = abs(p.y);
  if (z > 0.24) {
    if (n.x > -0.25 || z > 0.36) {                                    // cornrows
      m.alb = vec3f(0.035, 0.028, 0.025) * (0.6 + 0.6 * smoothstep(0.3, 1.0, sin(p.y * 260.0))); m.gloss = 0.6;
    } else if (z < 0.30) {                                            // salt-and-pepper beard
      m.alb = mix(vec3f(0.05, 0.045, 0.04), vec3f(0.45, 0.44, 0.42), smoothstep(0.55, 0.85, hash21(floor(p.yz * 900.0))) * smoothstep(0.255, 0.285, -abs(p.y) * 0.6 + z + 0.03));
      m.gloss = 0.15;
    }
    if (n.x < -0.35 && z > 0.322 && z < 0.345) { m.alb = vec3f(0.02, 0.45, 0.42); m.emit = vec3f(0.0, 0.08, 0.07); m.gloss = 2.0; }
  }
  let vest = x > 0.25 && x < 0.57 && z > -0.13 && z < 0.255 && ay < 0.2;
  if (vest) {
    m.alb = vec3f(0.33, 0.08, 0.55); m.gloss = 0.5;
    if (z > 0.18 && ay > 0.085) { m.alb = vec3f(0.35, 0.85, 0.62); }
    if ((z > -0.08 && z < -0.062) || (z > -0.035 && z < -0.017)) { m.alb = vec3f(0.03); m.gloss = 0.8; }
    if (ay < 0.004 && n.x < -0.3) { m.alb = vec3f(0.6); m.gloss = 2.0; }
  }
  if (z < -0.02 && x >= 0.1 && !vest) {
    m.alb = vec3f(0.08, 0.08, 0.1); m.gloss = 0.2;
    let thighc = -0.04 - 0.31 * (x - 0.13);
    if (ay > 0.19 && abs(z - thighc) < 0.014) { m.alb = vec3f(0.95, 0.35, 0.3); }
  }
  if (x < 0.1 && z < -0.225) { m.alb = vec3f(0.03, 0.03, 0.035); m.gloss = 0.4; }
  return m;
}
@fragment fn fsModel(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let t = scene.params.x;
  let ln = normalize(i.ln);
  var mt: Mat;
  mt = skiMat(i.lp, ln);
  var n = normalize(i.wn); if (!ff) { n = -n; }
  let v = normalize(scene.camPos.xyz - i.world);
  let S = sunDir(); let sc = sunCol(); let day = scene.sun.w;
  let ndv = max(dot(n, v), 0.0);
  let amb = mix(vec3f(0.12, 0.1, 0.2), vec3f(0.35, 0.42, 0.55), day) * (0.6 + 0.4 * n.y)
          + mix(vec3f(0.08, 0.05, 0.04), vec3f(0.06, 0.08, 0.09), day) * (0.5 - 0.5 * n.y);   // bounce off the water
  let diff = max(dot(n, S), 0.0);
  let h = normalize(S + v);
  let spec = pow(max(dot(n, h), 0.0), mix(24.0, 160.0, min(mt.gloss, 1.0))) * (0.15 + 0.5 * mt.gloss);
  let F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  // pearlescent paint: hue shifts with viewing angle
  let irid = 0.5 + 0.5 * cos(6.28318 * (ndv * 1.3 + vec3f(0.0, 0.33, 0.67)));
  let alb = mt.alb * mix(vec3f(1.0), mix(vec3f(1.0), irid * 0.35 + 0.75, 0.6), mt.pearl);
  var col = alb * (amb + sc * diff * 1.3) + sc * spec + mt.emit;
  col += sky(reflect(-v, n), t) * F * (0.15 + 0.6 * min(mt.gloss, 1.0) * (0.4 + 0.6 * mt.pearl));
  return vec4f(finish(fogMix(col, i.world, t)), 1.0);
}
@fragment fn fsGhost(@builtin(position) fp: vec4f, @location(0) world: vec3f, @location(1) wn: vec3f) -> @location(0) vec4f {
  let n = normalize(wn); let v = normalize(scene.camPos.xyz - world);
  let rim = pow(1.0 - abs(dot(n, v)), 2.0);
  let scan = 0.85 + 0.15 * sin(fp.y * 0.6 + scene.params.x * 8.0);
  return vec4f(finish(vec3f(0.35, 0.95, 1.0) * (0.45 + 1.3 * rim) * scan), 0.14 + 0.5 * rim);
}`;

/* Half-loop ring arches over each gate: glossy tube with racing light bands. */
const ARCH_WGSL = PRELUDE + /* wgsl */`
struct AO { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) st: f32 };
@vertex fn vsArch(@location(0) p: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) inst: vec4f) -> AO {
  let w = gerstner(inst.xy, scene.params.x, 6);
  let ca = cos(inst.w); let sa = sin(inst.w);
  let wp = vec3f(inst.x + p.x * ca - p.z * sa, w.pos.y - 0.25 + p.y, inst.y + p.x * sa + p.z * ca);
  var o: AO;
  o.pos = scene.viewProj * vec4f(wp, 1.0); o.world = wp;
  o.n = vec3f(nrm.x * ca - nrm.z * sa, nrm.y, nrm.x * sa + nrm.z * ca);
  o.uv = uv; o.st = inst.z;
  return o;
}
@fragment fn fsArch(a: AO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let t = scene.params.x;
  var n = normalize(a.n); if (!ff) { n = -n; }
  let v = normalize(scene.camPos.xyz - a.world);
  let S = sunDir(); let sc = sunCol(); let day = scene.sun.w;
  let next = a.st > 0.5 && a.st < 1.5;
  let startLine = a.st > 1.5;
  var base = vec3f(1.0, 0.45, 0.05);                       // orange
  if (next) { base = vec3f(0.1, 0.45, 1.0); }               // blue
  if (startLine) { base = mix(vec3f(0.95), vec3f(0.08), step(0.5, fract(a.uv.x * 12.0))); }
  // ring segments around the arch + a band of light racing over the top
  let seg = fract(a.uv.x * 28.0);
  let groove = smoothstep(0.0, 0.06, seg) * smoothstep(1.0, 0.94, seg);
  let rd = (fract(a.uv.x - t * select(0.35, 0.9, next)) - 0.5) * 9.0;
  let race = exp(-rd * rd);
  let rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  let F = 0.08 + 0.92 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  let refl = sky(reflect(-v, n), t);
  let h = normalize(S + v);
  let spec = pow(max(dot(n, h), 0.0), 120.0) * 1.4;
  var col = base * (0.15 + 0.5 * max(dot(n, S), 0.0)) * groove + refl * base * (0.35 + F) + sc * spec;
  let glow = select(0.9, 2.2, next) + race * select(1.2, 3.0, next);
  col += base * (0.25 + 0.75 * (1.0 - day * 0.5)) * glow * (0.35 + rim) * groove;
  col += base * (1.0 - groove) * 0.08;
  return vec4f(finish(fogMix(col, a.world, t)), 1.0);
}`;

/* Textured rider (Meshy texture, skin warmed toward the artwork) with straight-back braids painted over the scalp. */
const CHAR_WGSL = PRELUDE + /* wgsl */`
struct Obj { model: mat4x4f };
@group(1) @binding(0) var<uniform> obj: Obj;
@group(1) @binding(1) var samp: sampler;
@group(1) @binding(2) var tex: texture_2d<f32>;
struct CO { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) hv: vec2f, @location(4) flag: f32 };
@vertex fn vsChar(@location(0) p: vec3f, @location(1) n: vec4f, @location(2) uv: vec2f, @location(3) h: vec2f) -> CO {
  let wp = obj.model * vec4f(p, 1.0);
  var o: CO;
  o.pos = scene.viewProj * wp; o.world = wp.xyz; o.n = (obj.model * vec4f(n.xyz, 0.0)).xyz;
  o.uv = uv; o.hv = h; o.flag = n.w;
  return o;
}
@fragment fn fsChar(c: CO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let t = scene.params.x;
  var alb = pow(textureSample(tex, samp, c.uv).rgb, vec3f(2.2));
  var gloss = 0.35;
  if (c.flag > 0.75) {
    let u = c.hv.x * 13.0;
    let row = fract(u);
    let across = abs(row - 0.5) * 2.0;
    let braid = 1.0 - smoothstep(0.5, 1.0, across);
    let weave = 0.5 + 0.5 * sin(c.hv.y * 95.0 + floor(u) * 1.7 + select(0.0, 3.14159, row > 0.5));
    let part = smoothstep(0.86, 1.0, across);
    alb = mix(vec3f(0.018, 0.013, 0.011) * (0.5 + 1.2 * braid * (0.55 + 0.45 * weave)), pow(vec3f(0.42, 0.25, 0.15), vec3f(2.2)), part * 0.85);
    gloss = 0.25 + 0.7 * braid;
  } else if (c.flag > 0.25) {
    alb = pow(vec3f(0.6, 0.36, 0.21), vec3f(2.2));
  }
  var n = normalize(c.n); if (!ff) { n = -n; }
  let v = normalize(scene.camPos.xyz - c.world);
  let S = sunDir(); let sc = sunCol(); let day = scene.sun.w;
  let amb = mix(vec3f(0.12, 0.1, 0.2), vec3f(0.35, 0.42, 0.55), day) * (0.6 + 0.4 * n.y)
          + mix(vec3f(0.08, 0.05, 0.04), vec3f(0.06, 0.08, 0.09), day) * (0.5 - 0.5 * n.y);
  let wl = max((dot(n, S) + 0.25) / 1.25, 0.0);
  let spec = pow(max(dot(n, normalize(S + v)), 0.0), mix(16.0, 90.0, gloss)) * 0.25 * gloss;
  let rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  var col = alb * (amb * 1.3 + sc * wl * 1.25) + sc * spec + sky(reflect(-v, n), t) * rim * 0.12;
  return vec4f(finish(fogMix(col, c.world, t)), 1.0);
}
@fragment fn fsGhost(@builtin(position) fp: vec4f, @location(0) world: vec3f, @location(1) wn: vec3f) -> @location(0) vec4f {
  let n = normalize(wn); let v = normalize(scene.camPos.xyz - world);
  let rim = pow(1.0 - abs(dot(n, v)), 2.0);
  let scan = 0.85 + 0.15 * sin(fp.y * 0.6 + scene.params.x * 8.0);
  return vec4f(finish(vec3f(0.35, 0.95, 1.0) * (0.45 + 1.3 * rim) * scan), 0.14 + 0.5 * rim);
}`;

/* Banner gates: two striped poles with a waving flag strung across the top. */
const BANNER_WGSL = PRELUDE + /* wgsl */`
struct BO { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) st: f32, @location(4) kind: f32, @location(5) fwd: vec3f };
@vertex fn vsBan(@location(0) p0: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(4) kind: f32, @location(3) inst: vec4f) -> BO {
  let t = scene.params.x;
  let w = gerstner(inst.xy, t, 6);
  var p = p0; var nl = nrm;
  if (kind > 0.5) {
    let span = sin(uv.x * 3.14159);
    let amp = 0.2 * (1.15 - uv.y * 0.55) * (1.0 + scene.misc.x * 1.5);
    let arg = uv.x * 7.0 - t * 3.6 + inst.x * 0.37;
    p.z += span * sin(arg) * amp;
    p.y -= span * 0.18;
    let W = 8.8;
    let dz = (3.14159 * cos(uv.x * 3.14159) * sin(arg) * amp + span * 7.0 * cos(arg) * amp) / W;
    nl = normalize(vec3f(-dz, 0.0, 1.0));
  }
  let ca = cos(inst.w); let sa = sin(inst.w);
  let wp = vec3f(inst.x + p.x * ca - p.z * sa, w.pos.y - 0.25 + p.y, inst.y + p.x * sa + p.z * ca);
  var o: BO;
  o.pos = scene.viewProj * vec4f(wp, 1.0); o.world = wp;
  o.n = vec3f(nl.x * ca - nl.z * sa, nl.y, nl.x * sa + nl.z * ca);
  o.fwd = vec3f(-sa, 0.0, ca);
  o.uv = uv; o.st = inst.z; o.kind = kind;
  return o;
}
fn sdSeg(p: vec2f, a: vec2f, b: vec2f) -> f32 { let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
fn text747(u0: vec2f) -> f32 {
  var p = u0; p.x -= p.y * 0.2;
  var d = 1e3;
  d = min(d, sdSeg(p, vec2f(0.0, 1.0), vec2f(0.85, 1.0)));
  d = min(d, sdSeg(p, vec2f(0.85, 1.0), vec2f(0.3, 0.0)));
  let q = p - vec2f(1.15, 0.0);
  d = min(d, sdSeg(q, vec2f(0.62, 0.0), vec2f(0.62, 1.0)));
  d = min(d, sdSeg(q, vec2f(0.62, 1.0), vec2f(0.0, 0.32)));
  d = min(d, sdSeg(q, vec2f(0.0, 0.32), vec2f(0.88, 0.32)));
  let r = p - vec2f(2.35, 0.0);
  d = min(d, sdSeg(r, vec2f(0.0, 1.0), vec2f(0.85, 1.0)));
  d = min(d, sdSeg(r, vec2f(0.85, 1.0), vec2f(0.3, 0.0)));
  return d;
}
@fragment fn fsBan(b: BO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let t = scene.params.x;
  let v = normalize(scene.camPos.xyz - b.world);
  let S = sunDir(); let sc = sunCol(); let day = scene.sun.w;
  let next = b.st > 0.5 && b.st < 1.5;
  let startLine = b.st > 1.5;
  var n = normalize(b.n); if (!ff) { n = -n; }
  var alb = vec3f(0.0); var emit = vec3f(0.0); var gloss = 0.2;
  if (b.kind < 0.5) {                                        // pole: candy-striped metal with a lit cap
    alb = mix(vec3f(0.92), select(vec3f(1.0, 0.42, 0.05), vec3f(0.1, 0.45, 1.0), next), step(0.5, fract(b.uv.y * 9.0)));
    if (b.uv.y > 0.985) { emit = select(vec3f(1.6, 0.6, 0.1), vec3f(0.3, 1.0, 2.2), next) * (0.8 + 0.4 * sin(t * 5.0)); }
    gloss = 0.9;
  } else {
    var base = select(vec3f(1.0, 0.42, 0.05), vec3f(0.08, 0.4, 1.0), next);
    // read the flag from whichever side you're on so "747" never shows mirrored
    let side = select(-1.0, 1.0, dot(b.fwd, v) > 0.0);
    let W = 8.8; let H = 1.4;
    let lx = (b.uv.x - 0.5) * W * side;
    let ly = (b.uv.y - 0.5) * H;
    alb = base;
    if (startLine) { alb = mix(vec3f(0.95), vec3f(0.06), abs(step(0.5, fract(lx / 0.35)) - step(0.5, fract(ly / 0.35)))); }
    let edge = step(0.4, abs(ly));
    alb = mix(alb, vec3f(0.95), edge * select(1.0, 0.0, startLine));
    if (!startLine) {
      let g = 0.62;
      let k = 1.0 - smoothstep(0.07, 0.11, text747(vec2f(lx / g + 1.62, ly / g + 0.5)));
      alb = mix(alb, vec3f(0.97), k);
      // chevrons on both ends
      let cx = abs(lx) - 2.6;
      if (cx > 0.0 && cx < 1.6) { let ch = fract((cx - abs(ly) * 0.8) / 0.55); alb = mix(alb, vec3f(0.97), step(0.62, ch) * (1.0 - edge)); }
    } else {
      let k = 1.0 - smoothstep(0.07, 0.11, text747(vec2f(lx / 0.5 + 1.62, ly / 0.5 + 0.5)));
      if (abs(lx) < 1.25 && abs(ly) < 0.36) { alb = mix(vec3f(0.06), vec3f(1.0, 0.42, 0.05), k); }
    }
    if (next) { emit = alb * (0.25 + 0.2 * sin(t * 6.0)); }
  }
  let amb = mix(vec3f(0.14, 0.12, 0.22), vec3f(0.4, 0.46, 0.58), day) * (0.6 + 0.4 * n.y);
  let diff = max(dot(n, S), 0.0);
  let trans = select(max(dot(-n, S), 0.0) * 0.45, 0.0, b.kind < 0.5);       // sun glowing through the cloth
  let spec = pow(max(dot(n, normalize(S + v)), 0.0), mix(12.0, 120.0, gloss)) * gloss * 0.6;
  var col = alb * (amb + sc * (diff + trans) * 1.2) + sc * spec + emit
          + sky(reflect(-v, n), t) * pow(1.0 - max(dot(n, v), 0.0), 4.0) * gloss * 0.5;
  return vec4f(finish(fogMix(col, b.world, t)), 1.0);
}`;

/* Lane marker buoys: red and white banded floats with a blinking top light, tilting on the swell. */
const MARK_WGSL = PRELUDE + /* wgsl */`
struct KO { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) ly: f32, @location(3) ph: f32 };
@vertex fn vsMark(@location(0) p: vec3f, @location(1) nrm: vec3f, @location(2) inst: vec4f) -> KO {
  let t = scene.params.x;
  let w = gerstner(inst.xy, t, 6);
  let tilt = vec2f(w.nrm.x, w.nrm.z) * 1.3 + vec2f(sin(t * 1.7 + inst.z), cos(t * 1.3 + inst.z)) * 0.05;
  let lp = vec3f(p.x + tilt.x * p.y, p.y, p.z + tilt.y * p.y);
  let wp = vec3f(inst.x + lp.x, w.pos.y - 0.2 + lp.y, inst.y + lp.z);
  var o: KO;
  o.pos = scene.viewProj * vec4f(wp, 1.0); o.world = wp;
  o.n = normalize(nrm + vec3f(tilt.x, 0.0, tilt.y) * nrm.y);
  o.ly = p.y; o.ph = inst.z;
  return o;
}
@fragment fn fsMark(k: KO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let t = scene.params.x;
  var n = normalize(k.n); if (!ff) { n = -n; }
  let v = normalize(scene.camPos.xyz - k.world);
  let S = sunDir(); let sc = sunCol(); let day = scene.sun.w;
  let band = step(0.5, fract((k.ly + 0.35) * 2.4));
  var alb = mix(vec3f(0.82, 0.05, 0.04), vec3f(0.94, 0.93, 0.92), band);
  var emit = vec3f(0.0);
  if (k.ly > 0.9) { alb = vec3f(0.15); }
  if (k.ly > 1.13) {
    let blink = step(0.72, fract(t * 0.7 + k.ph * 0.159));
    alb = vec3f(0.6, 0.1, 0.08); emit = vec3f(3.0, 0.25, 0.15) * blink + vec3f(0.25, 0.02, 0.01);
  }
  let amb = mix(vec3f(0.14, 0.12, 0.22), vec3f(0.4, 0.46, 0.58), day) * (0.6 + 0.4 * n.y);
  let diff = max(dot(n, S), 0.0);
  let spec = pow(max(dot(n, normalize(S + v)), 0.0), 60.0) * 0.5;
  let F = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  let col = alb * (amb + sc * diff * 1.25) + sc * spec + sky(reflect(-v, n), t) * F * 0.5 + emit;
  return vec4f(finish(fogMix(col, k.world, t)), 1.0);
}`;

/* Course props. Ramps: red and white arrows on the deck and sides. Speed pads: blue-to-white chevrons racing forward. */
const PROP_WGSL = PRELUDE + /* wgsl */`
struct PO { @builtin(position) pos: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) part: f32 };
@vertex fn vsProp(@location(0) p: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) part: f32, @location(4) a: vec4f, @location(5) b: vec4f) -> PO {
  let ca = cos(a.w); let sa = sin(a.w);
  var lp = p; lp.y += p.x * b.x + p.z * b.y;          // tilt pads with the swell
  if (part > 4.5 && part < 5.5 && p.y > 2.0) { lp.z += sin(abs(p.x) * 3.0 - scene.params.x * 6.0) * 0.18 * (abs(p.x) - 8.0); }
  let wp = vec3f(a.x + lp.x * ca + lp.z * sa, a.y + lp.y, a.z - lp.x * sa + lp.z * ca);
  var n = nrm; n = normalize(vec3f(n.x - n.y * b.x, n.y, n.z - n.y * b.y));
  var o: PO;
  o.pos = scene.viewProj * vec4f(wp, 1.0); o.world = wp;
  o.n = vec3f(n.x * ca + n.z * sa, n.y, -n.x * sa + n.z * ca);
  o.uv = uv; o.part = part;
  return o;
}
@fragment fn fsProp(f: PO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let t = scene.params.x;
  var n = normalize(f.n); if (!ff) { n = -n; }
  let v = normalize(scene.camPos.xyz - f.world);
  let S = sunDir(); let sc = sunCol(); let day = scene.sun.w;
  let RED = vec3f(0.85, 0.05, 0.04); let WHITE = vec3f(0.94, 0.93, 0.92);
  var alb = vec3f(0.12); var emit = vec3f(0.0); var gloss = 0.4;
  if (f.part < 0.5) {                                  // ramp deck: arrows pointing up the ramp
    let along = f.uv.y * 7.0; let across = f.uv.x * 2.25;
    let ch = fract((along - abs(across) * 0.9) / 1.4);
    alb = mix(RED, WHITE, step(0.5, ch));
    if (abs(f.uv.x) > 0.93) { alb = vec3f(0.95, 0.75, 0.05); }
    if (f.uv.y > 0.97) { alb = vec3f(0.95, 0.75, 0.05); emit = vec3f(0.5, 0.35, 0.0); }
    gloss = 0.3;
  } else if (f.part < 1.5) {                           // ramp sides: arrows on the outside too
    let ch = fract((f.uv.y * 7.0 - abs(f.uv.x - 0.5) * 1.6) / 1.2);
    alb = mix(WHITE, RED, step(0.5, ch));
  } else if (f.part < 2.5) {                           // back and underside
    alb = vec3f(0.1, 0.1, 0.12);
  } else if (f.part < 3.5) {                           // speed pad
    let along = f.uv.y * 5.0; let across = f.uv.x * 1.6;
    let ch = fract((along - abs(across) * 0.85) / 1.1 - t * 2.4);
    let k = smoothstep(0.3, 0.8, ch) * step(ch, 0.92);
    alb = mix(vec3f(0.03, 0.25, 0.85), vec3f(1.0), k);
    emit = mix(vec3f(0.05, 0.35, 1.2), vec3f(1.4, 1.6, 1.8), k) * (0.55 + 0.45 * (1.0 - day * 0.5));
    if (abs(f.uv.x) > 0.9 || f.uv.y < 0.04 || f.uv.y > 0.96) { alb = WHITE; emit = vec3f(0.3, 0.5, 0.9); }
    gloss = 0.8;
  } else if (f.part < 4.5) {                           // pad frame
    alb = vec3f(0.08, 0.3, 0.9); gloss = 0.7;
  } else if (f.part < 5.5) {                           // start/finish checks
    let c = (floor(f.uv.x / 0.6) + floor(f.uv.y / 0.6)) % 2.0;
    alb = mix(vec3f(0.95), vec3f(0.04), abs(c)); gloss = 0.35;
  } else {                                             // flag poles
    alb = vec3f(0.9); gloss = 0.9;
  }
  let amb = mix(vec3f(0.14, 0.12, 0.22), vec3f(0.4, 0.46, 0.58), day) * (0.6 + 0.4 * n.y);
  let diff = max(dot(n, S), 0.0);
  let spec = pow(max(dot(n, normalize(S + v)), 0.0), mix(16.0, 120.0, gloss)) * gloss * 0.6;
  let F = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  let col = alb * (amb + sc * diff * 1.25) + sc * spec + sky(reflect(-v, n), t) * F * gloss * 0.5 + emit;
  return vec4f(finish(fogMix(col, f.world, t)), 1.0);
}`;

const SPRAY_WGSL = PRELUDE + /* wgsl */`
struct POut { @builtin(position) pos: vec4f, @location(0) c: vec2f, @location(1) a: f32, @location(2) world: vec3f, @location(3) kind: f32 };
@vertex fn vsSpray(@builtin(vertex_index) vi: u32, @location(0) p: vec4f, @location(1) q: vec4f, @location(2) r: vec4f) -> POut {
  var cs = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  let c = cs[vi];
  var wp: vec3f;
  if (r.x < 0.5) {
    // droplets and streams: the quad stretches along the drop's motion as seen from the camera
    let toCam = normalize(scene.camPos.xyz - p.xyz);
    var ax = q.xyz - toCam * dot(q.xyz, toCam);
    let al = length(ax);
    if (al < 1e-3) { ax = scene.camUp.xyz; } else { ax = ax / al; }
    let side = normalize(cross(ax, toCam));
    wp = p.xyz + side * c.x * p.w + ax * c.y * p.w * (1.0 + min(al, 30.0) * 0.09);
  } else {
    wp = p.xyz + (scene.camRight.xyz * c.x + scene.camUp.xyz * c.y) * p.w;
  }
  var o: POut;
  o.pos = scene.viewProj * vec4f(wp, 1.0); o.c = c; o.a = q.w; o.world = wp; o.kind = r.x;
  return o;
}
@fragment fn fsSpray(i: POut) -> @location(0) vec4f {
  let t = scene.params.x; let day = scene.sun.w; let S = sunDir(); let sc = sunCol();
  let r2 = dot(i.c, i.c);
  if (r2 > 1.0) { discard; }
  let v = normalize(scene.camPos.xyz - i.world);
  if (i.kind < 0.5) {
    // a tiny sphere of water: sky reflection at the rim, a sun glint, a little blue-green body
    let nz = sqrt(1.0 - r2);
    let n = normalize(scene.camRight.xyz * i.c.x + scene.camUp.xyz * i.c.y + v * nz);
    let F = 0.08 + 0.92 * pow(1.0 - nz, 3.0);
    let refl = sky(reflect(-v, n), t);
    let body = mix(vec3f(0.16, 0.38, 0.44), vec3f(0.55, 0.8, 0.86), day) * (0.5 + 0.5 * max(dot(n, S), 0.0));
    let glint = pow(max(dot(n, normalize(S + v)), 0.0), 80.0) * 4.0;
    let col = mix(body, refl, F) + sc * glint;
    let a = i.a * (0.5 + 0.5 * F) * smoothstep(1.0, 0.7, r2);
    return vec4f(finish(fogMix(col, i.world, t)), a);
  }
  let soft = 1.0 - r2;
  let col = mix(vec3f(0.62, 0.64, 0.72), vec3f(0.96, 0.98, 1.0), day) * (0.65 + 0.35 * sc.x);
  return vec4f(finish(fogMix(col, i.world, t)), soft * soft * i.a * 0.3);
}`;


async function initRenderer(device, signal) {
  const ctx=canvas.getContext("webgpu");
  if (!ctx) throw Error("WebGPU canvas unavailable.");
  const format=navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({device,format,alphaMode:"opaque"});
  const SAMPLES=4;
  /* ================= meshes: pos3 nrm3 col3 ================= */
  function Builder(){
    const v=[];
    const quad=(a,b,c,d,col,center)=>{
      let n=V.norm(V.cross(V.sub(b,a),V.sub(d,a)));
      const fc=V.sc(V.add(V.add(a,b),V.add(c,d)),0.25);
      if (V.dot(n,V.sub(fc,center))<0) n=V.sc(n,-1);
      for(const p of [a,b,c,a,c,d]) v.push(...p,...n,...col);
    };
    const hexa=(p,col)=>{ const ce=V.sc(p.reduce((s,q)=>V.add(s,q),[0,0,0]),1/8);
      [[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],[0,3,7,4],[1,2,6,5]].forEach(f=>quad(p[f[0]],p[f[1]],p[f[2]],p[f[3]],col,ce)); };
    const box=(cx,cy,cz,sx,sy,sz,col)=>{ const x=sx/2,y=sy/2,z=sz/2;
      hexa([[cx-x,cy-y,cz-z],[cx+x,cy-y,cz-z],[cx+x,cy-y,cz+z],[cx-x,cy-y,cz+z],[cx-x,cy+y,cz-z],[cx+x,cy+y,cz-z],[cx+x,cy+y,cz+z],[cx-x,cy+y,cz+z]],col); };
    const beam=(a,b,th,col)=>{ const d=V.norm(V.sub(b,a)); let s=V.cross(d,[0,1,0]); if(Math.hypot(...s)<1e-3) s=[1,0,0]; s=V.sc(V.norm(s),th); const u=V.sc(V.norm(V.cross(s,d)),th);
      const P=(o,i,j)=>V.add(V.add(o,V.sc(s,i)),V.sc(u,j));
      hexa([P(a,-1,-1),P(a,1,-1),P(b,1,-1),P(b,-1,-1),P(a,-1,1),P(a,1,1),P(b,1,1),P(b,-1,1)],col); };
    return {v,hexa,box,beam};
  }
  function buoyMesh(){
    const v=[], top=[0,1.7,0], bot=[0,-1,0], eq=[[.7,0,0],[0,0,.7],[-.7,0,0],[0,0,-.7]];
    const face=(a,b,c)=>{ let n=V.norm(V.cross(V.sub(b,a),V.sub(c,a))); const ce=V.sc(V.add(V.add(a,b),c),1/3); if(V.dot(n,ce)<0)n=V.sc(n,-1); for(const p of [a,b,c]) v.push(...p,...n,1,1,1); };
    for(let i=0;i<4;i++){const a=eq[i],b=eq[(i+1)%4];face(top,a,b);face(bot,b,a);}
    return new Float32Array(v);
  }
  // ocean grid around the camera: dense in the middle, stretched toward the horizon
  const N=256, R=170;
  const warp=u=>Math.sign(u)*(Math.abs(u)*0.22+Math.pow(Math.abs(u),3)*0.78)*R;
  const gridV=new Float32Array((N+1)*(N+1)*2);
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const k=(j*(N+1)+i)*2;gridV[k]=warp(i/N*2-1);gridV[k+1]=warp(j/N*2-1);}
  const gridI=new Uint32Array(N*N*6);
  for(let j=0,k=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;gridI.set([a,c,b,b,c,d],k);k+=6;}

  const mkBuf=(data,usage)=>{const b=device.createBuffer({size:data.byteLength,usage:usage|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(b,0,data);return b;};
  const buoyData=buoyMesh();
  // Neon Wave 747 hull: int16 local positions, int8 normals. Rider: posed in ski space, with UVs and braid coords.
  async function bufferFile(name,bytes) {
    const response=await fetch('./v014/'+name,{signal});
    if (!response.ok) throw Error('Could not load '+name+' ('+response.status+').');
    const data=new Uint8Array(await response.arrayBuffer());
    if (data.length!==bytes) throw Error('Incomplete model file: '+name);
    return data;
  }
  const [skiVertices,skiIndices,riderVertices,riderIndices]=await Promise.all([
    bufferFile('ski-vb.bin',164040),
    bufferFile('ski-ib.bin',106224),
    bufferFile('rider-vb.bin',652896),
    bufferFile('rider-ib.bin',170274)
  ]);
  const idxBuf=u8=>{const pad=new Uint8Array(Math.ceil(u8.byteLength/4)*4);pad.set(u8);return mkBuf(pad,GPUBufferUsage.INDEX);};
  const skiVB2=mkBuf(skiVertices,GPUBufferUsage.VERTEX),skiIB2=idxBuf(skiIndices);
  const charVB=mkBuf(riderVertices,GPUBufferUsage.VERTEX),charIB=idxBuf(riderIndices);
  // local (Z-up, nose at -X) -> game (Y-up, nose at +Z), scaled to a ~3 m ski with the hull bottom at the origin
  const MS=1.58, MZ0=-(-0.2943280339241028);
  const MODEL_FIX=new Float32Array([0,0,-MS,0, -MS,0,0,0, 0,MS,0,0, 0,MZ0*MS,0,1]);
  const gridVB=mkBuf(gridV,GPUBufferUsage.VERTEX), gridIB=mkBuf(gridI,GPUBufferUsage.INDEX);
  const buoyVB=mkBuf(buoyData,GPUBufferUsage.VERTEX);
  function archMesh(R,r,segU,segV){
    const v=[], P=(i,j)=>{ const th=Math.PI*i/segU, ph=2*Math.PI*j/segV; const cx=Math.cos(th)*R, cy=Math.sin(th)*R;
      const nx=Math.cos(th)*Math.cos(ph), ny=Math.sin(th)*Math.cos(ph), nz=Math.sin(ph);
      return [cx+nx*r, cy+ny*r, nz*r, nx, ny, nz, i/segU, j/segV]; };
    for(let i=0;i<segU;i++)for(let j=0;j<segV;j++){ const a=P(i,j),b=P(i+1,j),c=P(i+1,j+1),d=P(i,j+1); v.push(...a,...b,...c,...a,...c,...d); }
    return new Float32Array(v);
  }
  const archData=archMesh(HALF_ARCH,0.32,64,14);
  function bannerMesh(){
    const v=[], push=(p,n,u,k)=>v.push(p[0],p[1],p[2],n[0],n[1],n[2],u[0],u[1],k);
    const SEG=12, Y0=-0.4, Y1=5.4, R=0.09;
    for (const sx of [-HALF_ARCH,HALF_ARCH]){
      for(let i=0;i<SEG;i++){ const a0=i/SEG*TAU, a1=(i+1)/SEG*TAU;
        const P=(a,y)=>[sx+Math.cos(a)*R,y,Math.sin(a)*R], Nn=a=>[Math.cos(a),0,Math.sin(a)];
        const A=P(a0,Y0),Bp=P(a1,Y0),C=P(a1,Y1),D=P(a0,Y1);
        push(A,Nn(a0),[0,0],0); push(Bp,Nn(a1),[0,0],0); push(C,Nn(a1),[0,0.98],0);
        push(A,Nn(a0),[0,0],0); push(C,Nn(a1),[0,0.98],0); push(D,Nn(a0),[0,0.98],0);
        const top=[sx,Y1+0.14,0]; push(D,[0,1,0],[0,1],0); push(C,[0,1,0],[0,1],0); push(top,[0,1,0],[0,1],0);
      }
    }
    const NU=48, NV=6, X0=-HALF_ARCH+0.1, X1=HALF_ARCH-0.1, B0=3.75, B1=5.15;
    const G=(i,j)=>[[X0+(X1-X0)*i/NU, B0+(B1-B0)*j/NV, 0],[0,0,1],[i/NU,j/NV]];
    for(let i=0;i<NU;i++)for(let j=0;j<NV;j++){ const a=G(i,j),b=G(i+1,j),c=G(i+1,j+1),d=G(i,j+1);
      for(const q of [a,b,c,a,c,d]) push(q[0],q[1],q[2],1); }
    return new Float32Array(v);
  }
  function markerMesh(){
    const prof=[[0,-0.35],[0.24,-0.31],[0.36,-0.12],[0.4,0.15],[0.37,0.45],[0.25,0.72],[0.09,0.88],[0.07,0.9],[0.07,1.12],[0.12,1.14],[0.12,1.24],[0,1.27]];
    const SEG=14, v=[];
    const nrmAt=i=>{ const a=prof[Math.max(0,i-1)], b=prof[Math.min(prof.length-1,i+1)]; const dr=b[0]-a[0], dy=b[1]-a[1]; const l=Math.hypot(dr,dy)||1; return [dy/l,-dr/l]; };
    for(let i=0;i<prof.length-1;i++) for(let j=0;j<SEG;j++){
      const a0=j/SEG*TAU, a1=(j+1)/SEG*TAU;
      const P=(k,a)=>{ const [r,y]=prof[k], [nr,ny]=nrmAt(k); return [Math.cos(a)*r,y,Math.sin(a)*r, Math.cos(a)*nr,ny,Math.sin(a)*nr]; };
      const A=P(i,a0),B=P(i,a1),C=P(i+1,a1),D=P(i+1,a0);
      v.push(...A,...B,...C,...A,...C,...D);
    }
    return new Float32Array(v);
  }
  function rampMesh(){
    const v=[], tri=(a,b,c,n,ua,ub,uc,part)=>{ for(const [q,u] of [[a,ua],[b,ub],[c,uc]]) v.push(q[0],q[1],q[2],n[0],n[1],n[2],u[0],u[1],part); };
    const quad=(a,b,c,d,n,ua,ub,uc,ud,part)=>{ tri(a,b,c,n,ua,ub,uc,part); tri(a,c,d,n,ua,uc,ud,part); };
    const w=RAMP_W/2, L=RAMP_L, H=RAMP_H, sl=Math.hypot(L,H), nt=[0,L/sl,-H/sl];
    // deck split into strips so the arrows stay crisp
    const SEG=8; for(let i=0;i<SEG;i++){ const z0=L*i/SEG, z1=L*(i+1)/SEG, y0=H*i/SEG, y1=H*(i+1)/SEG;
      quad([-w,y0,z0],[w,y0,z0],[w,y1,z1],[-w,y1,z1],nt,[-1,i/SEG],[1,i/SEG],[1,(i+1)/SEG],[-1,(i+1)/SEG],0); }
    for (const sx of [-1,1]){ const x=sx*w; tri([x,0,0],[x,0,L],[x,H,L],[sx,0,0],[0,0],[0,1],[1,1],1); tri([x,-0.4,0],[x,-0.4,L],[x,0,L],[sx,0,0],[0,0],[0,1],[0.2,1],1); tri([x,-0.4,0],[x,0,L],[x,0,0],[sx,0,0],[0,0],[0.2,1],[0.2,0],1); }
    quad([-w,-0.4,L],[w,-0.4,L],[w,H,L],[-w,H,L],[0,0,1],[0,0],[1,0],[1,1],[0,1],2);
    quad([-w,-0.4,0],[w,-0.4,0],[w,0,0],[-w,0,0],[0,0,-1],[0,0],[1,0],[1,1],[0,1],2);
    return new Float32Array(v);
  }
  function padMesh(){
    const v=[], quad=(a,b,c,d,n,ua,ub,uc,ud,part)=>{ for(const [q,u] of [[a,ua],[b,ub],[c,uc],[a,ua],[c,uc],[d,ud]]) v.push(q[0],q[1],q[2],n[0],n[1],n[2],u[0],u[1],part); };
    const w=PAD_W/2, l=PAD_L/2, y=0.14;
    quad([-w,y,-l],[w,y,-l],[w,y,l],[-w,y,l],[0,1,0],[-1,0],[1,0],[1,1],[-1,1],3);
    quad([-w,-0.1,-l],[w,-0.1,-l],[w,y,-l],[-w,y,-l],[0,0,-1],[0,0],[1,0],[1,1],[0,1],4);
    quad([-w,-0.1,l],[w,-0.1,l],[w,y,l],[-w,y,l],[0,0,1],[0,0],[1,0],[1,1],[0,1],4);
    quad([-w,-0.1,-l],[-w,-0.1,l],[-w,y,l],[-w,y,-l],[-1,0,0],[0,0],[1,0],[1,1],[0,1],4);
    quad([w,-0.1,-l],[w,-0.1,l],[w,y,l],[w,y,-l],[1,0,0],[0,0],[1,0],[1,1],[0,1],4);
    return new Float32Array(v);
  }
  function startMesh(){
    const v=[], quad=(a,b,c,d,n,ua,ub,uc,ud,part)=>{ for(const [q,u] of [[a,ua],[b,ub],[c,uc],[a,ua],[c,uc],[d,ud]]) v.push(q[0],q[1],q[2],n[0],n[1],n[2],u[0],u[1],part); };
    const E=9.5+0.5;   // lane half-width + 0.5 (LANE is declared later with the course)
    quad([-E,0.1,-0.6],[E,0.1,-0.6],[E,0.1,0.6],[-E,0.1,0.6],[0,1,0],[0,0],[2*E,0],[2*E,1.2],[0,1.2],5);          // line across the water
    quad([-E,-0.1,-0.6],[E,-0.1,-0.6],[E,0.1,-0.6],[-E,0.1,-0.6],[0,0,-1],[0,0],[2*E,0],[2*E,0.2],[0,0.2],5);
    quad([-E,-0.1,0.6],[E,-0.1,0.6],[E,0.1,0.6],[-E,0.1,0.6],[0,0,1],[0,0],[2*E,0],[2*E,0.2],[0,0.2],5);
    for (const sx of [-1,1]){
      const x=sx*E, xo=sx*(E+0.25);
      quad([x,-0.1,-6],[x,-0.1,6],[x,0.6,6],[x,0.6,-6],[-sx,0,0],[0,0],[12,0],[12,0.7],[0,0.7],5);               // boards along the edges
      quad([xo,-0.1,-6],[xo,-0.1,6],[xo,0.6,6],[xo,0.6,-6],[sx,0,0],[0,0],[12,0],[12,0.7],[0,0.7],5);
      quad([x,0.6,-6],[xo,0.6,-6],[xo,0.6,6],[x,0.6,6],[0,1,0],[0,0],[0.25,0],[0.25,12],[0,12],5);
      const px=sx*(E+0.12), r=0.07;                                                                              // pole
      for (const [ax,az,nx,nz] of [[1,0,1,0],[-1,0,-1,0],[0,1,0,1],[0,-1,0,-1]]){
        const a=[px+ax*r-az*r,-0.3,az*r+ax*r], b=[px+ax*r+az*r,-0.3,az*r-ax*r];
        quad(a,b,[b[0],4.1,b[2]],[a[0],4.1,a[2]],[nx,0,nz],[0,0],[1,0],[1,1],[0,1],6);
      }
      const f0=sx*(E+0.12), f1=sx*(E+2.0);                                                                        // flag
      quad([f0,2.9,0],[f1,2.9,0],[f1,4.0,0],[f0,4.0,0],[0,0,1],[0,0],[1.88,0],[1.88,1.1],[0,1.1],5);
    }
    return new Float32Array(v);
  }
  const startData=startMesh(), startVB=mkBuf(startData,GPUBufferUsage.VERTEX);
  const startInst=device.createBuffer({size:32,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}), startIData=new Float32Array(8);
  const rampData=rampMesh(), padData=padMesh();
  const rampVB=mkBuf(rampData,GPUBufferUsage.VERTEX), padVB=mkBuf(padData,GPUBufferUsage.VERTEX);
  const rampInst=device.createBuffer({size:MAX_RAMPS*32,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  const padInst=device.createBuffer({size:MAX_PADS*32,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  const rampIData=new Float32Array(MAX_RAMPS*8), padIData=new Float32Array(MAX_PADS*8);
  const markData=markerMesh();
  const markVB=mkBuf(markData,GPUBufferUsage.VERTEX);
  const banData=bannerMesh();
  const banVB=mkBuf(banData,GPUBufferUsage.VERTEX);
  const archVB=mkBuf(archData,GPUBufferUsage.VERTEX);
  const archInst=device.createBuffer({size:MAX_GATES*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  const buoyInst=device.createBuffer({size:MAX_GATES*2*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  const sprayInst=device.createBuffer({size:MAX_SPRAY*48,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});

  /* ================= pipelines ================= */
  const uBGL=()=>device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]});
  const sceneBGL=uBGL(), objBGL=uBGL();
  const SCENE_FLOATS=200;
  const sceneBuf=device.createBuffer({size:SCENE_FLOATS*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const sceneBG=device.createBindGroup({layout:sceneBGL,entries:[{binding:0,resource:{buffer:sceneBuf}}]});
  const skiBuf=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const skiBG=device.createBindGroup({layout:objBGL,entries:[{binding:0,resource:{buffer:skiBuf}}]});
  const charImg=new Image(); charImg.src='./v014/rider.jpg'; await charImg.decode();
  const TEX=2048, MIPS=Math.floor(Math.log2(TEX))+1;
  const charTex=device.createTexture({size:[TEX,TEX],format:'rgba8unorm',mipLevelCount:MIPS,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
  for(let l=0,sz=TEX;l<MIPS;l++,sz=Math.max(1,sz>>1)){
    const bmp=await createImageBitmap(charImg,{resizeWidth:sz,resizeHeight:sz,resizeQuality:'high'});
    try { device.queue.copyExternalImageToTexture({source:bmp},{texture:charTex,mipLevel:l},[sz,sz]); } finally { bmp.close(); }
  }
  const charSamp=device.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear',maxAnisotropy:8,addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  const charBGL=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
    {binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}}]});
  const charBuf=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const charBG=device.createBindGroup({layout:charBGL,entries:[{binding:0,resource:{buffer:charBuf}},{binding:1,resource:charSamp},{binding:2,resource:charTex.createView()}]});
  const L1=device.createPipelineLayout({bindGroupLayouts:[sceneBGL]}), L2=device.createPipelineLayout({bindGroupLayouts:[sceneBGL,objBGL]});
  const mod=code=>device.createShaderModule({code});
  const propMod=mod(PROP_WGSL), markMod=mod(MARK_WGSL), banMod=mod(BANNER_WGSL), charMod=mod(CHAR_WGSL), archMod=mod(ARCH_WGSL), skyMod=mod(SKY_WGSL), waterMod=mod(WATER_WGSL), meshMod=mod(MESH_WGSL), sprayMod=mod(SPRAY_WGSL), modelMod=mod(MODEL_WGSL);
  const ds=(w,c)=>({format:'depth24plus',depthWriteEnabled:w,depthCompare:c});
  const ms={count:SAMPLES}, prim={topology:'triangle-list',cullMode:'none'};
  const meshAttrs={arrayStride:36,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x3'}]};
  const charPipeP=()=>device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[sceneBGL,charBGL]}),
    vertex:{module:charMod,entryPoint:'vsChar',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'snorm8x4'},{shaderLocation:2,offset:16,format:'unorm16x2'},{shaderLocation:3,offset:20,format:'snorm16x2'}]}]},
    fragment:{module:charMod,entryPoint:'fsChar',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms});
  const propPipeP=()=>device.createRenderPipelineAsync({layout:L1,
    vertex:{module:propMod,entryPoint:'vsProp',buffers:[{arrayStride:36,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'},{shaderLocation:3,offset:32,format:'float32'}]},
      {arrayStride:32,stepMode:'instance',attributes:[{shaderLocation:4,offset:0,format:'float32x4'},{shaderLocation:5,offset:16,format:'float32x4'}]}]},
    fragment:{module:propMod,entryPoint:'fsProp',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms});
  const markPipeP=()=>device.createRenderPipelineAsync({layout:L1,
    vertex:{module:markMod,entryPoint:'vsMark',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'}]},
      {arrayStride:16,stepMode:'instance',attributes:[{shaderLocation:2,offset:0,format:'float32x4'}]}]},
    fragment:{module:markMod,entryPoint:'fsMark',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms});
  const banPipeP=()=>device.createRenderPipelineAsync({layout:L1,
    vertex:{module:banMod,entryPoint:'vsBan',buffers:[{arrayStride:36,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'},{shaderLocation:4,offset:32,format:'float32'}]},
      {arrayStride:16,stepMode:'instance',attributes:[{shaderLocation:3,offset:0,format:'float32x4'}]}]},
    fragment:{module:banMod,entryPoint:'fsBan',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms});
  const archPipeP=()=>device.createRenderPipelineAsync({layout:L1,
    vertex:{module:archMod,entryPoint:'vsArch',buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x2'}]},
      {arrayStride:16,stepMode:'instance',attributes:[{shaderLocation:3,offset:0,format:'float32x4'}]}]},
    fragment:{module:archMod,entryPoint:'fsArch',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms});
  const ghostBlend={format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}};
  const [charPipe,propPipe,markPipe,banPipe,archPipe,skyPipe,waterPipe,skiPipe,buoyPipe,sprayPipe,skiGhostPipe,charGhostPipe]=await Promise.all([
    charPipeP(),propPipeP(),markPipeP(),banPipeP(),archPipeP(),
    device.createRenderPipelineAsync({layout:L1,vertex:{module:skyMod,entryPoint:'vsSky'},fragment:{module:skyMod,entryPoint:'fsSky',targets:[{format}]},depthStencil:ds(false,'always'),multisample:ms}),
    device.createRenderPipelineAsync({layout:L1,vertex:{module:waterMod,entryPoint:'vsWater',buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:'float32x2'}]}]},
      fragment:{module:waterMod,entryPoint:'fsWater',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms}),
    device.createRenderPipelineAsync({layout:L2,vertex:{module:modelMod,entryPoint:'vsModel',buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:'snorm16x4'},{shaderLocation:1,offset:8,format:'snorm8x4'}]}]},
      fragment:{module:modelMod,entryPoint:'fsModel',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms}),
    device.createRenderPipelineAsync({layout:L2,vertex:{module:meshMod,entryPoint:'vsBuoy',buffers:[meshAttrs,{arrayStride:16,stepMode:'instance',attributes:[{shaderLocation:3,offset:0,format:'float32x4'}]}]},
      fragment:{module:meshMod,entryPoint:'fsMesh',targets:[{format}]},primitive:prim,depthStencil:ds(true,'less'),multisample:ms}),
    device.createRenderPipelineAsync({layout:L1,vertex:{module:sprayMod,entryPoint:'vsSpray',buffers:[{arrayStride:48,stepMode:'instance',attributes:[{shaderLocation:0,offset:0,format:'float32x4'},{shaderLocation:1,offset:16,format:'float32x4'},{shaderLocation:2,offset:32,format:'float32x4'}]}]},
      fragment:{module:sprayMod,entryPoint:'fsSpray',targets:[{format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},
      primitive:prim,depthStencil:ds(false,'less'),multisample:ms}),
    device.createRenderPipelineAsync({layout:L2,vertex:{module:modelMod,entryPoint:'vsModel',buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:'snorm16x4'},{shaderLocation:1,offset:8,format:'snorm8x4'}]}]},
      fragment:{module:modelMod,entryPoint:'fsGhost',targets:[ghostBlend]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:ds(false,'less'),multisample:ms}),
    device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[sceneBGL,charBGL]}),
      vertex:{module:charMod,entryPoint:'vsChar',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'snorm8x4'},{shaderLocation:2,offset:16,format:'unorm16x2'},{shaderLocation:3,offset:20,format:'snorm16x2'}]}]},
      fragment:{module:charMod,entryPoint:'fsGhost',targets:[ghostBlend]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:ds(false,'less'),multisample:ms}),
  ]);
  const ghostSkiBuf=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const ghostCharBuf=device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const ghostSkiBG=device.createBindGroup({layout:objBGL,entries:[{binding:0,resource:{buffer:ghostSkiBuf}}]});
  const ghostCharBG=device.createBindGroup({layout:charBGL,entries:[{binding:0,resource:{buffer:ghostCharBuf}},{binding:1,resource:charSamp},{binding:2,resource:charTex.createView()}]});
  const archData2=new Float32Array(MAX_GATES*4);

  let msaaTex, depthTex;
  function resize(){
    const dpr=Math.min(devicePixelRatio||1, coarse?1.5:2);
    const w=Math.max(1,Math.floor(canvas.clientWidth*dpr)), h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
    if (canvas.width===w && canvas.height===h && msaaTex) return;
    canvas.width=w; canvas.height=h;
    msaaTex?.destroy(); depthTex?.destroy();
    msaaTex=device.createTexture({size:[w,h],format,sampleCount:SAMPLES,usage:GPUTextureUsage.RENDER_ATTACHMENT});
    depthTex=device.createTexture({size:[w,h],format:'depth24plus',sampleCount:SAMPLES,usage:GPUTextureUsage.RENDER_ATTACHMENT});
  }
  const laneInst=device.createBuffer({size:MAX_LANE*16,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  const sceneData=new Float32Array(SCENE_FLOATS), buoyData2=new Float32Array(MAX_GATES*2*4), sprayData=new Float32Array(MAX_SPRAY*12);
  for(let i=0;i<12;i++) sceneData.set(WAVES[i],56+i*4);

  return {
    resize,
    uploadLane() {device.queue.writeBuffer(laneInst,0,laneData);},
    draw(gAtt) {
    // view
    const view=M.lookAt(cam.eye,cam.tgt,[0,1,0]);
    const viewProj=M.mul(M.persp(Math.PI/2.55,canvas.width/canvas.height,0.1,450),view);
    const invVP=M.inv(viewProj);
    sceneData.set(viewProj,0); sceneData.set(invVP,16);
    sceneData.set([cam.eye[0],cam.eye[1],cam.eye[2],1],32);
    const liveWake=wake.filter(w=>simT-w.born<1.4);
    sceneData.set([simT,sea.scale,sea.chop,liveWake.length],36);
    sceneData.set([...skyS.sun,skyS.day],40);
    sceneData.set([sea.storm,cam.eye[0],cam.eye[2],0],44);
    sceneData.set([view[0],view[4],view[8],0],48);
    sceneData.set([view[1],view[5],view[9],0],52);
    sceneData.fill(0,104);
    liveWake.forEach((w,i)=>sceneData.set([w.x,w.z,(simT-w.born)/1.4,w.str],104+i*4));
    device.queue.writeBuffer(sceneBuf,0,sceneData);

    // jet ski model: wave-aligned basis * lean roll * pitch
    const fwd=[Math.sin(ski.heading),0,Math.cos(ski.heading)];
    const up=ski.up, rt=V.norm(V.cross(up,fwd)), fw2=V.cross(rt,up);
    const basis=new Float32Array([rt[0],rt[1],rt[2],0, up[0],up[1],up[2],0, fw2[0],fw2[1],fw2[2],0, ski.x,ski.y,ski.z,1]);
    const att=M.mul(basis,M.mul(M.RZ(ski.roll),M.RX(-ski.pitch)));
    device.queue.writeBuffer(skiBuf,0,M.mul(att,MODEL_FIX)); device.queue.writeBuffer(charBuf,0,att);

    gates.forEach((g,i)=>{
      const st=(state==='race'||state==='countdown')&&i===nextGate?1:(i===0?2:0);
      const sc=st===1?0.85:0.6;
      buoyData2.set([g.x-g.nx*HALF,g.z-g.nz*HALF,st,sc],i*8);
      buoyData2.set([g.x+g.nx*HALF,g.z+g.nz*HALF,st,sc],i*8+4);
    });
    device.queue.writeBuffer(buoyInst,0,buoyData2);
    gates.forEach((g,i)=>{ const st=(state==='race'||state==='countdown')&&i===nextGate?1:(i===0?2:0); archData2.set([g.x,g.z,st,Math.atan2(g.nz,g.nx)],i*4); });
    device.queue.writeBuffer(archInst,0,archData2);
    ramps.forEach((r,i)=>rampIData.set([r.x,surfH(r.x,r.z)-0.2,r.z,r.a, 0,0,0,0],i*8));
    if (ramps.length) device.queue.writeBuffer(rampInst,0,rampIData,0,ramps.length*8);
    pads.forEach((p,i)=>{ const n=surfN(p.x,p.z), c=Math.cos(p.a), sn=Math.sin(p.a);
      // surface slope expressed in the pad's own axes (x across, z along)
      const gx=-n[0]/n[1], gz=-n[2]/n[1];
      padIData.set([p.x,surfH(p.x,p.z)-0.05,p.z,p.a, gx*c-gz*sn, gx*sn+gz*c,0,0],i*8); });
    if (pads.length) device.queue.writeBuffer(padInst,0,padIData,0,pads.length*8);
    { const g=gates[0]; startIData.set([g.x,surfH(g.x,g.z)-0.08,g.z,Math.atan2(g.tx,g.tz),0,0,0,0]); device.queue.writeBuffer(startInst,0,startIData); }
    spray.forEach((p,i)=>{ const k=p.age/p.life; sprayData.set([p.p[0],p.p[1],p.p[2],p.kind?p.size*(1+k*1.3):p.size, p.v[0],p.v[1],p.v[2],p.kind?(1-k)*p.a:(1-k*k)*p.a, p.kind,0,0,0],i*12); });
    if (spray.length) device.queue.writeBuffer(sprayInst,0,sprayData,0,spray.length*12);

    const enc=device.createCommandEncoder();
    const pass=enc.beginRenderPass({
      colorAttachments:[{view:msaaTex.createView(),resolveTarget:ctx.getCurrentTexture().createView(),loadOp:'clear',storeOp:'discard',clearValue:{r:0,g:0,b:0,a:1}}],
      depthStencilAttachment:{view:depthTex.createView(),depthLoadOp:'clear',depthStoreOp:'discard',depthClearValue:1}
    });
    pass.setBindGroup(0,sceneBG);
    pass.setPipeline(skyPipe); pass.draw(3);
    pass.setPipeline(skiPipe); pass.setBindGroup(1,skiBG); pass.setVertexBuffer(0,skiVB2); pass.setIndexBuffer(skiIB2,(false)?'uint32':'uint16'); pass.drawIndexed((53112));
    pass.setPipeline(charPipe); pass.setBindGroup(1,charBG); pass.setVertexBuffer(0,charVB); pass.setIndexBuffer(charIB,(false)?'uint32':'uint16'); pass.drawIndexed((85137)); pass.setBindGroup(1,skiBG);
    pass.setPipeline(buoyPipe); pass.setVertexBuffer(0,buoyVB); pass.setVertexBuffer(1,buoyInst); pass.draw(buoyData.length/9,GATES*2);
    pass.setPipeline(propPipe);
    if (ramps.length){ pass.setVertexBuffer(0,rampVB); pass.setVertexBuffer(1,rampInst); pass.draw(rampData.length/9,ramps.length); }
    if (pads.length){ pass.setVertexBuffer(0,padVB); pass.setVertexBuffer(1,padInst); pass.draw(padData.length/9,pads.length); }
    pass.setVertexBuffer(0,startVB); pass.setVertexBuffer(1,startInst); pass.draw(startData.length/9,1);
    pass.setPipeline(markPipe); pass.setVertexBuffer(0,markVB); pass.setVertexBuffer(1,laneInst); pass.draw(markData.length/6,laneBuoys.length);
    if (gateStyle===1){ pass.setPipeline(archPipe); pass.setVertexBuffer(0,archVB); pass.setVertexBuffer(1,archInst); pass.draw(archData.length/8,GATES); }
    if (gateStyle===2){ pass.setPipeline(banPipe); pass.setVertexBuffer(0,banVB); pass.setVertexBuffer(1,archInst); pass.draw(banData.length/9,GATES); }
    pass.setPipeline(waterPipe); pass.setVertexBuffer(0,gridVB); pass.setIndexBuffer(gridIB,'uint32'); pass.drawIndexed(gridI.length);
    if (gAtt){
      device.queue.writeBuffer(ghostSkiBuf,0,M.mul(gAtt,MODEL_FIX)); device.queue.writeBuffer(ghostCharBuf,0,gAtt);
      pass.setPipeline(skiGhostPipe); pass.setBindGroup(1,ghostSkiBG); pass.setVertexBuffer(0,skiVB2); pass.setIndexBuffer(skiIB2,(false)?'uint32':'uint16'); pass.drawIndexed((53112));
      pass.setPipeline(charGhostPipe); pass.setBindGroup(1,ghostCharBG); pass.setVertexBuffer(0,charVB); pass.setIndexBuffer(charIB,(false)?'uint32':'uint16'); pass.drawIndexed((85137));
    }
    if (spray.length){ pass.setPipeline(sprayPipe); pass.setVertexBuffer(0,sprayInst); pass.draw(6,spray.length); }
    pass.end();
    device.queue.submit([enc.finish()]);
    }
  };
}
/* ================= sound (all synthesized, nothing to download) ================= */
const VERSION='0.14';
const sfx=(()=>{
  let ac=null, master, eng, engF, engGain, rushF, rushGain, noiseBuf, muted=false;
  try{ muted=localStorage.getItem('waverun747-mute')==='1'; }catch{}
  function init(){
    if (ac){ if (ac.state==='suspended') ac.resume(); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if (!AC) return;
    try{ ac=new AC(); }catch{ return; }
    master=ac.createGain(); master.gain.value=muted?0:0.8;
    const comp=ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    noiseBuf=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    // engine: saw + sub square, an amplitude wobble for the two-stroke burble, through a resonant low-pass
    engF=ac.createBiquadFilter(); engF.type='lowpass'; engF.frequency.value=500; engF.Q.value=4;
    engGain=ac.createGain(); engGain.gain.value=0;
    const o1=ac.createOscillator(); o1.type='sawtooth'; const o2=ac.createOscillator(); o2.type='square';
    const g2=ac.createGain(), wob=ac.createGain(); g2.gain.value=0.5; wob.gain.value=0.75;
    const lfo=ac.createOscillator(); lfo.frequency.value=22; const lfoG=ac.createGain(); lfoG.gain.value=0.25;
    lfo.connect(lfoG); lfoG.connect(wob.gain); o1.connect(wob); o2.connect(g2); g2.connect(wob); wob.connect(engF); engF.connect(engGain); engGain.connect(master);
    o1.start(); o2.start(); lfo.start(); eng={o1,o2,lfo};
    // hull rushing through water: looped noise through a band-pass that opens with speed
    const n=ac.createBufferSource(); n.buffer=noiseBuf; n.loop=true;
    rushF=ac.createBiquadFilter(); rushF.type='bandpass'; rushF.frequency.value=900; rushF.Q.value=0.7;
    rushGain=ac.createGain(); rushGain.gain.value=0; n.connect(rushF); rushF.connect(rushGain); rushGain.connect(master); n.start();
  }
  function update(on,speed,throttle,air,boost,brake){
    if (!ac) return; const t=ac.currentTime;
    const f=38+speed*3.2+throttle*14+(air?25:0)+(boost?12:0);
    eng.o1.frequency.setTargetAtTime(f,t,0.08); eng.o2.frequency.setTargetAtTime(f*0.5,t,0.08); eng.lfo.frequency.setTargetAtTime(14+f*0.25,t,0.1);
    engF.frequency.setTargetAtTime(350+speed*55+throttle*500+(air?900:0),t,0.08);
    engGain.gain.setTargetAtTime(on?0.07+throttle*0.06+(boost?0.03:0):0,t,0.12);
    const w=on&&!air?Math.min(speed/22,1.3):0;
    rushGain.gain.setTargetAtTime(w*(0.16+(brake?0.12:0)),t,0.1); rushF.frequency.setTargetAtTime(500+speed*60+(brake?600:0),t,0.1);
  }
  function noise(dur,type,f0,f1,q,vol,delay=0){ if (!ac) return; const t=ac.currentTime+delay;
    const s=ac.createBufferSource(); s.buffer=noiseBuf; const fl=ac.createBiquadFilter(); fl.type=type; fl.Q.value=q;
    fl.frequency.setValueAtTime(f0,t); fl.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.015); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t,Math.random()); s.stop(t+dur+0.05); }
  function tone(freq,dur,type='sine',vol=0.2,delay=0,slide=0){ if (!ac) return; const t=ac.currentTime+delay;
    const o=ac.createOscillator(); o.type=type; o.frequency.setValueAtTime(freq,t); if (slide) o.frequency.exponentialRampToValueAtTime(freq*slide,t+dur);
    const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.05); }
  return {
    init, update,
    get muted(){ return muted; },
    toggle(){ muted=!muted; try{ localStorage.setItem('waverun747-mute',muted?'1':'0'); }catch{} if (master) master.gain.setTargetAtTime(muted?0:0.8,ac.currentTime,0.05); return muted; },
    splash(k){ k=Math.min(1,Math.max(0.2,k)); noise(0.5+k*0.5,'lowpass',2500,300,0.8,0.25+0.35*k); noise(0.25,'highpass',3000,6000,0.5,0.12*k,0.03); tone(90,0.25,'sine',0.25*k,0,0.5); },
    bump(){ tone(110,0.22,'sine',0.35,0,0.45); noise(0.18,'lowpass',1200,200,1,0.25); },
    boost(){ noise(0.7,'bandpass',400,3500,1.5,0.3); tone(220,0.5,'sawtooth',0.06,0,2.2); },
    gate(){ tone(1046,0.18,'triangle',0.13); tone(1568,0.25,'sine',0.09,0.06); },
    lap(){ [784,988,1175].forEach((f,i)=>tone(f,0.22,'triangle',0.13,i*0.09)); },
    finish(){ [523,659,784,1046,1318].forEach((f,i)=>tone(f,0.35,'triangle',0.14,i*0.11)); },
    beep(go){ tone(go?988:587,go?0.45:0.18,'square',0.09); },
    reset(){ noise(0.35,'bandpass',2000,400,1,0.15); },
    wipe(){ noise(1.0,'lowpass',1800,150,0.7,0.5); tone(70,0.5,'sine',0.3,0,0.5); }
  };
})();
addEventListener('pointerdown',()=>sfx.init(),{passive:true});
addEventListener('keydown',()=>sfx.init());

/* ================= math ================= */
const TAU = Math.PI * 2;
const M = {
  ident(){const o=new Float32Array(16);o[0]=o[5]=o[10]=o[15]=1;return o;},
  mul(a,b){ const o=new Float32Array(16); for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;} return o; },
  persp(fovy,asp,n,f){ const t=1/Math.tan(fovy/2), o=new Float32Array(16); o[0]=t/asp;o[5]=t;o[10]=f/(n-f);o[11]=-1;o[14]=n*f/(n-f); return o; },
  lookAt(e,c,u){
    let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],l=Math.hypot(zx,zy,zz); zx/=l;zy/=l;zz/=l;
    let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx; l=Math.hypot(xx,xy,xz); xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*e[0]+xy*e[1]+xz*e[2]), -(yx*e[0]+yy*e[1]+yz*e[2]), -(zx*e[0]+zy*e[1]+zz*e[2]), 1]);
  },
  inv(a){
    const [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33]=a;
    const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
          b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
    const d=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
    return new Float32Array([
      (a11*b11-a12*b10+a13*b09)*d,(a02*b10-a01*b11-a03*b09)*d,(a31*b05-a32*b04+a33*b03)*d,(a22*b04-a21*b05-a23*b03)*d,
      (a12*b08-a10*b11-a13*b07)*d,(a00*b11-a02*b08+a03*b07)*d,(a32*b02-a30*b05-a33*b01)*d,(a20*b05-a22*b02+a23*b01)*d,
      (a10*b10-a11*b08+a13*b06)*d,(a01*b08-a00*b10-a03*b06)*d,(a30*b04-a31*b02+a33*b00)*d,(a21*b02-a20*b04-a23*b00)*d,
      (a11*b07-a10*b09-a12*b06)*d,(a00*b09-a01*b07+a02*b06)*d,(a31*b01-a30*b03-a32*b00)*d,(a20*b03-a21*b01+a22*b00)*d]);
  },
  RX(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
  RZ(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); },
};
const V = {
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sc:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  norm:a=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const damp=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));

/* ================= waves (shared by CPU physics and GPU shaders) ================= */
const WAVES=[]; { let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  let L=34, w=0.175; for(let i=0;i<12;i++){ const a=0.6+(rnd()-0.5)*2.0; WAVES.push([Math.cos(a),Math.sin(a),L,w]); L*=0.74; w*=0.85; } }
const SEAS=[{scale:0.55,chop:0.32,storm:0},{scale:1.0,chop:0.6,storm:0.05},{scale:1.7,chop:0.88,storm:0.75}];
const SKIES=[{sun:[0.6,0.12,-0.79],day:0},{sun:[0.35,0.62,-0.7],day:1}];
let seaIdx=1, skyIdx=0;
const sea={...SEAS[1]}, skyS={sun:[...SKIES[0].sun],day:0};
let simT=0;
function disp(x,z){
  let px=0,py=0,pz=0; const tt=simT*0.8;
  for(let i=0;i<8;i++){ const W=WAVES[i]; const k=TAU/(W[2]*sea.scale); const c=Math.sqrt(9.8/k); const a=sea.chop*W[3]/k;
    const f=k*(W[0]*x+W[1]*z-c*tt)+i*1.7; const co=Math.cos(f); px+=W[0]*a*co; py+=a*Math.sin(f); pz+=W[1]*a*co; }
  return [px,py,pz];
}
function surfH(x,z){ const d=disp(x,z); return disp(x-d[0],z-d[2])[1]; }
function surfN(x,z){ const e=0.8; return V.norm([-(surfH(x+e,z)-surfH(x-e,z))/(2*e),1,-(surfH(x,z+e)-surfH(x,z-e))/(2*e)]); }


const MAX_GATES=32, MAX_SPRAY=900, HALF_ARCH=4.5; let GATES=12;
const RAMP_L=7, RAMP_W=4.5, RAMP_H=1.7, PAD_L=5, PAD_W=3.2;
const MAX_RAMPS=16, MAX_PADS=28;
const HALF=4.5, LANE=9.5, SPACING=10, MAX_LANE=520, MAX_LEVEL=10;
let LAPS=3;
let ramps=[], pads=[];
const gates=[]; let laneBuoys=[], coursePath=[], courseLen=0, par=0, centerClear=0;
const mmB={x0:-1,x1:1,z0:-1,z1:1};
const laneData=new Float32Array(MAX_LANE*4);
const rng=seed=>{ let a=seed>>>0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };
const polarGates=(n,rx,rz,h)=>{ const g=[]; for(let i=0;i<n;i++){ const a=i/n*TAU; let r=1; for(const [k,amp,ph] of h) r+=amp*Math.sin(k*a+ph); g.push([Math.cos(a)*r*rx, Math.sin(a)*r*rz]); } return g; };
// sample a closed curve densely and drop gates at equal distances along it, so long straights get evenly spaced gates
function curveGates(fn,spacing,minN=10){
  const N=2400, pts=[fn(0)], cum=[0]; let len=0;
  for(let i=1;i<=N;i++){ const q=fn(i/N*TAU), pr=pts[i-1]; len+=Math.hypot(q[0]-pr[0],q[1]-pr[1]); pts.push(q); cum.push(len); }
  const n=Math.max(minN,Math.min(MAX_GATES,Math.round(len/spacing))), out=[]; let j=0;
  for(let k=0;k<n;k++){ const sd=k*len/n; while(cum[j+1]<sd) j++; out.push(pts[j]); }
  return out;
}
// superellipse radius: p>2 squares the corners off and stretches the sides into long straights
const sedge=(a,p)=>Math.pow(Math.pow(Math.abs(Math.cos(a)),p)+Math.pow(Math.abs(Math.sin(a)),p),-1/p);
const CLASSIC=()=>({pts:curveGates(a=>{ const r=sedge(a,4)*(1+0.07*Math.sin(2*a+0.6)); return [Math.cos(a)*r*165, Math.sin(a)*r*100]; },62), clear:0});
// Endless: every race is a new seeded layout; size, gate count and twistiness grow until MAX_LEVEL
function levelSpec(L){
  const r=rng(L*7919+747), t=Math.min(L-1,MAX_LEVEL-1)/(MAX_LEVEL-1);
  const base=95+t*125, asp=0.65+r()*0.5, sq=2.4+r()*1.8, nh=1+Math.floor(t*2.2+r()*0.6), h=[];
  let budget=0.06+0.14*t;
  for(let i=0;i<nh;i++){ const k=2+Math.floor(r()*(1+t*3)); const amp=i===nh-1?budget:budget*(0.35+r()*0.4); budget-=amp; h.push([k,amp,r()*TAU]); }
  const rx=base*Math.sqrt(asp), rz=base/Math.sqrt(asp);
  return {pts:curveGates(a=>{ let rr=sedge(a,sq); for(const [k,amp,ph] of h) rr*=1+amp*Math.sin(k*a+ph); return [Math.cos(a)*rr*rx, Math.sin(a)*rr*rz]; },60), clear:0};
}
// Clover: a three-leaf rose; one run through all three leaves crosses the centre three times
function cloverSpec(R=185){
  const P=th=>{ const c=Math.cos(3*th), r=R*Math.sign(c)*Math.pow(Math.abs(c),0.75); return [r*Math.cos(th), r*Math.sin(th)]; };
  const N=3000, th0=-Math.PI/6, samp=[]; let len=0, prev=P(th0);
  for(let i=0;i<=N;i++){ const q=P(th0+Math.PI*i/N); len+=Math.hypot(q[0]-prev[0],q[1]-prev[1]); samp.push([q,len]); prev=q; }
  const n=Math.min(MAX_GATES,Math.round(len/42)), out=[];
  for(let k=0;k<n;k++){ const sd=(22+k*len/n)%len; const s2=samp.find(e=>e[1]>=sd)||samp[samp.length-1]; if (Math.hypot(...s2[0])>17) out.push(s2[0]); }
  return {pts:out, clear:24};
}
// Ramps go on the straightest stretches, each with a speed pad lined up 30 m before it; extra pads sit between ramps.
function placeProps(pts,len){
  const cum=[0]; for(let i=1;i<=pts.length;i++){ const a=pts[i-1], b=pts[i%pts.length]; cum.push(cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1])); }
  const at=sd=>{ sd=((sd%len)+len)%len; let lo=0,hi=pts.length; while(hi-lo>1){ const m=(lo+hi)>>1; if(cum[m]<=sd) lo=m; else hi=m; }
    const a=pts[lo], b=pts[(lo+1)%pts.length], L=cum[lo+1]-cum[lo]||1, t=(sd-cum[lo])/L, dx=(b[0]-a[0])/L, dz=(b[1]-a[1])/L;
    return {x:a[0]+(b[0]-a[0])*t, z:a[1]+(b[1]-a[1])*t, dx, dz}; };
  const bend=sd=>{ const a=at(sd-14), b=at(sd+14); return Math.acos(Math.max(-1,Math.min(1,a.dx*b.dx+a.dz*b.dz))); };
  const clearOf=(q,r=9)=>gates.every((g,gi)=>Math.hypot(g.x-q.x,g.z-q.z)>(gi===0?Math.max(r,12):r)) && (!centerClear || Math.hypot(q.x,q.z)>centerClear+16);
  const mk=(sd,off)=>{ const q=at(sd); const nx=-q.dz, nz=q.dx; return {x:q.x+nx*off, z:q.z+nz*off, dx:q.dx, dz:q.dz, a:Math.atan2(q.dx,q.dz), hit:-1e9}; };
  ramps=[]; pads=[];
  const N=Math.min(MAX_RAMPS,Math.max(2,Math.round(len/170)));
  for(let k=0;k<N;k++){
    const c=(k+0.6)*len/N; let best=null, bb=1e9;
    for(let d=-45; d<=45; d+=3){ const sd=c+d, q=at(sd), b=bend(sd); if (b<bb && clearOf(q) && clearOf(at(sd+RAMP_L)) && clearOf(at(sd-26),6)){ bb=b; best=sd; } }
    if (best==null || bb>0.75) continue;
    const off=(k%2?1:-1)*2.4;
    ramps.push(mk(best,off)); pads.push(mk(best-26,off));
    for (let d=0; d<=30; d+=6){ const mid=best+len/N*0.5+d; if (clearOf(at(mid),6)){ if (pads.length<MAX_PADS) pads.push(mk(mid,-off)); break; } }
  }
  pads=pads.slice(0,MAX_PADS);
}
function buildCourse(spec){
  gates.length=0;
  for (const [x,z] of spec.pts.slice(0,MAX_GATES)) gates.push({x,z});
  GATES=gates.length; centerClear=spec.clear||0;
  gates.forEach((g,i)=>{ const p=gates[(i+GATES-1)%GATES], n=gates[(i+1)%GATES]; let tx=n.x-p.x, tz=n.z-p.z; const l=Math.hypot(tx,tz); g.tx=tx/l; g.tz=tz/l; g.nx=-g.tz; g.nz=g.tx; });
  const cr=(a,b,c,d,t)=>{ const t2=t*t,t3=t2*t; return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3); };
  const pts=[];
  for(let i=0;i<GATES;i++){ const g0=gates[(i+GATES-1)%GATES],g1=gates[i],g2=gates[(i+1)%GATES],g3=gates[(i+2)%GATES];
    for(let k=0;k<40;k++){ const t=k/40; pts.push([cr(g0.x,g1.x,g2.x,g3.x,t),cr(g0.z,g1.z,g2.z,g3.z,t)]); } }
  laneBuoys=[];
  let acc=0, next=SPACING*0.5;
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length]; const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz);
    while(acc+L>=next){
      const t=(next-acc)/L, px=a[0]+dx*t, pz=a[1]+dz*t, nx=-dz/L, nz=dx/L;
      const nearGate=gates.some((g,gi)=>Math.hypot(g.x-px,g.z-pz)<(gi===0?9:7));
      if(!nearGate) for(const sd of [-1,1]){ const bx=px+nx*LANE*sd, bz=pz+nz*LANE*sd;
        if (Math.hypot(bx,bz)>centerClear && laneBuoys.length<MAX_LANE) laneBuoys.push({x:bx, z:bz, hit:-1e9}); }
      next+=SPACING;
    }
    acc+=L;
  }
  // a buoy that sits on another stretch of the course (the clover crossings) would block the line
  laneBuoys=laneBuoys.filter(b=>{ let best=1e9; for(let i=0;i<pts.length;i+=2){ const d=Math.hypot(pts[i][0]-b.x,pts[i][1]-b.z); if(d<best) best=d; } return best>LANE-1.5; });
  laneData.fill(0); laneBuoys.forEach((b,i)=>laneData.set([b.x,b.z,i*2.399,0],i*4));
  renderer?.uploadLane();
  placeProps(pts,acc);
  coursePath=pts; courseLen=acc; par=LAPS*courseLen/14+6;
  mmB.x0=mmB.z0=1e9; mmB.x1=mmB.z1=-1e9;
  for (const [x,z] of pts){ mmB.x0=Math.min(mmB.x0,x); mmB.x1=Math.max(mmB.x1,x); mmB.z0=Math.min(mmB.z0,z); mmB.z1=Math.max(mmB.z1,z); }
}
buildCourse(CLASSIC());

/* ================= input: joystick, buttons, keys, gamepad ================= */
const input={x:0,y:0,gas:false,brake:false};
const stick={x:0,y:0,id:null}, keys=new Set(), touchBtn={A:false,B:false};
const stickEl=$('stick'), knob=$('knob');
const stickMove=e=>{ const r=stickEl.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, max=r.width*0.36;
  let dx=e.clientX-cx, dy=e.clientY-cy; const l=Math.hypot(dx,dy); if(l>max){dx*=max/l;dy*=max/l;}
  stick.x=dx/max; stick.y=-dy/max; knob.style.transform=`translate(${dx}px,${dy}px)`; };
stickEl.addEventListener('pointerdown',e=>{ e.preventDefault(); stick.id=e.pointerId; stickEl.setPointerCapture(e.pointerId); knob.classList.remove('rest'); stickMove(e); });
stickEl.addEventListener('pointermove',e=>{ if(e.pointerId===stick.id) stickMove(e); });
const stickEnd=e=>{ if(e.pointerId!==stick.id) return; stick.id=null; stick.x=stick.y=0; knob.classList.add('rest'); knob.style.transform=''; };
stickEl.addEventListener('pointerup',stickEnd); stickEl.addEventListener('pointercancel',stickEnd);
for (const [id,key] of [['btnA','A'],['btnB','B']]){
  const el=$(id);
  const on=e=>{e.preventDefault(); el.setPointerCapture?.(e.pointerId); touchBtn[key]=true; el.classList.add('on');};
  const off=()=>{touchBtn[key]=false; el.classList.remove('on');};
  el.addEventListener('pointerdown',on); el.addEventListener('pointerup',off); el.addEventListener('pointercancel',off);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
addEventListener('keydown',e=>{
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key==='r'||e.key==='R') resetToTrack();
  if ((e.key==='p'||e.key==='P'||e.key==='Escape') && (state==='race'||state==='countdown')) pause();
  else if ((e.key==='p'||e.key==='P'||e.key==='Escape') && state==='paused') resume();
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
let padStartPrev=false, padSelPrev=false;
function readInput(){
  let x=stick.x, y=stick.y, gas=touchBtn.A, boost=touchBtn.B;
  const k=n=>keys.has(n);
  if (k('arrowleft')||k('a')) x-=1; if (k('arrowright')||k('d')) x+=1;
  if (k('arrowdown')||k('s')) y-=1;
  if (k('arrowup')||k('w')) { gas=true; y+=0.4; }
  if (k(' ')||k('j')) gas=true;
  if (k('shift')||k('k')) boost=true;
  try {
    for (const gp of (navigator.getGamepads?.()||[])) { if (!gp) continue;
      const ax=gp.axes[0]||0, ay=gp.axes[1]||0;
      if (Math.abs(ax)>0.12) x+=ax; if (Math.abs(ay)>0.12) y-=ay;
      if (gp.buttons[0]?.pressed || (gp.buttons[7]?.value||0)>0.2) gas=true;
      if (gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || (gp.buttons[6]?.value||0)>0.2) boost=true;
      const sel=!!gp.buttons[8]?.pressed||!!gp.buttons[3]?.pressed; if (sel&&!padSelPrev) resetToTrack(); padSelPrev=sel;
      const st=!!gp.buttons[9]?.pressed;
      if (st && !padStartPrev){ if(state==='race'||state==='countdown') pause(); else if(state==='paused') resume(); else if(state==='menu'||state==='finish') startRace(); }
      padStartPrev=st;
    }
  } catch {}
  input.x=clamp(x,-1,1); input.y=clamp(y,-1,1); input.gas=gas; input.brake=boost;
}

/* ================= game state ================= */
let state='menu', raceT=0, cdT=0, lapsDone=0, nextGate=0, firstCross=true;
// modes: 0 race (3 laps) · 1 clover (one run, three leaves) · 2 time trial (hot laps vs ghost) · 3 endless (new course every race)
let mode=0, level=1, lapStart=0, rec=[], curSplits=[], ghost=null, ghostPos=null, passedPar=false;
const store={ get:k=>{ try{ return localStorage.getItem('waverun747-'+k); }catch{ return null; } }, set:(k,v)=>{ try{ localStorage.setItem('waverun747-'+k,String(v)); }catch{} } };
level=Math.max(1,parseInt(store.get('endless'))||1);
const ski={x:0,z:0,y:0,vy:0,lastH:0,heading:0,speed:0,boostT:0,air:false,airT:0,pitch:0,roll:0,up:[0,1,0]};
const wake=[], spray=[];
let wakeTimer=0;
const bestKey=()=>'waverun747-'+(mode===1?'clover-':'best-')+seaIdx;
const getBest=()=>{ try{ const v=parseFloat(localStorage.getItem(bestKey())); return isFinite(v)?v:null; }catch{ return null; } };
const setBest=v=>{ try{ localStorage.setItem(bestKey(),String(v)); }catch{} };
const fmt=s=>{ const m=Math.floor(s/60), r=s-m*60; return m+':'+(r<10?'0':'')+r.toFixed(1); };
const TAGS=["3 laps. Let's ride.","Three leaves. One run.","Hot laps. Chase your ghost.",""];
const START=['Start race','Start clover','Start time trial',''];
function loadGhost(){ try{ ghost=JSON.parse(store.get('ghost-'+seaIdx)); }catch{ ghost=null; } if (ghost&&!ghost.s) ghost=null; }
function refreshBest(){
  let b='--';
  if (mode===2){ loadGhost(); b=ghost?fmt(ghost.t)+' lap':'--'; }
  else if (mode===3){ b='Race '+level+(level>=MAX_LEVEL?' · max size':''); }
  else { const v=getBest(); b=v?fmt(v):'--'; }
  $('bestMenu').textContent=b;
  $('tag').textContent=mode===3?('Race '+level+'. Beat the par.'):TAGS[mode];
}
function courseForMode(){ LAPS=mode===1?1:3; buildCourse(mode===1?cloverSpec():mode===3?levelSpec(level):CLASSIC()); }

function resetSki(){
  const g=gates[0];
  ski.x=g.x-g.tx*18; ski.z=g.z-g.tz*18; ski.heading=Math.atan2(g.tx,g.tz);
  ski.speed=0; ski.vy=0; ski.air=false; ski.airT=0; ski.pitch=0; ski.roll=0; ski.boostT=0; ski.up=[0,1,0];
  ski.y=surfH(ski.x,ski.z)-0.12; ski.lastH=ski.y+0.12;
  wake.length=0; spray.length=0;
  lapsDone=0; nextGate=0; firstCross=true; raceT=0;
}
resetSki();

const msgEl=$('msg'); let msgTimer=0;
function flash(text,ms=900,warn=false){ msgEl.textContent=text; msgEl.classList.toggle('warn',warn); msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show'); clearTimeout(msgTimer); msgTimer=setTimeout(()=>msgEl.classList.remove('show'),ms); }
function show(id){ for (const o of ['menu','pauseMenu','finishMenu']) $(o).hidden = o!==id; }

function startRace(){ if($('startBtn').disabled)return; resetSki(); rec=[]; curSplits=[]; ghostPos=null; if (mode===2) loadGhost(); else ghost=null; orbit.yaw=0; orbit.pitch=BASE_PITCH; orbit.dist=BASE_DIST; state='countdown'; cdT=3.0; show(null); $('arrow').hidden=false; flash('3',800); sfx.init(); sfx.beep(false); camSnap=true; }
// drop back onto the racing line on the stretch leading to the next gate, facing along it
let lastReset=-1e9;
function resetToTrack(){
  if (state!=='race' || simT-lastReset<1) return; lastReset=simT;
  const seg=40, prevG=(nextGate+GATES-1)%GATES, n=coursePath.length; let best=0, bd=1e18;
  for (let k=-seg; k<seg*2; k++){ const i=((prevG*seg+k)%n+n)%n, q=coursePath[i], d=(q[0]-ski.x)**2+(q[1]-ski.z)**2; if (d<bd){ bd=d; best=i; } }
  const a=coursePath[best], b=coursePath[(best+1)%n];
  ski.x=a[0]; ski.z=a[1]; ski.heading=Math.atan2(b[0]-a[0],b[1]-a[1]);
  ski.speed=0; ski.vy=0; ski.air=false; ski.airT=0; ski.pitch=0; ski.roll=0; ski.boostT=0; ski.up=[0,1,0];
  ski.y=surfH(ski.x,ski.z)-0.12; ski.lastH=ski.y+0.12; wake.length=0;
  orbit.yaw=0; camSnap=true; flash('RESET',600); sfx.reset();
}
function pause(){ state='paused'; show('pauseMenu'); }
function resume(){ state=cdT>0?'countdown':'race'; show(null); }
function toMenu(){ state='menu'; if (mode===3) courseForMode(); resetSki(); show('menu'); $('arrow').hidden=true; $('gatedist').textContent=''; refreshBest(); }
function finishRace(){
  state='finish'; $('arrow').hidden=true; $('gatedist').textContent='';
  if (mode===3){
    passedPar=raceT<=par;
    $('finishTitle').textContent=passedPar?'Race '+level+' cleared':'Missed par';
    $('finalTime').textContent=fmt(raceT);
    $('newBest').textContent='Race '+(level+1)+' unlocked'; $('newBest').hidden=!passedPar;
    $('finalBest').textContent='Par '+fmt(par)+' · '+Math.abs(raceT-par).toFixed(1)+'s '+(passedPar?'under':'over');
    $('againBtn').textContent=passedPar?'Next race':'Retry race';
    if (passedPar){ level++; store.set('endless',Math.max(level,parseInt(store.get('endless'))||1)); }
    show('finishMenu'); flash(passedPar?'CLEARED':'FINISH',1200,!passedPar); sfx.finish(); return;
  }
  $('finishTitle').textContent='Finish'; $('againBtn').textContent='Race again'; $('newBest').textContent='New best for this sea';
  const prev=getBest(), isBest=prev==null||raceT<prev; if(isBest) setBest(raceT);
  $('finalTime').textContent=fmt(raceT); $('newBest').hidden=!isBest;
  $('finalBest').textContent=isBest?(prev?'Previous best '+fmt(prev):'First recorded time on this sea.'):'Best on this sea: '+fmt(prev);
  show('finishMenu'); flash('FINISH',1200); sfx.finish();
}
$('startBtn').onclick=startRace; $('againBtn').onclick=()=>{ if (mode===3){ courseForMode(); } startRace(); };
$('resetBtn').onclick=()=>resetToTrack();
const paintMute=()=>document.querySelectorAll('.soundSeg button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.v==='1')!==sfx.muted)));
document.querySelectorAll('.soundSeg button').forEach(b=>b.onclick=()=>{ sfx.init(); if ((b.dataset.v==='1')===sfx.muted) sfx.toggle(); paintMute(); });
paintMute();
document.querySelectorAll('.ver').forEach(e=>e.textContent='v'+VERSION);
$('pauseBtn').onclick=()=>{ if(state==='race'||state==='countdown') pause(); else if(state==='paused') resume(); };
$('resumeBtn').onclick=resume; $('restartBtn').onclick=startRace; $('quitBtn').onclick=toMenu; $('menuBtn').onclick=toMenu;
const segPick=(segId,cb)=>{ const seg=$(segId); seg.querySelectorAll('button').forEach(b=>b.onclick=()=>{ seg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); cb(+b.dataset.v); }); };
let gateStyle=1;
const setGateStyle=v=>{ gateStyle=v; document.querySelectorAll('.gateSeg button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.v===v))); try{ localStorage.setItem('waverun747-gates',String(v)); }catch{} };
document.querySelectorAll('.gateSeg button').forEach(b=>b.onclick=()=>setGateStyle(+b.dataset.v));
try{ const g=parseInt(localStorage.getItem('waverun747-gates')); if(g>=0&&g<=2) setGateStyle(g); }catch{}
segPick('modeSeg',v=>{ mode=v; store.set('mode',v); courseForMode(); resetSki(); camSnap=true; refreshBest(); });
{ const m=parseInt(store.get('mode')); if (m>=0&&m<=3){ mode=m; $('modeSeg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.v===m))); } }
courseForMode(); resetSki(); refreshBest();
segPick('seaSeg',v=>{seaIdx=v;refreshBest();}); segPick('skySeg',v=>{skyIdx=v;});

/* ================= physics ================= */
const rnd=(a,b)=>a+Math.random()*(b-a);
// kind 0 = droplet/stream (shaded, stretched along velocity) · kind 1 = mist (soft, slow, faint)
function emit(kind,pos,vel,size,life,a=1){ if(spray.length>=MAX_SPRAY) spray.shift(); spray.push({p:[pos[0],pos[1],pos[2]],v:[vel[0],vel[1],vel[2]],age:0,life,size,kind,a}); }
function emitSpray(n,pos,base,spread,up,life){
  for(let i=0;i<n;i++) emit(0,pos,[base[0]+rnd(-spread,spread)*0.5, up*rnd(0.5,1.5), base[2]+rnd(-spread,spread)*0.5],rnd(0.05,0.11),life*rnd(0.7,1.3));
  for(let i=0;i<n/4;i++) emit(1,pos,[rnd(-1,1),rnd(0.3,1),rnd(-1,1)],rnd(0.6,1.1),life*1.4,0.5);
}
// landing: a crown of drops thrown out in a ring, a puff of mist and a foam patch on the water
function splashCrown(pos,k){
  const n=Math.round(30+k*80);
  for(let i=0;i<n;i++){ const ang=Math.random()*TAU, out=rnd(2,4+k*4), up=rnd(3,5+k*6);
    emit(0,[pos[0]+Math.cos(ang)*0.7,pos[1],pos[2]+Math.sin(ang)*0.7],[Math.cos(ang)*out,up,Math.sin(ang)*out],rnd(0.05,0.13),rnd(0.6,1.25)); }
  for(let i=0;i<6+k*10;i++) emit(1,[pos[0]+rnd(-1,1),pos[1]+0.3,pos[2]+rnd(-1,1)],[rnd(-1,1),rnd(0.5,1.5),rnd(-1,1)],rnd(0.8,1.7),rnd(0.8,1.5),0.6);
  wake.unshift({x:pos[0],z:pos[2],born:simT,str:Math.min(1,0.6+k*0.4)}); if (wake.length>24) wake.pop();
}
function stepSki(dt){
  const racing=state==='race';
  const gas=input.gas && racing;
  const braking=input.brake && racing;
  const boosting=ski.boostT>0;
  const maxV=boosting?31:21;
  const grip=ski.air?0.25:1;
  if (gas&&!braking) ski.speed+=9*dt*grip;
  if (boosting) ski.speed+=16*dt*grip;
  if (braking&&!ski.air) ski.speed-=(ski.speed*1.8+5)*dt;
  ski.speed-=ski.speed*(gas?0.16:0.6)*dt*(ski.air?0.15:1);
  if (ski.speed>maxV) ski.speed+=(maxV-ski.speed)*2*dt;
  ski.speed=Math.max(0,ski.speed);
  ski.boostT=Math.max(0,ski.boostT-dt);

  const steer=racing?input.x:0;
  const turn=steer*(ski.air?0.7:2.1)*(braking?1.35:1)*(0.3+0.7*Math.min(ski.speed/12,1));
  ski.heading-=turn*dt;
  const fx=Math.sin(ski.heading), fz=Math.cos(ski.heading);
  const ox=ski.x, oz=ski.z;
  ski.x+=fx*ski.speed*dt; ski.z+=fz*ski.speed*dt;
  if (!ski.air) for (const b of laneBuoys){
    const dx=ski.x-b.x, dz=ski.z-b.z, d2=dx*dx+dz*dz;
    if (d2<1.2*1.2){ const d=Math.sqrt(d2)||1e-3; ski.x=b.x+dx/d*1.2; ski.z=b.z+dz/d*1.2;
      if (simT-b.hit>0.8){ b.hit=simT; ski.speed*=0.72; sfx.bump(); emitSpray(12,[b.x,ski.y+0.4,b.z],[dx/d*2,0,dz/d*2],3,3,0.6); } }
  }

  // speed pads
  for (const p of pads){
    const rx=ski.x-p.x, rz=ski.z-p.z, u=rx*p.dx+rz*p.dz, w=-rx*p.dz+rz*p.dx;
    if (Math.abs(u)<PAD_L/2+0.4 && Math.abs(w)<PAD_W/2+0.4 && ski.y<surfH(p.x,p.z)+1.2 && simT-p.hit>1){
      p.hit=simT; ski.boostT=1.9; if (state==='race'){ flash('BOOST',600); sfx.boost(); } emitSpray(16,[ski.x,ski.y+0.3,ski.z],[0,0,0],4,3,0.6); }
  }
  // ramps: the deck counts as the surface, so leaving the lip at speed launches you
  let onRamp=null, rampTop=-1e9;
  for (const r of ramps){
    const rx=ski.x-r.x, rz=ski.z-r.z, u=rx*r.dx+rz*r.dz, w=-rx*r.dz+rz*r.dx;
    if (u>=0 && u<=RAMP_L && Math.abs(w)<=RAMP_W/2 && fx*r.dx+fz*r.dz>0.2){
      const top=surfH(r.x,r.z)-0.2+RAMP_H*u/RAMP_L+0.12; if (top>rampTop){ rampTop=top; onRamp=r; } }
  }
  // ride the swell: vertical speed comes from how fast the surface under us rises
  const h=Math.max(surfH(ski.x,ski.z),rampTop);
  const vys=clamp((h-ski.lastH)/Math.max(dt,1e-3),-14,14); ski.lastH=h;
  ski.vy-=16*dt; ski.y+=ski.vy*dt;
  const floor=h-0.12;
  if (ski.y<=floor){
    if (ski.air) land();
    ski.y=floor; ski.vy=vys*(1+0.45*Math.min(ski.speed/20,1)); ski.air=false;
  } else if (ski.y>floor+0.3 && !ski.air){ ski.air=true; ski.airT=0; }
  if (ski.air) ski.airT+=dt;

  // attitude
  if (ski.air){
    ski.pitch+=(-(racing?input.y:0)*1.9-0.35)*dt;
    ski.up=V.norm(ski.up.map((u,i)=>damp(u,[0,1,0][i],1,dt)));
  } else {
    ski.pitch=damp(ski.pitch,(racing?input.y:0)*-0.14+Math.min(ski.speed/25,1)*0.08,8,dt);
    const n=onRamp?V.norm([-onRamp.dx*RAMP_H/RAMP_L,1,-onRamp.dz*RAMP_H/RAMP_L]):surfN(ski.x,ski.z);
    ski.up=V.norm(ski.up.map((u,i)=>damp(u,n[i],onRamp?20:9,dt)));
  }
  ski.roll=damp(ski.roll,steer*0.5*Math.min(ski.speed/10,1),6,dt);

  // wake + spray
  const right=[Math.cos(ski.heading),0,-Math.sin(ski.heading)];
  wakeTimer+=dt;
  if (wakeTimer>0.06){ wakeTimer=0; if(!ski.air && ski.speed>2){ wake.unshift({x:ski.x-fx*1.5,z:ski.z-fz*1.5,born:simT,str:Math.min(ski.speed/18,1)}); if(wake.length>24) wake.pop(); } }
  if (!ski.air && ski.speed>2.5){
    const sp=ski.speed, vx=fx*sp, vz=fz*sp, thr=(input.gas&&racing)?1:0.35;
    // bow sheets: water peeled off both sides of the hull, thrown out and up; heavier on the outside of a turn
    for (const sd of [-1,1]){
      const w=1+Math.max(0,sd*steer)*1.6;
      for (let cnt=sp*dt*11*w; cnt>0; cnt-=1){ if (Math.random()>=cnt) continue;
        const out=rnd(1.5,3)+sp*0.14*w, up=rnd(1.2,2.2)+sp*0.09;
        emit(0,[ski.x+fx*0.6+right[0]*sd*0.55, ski.y+0.12, ski.z+fz*0.6+right[2]*sd*0.55],[vx*0.55+right[0]*sd*out, up, vz*0.55+right[2]*sd*out], rnd(0.04,0.09), rnd(0.5,0.9)); }
    }
    // rooster tail out of the jet nozzle: a column that climbs behind the ski and falls back as streams
    for (let cnt=sp*dt*14*thr; cnt>0; cnt-=1){ if (Math.random()>=cnt) continue;
      emit(0,[ski.x-fx*1.55+rnd(-0.1,0.1), ski.y+0.15, ski.z-fz*1.55+rnd(-0.1,0.1)],[vx*0.15-fx*rnd(1,3)+rnd(-0.6,0.6), rnd(3.5,5)+sp*0.22*thr, vz*0.15-fz*rnd(1,3)+rnd(-0.6,0.6)], rnd(0.06,0.13), rnd(0.9,1.4)); }
    if (Math.random()<sp*dt*1.5) emit(1,[ski.x-fx*1.2,ski.y+0.4,ski.z-fz*1.2],[vx*0.2+rnd(-0.8,0.8),rnd(0.4,1.2),vz*0.2+rnd(-0.8,0.8)],rnd(0.6,1.2),rnd(0.9,1.5),0.5);
  }
  return [ox,oz];
}
function land(){
  splashCrown([ski.x,ski.y+0.1,ski.z],Math.min(1,ski.airT/1.2)); sfx.splash(0.3+Math.min(ski.airT,1.4)*0.5);
  if (Math.abs(ski.pitch)>0.85){ ski.speed*=0.25; ski.pitch=0; if(state==='race'){ flash('WIPEOUT',1000,true); sfx.wipe(); } }
  else if (ski.airT>0.6 && state==='race'){ ski.boostT=Math.max(ski.boostT,Math.min(ski.airT*0.6,1.2)); flash('AIR '+ski.airT.toFixed(1)+'s',800); }
  ski.pitch*=0.3; ski.airT=0;
}
function crossGate(ox,oz){
  const g=gates[nextGate];
  const ax=g.x-g.nx*HALF, az=g.z-g.nz*HALF, bx=g.x+g.nx*HALF, bz=g.z+g.nz*HALF;
  const rx=ski.x-ox, rz=ski.z-oz, sx=bx-ax, sz=bz-az;
  const den=rx*sz-rz*sx; if (Math.abs(den)<1e-6) return;
  const t=((ax-ox)*sz-(az-oz)*sx)/den, u=((ax-ox)*rz-(az-oz)*rx)/den;
  if (t<0||t>1||u<0||u>1||rx*g.tx+rz*g.tz<=0) return;
  sfx.gate();
  if (mode===2){
    if (firstCross){ lapStart=raceT; rec=[]; curSplits=[]; }
    else if (nextGate===0) completeTrialLap();
    else { const sp=raceT-lapStart; curSplits[nextGate]=sp; if (ghost&&ghost.splits&&ghost.splits[nextGate]!=null) showDelta(sp-ghost.splits[nextGate]); }
    firstCross=false; nextGate=(nextGate+1)%GATES; return;
  }
  if (nextGate===0 && !firstCross){
    lapsDone++;
    if (lapsDone>=LAPS){ finishRace(); return; }
    flash(lapsDone===LAPS-1?'FINAL LAP':'LAP '+(lapsDone+1),1000); sfx.lap();
  }
  firstCross=false; nextGate=(nextGate+1)%GATES;
}

const deltaEl=$('delta'); let deltaTimer=0;
function showDelta(d){ if (d==null) return; deltaEl.textContent=(d<0?'−':'+')+Math.abs(d).toFixed(2); deltaEl.className='delta show '+(d<0?'good':'bad'); clearTimeout(deltaTimer); deltaTimer=setTimeout(()=>deltaEl.classList.remove('show'),1600); }
function completeTrialLap(){
  const lt=raceT-lapStart; lapsDone++;
  const prev=ghost?ghost.t:null;
  if (prev==null||lt<prev){
    ghost={t:lt,splits:curSplits.slice(),s:rec.slice()}; store.set('ghost-'+seaIdx,JSON.stringify(ghost));
    flash('BEST LAP',1300); sfx.finish();
  } else { flash('LAP '+fmt(lt),1100); sfx.lap(); }
  if (prev!=null) showDelta(lt-prev);
  lapStart=raceT; rec=[]; curSplits=[];
}
const GHOST_DT=0.05;
function recordTrial(){
  const lt=raceT-lapStart;
  while (rec.length/9<=lt/GHOST_DT && rec.length<9*4000){
    const r2=x=>Math.round(x*100)/100;
    rec.push(r2(ski.x),r2(ski.y),r2(ski.z),Math.round(ski.heading*1000)/1000,r2(ski.pitch),r2(ski.roll),r2(ski.up[0]),r2(ski.up[1]),r2(ski.up[2]));
  }
}
function ghostAtt(){
  ghostPos=null;
  if (mode!==2||!ghost||firstCross||!(state==='race'||state==='paused')) return null;
  const s=ghost.s, n=s.length/9, f=(raceT-lapStart)/GHOST_DT, i=Math.floor(f);
  if (i+1>=n) return null;
  const k=f-i, A=i*9, B=A+9, L=(o)=>s[A+o]+(s[B+o]-s[A+o])*k;
  let dh=s[B+3]-s[A+3]; dh=Math.atan2(Math.sin(dh),Math.cos(dh));
  const h=s[A+3]+dh*k, x=L(0), y=L(1), z=L(2);
  ghostPos=[x,z];
  const fwd=[Math.sin(h),0,Math.cos(h)], up=V.norm([L(6),L(7),L(8)]), rt=V.norm(V.cross(up,fwd)), fw2=V.cross(rt,up);
  const basis=new Float32Array([rt[0],rt[1],rt[2],0, up[0],up[1],up[2],0, fw2[0],fw2[1],fw2[2],0, x,y,z,1]);
  return M.mul(basis,M.mul(M.RZ(L(5)),M.RX(-L(4))));
}

/* ================= camera ================= */
// yaw is relative to "behind the rider". Drag to orbit, pinch/scroll to zoom; once he's moving
// and nobody is touching the view, the camera eases back around behind him.
const BASE_PITCH=0.3, BASE_DIST=9.5;
const cam={eye:[0,4,0],tgt:[0,1,0]}; let camSnap=true;
const orbit={yaw:0,pitch:BASE_PITCH,dist:BASE_DIST,last:-1e9,dragging:false};
const camPtrs=new Map();
canvas.addEventListener('pointerdown',e=>{ canvas.setPointerCapture(e.pointerId); camPtrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); orbit.dragging=true; orbit.last=performance.now(); });
canvas.addEventListener('pointermove',e=>{
  const p=camPtrs.get(e.pointerId); if(!p) return;
  if (camPtrs.size===1){ orbit.yaw-=(e.clientX-p.x)*0.008; orbit.pitch=clamp(orbit.pitch+(e.clientY-p.y)*0.006,0.04,1.35); }
  else if (camPtrs.size===2){ const [a,b]=[...camPtrs.values()], before=Math.hypot(a.x-b.x,a.y-b.y);
    p.x=e.clientX; p.y=e.clientY; const [c,d]=[...camPtrs.values()], after=Math.hypot(c.x-d.x,c.y-d.y);
    if (before>0&&after>0) orbit.dist=clamp(orbit.dist*before/after,3.5,28); }
  p.x=e.clientX; p.y=e.clientY; orbit.last=performance.now();
});
const camUp=e=>{ camPtrs.delete(e.pointerId); if(!camPtrs.size) orbit.dragging=false; orbit.last=performance.now(); };
canvas.addEventListener('pointerup',camUp); canvas.addEventListener('pointercancel',camUp);
canvas.addEventListener('wheel',e=>{ e.preventDefault(); orbit.dist=clamp(orbit.dist*Math.exp(e.deltaY*0.001),3.5,28); orbit.last=performance.now(); },{passive:false});
const wrapA=a=>{ a=(a+Math.PI)%TAU; if(a<0)a+=TAU; return a-Math.PI; };
function updateCam(dt,now){
  const idle=!orbit.dragging && now-orbit.last>1200;
  orbit.yaw=wrapA(orbit.yaw);
  if (state==='menu' && idle) orbit.yaw+=dt*0.15;
  if (state!=='menu' && idle && ski.speed>3){
    // swing back around behind him: quick enough to notice, slow enough to feel smooth
    orbit.yaw=damp(orbit.yaw,0,1.3,dt); orbit.pitch=damp(orbit.pitch,BASE_PITCH,1.3,dt); orbit.dist=damp(orbit.dist,BASE_DIST+ski.speed*0.08,0.9,dt);
  }
  const fx=Math.sin(ski.heading), fz=Math.cos(ski.heading);
  const a=ski.heading+Math.PI+orbit.yaw, cp=Math.cos(orbit.pitch), sp=Math.sin(orbit.pitch);
  const look=Math.max(0,Math.cos(orbit.yaw))*(state==='menu'?0:11);
  const base=[ski.x, Math.max(ski.y,0)+1.0, ski.z];
  const eye=[base[0]+Math.sin(a)*cp*orbit.dist, base[1]+sp*orbit.dist, base[2]+Math.cos(a)*cp*orbit.dist];
  const tgt=[ski.x+fx*look, ski.y+1.0, ski.z+fz*look];
  if (camSnap){ cam.eye=eye; cam.tgt=tgt; camSnap=false; }
  const rate=orbit.dragging?14:5;
  cam.eye=cam.eye.map((v,i)=>damp(v,eye[i],rate,dt));
  cam.tgt=cam.tgt.map((v,i)=>damp(v,tgt[i],8,dt));
  cam.eye[1]=Math.max(cam.eye[1],surfH(cam.eye[0],cam.eye[2])+0.8);
}

/* ================= course map ================= */
const mm=$('minimap'), mctx=mm.getContext('2d');
const mmSize=()=>{ const d=Math.min(devicePixelRatio||1,2); mm.width=Math.round(mm.clientWidth*d); mm.height=Math.round(mm.clientHeight*d); };
new ResizeObserver(mmSize).observe(mm);
function drawMini(){
  const show=state!=='menu'; if (mm.hidden===show) mm.hidden=!show;
  const W=mm.width, H=mm.height; if (!show||!W) return;
  const pad=W*0.13, k=Math.min((W-2*pad)/(mmB.x1-mmB.x0),(H-2*pad)/(mmB.z1-mmB.z0)), cx=(mmB.x0+mmB.x1)/2, cz=(mmB.z0+mmB.z1)/2;
  const P=(x,z)=>[W/2-(x-cx)*k, H/2-(z-cz)*k];      // seen from above: world +x is screen-left when +z is up
  mctx.clearRect(0,0,W,H); mctx.lineJoin='round'; mctx.lineCap='round';
  mctx.beginPath(); coursePath.forEach(([x,z],i)=>{ const [u,v]=P(x,z); i?mctx.lineTo(u,v):mctx.moveTo(u,v); }); mctx.closePath();
  mctx.strokeStyle='rgba(95,224,230,.18)'; mctx.lineWidth=W*0.075; mctx.stroke();
  mctx.strokeStyle='rgba(230,241,255,.75)'; mctx.lineWidth=W*0.016; mctx.stroke();
  const racing=state==='race'||state==='countdown'||state==='paused';
  gates.forEach((g,i)=>{ const [u,v]=P(g.x,g.z); const nx=racing&&i===nextGate;
    mctx.beginPath(); mctx.arc(u,v,nx?W*0.048:W*0.026,0,TAU);
    mctx.fillStyle=nx?'#3d8bff':(i===0?'#ffffff':'#ffa24a'); mctx.fill();
    if (nx){ mctx.lineWidth=W*0.012; mctx.strokeStyle='rgba(166,210,255,.9)'; mctx.stroke(); } });
  for (const r of ramps){ const [u,v]=P(r.x,r.z); mctx.fillStyle='#ff4a3d'; mctx.fillRect(u-W*0.022,v-W*0.022,W*0.044,W*0.044); }
  for (const pd of pads){ const [u,v]=P(pd.x,pd.z); mctx.beginPath(); mctx.arc(u,v,W*0.02,0,TAU); mctx.fillStyle='#7fb8ff'; mctx.fill(); }
  if (ghostPos){ const [gu,gv]=P(ghostPos[0],ghostPos[1]); mctx.beginPath(); mctx.arc(gu,gv,W*0.04,0,TAU); mctx.fillStyle='rgba(120,240,255,.85)'; mctx.fill(); }
  const [u,v]=P(ski.x,ski.z), a=Math.atan2(-Math.cos(ski.heading),-Math.sin(ski.heading)), r=W*0.07;
  mctx.save(); mctx.translate(u,v); mctx.rotate(a);
  mctx.beginPath(); mctx.moveTo(r,0); mctx.lineTo(-r*0.7,r*0.62); mctx.lineTo(-r*0.35,0); mctx.lineTo(-r*0.7,-r*0.62); mctx.closePath();
  mctx.fillStyle='#ffffff'; mctx.fill(); mctx.lineWidth=W*0.014; mctx.strokeStyle='#5fe0e6'; mctx.stroke(); mctx.restore();
}

/* ================= frame ================= */
function makeFlatView(surface) {
  const c=surface.getContext('2d',{alpha:false});
  if(!c)throw Error('This browser could not create a racing canvas.');
  function line(x,y,x2,y2,color,width) {
    c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
  }
  function skiIcon(x,y,heading,size,ghost=false){
    c.save();c.translate(x,y);c.rotate(heading);c.scale(size,size);
    c.globalAlpha=ghost?.5:1;
    c.fillStyle='#a9f9f9';c.beginPath();c.moveTo(-.5,1);c.lineTo(0,2.4+ski.speed*.035);c.lineTo(.5,1);c.fill();
    c.fillStyle='#341c53';c.strokeStyle='#e8faff';c.lineWidth=.14;
    c.beginPath();c.moveTo(0,-1.65);c.quadraticCurveTo(.9,-.9,.7,1.2);c.lineTo(-.7,1.2);c.quadraticCurveTo(-.9,-.9,0,-1.65);c.fill();c.stroke();
    c.fillStyle='#67e0d1';c.fillRect(-.47,-.77,.94,.45);c.fillStyle='#f5a253';c.fillRect(-.34,-.1,.68,.72);c.restore();
  }
  return function drawTopDown(){
    const w=surface.clientWidth||1,h=surface.clientHeight||1,dpr=Math.min(devicePixelRatio||1,1.6);
    const pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));
    if(surface.width!==pw||surface.height!==ph){surface.width=pw;surface.height=ph;}
    c.setTransform(pw/w,0,0,ph/h,0,0);
    const day=skyIdx===1,gradient=c.createLinearGradient(0,0,w,h);
    gradient.addColorStop(0,day?'#116a7d':'#193652');gradient.addColorStop(1,day?'#138d98':'#135662');c.fillStyle=gradient;c.fillRect(0,0,w,h);
    const scale=clamp(Math.min(w,h)/92,2,8),cx=w*.5,cy=h*.56;
    const X=x=>cx-(x-ski.x)*scale,Y=z=>cy-(z-ski.z)*scale;
    const visible=(x,y)=>x>-30&&x<w+30&&y>-30&&y<h+30;
    for(let y=((ski.z*scale+simT*6)%23+23)%23-23;y<h+23;y+=23){
      c.beginPath();for(let x=-8;x<w+24;x+=12){const yy=y+Math.sin((x-ski.x*scale)*.045+y*.06+simT)*(1+seaIdx);if(x===-8)c.moveTo(x,yy);else c.lineTo(x,yy);}
      c.lineWidth=1;c.strokeStyle='#c6f8e516';c.stroke();
    }
    for(const b of laneBuoys){const x=X(b.x),y=Y(b.z);if(!visible(x,y))continue;c.fillStyle='#e9937c';c.beginPath();c.arc(x,y,Math.max(1.8,scale*.55),0,TAU);c.fill();}
    for(const [items,color] of [[ramps,'#ff9e75'],[pads,'#80e8ff']]){
      for(const p of items){const x=X(p.x),y=Y(p.z);if(!visible(x,y))continue;c.save();c.translate(x,y);c.rotate(-p.a);c.fillStyle=color;c.fillRect(-2*scale,-2*scale,4*scale,4*scale);line(-scale,scale,0,-scale,'#214052',1.6);line(0,-scale,scale,scale,'#214052',1.6);c.restore();}
    }
    for(let i=0;i<gates.length;i++){
      const g=gates[i],x=X(g.x),y=Y(g.z);if(!visible(x,y))continue;
      const dx=g.nx*HALF*scale,dy=g.nz*HALF*scale,target=i===nextGate;
      const color=target?'#fff09b':i===0?'#fff':'#78cee3';if(target||gateStyle!==0)line(x-dx,y-dy,x+dx,y+dy,color,target?3:1);
      for(const s of [-1,1]){c.fillStyle=color;c.beginPath();c.arc(x+s*dx,y+s*dy,scale*.9,0,TAU);c.fill();}
      if(target){c.fillStyle='#fff8b4';c.font='bold 12px system-ui';c.textAlign='center';c.fillText('GATE '+(i+1),x,y-7);}
    }
    if(ghostPos)skiIcon(X(ghostPos[0]),Y(ghostPos[1]),-ski.heading,scale*1.4,true);
    skiIcon(cx,cy,-ski.heading,scale*1.5+Math.min(2,Math.max(0,ski.y)*.2));
  };
}
async function chooseRenderer(){
  if(params.get('view')==='top-down' || !navigator.gpu){
    flatView(params.get('view')==='top-down'?'Selected top-down view':'WebGPU is unavailable in this browser.');
    return;
  }
  const loading=async()=>{
    let adapter=await navigator.gpu.requestAdapter();
    if(!adapter) adapter=await navigator.gpu.requestAdapter({featureLevel:'compatibility'});
    if(!adapter) throw Error('No WebGPU adapter available.');
    controller.signal.throwIfAborted();
    const candidate=await adapter.requestDevice();
    if(controller.signal.aborted){candidate.destroy();throw Error('Graphics startup canceled.');}
    device=candidate;
    candidate.lost.then(info=>{if(device===candidate)flatView(info.message||'Graphics device disconnected.');});
    candidate.addEventListener('uncapturederror',e=>{if(device===candidate)flatView(e.error.message||'Graphics error.');});
    return initRenderer(candidate,controller.signal);
  };
  let timeout;
  try {
    const initialized=await Promise.race([loading(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('3D graphics took too long to start.')),18000);})]);
    if(!controller.signal.aborted){
      renderer=initialized;renderer.resize();renderer.uploadLane();
      document.documentElement.dataset.renderer='webgpu';
    }
  } catch(error) {flatView(error.message||'3D graphics unavailable.');}
  finally {clearTimeout(timeout);}
}
const lapK=$('lapK'), extraPlate=$('extraPlate'), extraK=$('extraK'), extraV=$('extraV');
const lapEl=$('lap'), timeEl=$('time'), spdEl=$('spd'), boostEl=$('boostbar'), arrowSvg=$('arrow').firstElementChild, gdEl=$('gatedist');
let last=performance.now(), offCourse=false; const offEl=$('offcourse');

function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  readInput();
  const paused=state==='paused'||state==='finish';
  if (state!=='paused') simT+=dt;

  const ease=1-Math.exp(-dt*1.5);
  const ST=SEAS[seaIdx], KT=SKIES[skyIdx];
  for (const k of ['scale','chop','storm']) sea[k]+=(ST[k]-sea[k])*ease;
  for (let i=0;i<3;i++) skyS.sun[i]+=(KT.sun[i]-skyS.sun[i])*ease;
  skyS.day+=(KT.day-skyS.day)*ease;

  if (state==='countdown'){
    const prev=Math.ceil(cdT); cdT-=dt; const cur=Math.ceil(cdT);
    if (cur!==prev && cur>0){ flash(String(cur),800); sfx.beep(false); }
    if (cdT<=0){ cdT=0; state='race'; flash('GO!',700); sfx.beep(true); }
  }
  if (state!=='paused'){
    const [ox,oz]=stepSki(dt);
    if (state==='race'){ raceT+=dt; crossGate(ox,oz); if (mode===2&&!firstCross) recordTrial(); }
  }
  if (state!=='paused') for (const p of spray){
    p.age+=dt;
    if (p.kind){ p.v[1]-=1.2*dt; const dr=1-1.4*dt; p.v[0]*=dr; p.v[1]*=dr; p.v[2]*=dr; }
    else { p.v[1]-=11*dt; const dr=1-0.3*dt; p.v[0]*=dr; p.v[2]*=dr; }
    for(let i=0;i<3;i++) p.p[i]+=p.v[i]*dt;
    // drops die when they fall back into the sea
    if (!p.kind && p.v[1]<0 && p.age>0.12 && p.p[1]<surfH(p.p[0],p.p[2])) p.age=p.life;
  }
  for (let i=spray.length-1;i>=0;i--) if (spray[i].age>spray[i].life) spray.splice(i,1);
  updateCam(dt,now);
  sfx.update(state==='race'||state==='countdown', ski.speed, input.gas&&(state==='race'||state==='countdown')?1:0, ski.air, ski.boostT>0, input.brake&&state==='race');

  // HUD
  if (mode===2){
    lapK.textContent='Lap'; lapEl.textContent=String(lapsDone+1);
    timeEl.textContent=fmt(firstCross?0:raceT-lapStart); timeEl.classList.remove('over');
    extraPlate.hidden=false; extraK.textContent='Best lap'; extraV.textContent=ghost?fmt(ghost.t):'--';
  } else if (mode===1){
    const leaf=firstCross?1:Math.min(3,1+Math.floor(((nextGate+GATES-1)%GATES)/(GATES/3)));
    lapK.textContent='Leaf'; lapEl.innerHTML=leaf+'<small>/3</small>';
    timeEl.textContent=fmt(raceT); timeEl.classList.remove('over'); extraPlate.hidden=true;
  } else {
    lapK.textContent='Lap'; lapEl.innerHTML=Math.min(lapsDone+1,LAPS)+'<small>/'+LAPS+'</small>';
    timeEl.textContent=fmt(raceT);
    extraPlate.hidden=mode!==3; timeEl.classList.toggle('over',mode===3&&raceT>par);
    if (mode===3){ extraK.textContent='Race '+level+' par'; extraV.textContent=fmt(par); }
  }
  spdEl.textContent=Math.round(ski.speed*2.237);
  boostEl.style.width=(ski.boostT/1.9*100).toFixed(0)+'%';
  if (state==='race'||state==='countdown'){
    const g=gates[nextGate], dx=g.x-ski.x, dz=g.z-ski.z;
    const fx=Math.sin(ski.heading), fz=Math.cos(ski.heading);
    const ang=Math.atan2(dx*(-fz)+dz*fx, dx*fx+dz*fz);
    arrowSvg.style.transform=`rotate(${ang}rad)`;
    gdEl.textContent=`GATE ${nextGate===0&&!firstCross?'START':(nextGate+1)} · ${Math.round(Math.hypot(dx,dz))} M`;
  }

  const gAtt=ghostAtt();
  drawMini();
  // off-course warning: distance from the racing line, with a little hysteresis
  if (state==='race'){
    let bd=1e18; for (let i=0;i<coursePath.length;i+=2){ const q=coursePath[i], d=(q[0]-ski.x)**2+(q[1]-ski.z)**2; if (d<bd) bd=d; }
    const d=Math.sqrt(bd); if (!offCourse && d>LANE+4.5) offCourse=true; else if (offCourse && d<LANE+2) offCourse=false;
  } else offCourse=false;
  if (offEl.classList.contains('show')!==offCourse) offEl.classList.toggle('show',offCourse);
  if(drawFlat)drawFlat();
  else {
    try {renderer.draw(gAtt);}
    catch(error){flatView(error.message||'3D drawing interrupted.');}
  }
  if(!closed)requestAnimationFrame(frame);
}
$('boot').textContent='Preparing graphics…';
await chooseRenderer();
new ResizeObserver(()=>renderer?.resize()).observe(canvas);
$('boot').hidden=true;
$('startBtn').disabled=false;
document.documentElement.dataset.ready='true';
requestAnimationFrame(frame);
})().catch(error=>{
  document.getElementById('fbmsg').textContent=error.message||'Startup failed. Please retry.';
  document.getElementById('fallback').hidden=false;
});
