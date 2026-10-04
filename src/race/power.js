import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';
import { SUPER_T } from './specs.js';

// Race methods for the boost: collectable orbs and the super power they charge. Mixed into Race.
// Players and the rivals that don't use flashes (shock.js). Like energy cells, orbs are per car (c.taken) and come
// back every lap; one a rival takes stays on the road for everyone else.
// One at a time: a car holds a boost or a flash (shock.js), never more, and one key fires whichever it holds.
// While it holds one, neither kind is on its road (sees in contact.js); once it fires, they are back.
// Catch-up: every place can take a boost, but it runs longer the further back the car is when it fires,
// from SUPER_T / 2 in the lead to 2 * SUPER_T in last place. Rivals save theirs for a player at the front (aiPower).
// Super power: fast acceleration past top speed, barriers are smashed aside, puddles and ice
// are ignored, roadside crashes are blocked and rivals get shoved out of the way.
const ORB_GAP = 450;   // segments between orbs (offset from the flashes)
const SUPER_ACC = 0.5; // extra acceleration, fraction of MAX_SPEED per second
const CHASE = 12000;   // a rival fires its boost at a player in the top three up to this far ahead

export function placeOrbs() {
  const T = this.track, rnd = U.rng(U.hash(T.code + 'power')), d = Art.DEF.orb;
  for (let i = K.START_SEG + 115; i < T.N - 20; i += ORB_GAP) {
    const k = this.freeSeg(i);
    if (k < 0) continue;
    const x = (rnd() * 2 - 1) * 0.75;
    T.segments[k].obs.push({ name: 'orb', v: 0, x, bx: x, ww: d.ww, hw: (d.hit * d.ww) / T.roadW / 2, fx: 'power', hit: false, fly: null });
  }
}

// Whether car c holds a boost or a flash.
export function holds(c) { return c.power > 0 || c.shock > 0; }

export function collectPower(c, ob) {
  if (c.power == null || this.holds(c)) return; // a rival that uses flashes, or a puppet (online.js)
  c.taken.add(ob);
  c.power = 1; c.aiFireT = 1 + Math.random() * 3;
  if (!c.human) return;
  this.msg(c, 'BOOST READY!', 1.2, '#ff70ff');
  Sound.fx.powerup();
}

// Fires a held boost on the fire key and keeps an active super power going.
export function usePower(c, fire, dt) {
  if (fire && c.power > 0 && c.superT <= 0 && !c.finished) {
    c.power = 0; c.superT = c.superMax = SUPER_T * (0.5 + 1.5 * this.share(c));
    if (c.human) { this.msg(c, 'BOOST!', 1.2, '#ff70ff'); Sound.fx.superboost(); }
  }
  if (c.superT <= 0) return;
  c.superT = Math.max(0, c.superT - dt);
  c.boostT = Math.max(c.boostT, c.superT); // lifts the speed caps and shows the boost flames
  c.immuneT = Math.max(c.immuneT, c.superT);
  c.slideT = 0;
  if (!c.air) c.speed = Math.min(c.speed + K.MAX_SPEED * SUPER_ACC * dt, c.spec.top * K.MAX_SPEED * 1.3);
}

// Whether rival c fires the boost it holds. It saves it to chase down a player at the front: after a moment, once one
// of the top three is close ahead, and not into a sharp bend (bend: the sharpest curve ahead).
export function aiPower(c, dt, bend) {
  if (!(c.power > 0) || (c.aiFireT -= dt) > 0 || bend > 3) return false;
  return this.humans.some(h => !h.finished && h.place <= 3 && h.travel > c.travel && h.travel - c.travel < CHASE);
}
