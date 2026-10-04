import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';

// Race methods for the limited-energy option: battery drain, energy cells, running flat. Mixed into Race.
// Humans only. Cells are per player: each car tracks the ones it took this lap (c.taken), so they
// reappear for the other player and on the next lap.
const DRAIN = 1 / 38;  // per second at full rated power
const REGEN = 0.02;    // per second at full rated regen
const CELL = 0.14;     // energy from one cell
const CELL_GAP = 150;  // segments between cells
const LOW = 0.2;
const RECHARGE = 0.6;  // energy after running flat
const FLAT_T = 1.2;    // seconds without power after running flat

export function placeCells() {
  const T = this.track, rnd = U.rng(U.hash(T.code + 'energy')), d = Art.DEF.cell;
  for (const s of T.segments) s.obs = s.obs.filter(ob => ob.fx !== 'energy');
  for (let i = K.START_SEG + 40; i < T.N - 20; i += CELL_GAP) {
    const s = T.segments[i];
    if (s.obs.length) continue; // keep cells clear of hazards
    const x = (rnd() * 2 - 1) * 0.7;
    s.obs.push({ name: 'cell', v: 0, x, bx: x, ww: d.ww, hw: (d.hit * d.ww) / T.roadW / 2, fx: 'energy', hit: false, fly: null });
  }
}

// Returns the throttle the battery allows.
export function useEnergy(c, thr, brk, sp, dt) {
  if (c.finished) return thr;
  if (c.flatT > 0) { c.flatT -= dt; return 0; }
  c.energy += (c.pwr < 0 ? -c.pwr * REGEN : -c.pwr * DRAIN) * dt; // follows the kW meter
  c.energy = U.clamp(c.energy, 0, 1);
  if (c.energy < LOW && !c.lowWarned) { c.lowWarned = true; this.msg(c, 'LOW ENERGY', 1.5, '#ffb030'); Sound.fx.warn(); }
  if (c.energy <= 0) { this.runFlat(c); return 0; }
  return thr;
}

export function collectEnergy(c, ob) {
  c.taken.add(ob);
  c.energy = Math.min(1, c.energy + CELL);
  if (c.energy >= LOW) c.lowWarned = false;
  Sound.fx.charge();
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
  Sound.fx.timeout();
  this.rank();
}
