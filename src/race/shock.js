import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';
import { SHOCK_T, SHOCK_CAP } from './specs.js';

// Race methods for the electro shock, part of the power-up option. Humans pick up a shock charge on the
// road (per player via c.taken, back every lap, like the orbs) and fire it at the car directly ahead,
// human or AI, which is held to SHOCK_CAP of its top speed for SHOCK_T seconds. Super power blocks it.
const SHOCK_GAP = 450;     // segments between pickups (offset from the orbs and energy cells)
const SHOCK_RANGE = 60000; // how far ahead a shock reaches, in world units

export function placeShocks() {
  const T = this.track, rnd = U.rng(U.hash(T.code + 'shock')), d = Art.DEF.shock;
  for (const s of T.segments) s.obs = s.obs.filter(ob => ob.fx !== 'shock');
  for (let i = K.START_SEG + 265; i < T.N - 20; i += SHOCK_GAP) {
    const s = T.segments[i];
    if (s.obs.length) continue;
    const x = (rnd() * 2 - 1) * 0.75;
    s.obs.push({ name: 'shock', v: 0, x, bx: x, ww: d.ww, hw: (d.hit * d.ww) / T.roadW / 2, fx: 'shock', hit: false, fly: null });
  }
}

export function collectShock(c, ob) {
  c.taken.add(ob);
  if (c.shock) return;
  c.shock = 1;
  this.msg(c, 'SHOCK READY!', 1.2, '#60e0ff');
  Sound.fx.powerup();
}

// The nearest car ahead on the road that is still racing, within range.
export function shockTarget(c) {
  let best = null;
  for (const o of this.cars) {
    const d = o.travel - c.travel;
    if (o !== c && !o.finished && d > 0 && d < SHOCK_RANGE && (!best || o.travel < best.travel)) best = o;
  }
  return best;
}

// Fires the held charge on the shock key. Without a car in range the charge is kept.
export function useShock(c, inp) {
  if (!inp.shock || !c.shock || c.finished) return;
  const t = this.shockTarget(c);
  if (!t) { this.msg(c, 'NO CAR IN RANGE', 1, '#60e0ff'); return; }
  c.shock = 0;
  Sound.fx.zap();
  if (t.superT > 0) { this.msg(c, 'SHOCK BLOCKED', 1.2, '#60e0ff'); return; }
  t.shockT = SHOCK_T;
  this.msg(c, 'SHOCK HIT!', 1.2, '#60e0ff');
  if (t.human) this.msg(t, 'SHOCKED!', 1.5, '#60e0ff');
}

// Any car: while shocked its motor is held back, easing the speed down to the cap.
export function shocked(c, dt) {
  c.shockT = c.superT > 0 ? 0 : Math.max(0, c.shockT - dt);
  const cap = c.spec.top * K.MAX_SPEED * SHOCK_CAP;
  if (c.shockT > 0 && c.speed > cap) c.speed = Math.max(cap, c.speed - K.MAX_SPEED * 1.2 * dt);
}
