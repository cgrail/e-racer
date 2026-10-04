import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';
import { SUPER_T } from './specs.js';

// Race methods for the power-up option: collectable power orbs and the super power they charge.
// Humans only. Like energy cells, orbs are per player (c.taken) and come back every lap.
// Catch-up: orbs do nothing for the top three (they stay on the road for when the car drops back). Further back,
// an orb gives more charges and a charge runs longer, so a car at the back can power its way to the front.
// Super power: fast acceleration past top speed, barriers are smashed aside, puddles and ice
// are ignored, roadside crashes are blocked and rivals get shoved out of the way.
const ORB_GAP = 450;   // segments between orbs (offset from the energy cells)
const MAX_HELD = 3;
const SUPER_ACC = 0.5; // extra acceleration, fraction of MAX_SPEED per second

export function placeOrbs() {
  const T = this.track, rnd = U.rng(U.hash(T.code + 'power')), d = Art.DEF.orb;
  for (const s of T.segments) s.obs = s.obs.filter(ob => ob.fx !== 'power');
  for (let i = K.START_SEG + 115; i < T.N - 20; i += ORB_GAP) {
    const s = T.segments[i];
    if (s.obs.length) continue;
    const x = (rnd() * 2 - 1) * 0.75;
    s.obs.push({ name: 'orb', v: 0, x, bx: x, ww: d.ww, hw: (d.hit * d.ww) / T.roadW / 2, fx: 'power', hit: false, fly: null });
  }
}

// 0 for 4th place up to 1 for last.
export function powerShare(c) {
  const n = this.cars.length;
  return n > 4 ? U.clamp((c.place - 4) / (n - 4), 0, 1) : 1;
}

export function collectPower(c, ob) {
  if (c.power == null || c.place <= 3) return; // rivals don't use power-ups
  c.taken.add(ob);
  if (c.power >= MAX_HELD) return;
  const got = Math.min(MAX_HELD - c.power, 1 + Math.round(this.powerShare(c) * 2));
  c.power += got;
  this.msg(c, got > 1 ? `POWER UP x${got}!` : 'POWER UP!', 1.2, '#ff70ff');
  Sound.fx.powerup();
}

// Fires a held charge on the power key and keeps an active super power going.
export function usePower(c, inp, dt) {
  if (inp.power && c.power > 0 && c.superT <= 0 && !c.finished) {
    c.power--; c.superT = c.superMax = SUPER_T * (1 + this.powerShare(c));
    this.msg(c, 'SUPER POWER!', 1.2, '#ff70ff');
    Sound.fx.superboost();
  }
  if (c.superT <= 0) return;
  c.superT = Math.max(0, c.superT - dt);
  c.boostT = Math.max(c.boostT, c.superT); // lifts the speed caps and shows the boost flames
  c.immuneT = Math.max(c.immuneT, c.superT);
  c.slideT = 0;
  if (!c.air) c.speed = Math.min(c.speed + K.MAX_SPEED * SUPER_ACC * dt, c.spec.top * K.MAX_SPEED * 1.3);
}
