import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { PICKUPS } from './specs.js';

const BACK = 6; // seconds until a pickup a rival took is back for the leader

// Race methods for contact: hazards, roadside crashes and car-to-car bumps. Mixed into Race.
export function hits(c) {
  const T = this.track, halfW = K.CAR_W / 2 / T.roadW;
  let i0 = Math.floor(c.prevZ / K.SEG_LEN), i1 = Math.floor(c.z / K.SEG_LEN);
  if (i1 < i0) i1 += T.N;
  for (let i = i0; i <= i1; i++) {
    const s = T.segments[i % T.N];
    for (const ob of s.obs) {
      if (ob.gone || ob.fly || (ob === c.lastObs && this.time - c.lastObsT < 1.5)) continue;
      if (Math.abs(c.x - ob.x) < halfW + ob.hw) this.hitObstacle(c, ob, halfW);
    }
    if (c.human && Math.abs(c.x) > 0.9 && c.immuneT <= 0 && !c.air) {
      for (const sp of s.sprites) {
        if (!sp.solid) continue;
        if (Math.abs(c.x - sp.hx) < halfW * 0.8 + sp.hw) {
          this.crash(c);
          c.x = sp.hx - Math.sign(sp.hx) * (sp.hw + halfW * 0.8 + 0.05);
          break;
        }
      }
    }
  }
}

export function hitObstacle(c, ob, halfW) {
  const fx = ob.fx, MAX = K.MAX_SPEED;
  if (fx === 'jump') {
    if (!c.air && c.speed > MAX * 0.2) {
      c.air = true; c.vy = 5000 + (c.speed / MAX) * 6000;
      if (c.human) Sound.fx.jump();
    }
    return;
  }
  if (PICKUPS.includes(fx)) {
    if (c.taken && !c.taken.has(ob) && this.sees(c, ob)) {
      if (fx === 'energy') this.collectEnergy(c, ob); else if (fx === 'power') this.collectPower(c, ob); else this.collectShock(c, ob);
    }
    return;
  }
  if (c.air) return;
  const smash = c.superT > 0 && fx === 'crash'; // super power knocks barriers flying like cones
  if (fx === 'soft' || smash) {
    ob.fly = { t: 0, y: 0, vx: (ob.x >= c.x ? 1 : -1) * (0.8 + Math.random()), vy: 1500 + c.speed * 0.15 };
    ob.hit = true; this.dyn.push(ob);
    if (!smash) c.speed *= c.human ? 0.88 : 0.95;
    if (c.human) (smash ? Sound.fx.bump : Sound.fx.cone)();
    return;
  }
  if (!c.human || (c.superT > 0 && fx !== 'boost')) return;
  c.lastObs = ob; c.lastObsT = this.time;
  if (fx === 'crash') {
    this.crash(c);
    c.x = ob.x + (c.x >= ob.x ? 1 : -1) * (ob.hw + halfW + 0.03);
  } else if (fx === 'splash') {
    c.speed *= 0.85; c.slideT = Math.max(c.slideT, 0.5); c.splashT = 0.7; Sound.fx.splash();
  } else if (fx === 'ice') {
    c.slideT = 1.6;
  } else if (fx === 'boost') {
    c.speed = Math.min(c.speed + MAX * 0.3, c.spec.top * MAX * 1.3); c.boostT = 2; Sound.fx.boost();
  }
}

// Whether pickup ob is on car c's road: cells by its place (cellNeed in energy.js), boosts and flashes
// while it holds neither (power.js). One a rival took is gone for up to BACK seconds: that long for the leader,
// less the further back a car is, and not at all for the last. Anything else on the road is there for every car.
export function sees(c, ob) {
  if (ob.takenAt != null && this.time - ob.takenAt < BACK * (1 - this.share(c))) return false;
  if (ob.fx === 'energy') return ob.tier < c.cellD;
  return (ob.fx !== 'power' && ob.fx !== 'shock') || !this.holds(c);
}

export function crash(c) {
  if (c.immuneT > 0) return;
  c.speed *= 0.05; c.crashT = 0.9; c.immuneT = 1.6;
  c.air = true; c.vy = 4000;
  Sound.fx.crash();
}

export function collide() {
  const halfW = K.CAR_W / 2 / this.track.roadW;
  for (const h of this.humans) {
    for (const o of this.cars) {
      if (o === h || (o.human && o.pidx < h.pidx)) continue;
      const dz = U.wrap(o.z - h.z + this.L / 2, this.L) - this.L / 2;
      if (Math.abs(dz) > K.CAR_LEN || Math.abs(o.x - h.x) > halfW * 1.8 || h.jumpY > 200 || o.jumpY > 200) continue;
      const [back, front] = dz > 0 ? [h, o] : [o, h];
      if (back.superT > 0 && back.speed > front.speed) { // super power shoves the other car aside
        front.x += (Math.sign(front.x - back.x) || 1) * 0.3; front.speed *= 0.85;
        if (h.bumpT <= 0) { Sound.fx.bump(); h.bumpT = 0.35; }
        continue;
      }
      if (back.speed > front.speed) {
        const v = back.speed;
        back.speed = front.speed * 0.85;
        if (!front.human || front.speed < v) front.speed = Math.min(front.speed + (v - front.speed) * 0.3, K.MAX_SPEED * front.spec.top);
        this.setTravel(back, back.travel - (K.CAR_LEN - Math.abs(dz)) * 0.5);
      }
      const side = Math.sign(h.x - o.x) || 1;
      h.x += side * 0.04;
      o.x -= side * (o.human ? 0.04 : 0.02);
      if (h.bumpT <= 0) { Sound.fx.bump(); h.bumpT = 0.35; }
    }
  }
}
