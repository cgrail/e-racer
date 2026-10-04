import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';
import { SHOCK_T, SHOCK_CAP, AI_ATTACK } from './specs.js';

// Race methods for the flash (electro shock), in every race. Humans and some rivals (AI_SHOCKS; the others use boosts) pick up a flash
// on the road (per car via c.taken, back every lap, like the orbs) and fire it at the car directly ahead,
// human or AI, which is held to SHOCK_CAP of its top speed for SHOCK_T seconds. Super power blocks it.
// A car holds one flash or one boost at a time (power.js), and the same key fires either.
// Like an energy cell, a pickup a rival collects is used up for a while (ob.takenAt), the longer the further ahead a car is.
const SHOCK_GAP = 450;     // segments between pickups (offset from the orbs)
const SHOCK_RANGE = 60000; // how far ahead a shock reaches, in world units

export function placeShocks() {
  const T = this.track, rnd = U.rng(U.hash(T.code + 'shock')), d = Art.DEF.shock;
  for (let i = K.START_SEG + 265; i < T.N - 20; i += SHOCK_GAP) {
    const k = this.freeSeg(i);
    if (k < 0) continue;
    const x = (rnd() * 2 - 1) * 0.75;
    T.segments[k].obs.push({ name: 'shock', v: 0, x, bx: x, ww: d.ww, hw: (d.hit * d.ww) / T.roadW / 2, fx: 'shock', hit: false, fly: null });
  }
}

export function collectShock(c, ob) {
  if (c.shock == null || this.holds(c)) return; // a rival that doesn't use shocks
  c.taken.add(ob);
  c.shock = 1; c.aiFireT = 1 + Math.random() * 3;
  if (!c.human) ob.takenAt = this.time;
  if (c.human) { this.msg(c, 'FLASH READY!', 1.2, '#60e0ff'); Sound.fx.powerup(); }
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

// Fires a held flash on the fire key. Without a car in range it is kept.
export function useShock(c, fire) {
  if (!fire || !c.shock || c.finished) return;
  const t = this.shockTarget(c);
  if (!t) { this.msg(c, 'NO CAR IN RANGE', 1, '#60e0ff'); return; }
  c.shock = 0;
  if (c.human || t.human) Sound.fx.zap();
  if (t.superT > 0) { this.msg(c, 'FLASH BLOCKED', 1.2, '#60e0ff'); return; }
  this.shockHit(t);
  this.msg(c, 'FLASH HIT!', 1.2, '#60e0ff');
}

// A shock lands on car t. A puppet's real car is driven elsewhere, so the hit goes out over the network too.
export function shockHit(t) {
  t.shockT = SHOCK_T;
  if (t.net) this.outbox.push(['shock', this.cars.indexOf(t)]);
  else if (t.human) this.msg(t, 'SHOCKED!', 1.5, '#60e0ff');
}

// Rivals hold a shock for a moment, then fire it once a car is close ahead, unless that car is shocked already.
// On Hard, with a player in the top three ahead of them, they save it for that player.
export function aiShock(c, dt) {
  if ((c.aiFireT -= dt) > 0) return;
  const t = this.shockTarget(c);
  if (!t || t.travel - c.travel > 5000 || t.shockT > 0) return;
  const save = AI_ATTACK[this.diff] && this.humans.some(h => h.place <= 3 && !h.finished && h.travel > c.travel);
  if (t.human || !save) this.useShock(c, true);
}

// Any car: while shocked its motor is held back, easing the speed down to the cap.
export function shocked(c, dt) {
  c.shockT = c.superT > 0 ? 0 : Math.max(0, c.shockT - dt);
  const cap = c.spec.top * K.MAX_SPEED * SHOCK_CAP;
  if (c.shockT > 0 && c.speed > cap) c.speed = Math.max(cap, c.speed - K.MAX_SPEED * 1.2 * dt);
}
