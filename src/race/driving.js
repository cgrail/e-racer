import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { GEAR_TOP, GEAR_ACC } from './specs.js';

// Race methods for human driving: steering, gearbox, speed, ballistic jumps. Mixed into Race.
export function driveHuman(c, inp, dt, racing) {
  const T = this.track, MAX = K.MAX_SPEED, seg = T.findSegment(c.z), sp = c.speed / MAX;
  let thr = inp.throttle, brk = inp.brake;
  const rate = inp.analog ? 14 : 7;
  c.steer += U.clamp(inp.steer - c.steer, -rate * dt, rate * dt);
  c.frame = Math.sign(c.steer) * (Math.abs(c.steer) > 0.75 ? 2 : Math.abs(c.steer) > 0.3 ? 1 : 0);
  if (!racing) { // revving on the grid
    c.rpm += ((thr ? 0.95 : 0.12) - c.rpm) * Math.min(1, dt * (thr ? 3 : 2));
    c.thr = thr; c.brake = brk > 0;
    return;
  }
  if (c.crashT > 0) { c.crashT -= dt; thr = 0; }
  if (c.outOfTime) { thr = 0; brk = Math.max(brk, 0.3); }
  c.immuneT = Math.max(0, c.immuneT - dt); c.bumpT = Math.max(0, c.bumpT - dt);
  c.slideT = Math.max(0, c.slideT - dt); c.boostT = Math.max(0, c.boostT - dt); c.splashT = Math.max(0, c.splashT - dt);
  const grip = c.spec.grip * T.theme.grip * (c.slideT > 0 ? 0.45 : 1);
  const air = c.air;

  if (!air) {
    const dx = dt * 2 * Math.min(1, sp * 1.6);
    c.x += dx * c.steer * (c.slideT > 0 ? 0.6 : 1);
    c.x -= (dt * 2 * sp * sp * seg.curve * 0.32) / grip;
    if (c.slideT > 0) c.x += Math.sin(this.time * 7 + c.pidx * 3) * dt * 0.6 * sp;
  }
  c.x += this.wind * dt * (0.25 + 0.6 * sp);

  if (c.manual) {
    if (inp.gearUp && c.gear < 5) { c.gear++; Sound.fx.gear(); }
    if (inp.gearDown && c.gear > 1) { c.gear--; Sound.fx.gear(); }
  }
  const top = c.spec.top * MAX;
  let gTop = top * GEAR_TOP[c.gear - 1];
  let rpm = c.speed / gTop;
  if (!air) {
    if (thr > 0) {
      if (rpm < 1) {
        const torque = 0.6 + 0.55 * Math.sin(Math.min(1, rpm) * Math.PI * 0.85);
        c.speed += MAX * 0.24 * c.spec.acc * GEAR_ACC[c.gear - 1] * torque * thr * dt;
      }
    } else c.speed -= MAX * (0.1 + sp * 0.08) * dt;
    if (brk > 0) c.speed -= MAX * 0.95 * brk * dt;
    if (c.boostT <= 0 && c.speed > gTop * 1.02) c.speed = Math.max(gTop * 1.02, c.speed - MAX * 0.5 * dt);
    c.offroad = Math.abs(c.x) > 1;
    if (c.offroad && c.speed > MAX * 0.3) c.speed -= MAX * 0.8 * dt;
    c.speed -= ((seg.p2.world.y - seg.p1.world.y) / K.SEG_LEN) * MAX * 0.25 * dt;
  }
  if (c.boostT <= 0 && c.speed > top) c.speed = Math.max(top, c.speed - MAX * 0.6 * dt);
  c.speed = U.clamp(c.speed, 0, top * 1.3);

  if (!c.manual) {
    if (c.speed / gTop > 0.96 && c.gear < 5 && thr > 0) c.gear++;
    else if (c.gear > 1 && c.speed < top * GEAR_TOP[c.gear - 2] * 0.6) c.gear--;
    gTop = top * GEAR_TOP[c.gear - 1];
  }
  rpm = c.speed / gTop;
  c.rpm = rpm >= 1 ? 1 + Math.sin(this.time * 60) * 0.02 : Math.max(0.12, rpm);
  if (air && thr) c.rpm = Math.min(1.02, c.rpm + 0.3);

  const cf = (Math.abs(seg.curve) * sp * sp) / grip;
  c.skid = air ? 0 : U.clamp(Math.max((cf - 1.8) / 2, brk > 0 && sp > 0.35 ? 0.5 : 0, c.slideT > 0 ? sp : 0), 0, 1);
  c.rough = c.offroad && !air ? Math.min(1, sp * 2) : 0;
  c.thr = thr; c.brake = brk > 0;
  c.x = U.clamp(c.x, -3.2, 3.2);
  this.advance(c, dt, seg);
  this.hits(c);
}

export function advance(c, dt, seg) {
  c.prevZ = c.z;
  this.setTravel(c, c.travel + c.speed * dt);
  c.bgOff += (seg.curve * c.speed * dt) / K.SEG_LEN;
}

// Ballistic vertical motion: cars leave the ground over sharp crests and ramps.
export function slope(z) {
  const s = this.track.findSegment(z);
  return (s.p2.world.y - s.p1.world.y) / K.SEG_LEN;
}
export function vertical(c, dt) {
  const ry = this.roadY(c.z);
  if (!c.air) {
    if (this.phase === 'race' && c.speed > K.MAX_SPEED * 0.45) {
      const bend = (this.slope(c.z + 400) - this.slope(c.z - 400)) / 800;
      if (bend * c.speed * c.speed < -K.GRAVITY) { c.air = true; c.vy = this.slope(c.z) * c.speed; }
    }
    if (!c.air) { c.alt = ry; c.vy = 0; }
  }
  if (c.air) {
    c.vy -= K.GRAVITY * dt; c.alt += c.vy * dt;
    if (c.alt <= ry) {
      if (c.jumpY > 150 && c.human) Sound.fx.land();
      c.alt = ry; c.air = false; c.vy = 0;
    }
  }
  c.jumpY = Math.max(0, c.alt - ry);
}
