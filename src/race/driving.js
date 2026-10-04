import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { MOTOR_ACC, MOTOR_BASE, REGEN_MAX } from './specs.js';

// Race methods for human driving: steering, electric drive, speed, ballistic jumps. Mixed into Race.
export function driveHuman(c, inp, dt, racing) {
  const T = this.track, MAX = K.MAX_SPEED, seg = T.findSegment(c.z), sp = c.speed / MAX;
  let thr = inp.throttle, brk = inp.brake;
  const rate = inp.analog ? 14 : 7;
  c.steer += U.clamp(inp.steer - c.steer, -rate * dt, rate * dt);
  c.frame = Math.sign(c.steer) * (Math.abs(c.steer) > 0.75 ? 2 : Math.abs(c.steer) > 0.3 ? 1 : 0);
  if (!racing) { // waiting on the grid: the motor draws nothing at standstill
    c.pwr = 0; c.thr = thr; c.brake = brk > 0;
    return;
  }
  if (c.crashT > 0) { c.crashT -= dt; thr = 0; }
  if (c.outOfTime) { thr = 0; brk = Math.max(brk, 0.3); }
  if (c.energy != null) thr = this.useEnergy(c, thr, brk, sp, dt);
  if (c.power != null) this.usePower(c, inp, dt);
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

  const top = c.spec.top * MAX, st = c.speed / top;
  const band = Math.min(1, st / MOTOR_BASE); // share of rated power the motor can deliver at this speed
  if (!air) {
    if (thr > 0) {
      const torque = (st < MOTOR_BASE ? 1 : MOTOR_BASE / st) * U.clamp((1 - st) * 20, 0, 1);
      c.speed += MAX * 0.24 * c.spec.acc * MOTOR_ACC * torque * thr * dt;
    } else c.speed -= MAX * (0.1 + sp * 0.08) * dt;
    if (brk > 0) c.speed -= MAX * 0.95 * brk * dt;
    c.offroad = Math.abs(c.x) > 1;
    if (c.offroad && c.speed > MAX * 0.3) c.speed -= MAX * 0.8 * dt;
    c.speed -= ((seg.p2.world.y - seg.p1.world.y) / K.SEG_LEN) * MAX * 0.25 * dt;
  }
  if (c.boostT <= 0 && c.speed > top) c.speed = Math.max(top, c.speed - MAX * 0.6 * dt);
  c.speed = U.clamp(c.speed, 0, top * 1.3);

  // power draw as a share of rated kW: positive drives, negative is regen braking or coasting
  const draw = thr > 0 ? thr * Math.max(0.05, band) * (air ? 0.3 : 1) : -(brk > 0 ? REGEN_MAX * brk : 0.08) * band;
  c.pwr += (draw - c.pwr) * Math.min(1, dt * 8);

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
