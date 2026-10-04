import { K, U } from '../core/util.js';
import { Art } from '../art/index.js';
import { MOTOR_BASE, REGEN_MAX } from './specs.js';

// Race methods for computer drivers: target speed, rubber band, racing line, drafting, overtaking, defending,
// pickups and hazard avoidance. Mixed into Race.
const BAND = [0.16, 0.12, 0.09]; // rubber-band strength by difficulty (easy, medium, hard)
const BAND_DEAD = 6000;          // world units around the humans where rivals race unaided
const BAND_RANGE = 50000;        // distance beyond the dead zone at which the full effect applies

// Speed factor that keeps the field together around the human players: rivals ahead of the
// leading human ease off, rivals behind the last human push harder. Races only.
export function rubberBand(c) {
  if (this.mode !== 'race') return 1;
  let front = -Infinity, back = Infinity;
  for (const h of this.humans) if (!h.finished) { front = Math.max(front, h.travel); back = Math.min(back, h.travel); }
  if (front === -Infinity) return 1;
  const ahead = c.travel - front - BAND_DEAD, behind = back - c.travel - BAND_DEAD;
  const pull = ahead > 0 ? -Math.min(1, ahead / BAND_RANGE) : behind > 0 ? Math.min(1, behind / BAND_RANGE) : 0;
  return 1 + BAND[this.diff] * pull;
}

// Rivals steer for an energy cell when their battery runs low, or for an electro shock when they can hold one.
export function aiPickup(c, seg) {
  const T = this.track, wantE = c.energy != null && c.energy < 0.55, wantS = c.shock === 0;
  if (!wantE && !wantS) return null;
  for (let n = 4; n < 36; n++) {
    for (const ob of T.segments[(seg.index + n) % T.N].obs) {
      if (((wantE && ob.fx === 'energy') || (wantS && ob.fx === 'shock')) && !c.taken.has(ob)) return ob.x;
    }
  }
  return null;
}

export function driveAI(c, dt, racing) {
  const T = this.track, MAX = K.MAX_SPEED, seg = T.findSegment(c.z);
  if (!racing) { c.speed = 0; return; }
  // rivals in a race drive actively; time-challenge traffic and finished cars just cruise
  const rival = !c.human && !c.finished && this.mode === 'race';
  let target = c.human ? c.spec.top * MAX * 0.7 : c.aiTop * MAX;
  let maxC = 0, turn = 0;
  for (let n = 0; n < 14; n += 2) {
    const cv = T.segments[(seg.index + n) % T.N].curve;
    if (Math.abs(cv) > maxC) { maxC = Math.abs(cv); turn = cv; }
  }
  target *= 1 - Math.min(0.2, maxC * 0.03);
  if (!c.finished && !c.human) target *= this.rubberBand(c);
  if (c.finished && !c.human) target *= 0.85;
  if (rival) target *= 1 + 0.03 * Math.sin(this.time * 0.35 + c.aiPhase); // pace ebbs and flows, so rivals swap places
  if (c.energy != null && !c.human && !this.useEnergy(c, 1, c.brake ? 1 : 0, c.speed / MAX, dt)) target = 0;

  // lane choice: rivals wander between lines and cut to the inside of bends
  if (rival && (c.aiLaneT -= dt) <= 0) { c.aiLaneT = 2 + Math.random() * 4; c.aiLane = (Math.random() * 2 - 1) * 0.7; }
  const halfW = K.CAR_W / 2 / T.roadW;
  let desired = rival ? U.lerp(c.aiLane, Math.sign(turn) * 0.65, Math.min(1, maxC / 4)) : c.aiLane;

  // cars ahead: draft behind them, and pull out to pass slower ones (rivals look further ahead)
  const look = rival ? 3000 + c.aiAggro * 2500 : 2400;
  let blocked = null, bd = 1e9, draft = false;
  for (const o of this.cars) {
    if (o === c) continue;
    const dz = U.wrap(o.z - c.z, this.L);
    if (dz <= 0 || dz > look || Math.abs(o.x - c.x) >= halfW * 2.4) continue;
    if (dz < 2500) draft = true;
    if (o.speed < c.speed + (rival ? 300 : 0) && dz < bd) { bd = dz; blocked = o; }
  }
  if (rival && draft) target *= 1.04;
  if (blocked) {
    const lx = blocked.x - halfW * 2.6, rx = blocked.x + halfW * 2.6;
    desired = (Math.abs(lx - c.x) < Math.abs(rx - c.x) && lx > -0.85) || rx > 0.85 ? lx : rx;
    if (bd < K.CAR_LEN * 1.4) c.speed = Math.min(c.speed, blocked.speed);
  } else if (rival) {
    const want = this.aiPickup(c, seg);
    if (want != null) desired = want;
    else if (c.aiAggro > 0.6) { // defend: drift across in front of a human close behind, unless clearly slower
      for (const h of this.humans) {
        const dz = U.wrap(c.z - h.z, this.L);
        if (!h.finished && dz > 0 && dz < 2000 && h.speed < c.speed * 1.1) desired = U.lerp(desired, h.x, ((c.aiAggro - 0.6) / 0.4) * 0.35);
      }
    }
  }
  if (rival) { // mirrors: never swerve into a car alongside or closing from behind in the next lane
    for (const o of this.cars) {
      if (o === c) continue;
      const dz = U.wrap(o.z - c.z + this.L / 2, this.L) - this.L / 2, gap = halfW * 2.6;
      const closing = o.speed - c.speed; // a car behind matters if it arrives within about a second
      if (dz > K.CAR_LEN || (dz < -K.CAR_LEN && (closing <= 0 || -dz > closing * 1.2)) || Math.abs(o.x - c.x) < halfW * 2.4) continue;
      desired = o.x > c.x ? Math.min(desired, o.x - gap) : Math.max(desired, o.x + gap);
    }
  }
  if (rival && c.shock) this.aiShock(c, dt);
  if (c.speed < target) c.speed = Math.min(target, c.speed + MAX * 0.22 * (1.25 - c.speed / MAX) * dt);
  else c.speed = Math.max(target, c.speed - MAX * 0.5 * dt);

  for (let n = 1; n < 18; n++) {
    for (const ob of T.segments[(seg.index + n) % T.N].obs) {
      if (ob.gone || !Art.DEF[ob.name].avoid) continue;
      if (Math.abs(ob.x - desired) < ob.hw + halfW + 0.12) desired = ob.x + (ob.x > 0 ? -1 : 1) * (ob.hw + halfW + 0.2);
    }
  }
  desired = U.clamp(desired, -0.85, 0.85);
  const mv = U.clamp(desired - c.x, -1.1 * dt, 1.1 * dt);
  c.x = U.clamp(c.x + mv, -1, 1);
  const lean = Math.abs(mv) > 0.004 ? mv * 150 : seg.curve / 2.5;
  c.frame = Math.sign(lean) * (Math.abs(lean) > 1.6 ? 2 : Math.abs(lean) > 0.8 ? 1 : 0);
  c.brake = c.speed > target + 50;
  c.offroad = false; c.skid = 0; c.rough = 0;
  if (c.human) { c.thr = 0.5; c.pwr = 0.4; } else { // power drawn: full band accelerating, regen braking, part load cruising
    const st = c.speed / (c.spec.top * MAX), band = Math.min(1, st / MOTOR_BASE);
    c.pwr = c.speed < target - 50 ? band : c.brake ? -REGEN_MAX * band * 0.5 : 0.55 * st;
  }
  this.advance(c, dt, seg);
  this.hits(c);
}
