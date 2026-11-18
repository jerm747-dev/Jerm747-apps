// 747 GP — Sound gearbox
// ------------------------------------------------------------------
// Turns the vehicle's speed + throttle into an engine rpm with automatic
// shifts, so the engine sound climbs, drops at each upshift, and blips
// on downshifts. This is for SOUND only — your physics keeps doing its
// own thing. Feed it speed as 0..1 of that vehicle's top speed.
//
//   rpm in gear g = redline × speed01 × ratio[g] / ratio[top]
//   → top gear hits redline at top speed; 1st gear hits it much earlier.
// ------------------------------------------------------------------
import { GEARING } from './engine-presets.js';

export class SoundGearbox {
  constructor(preset, family = 'car') {
    const g = GEARING[family] || GEARING.car;
    this.ratios = g.ratios;
    this.shiftMs = g.shiftMs;
    this.idle = preset.idle;
    this.redline = preset.redline;
    this.gear = 0;
    this.shiftT = 0;
    this.rpm = preset.idle;
    this.upAt = 0.95;    // upshift near redline
    this.downAt = 0.5;   // downshift when revs sag this low
  }

  _rpm(g, s) {
    const top = this.ratios.length - 1;
    return this.redline * s * (this.ratios[g] / this.ratios[top]);
  }

  // speed01: 0..1 of top speed · throttle: 0..1 · dtMs: frame time
  // returns { rpm, throttle, gear, cut } — hand rpm/throttle/cut to the engine voice
  update(speed01, throttle, dtMs) {
    const s = Math.max(0, Math.min(1.05, speed01));
    const top = this.ratios.length - 1;
    let cut = 0;

    if (this.shiftT > 0) {
      this.shiftT -= dtMs;
      cut = 1;
    } else if (this.gear < top && this._rpm(this.gear, s) > this.redline * this.upAt && throttle > 0.2) {
      this.gear++;
      this.shiftT = this.shiftMs;
      cut = 1;
    } else if (this.gear > 0 && this._rpm(this.gear, s) < this.redline * this.downAt &&
               this._rpm(this.gear - 1, s) < this.redline * 0.8) {
      this.gear--;                      // downshift: revs jump up = natural blip
    }

    // clutch slip in 1st: hold launch revs until the gear catches up, so launches sound right
    const launch = this.gear === 0 ? this.idle + throttle * 0.45 * (this.redline - this.idle) : 0;
    const target = Math.max(this._rpm(this.gear, s), launch, this.idle);
    this.rpm = Math.min(target, this.redline);
    return { rpm: this.rpm, throttle: cut ? 0 : throttle, gear: this.gear + 1, cut };
  }
}
