'use strict';

const CARSPEC = {
  esprit: { name: 'ESPRIT TURBO SE', short: 'ESPRIT', top: 0.92, acc: 1.0, grip: 1.0 },
  elan: { name: 'ELAN SE', short: 'ELAN', top: 0.86, acc: 1.2, grip: 1.2 },
  m200: { name: 'M200 CONCEPT', short: 'M200', top: 0.98, acc: 0.9, grip: 0.84 },
};
const MODELS = ['esprit', 'elan', 'm200'];
const GEAR_TOP = [0.3, 0.48, 0.66, 0.83, 1.0];
const GEAR_ACC = [1.6, 1.32, 1.1, 0.9, 0.72];
const CAR_COLORS = ['#d81e1e', '#1e5ad8', '#f0d020', '#f2f2f2', '#22a040', '#26262a', '#a8b0b8', '#f07818', '#8a2be2', '#20c0d0'];
const NO_INPUT = { throttle: 0, brake: 0, steer: 0, analog: false, gearUp: false, gearDown: false };

// One race (or time challenge stage) on a track: simulation of every car, hazards, laps and timing.
class Race {
  // o: { track, mode: 'race'|'time', laps, humans: [driver], ai: [driver], diff, attract }
  constructor(o) {
    this.track = o.track; this.mode = o.mode; this.attract = !!o.attract;
    this.laps = o.mode === 'time' ? 1 : o.laps || 3;
    this.L = this.track.length; this.diff = o.diff == null ? 1 : o.diff;
    this.cars = []; this.humans = [];
    this.time = 0; this.wtime = 0; this.wind = 0; this.flash = 0; this.nextBolt = 3; this.thunderT = 0;
    this.phase = this.attract ? 'race' : 'countdown'; this.count = 3.99; this.lastBeep = 9;
    this.over = false; this.doneT = 0; this.finishOrder = [];
    this.dyn = [];
    for (const s of this.track.segments) for (const ob of s.obs) {
      ob.hit = false; ob.fly = null; ob.gone = false; ob.x = ob.bx;
      if (ob.moving) this.dyn.push(ob);
    }

    if (this.mode === 'race') {
      const grid = (o.ai || []).concat(o.humans);
      grid.forEach((d, k) => {
        const row = Math.floor(k / 2), col = k % 2;
        this.addCar(d, -K.CAR_LEN - row * 900 - col * 450, col ? 0.42 : -0.42);
      });
    } else {
      o.humans.forEach((d, k) => this.addCar(d, -600, o.humans.length > 1 ? (k ? 0.42 : -0.42) : 0));
      const ai = o.ai || [];
      ai.forEach((d, k) => this.addCar(d, 3000 + (k * this.L * 0.85) / ai.length, ((k * 0.37) % 1) * 1.4 - 0.7));
      // time allowance per leg, scaled by difficulty
      const marks = [0].concat(this.track.cps, [this.L]);
      const pace = [0.66, 0.74, 0.82][this.diff] * K.MAX_SPEED;
      this.legTime = [];
      for (let i = 1; i < marks.length; i++) this.legTime.push((marks[i] - marks[i - 1]) / pace + (i === 1 ? 4 : 1));
      for (const h of this.humans) h.timeLeft = this.legTime[0];
    }
    this.rank();
  }

  addCar(d, travel, x) {
    const c = {
      id: d.id, name: d.name, human: !!d.human, pidx: d.human ? d.pidx : -1,
      model: d.model, color: d.color, spec: CARSPEC[d.model], manual: !!d.manual,
      travel, x, z: 0, prevZ: 0, speed: 0, gear: 1, rpm: 0.1, thr: 0, steer: 0, frame: 0, brake: false,
      crashT: 0, immuneT: 0, bumpT: 0, alt: 0, vy: 0, air: false, jumpY: 0, slideT: 0, boostT: 0, splashT: 0,
      offroad: false, skid: 0, rough: 0, lastObs: null, lastObsT: 0,
      finished: false, finishTime: 0, lap: 0, lapStart: 0, lastLap: 0, bestLap: 0, place: 0, bgOff: 0,
      aiTop: d.aiTop || 0.75, aiLane: x, autopilot: false,
      timeLeft: 0, cpNext: 0, outOfTime: false, msg: null, warnS: 99,
    };
    c.z = U.wrap(this.track.startZ + travel, this.L); c.prevZ = c.z; c.alt = this.roadY(c.z);
    this.cars.push(c);
    if (c.human) this.humans.push(c);
    return c;
  }

  roadY(z) {
    const s = this.track.findSegment(z), p = (U.wrap(z, this.L) % K.SEG_LEN) / K.SEG_LEN;
    return U.lerp(s.p1.world.y, s.p2.world.y, p);
  }
  msg(c, text, t = 1.5, col = '#ffffff') { c.msg = { text, t, col }; }
  setTravel(c, travel) { c.travel = travel; c.z = U.wrap(this.track.startZ + travel, this.L); }

  update(dt, inputs) {
    const th = this.track.theme;
    this.wtime += dt;
    if (th.wind) this.wind = th.wind * (Math.sin(this.wtime * 0.37) * 0.75 + Math.sin(this.wtime * 1.13 + 1.7) * 0.35);
    if (th.lightning) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = 4 + Math.random() * 8; this.thunderT = 0.3 + Math.random() * 0.8; }
      this.flash = Math.max(0, this.flash - dt * 2.5);
      if (this.thunderT > 0 && (this.thunderT -= dt) <= 0 && !this.attract) Sound.fx.thunder();
    }
    if (this.phase === 'countdown') {
      this.count -= dt;
      const c = Math.ceil(this.count);
      if (c !== this.lastBeep && c >= 1 && c <= 3) { this.lastBeep = c; Sound.fx.beep(); }
      if (this.count <= 0) {
        this.phase = 'race'; Sound.fx.go();
        for (const h of this.humans) this.msg(h, 'GO!', 1.2, '#60ff60');
      }
    } else if (!this.over) this.time += dt;

    const racing = this.phase === 'race';
    for (const c of this.cars) {
      if (c.msg && (c.msg.t -= dt) <= 0) c.msg = null;
      if (c.human && !c.autopilot) this.driveHuman(c, inputs[c.pidx] || NO_INPUT, dt, racing);
      else this.driveAI(c, dt, racing);
      this.vertical(c, dt);
    }
    if (racing) this.collide();
    for (const ob of this.dyn) {
      if (ob.moving && !ob.hit) ob.x = ob.bx + Math.sin(this.wtime * ob.sp + ob.ph) * 0.8;
      if (ob.fly) {
        const f = ob.fly;
        f.t += dt; ob.x += f.vx * dt; f.y = f.vy * f.t - 3000 * f.t * f.t;
        if (f.t > 1.5) { ob.gone = true; ob.fly = null; }
      }
    }
    this.progress(dt);
  }

  driveHuman(c, inp, dt, racing) {
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

  driveAI(c, dt, racing) {
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

  advance(c, dt, seg) {
    c.prevZ = c.z;
    this.setTravel(c, c.travel + c.speed * dt);
    c.bgOff += (seg.curve * c.speed * dt) / K.SEG_LEN;
  }

  // Ballistic vertical motion: cars leave the ground over sharp crests and ramps.
  slope(z) {
    const s = this.track.findSegment(z);
    return (s.p2.world.y - s.p1.world.y) / K.SEG_LEN;
  }
  vertical(c, dt) {
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

  hits(c) {
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

  hitObstacle(c, ob, halfW) {
    const fx = ob.fx, MAX = K.MAX_SPEED;
    if (fx === 'jump') {
      if (!c.air && c.speed > MAX * 0.2) {
        c.air = true; c.vy = 5000 + (c.speed / MAX) * 6000;
        if (c.human) Sound.fx.jump();
      }
      return;
    }
    if (c.air) return;
    if (fx === 'soft') {
      ob.fly = { t: 0, y: 0, vx: (ob.x >= c.x ? 1 : -1) * (0.8 + Math.random()), vy: 1500 + c.speed * 0.15 };
      ob.hit = true; this.dyn.push(ob);
      c.speed *= c.human ? 0.88 : 0.95;
      if (c.human) Sound.fx.cone();
      return;
    }
    if (!c.human) return;
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

  crash(c) {
    if (c.immuneT > 0) return;
    c.speed *= 0.05; c.crashT = 0.9; c.immuneT = 1.6; c.gear = 1;
    c.air = true; c.vy = 4000;
    Sound.fx.crash();
  }

  collide() {
    const halfW = K.CAR_W / 2 / this.track.roadW;
    for (const h of this.humans) {
      for (const o of this.cars) {
        if (o === h || (o.human && o.pidx < h.pidx)) continue;
        const dz = U.wrap(o.z - h.z + this.L / 2, this.L) - this.L / 2;
        if (Math.abs(dz) > K.CAR_LEN || Math.abs(o.x - h.x) > halfW * 1.8 || h.jumpY > 200 || o.jumpY > 200) continue;
        const [back, front] = dz > 0 ? [h, o] : [o, h];
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

  progress(dt) {
    this.rank();
    if (this.phase !== 'race') return;
    for (const c of this.cars) {
      if (c.finished) continue;
      if (this.mode === 'race') {
        const lap = c.travel < 0 ? 0 : Math.floor(c.travel / this.L) + 1;
        if (lap > c.lap) {
          if (c.lap >= 1) {
            const lt = this.time - c.lapStart;
            c.lastLap = lt;
            if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
          }
          c.lapStart = this.time; c.lap = lap;
          if (lap > this.laps && !this.attract) { this.finish(c); continue; }
          if (c.human && lap > 1) {
            if (lap === this.laps) this.msg(c, 'FINAL LAP', 2, '#ffe040');
            else this.msg(c, 'LAP ' + lap, 1.5);
            Sound.fx.lap();
          }
        }
      } else if (c.human) {
        if (c.lap === 0 && c.travel >= 0) { c.lap = 1; c.lapStart = this.time; }
        if (!c.outOfTime) {
          c.timeLeft -= dt;
          const s = Math.ceil(c.timeLeft);
          if (s <= 5 && s !== c.warnS && s > 0) { c.warnS = s; Sound.fx.warn(); }
        }
        while (c.cpNext < this.track.cps.length && c.travel >= this.track.cps[c.cpNext]) {
          const bonus = this.legTime[c.cpNext + 1];
          c.timeLeft += bonus; c.cpNext++;
          this.msg(c, 'EXTENDED +' + Math.round(bonus), 2, '#60ff60');
          Sound.fx.checkpoint();
        }
        if (c.travel >= this.L) this.finish(c);
        else if (c.timeLeft <= 0 && !c.outOfTime) {
          c.timeLeft = 0; c.outOfTime = true;
          this.msg(c, 'OUT OF TIME', 99, '#ff4040'); Sound.fx.timeout();
        }
      }
    }
    if (!this.attract && !this.over && this.humans.every(h => h.finished || (h.outOfTime && h.speed < 60))) {
      this.doneT += dt;
      if (this.doneT > 3.5) this.over = true;
    }
  }

  finish(c) {
    c.finished = true; c.finishTime = this.time;
    if (c.lap >= 1 && this.mode === 'time') {
      const lt = this.time - c.lapStart;
      c.lastLap = lt; c.bestLap = lt;
    }
    this.finishOrder.push(c);
    if (c.human) {
      c.autopilot = true;
      if (this.mode === 'race') this.msg(c, 'FINISHED ' + U.ordinal(this.finishOrder.length), 99, '#ffe040');
      else this.msg(c, 'STAGE COMPLETE', 99, '#60ff60');
      Sound.fx.finish();
    }
  }

  // Classification: finishers in order, then the rest by distance covered.
  results() {
    return this.cars.slice().sort((a, b) =>
      (b.finished - a.finished) || (a.finished ? a.finishTime - b.finishTime : b.travel - a.travel));
  }
  rank() { this.results().forEach((c, i) => { c.place = i + 1; }); }
}
