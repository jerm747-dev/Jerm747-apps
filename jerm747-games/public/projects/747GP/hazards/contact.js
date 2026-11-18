// 747 GP uses metres, seconds, and an X/Z ground plane.
(() => {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Equal effective mass for the same-vehicle arcade field. Normal points B -> A.
  // The caller maps world-space corrections back into each driver's motion model.
  function pair(a, b, length, width) {
    const dx = a.x - b.x, dz = a.z - b.z;
    if (dx * dx + dz * dz > length * length + width * width) return null;
    const af = [Math.sin(a.h), Math.cos(a.h)], ar = [af[1], -af[0]];
    const bf = [Math.sin(b.h), Math.cos(b.h)], br = [bf[1], -bf[0]];
    let depth = Infinity, nx = 0, nz = 0;
    for (const [x, z] of [af, ar, bf, br]) {
      const extent = (length * (Math.abs(af[0]*x + af[1]*z) + Math.abs(bf[0]*x + bf[1]*z))
        + width * (Math.abs(ar[0]*x + ar[1]*z) + Math.abs(br[0]*x + br[1]*z))) / 2;
      const distance = dx*x + dz*z, overlap = extent - Math.abs(distance);
      if (overlap <= 0) return null;
      if (overlap < depth) {
        depth = overlap;
        const sign = Math.sign(distance) || 1;
        nx = x*sign; nz = z*sign;
      }
    }
    const closing = Math.max(0, -((a.vx-b.vx)*nx + (a.vz-b.vz)*nz));
    const impulse = (closing + Math.min(2.8, closing*0.12)) / 2;
    const shift = Math.max(0, depth - 0.012) * 0.48;
    return {nx, nz, closing, dx:nx*shift, dz:nz*shift, dvx:nx*impulse, dvz:nz*impulse};
  }

  function wall(body, nx, nz, depth) {
    const closing = Math.max(0, -(body.vx*nx + body.vz*nz));
    const impulse = closing + Math.min(4, closing*0.22);
    return {nx, nz, closing, dx:nx*depth, dz:nz*depth, dvx:nx*impulse, dvz:nz*impulse};
  }

  class Suspension {
    constructor() { this.reset(); }
    reset() { this.roll = this.pitch = this.rollRate = this.pitchRate = 0; }
    kick(side, fore, speed) {
      const force = Math.min(1, speed / 17);
      this.rollRate = clamp(this.rollRate - side*force*1.75, -1.9, 1.9);
      this.pitchRate = clamp(this.pitchRate + fore*force*1.15, -1.4, 1.4);
    }
    step(dt) {
      this.rollRate += (-150*this.roll - 16*this.rollRate)*dt;
      this.pitchRate += (-165*this.pitch - 18*this.pitchRate)*dt;
      this.roll = clamp(this.roll + this.rollRate*dt, -0.07, 0.07);
      this.pitch = clamp(this.pitch + this.pitchRate*dt, -0.045, 0.045);
    }
  }

  // A contact stays latched while two bodies touch. Separating motion may still
  // need a positional correction, but cannot trigger another impact cue.
  class ContactGate {
    constructor() { this.contacts = new Map(); this.time = 0; }
    reset() { this.contacts.clear(); this.time = 0; }
    step(dt) { this.time += dt; }
    strike(key, closing) {
      const previous = this.contacts.get(key);
      const continuing = previous && this.time - previous.seen < 0.11;
      const fired = continuing && previous.fired;
      const trigger = !fired && closing >= 0.85;
      this.contacts.set(key, {seen:this.time, fired:fired || trigger});
      return trigger;
    }
  }

  // Track-side lateral coordinates match the generated road mesh. Optional
  // gravel zones use lap fractions [from,to) and signed metres from the centre.
  function inZone(fraction,z) {
    return z.from <= z.to ? fraction >= z.from && fraction < z.to : fraction >= z.from || fraction < z.to;
  }
  function surface(lat, fraction, track, corner, roadWidth, apron) {
    const edge = Math.abs(lat) - roadWidth/2;
    if (track.gravelZones?.some(z => inZone(fraction,z) && lat >= z.min && lat <= z.max)) return 'gravel';
    if (edge <= 0) return 'asphalt';
    if (track.oval) return lat*(track.outSide || 1) > 0 || edge <= apron ? 'asphalt' : 'grass';
    if (corner && edge <= 1.4) return 'curb';
    return 'grass';
  }
  window.GPContact = {pair, wall, Suspension, ContactGate, inZone, surface};
})();
