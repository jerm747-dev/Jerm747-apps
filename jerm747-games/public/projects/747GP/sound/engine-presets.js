// 747 GP — Engine presets
// ------------------------------------------------------------------
// The idea: each class gets its own cylinder layout, and the layout
// decides the rhythm of the exhaust pulses.
//
//   Class 100   → inline-4   (even 180° firing, single pipe, buzzy)
//   Class 600   → V6         (even 120°, two banks, smooth growl)
//   Class 1200  → V8         (cross-plane: each bank fires unevenly → burble)
//   Class 1800  → V10        (even 72°, two banks, the scream)
//   Sleeper     → V8 big cam (heavy lope + blower whine — the wub wub)
//   Trucks      → same cylinder count as their class, heavier & lower
//   Motorcycles → twins that perk up (brighter, higher-revving) by class
//   F1          → short-stroke V10 at 18,500 rpm — moto bite, higher pitch
//
// Field guide
//   fire[]      crank angle (0–720°) where each cylinder fires
//   bank[]      which exhaust bank each cylinder dumps into
//   pan[]       left/right placement per bank (-1..1)
//   pulseDeg    how long each exhaust pulse lasts, in crank degrees
//               (shorter = sharper, like a short-stroke engine)
//   shapeK      exponent of the falling pulse (1-t)^k  → 3 = the x³ curve
//   undershoot  negative dip after the pulse (pressure rebound)
//   lpBase/lpPerK/lpLoad   muffler cutoff: base Hz + Hz per 1000 rpm + Hz at full throttle
//   q           muffler resonance
//   pipeMs[]    pipe length per bank (comb resonance — the metallic colour)
//   pipeFb      how much the pipe rings
//   drive       saturation amount
//   lope        big-cam idle wobble (0–1), fades out by lopeFade rpm
//   cylVar      fixed per-cylinder imbalance (adds character)
//   body/bodyHz the low rumble you feel more than hear
//   intake      induction / mechanical hiss
//   whine       {ratio × crank speed, amt, load} — blower, turbo, gears
//   pops        overrun crackle chance per firing when you lift
//   rpmLag      how heavy the flywheel feels (seconds)
//   gain        loudness trim (calibrated so presets sit at similar level)
// ------------------------------------------------------------------

// --- firing layouts -------------------------------------------------
const even = (n) => Array.from({ length: n }, (_, i) => (720 / n) * i);
const alt = (n) => Array.from({ length: n }, (_, i) => i % 2);

// Cross-plane V8, firing order 1-8-4-3-6-5-7-2, odd cylinders left bank.
// Each bank sees uneven gaps (270/180/90/180°) — that's the burble.
const V8_CROSS = {
  fire: [0, 630, 270, 180, 450, 360, 540, 90],
  bank: [0, 1, 0, 1, 0, 1, 0, 1],
};
// Flat-plane V8 (alternates banks, each bank perfectly even) — available as an alternate
const V8_FLAT = { fire: even(8), bank: alt(8) };

const LAYOUT = {
  i4:      { fire: even(4), bank: [0, 0, 0, 0], banks: 1, pan: [0] },
  v6:      { fire: even(6), bank: alt(6), banks: 2, pan: [-0.35, 0.35] },
  v8cross: { ...V8_CROSS, banks: 2, pan: [-0.4, 0.4] },
  v8flat:  { ...V8_FLAT, banks: 2, pan: [-0.35, 0.35] },
  v10:     { fire: even(10), bank: alt(10), banks: 2, pan: [-0.35, 0.35] },
  twin360: { fire: [0, 360], bank: [0, 0], banks: 1, pan: [0] },   // parallel twin
  twin270: { fire: [0, 270], bank: [0, 0], banks: 1, pan: [0] },   // 270° crank / L-twin feel
};

// --- base presets ---------------------------------------------------
export const PRESETS = {
  car100_i4: {
    name: 'Class 100 · Inline-4', layout: 'i4', seed: 101,
    idle: 850, redline: 7200,
    pulseDeg: 200, shapeK: 2.2, undershoot: 0.25,
    lpBase: 300, lpPerK: 220, lpLoad: 900, q: 1.1,
    pipeMs: [2.2], pipeFb: 0.35, drive: 1.6,
    lope: 0.05, cylVar: 0.04, body: 0.25, bodyHz: 110,
    intake: 0.10, pops: 0.05, rpmLag: 0.04,
  },
  car600_v6: {
    name: 'Class 600 · V6', layout: 'v6', seed: 601,
    idle: 800, redline: 7500,
    pulseDeg: 170, shapeK: 2.6, undershoot: 0.28,
    lpBase: 260, lpPerK: 200, lpLoad: 1000, q: 1.3,
    pipeMs: [3.1, 3.3], pipeFb: 0.35, drive: 1.7,
    lope: 0.08, cylVar: 0.06, body: 0.35, bodyHz: 95,
    intake: 0.08, pops: 0.06, rpmLag: 0.045,
  },
  car1200_v8: {
    name: 'Class 1200 · V8 (cross-plane)', layout: 'v8cross', seed: 1201,
    idle: 750, redline: 7000,
    pulseDeg: 160, shapeK: 3, undershoot: 0.3,
    lpBase: 200, lpPerK: 160, lpLoad: 900, q: 1.4,
    pipeMs: [3.8, 4.1], pipeFb: 0.4, drive: 1.9,
    lope: 0.18, lopeFade: 2400, jitterDeg: 8, cylVar: 0.08, body: 0.55, bodyHz: 85,
    intake: 0.06, pops: 0.08, rpmLag: 0.05,
  },
  car1800_v10: {
    name: 'Class 1800 · V10', layout: 'v10', seed: 1801,
    idle: 900, redline: 8700,
    pulseDeg: 140, shapeK: 3, undershoot: 0.3,
    lpBase: 320, lpPerK: 260, lpLoad: 1400, q: 1.3,
    pipeMs: [2.6, 2.8], pipeFb: 0.35, drive: 1.8,
    lope: 0.06, cylVar: 0.05, body: 0.35, bodyHz: 90,
    intake: 0.10, pops: 0.10, rpmLag: 0.04,
  },
  sleeper1800_v8: {
    name: 'Sleeper · Blown big-cam V8', layout: 'v8cross', seed: 1802,
    idle: 700, redline: 7400,
    pulseDeg: 175, shapeK: 3.2, undershoot: 0.35,
    lpBase: 170, lpPerK: 150, lpLoad: 900, q: 1.6,
    pipeMs: [4.4, 4.7], pipeFb: 0.45, drive: 2.3,
    lope: 0.65, lopeFade: 2600, jitterDeg: 14, cylVar: 0.12, body: 0.9, bodyHz: 75,
    intake: 0.06, whine: { ratio: 9.5, amt: 0.05, load: 0.8 }, pops: 0.18, rpmLag: 0.055,
  },
  f1_v10: {
    name: 'F1 · Short-stroke V10', layout: 'v10', seed: 1,
    idle: 4200, redline: 18500,
    pulseDeg: 110, shapeK: 3.2, undershoot: 0.3,
    lpBase: 900, lpPerK: 260, lpLoad: 3000, q: 1.2,
    pipeMs: [0.9, 1.0], pipeFb: 0.28, drive: 1.7,
    lope: 0, cylVar: 0.03, body: 0.15, bodyHz: 160,
    intake: 0.18, whine: { ratio: 4.25, amt: 0.03, load: 0.5 }, pops: 0.12, rpmLag: 0.02,
  },

  // Motorcycles — twins, perking up with class
  moto100_twin: {
    name: 'Moto 100 · Parallel twin', layout: 'twin360', seed: 102,
    idle: 1300, redline: 10500,
    pulseDeg: 230, shapeK: 2, undershoot: 0.2,
    lpBase: 450, lpPerK: 260, lpLoad: 1200, q: 1.2,
    pipeMs: [1.8], pipeFb: 0.3, drive: 1.5,
    lope: 0.06, cylVar: 0.05, body: 0.2, bodyHz: 130,
    intake: 0.14, pops: 0.10, rpmLag: 0.025,
  },
  moto600_twin: {
    name: 'Moto 600 · 270° twin', layout: 'twin270', seed: 602,
    idle: 1300, redline: 12000,
    pulseDeg: 200, shapeK: 2.4, undershoot: 0.25,
    lpBase: 480, lpPerK: 300, lpLoad: 1500, q: 1.25,
    pipeMs: [1.6], pipeFb: 0.3, drive: 1.6,
    lope: 0.10, cylVar: 0.06, body: 0.25, bodyHz: 120,
    intake: 0.14, pops: 0.14, rpmLag: 0.022,
  },
  moto1200_twin: {
    name: 'Moto 1200 · Big 270° twin', layout: 'twin270', seed: 1202,
    idle: 1200, redline: 13500,
    pulseDeg: 180, shapeK: 2.7, undershoot: 0.28,
    lpBase: 520, lpPerK: 330, lpLoad: 1800, q: 1.3,
    pipeMs: [1.4], pipeFb: 0.32, drive: 1.8,
    lope: 0.10, cylVar: 0.06, body: 0.3, bodyHz: 110,
    intake: 0.15, pops: 0.16, rpmLag: 0.02,
  },
  moto1800_twin: {
    name: 'Moto 1800 · Screaming twin', layout: 'twin270', seed: 1803,
    idle: 1300, redline: 15500,
    pulseDeg: 150, shapeK: 3, undershoot: 0.3,
    lpBase: 600, lpPerK: 380, lpLoad: 2200, q: 1.4,
    pipeMs: [1.2], pipeFb: 0.32, drive: 2.0,
    lope: 0.08, cylVar: 0.05, body: 0.3, bodyHz: 110,
    intake: 0.16, pops: 0.20, rpmLag: 0.018,
  },
};

// Trucks: same cylinder count as the class, but heavier — lower revs,
// longer pulses, darker muffler, more body, heavier flywheel, a little turbo.
function asTruck(base, name, seed) {
  return {
    ...base, name, seed,
    idle: Math.round(base.idle * 0.9), redline: Math.round(base.redline * 0.82),
    pulseDeg: base.pulseDeg * 1.12, lpBase: base.lpBase * 0.8, lpPerK: base.lpPerK * 0.8,
    lpLoad: base.lpLoad * 0.75, body: base.body * 1.3 + 0.1, bodyHz: 70,
    pipeMs: base.pipeMs.map((m) => m * 1.25), drive: base.drive * 1.1,
    lope: (base.lope || 0) + 0.08, rpmLag: 0.08,
    whine: { ratio: 38, amt: 0.018, load: 0.9 },
  };
}
PRESETS.truck100_i4 = asTruck(PRESETS.car100_i4, 'Truck 100 · Inline-4 turbo', 103);
PRESETS.truck600_v6 = asTruck(PRESETS.car600_v6, 'Truck 600 · V6 turbo', 603);
PRESETS.truck1200_v8 = asTruck(PRESETS.car1200_v8, 'Truck 1200 · V8', 1203);
PRESETS.truck1800_v10 = asTruck(PRESETS.car1800_v10, 'Truck 1800 · V10', 1804);

// Loudness trims (from tools/render-previews.mjs calibration)
export const GAIN = {
  car100_i4: 1.29, car600_v6: 0.75, car1200_v8: 0.92, car1800_v10: 0.98, sleeper1800_v8: 0.85, f1_v10: 0.99,
  moto100_twin: 1.02, moto600_twin: 1.13, moto1200_twin: 1.16, moto1800_twin: 1.29,
  truck100_i4: 1.41, truck600_v6: 0.77, truck1200_v8: 0.92, truck1800_v10: 1.01,
};

// Expand a preset id into the full object the worklet expects
export function buildPreset(id, overrides = {}) {
  const base = PRESETS[id];
  if (!base) throw new Error(`747GP sound: unknown engine preset "${id}"`);
  const lay = LAYOUT[base.layout];
  const { gain: trim = 1, ...rest } = overrides;
  return { id, ...lay, ...base, ...rest, fire: lay.fire, bank: lay.bank, gain: (GAIN[id] || 1) * trim };
}

// type: 'car' | 'truck' | 'moto' | 'f1' | 'sleeper'   cls: 100 | 600 | 1200 | 1800
export function engineFor(type, cls) {
  if (type === 'f1') return 'f1_v10';
  if (type === 'sleeper') return 'sleeper1800_v8';
  const c = [100, 600, 1200, 1800].includes(cls) ? cls : 600;
  const tag = { 100: 'i4', 600: 'v6', 1200: 'v8', 1800: 'v10' }[c];
  if (type === 'moto') return `moto${c}_twin`;
  if (type === 'truck') return `truck${c}_${tag}`;
  return `car${c}_${tag}`;
}

// Gearbox feel per family (used by gearbox.js)
export const GEARING = {
  car:     { ratios: [3.3, 2.25, 1.7, 1.35, 1.12, 1.0], shiftMs: 140 },
  truck:   { ratios: [3.8, 2.5, 1.8, 1.4, 1.15, 1.0], shiftMs: 220 },
  moto:    { ratios: [2.9, 2.1, 1.65, 1.38, 1.17, 1.0], shiftMs: 60 },
  f1:      { ratios: [2.4, 1.95, 1.65, 1.44, 1.28, 1.16, 1.07, 1.0], shiftMs: 25 },
  sleeper: { ratios: [2.9, 1.9, 1.35, 1.0], shiftMs: 160 },
};
