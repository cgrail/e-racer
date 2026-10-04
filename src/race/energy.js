import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';

// Race methods for limited energy: battery drain, energy cells, running flat. Mixed into Race.
// Every car, rivals included (they steer for cells when low). Cells show up by need: the further back a car is, the more
// of them are on its road (cellNeed, sees in contact.js). The leader gets one in TIERS, and has to take LEAD_NEED of those
// to keep going at full power; the last car gets them all, about five times what it needs. Each car tracks the cells it took
// this lap (c.taken), so they reappear for the other player and on the next lap. A cell a rival drives over is used up
// for a while (ob.takenAt, sees in contact.js), the longer the further ahead a car is: the pack ahead of the last car
// never leaves it short.
const DRAIN = 1 / 20;   // per second at full rated power
const REGEN = 0.02;     // per second at full rated regen
const AI_DRAIN = 0.45;  // rivals drive more frugally: they keep the front contested, the player has to fight for cells
const CELL_GAP = 36;    // segments between cells on the last car's road
const TIERS = 4;        // the leader gets one cell in TIERS
const LEAD_NEED = 0.85; // share of its cells the leader has to take at full power
const LOW = 0.2;
const RECHARGE = 0.6;   // energy after running flat
const FLAT_T = 1.2;     // seconds without power after running flat

// Cell j's tier in [0, 1), its bits reversed: the cells below any tier are spread evenly along the road.
function tier(j) {
  let t = 0;
  for (let b = 0.5; j; j >>= 1, b /= 2) if (j & 1) t += b;
  return t;
}

export function placeCells() {
  const T = this.track, rnd = U.rng(U.hash(T.code + 'energy')), d = Art.DEF.cell;
  for (let i = K.START_SEG + 40, j = 0; i < T.N - 20; i += CELL_GAP, j++) {
    const k = this.freeSeg(i);
    if (k < 0) continue;
    const x = (rnd() * 2 - 1) * 0.7;
    T.segments[k].obs.push({ name: 'cell', v: 0, x, bx: x, ww: d.ww, hw: (d.hit * d.ww) / T.roadW / 2, fx: 'energy', hit: false, fly: null, tier: tier(j) });
  }
}

// The first segment from i on, within a few, with nothing on the road: pickups keep clear of hazards and of each other.
export function freeSeg(i) {
  const T = this.track;
  for (let k = i; k < Math.min(i + 8, T.N - 20); k++) if (!T.segments[k].obs.length) return k;
  return -1;
}

// The share of cells on car c's road (c.cellD): those with a tier below it. It eases after the car's place,
// so cells don't blink in and out while two cars swap places.
export function cellNeed(c, dt) {
  const d = (1 + (TIERS - 1) * this.share(c)) / TIERS;
  c.cellD = c.cellD == null ? d : c.cellD + (d - c.cellD) * Math.min(1, dt * 0.5);
}

// Returns the throttle the battery allows.
export function useEnergy(c, thr, brk, sp, dt) {
  if (c.finished) return thr;
  if (c.flatT > 0) { c.flatT -= dt; return 0; }
  c.energy += (c.pwr < 0 ? -c.pwr * REGEN : -c.pwr * DRAIN * (c.human ? 1 : AI_DRAIN)) * dt; // follows the kW meter
  c.energy = U.clamp(c.energy, 0, 1);
  if (c.energy < LOW && !c.lowWarned) { c.lowWarned = true; this.msg(c, 'LOW ENERGY', 1.5, '#ffb030'); if (c.human) Sound.fx.warn(); }
  if (c.energy <= 0) { this.runFlat(c); return 0; }
  return thr;
}

export function collectEnergy(c, ob) {
  c.taken.add(ob);
  if (!c.human) ob.takenAt = this.time;
  // the leader's cells are TIERS * CELL_GAP apart: each gives what full power uses there at top speed, over LEAD_NEED
  const gapT = (TIERS * CELL_GAP * K.SEG_LEN) / (c.spec.top * K.MAX_SPEED);
  c.energy = Math.min(1, c.energy + (DRAIN * gapT) / LEAD_NEED);
  if (c.energy >= LOW) c.lowWarned = false;
  if (c.human) Sound.fx.charge();
}

// Out of energy: the car is put behind the last car on the road and recharged.
export function runFlat(c) {
  let last = null;
  for (const o of this.cars) if (o !== c && !o.finished && (!last || o.travel < last.travel)) last = o;
  if (last && last.travel - K.CAR_LEN * 2 < c.travel) {
    this.setTravel(c, last.travel - K.CAR_LEN * 2);
    c.prevZ = c.z;
    c.x = last.x > 0 ? -0.45 : 0.45;
    const lap = c.travel < 0 ? 0 : Math.floor(c.travel / this.L) + 1;
    if (lap < c.lap) c.lap = lap; // the lap line has to be crossed again
  }
  c.speed = 0; c.pwr = 0; c.flatT = FLAT_T; c.immuneT = FLAT_T + 1;
  c.air = false; c.vy = 0; c.alt = this.roadY(c.z); c.jumpY = 0;
  c.energy = RECHARGE; c.lowWarned = false; c.taken.clear();
  this.msg(c, 'OUT OF ENERGY!', 2.5, '#ff4040');
  if (c.human) Sound.fx.timeout();
  this.rank();
}
