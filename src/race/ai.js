import { K, U } from '../core/util.js';
import { Art } from '../art/index.js';

// Race method for computer drivers: target speed, overtaking, hazard avoidance. Mixed into Race.
export function driveAI(c, dt, racing) {
  const T = this.track, MAX = K.MAX_SPEED, seg = T.findSegment(c.z);
  if (!racing) { c.speed = 0; return; }
  let target = c.human ? c.spec.top * MAX * 0.7 : c.aiTop * MAX;
  let maxC = 0;
  for (let n = 0; n < 14; n += 2) maxC = Math.max(maxC, Math.abs(T.segments[(seg.index + n) % T.N].curve));
  target *= 1 - Math.min(0.2, maxC * 0.03);
  if (this.mode === 'race' && this.humans.length && !c.finished && !c.human) {
    const lead = Math.max(...this.humans.map(h => h.travel));
    const d = (c.travel - lead) / this.L;
    if (d > 0.25) target *= 0.95; else if (d < -0.25) target *= 1.05;
  }
  if (c.finished && !c.human) target *= 0.85;
  if (c.speed < target) c.speed = Math.min(target, c.speed + MAX * 0.22 * (1.25 - c.speed / MAX) * dt);
  else c.speed = Math.max(target, c.speed - MAX * 0.5 * dt);

  // avoid slower cars and hazards ahead
  const halfW = K.CAR_W / 2 / T.roadW;
  let desired = c.aiLane, blocked = null, bd = 1e9;
  for (const o of this.cars) {
    if (o === c) continue;
    const dz = U.wrap(o.z - c.z, this.L);
    if (dz <= 0 || dz > 2400 || o.speed >= c.speed) continue;
    if (Math.abs(o.x - c.x) < halfW * 2.4 && dz < bd) { bd = dz; blocked = o; }
  }
  if (blocked) {
    const lx = blocked.x - halfW * 2.6, rx = blocked.x + halfW * 2.6;
    desired = (Math.abs(lx - c.x) < Math.abs(rx - c.x) && lx > -0.85) || rx > 0.85 ? lx : rx;
    if (bd < K.CAR_LEN * 1.4) c.speed = Math.min(c.speed, blocked.speed);
  }
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
  if (c.human) { c.thr = 0.5; c.rpm = 0.7; c.gear = 4; }
  this.advance(c, dt, seg);
  this.hits(c);
}
