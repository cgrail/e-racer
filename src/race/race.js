import { K, U } from '../core/util.js';
import { Sound } from '../audio/sound.js';
import { CARSPEC, NO_INPUT, AI_SHOCKS, PICKUPS } from './specs.js';
import * as driving from './driving.js';
import * as ai from './ai.js';
import * as contact from './contact.js';
import * as energy from './energy.js';
import * as power from './power.js';
import * as shock from './shock.js';
import * as online from './online.js';

// One race (or time challenge stage) on a track: simulation of every car, hazards, laps and timing.
export class Race {
  // o: { track, mode: 'race'|'time', laps, humans: [driver], ai: [driver], diff, attract, energy, power, net }
  // net: 'server' or 'client' in an online race (see online.js)
  constructor(o) {
    this.track = o.track; this.mode = o.mode; this.attract = !!o.attract; this.net = o.net || null; this.outbox = [];
    this.laps = o.mode === 'time' ? 1 : o.laps || 3;
    this.L = this.track.length; this.diff = o.diff == null ? 1 : o.diff;
    this.cars = []; this.humans = [];
    this.time = 0; this.wtime = 0; this.wind = 0; this.flash = 0; this.nextBolt = 3; this.thunderT = 0;
    this.phase = this.attract ? 'race' : 'countdown'; this.count = 3.99; this.lastBeep = 9;
    this.over = false; this.doneT = 0;
    this.dyn = [];
    for (const s of this.track.segments) s.obs = s.obs.filter(ob => !PICKUPS.includes(ob.fx)); // any from a race before
    this.energy = !!o.energy && this.mode === 'race';
    if (this.energy) this.placeCells();
    this.power = !!o.power && this.mode === 'race';
    if (this.power) this.placeOrbs();
    this.shocks = this.mode === 'race'; // electro shocks are part of every race
    if (this.shocks) this.placeShocks();
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
    for (const c of this.cars) { // pickups: energy and flashes for every car, boosts for humans
      if (this.energy || this.power || this.shocks) c.taken = new Set();
      if (this.energy) { c.energy = 1; this.cellNeed(c, 0); }
      if (this.power && c.human) c.power = 0;
      if (this.shocks && (c.human || Math.random() < AI_SHOCKS[this.diff])) c.shock = 0;
    }
  }

  addCar(d, travel, x) {
    const c = {
      id: d.id, name: d.name, plate: d.plate || '', human: !!d.human, pidx: d.human ? d.pidx : -1, net: !!d.net, nets: null, netT: 0,
      model: d.model, color: d.color, spec: CARSPEC[d.model],
      travel, x, z: 0, prevZ: 0, speed: 0, pwr: 0, thr: 0, steer: 0, frame: 0, brake: false,
      crashT: 0, immuneT: 0, bumpT: 0, alt: 0, vy: 0, air: false, jumpY: 0, slideT: 0, boostT: 0, splashT: 0,
      offroad: false, skid: 0, rough: 0, lastObs: null, lastObsT: 0,
      finished: false, finishTime: 0, lap: 0, lapStart: 0, lastLap: 0, bestLap: 0, place: 0, bgOff: 0,
      aiTop: d.aiTop || 0.75, aiLane: x, autopilot: false,
      aiAggro: Math.random(), aiPhase: Math.random() * 6, aiLaneT: 1 + Math.random() * 3, aiFireT: 0, aiRun: 0, aiPrey: null,
      timeLeft: 0, cpNext: 0, outOfTime: false, msg: null, warnS: 99,
      energy: null, cellD: null, taken: null, flatT: 0, lowWarned: false, power: null, superT: 0, superMax: 0, shock: null, shockT: 0,
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
      if (c.net) this.drivePuppet(c, dt);
      else if (c.human && !c.autopilot) this.driveHuman(c, inputs[c.pidx] || NO_INPUT, dt, racing);
      else this.driveAI(c, dt, racing);
      if (c.shockT > 0) this.shocked(c, dt);
      if (this.energy) this.cellNeed(c, dt);
      if (!c.net) this.vertical(c, dt);
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

  progress(dt) {
    this.rank();
    if (this.phase !== 'race') return;
    for (const c of this.cars) {
      if (c.finished || c.net) continue; // a puppet's laps come with its state
      if (this.mode === 'race') {
        const lap = c.travel < 0 ? 0 : Math.floor(c.travel / this.L) + 1;
        if (lap > c.lap) {
          if (c.lap >= 1) {
            const lt = this.time - c.lapStart;
            c.lastLap = lt;
            if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
          }
          c.lapStart = this.time; c.lap = lap;
          if (c.taken) c.taken.clear();
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
    if (!this.attract && !this.net && !this.over && this.humans.every(h => h.finished || (h.outOfTime && h.speed < 60))) {
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
    if (c.human) {
      c.autopilot = true;
      if (this.mode === 'race') this.msg(c, 'FINISHED ' + U.ordinal(this.cars.filter(o => o.finished).length), 99, '#ffe040');
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
  // 0 for the leader up to 1 for the last car: the further back, the more the pickups help (energy.js, power.js).
  share(c) { return this.cars.length > 1 ? (c.place - 1) / (this.cars.length - 1) : 0; }
}

Object.assign(Race.prototype, driving, ai, contact, energy, power, shock, online);
