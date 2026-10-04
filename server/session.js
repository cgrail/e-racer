import { K, U } from '../src/core/util.js';
import { THEMES } from '../src/world/themes.js';
import { Track } from '../src/world/track.js';
import { Race } from '../src/race/race.js';
import { MODELS, CAR_COLORS, AI_NAMES, AI_RANGE, POINTS, lapsFor } from '../src/race/specs.js';

// The online session: races run back to back on one course after another, for whoever is online. The player who
// starts it sets the level. A player who comes later takes over the last
// rival on the road, mid-race; a player who leaves hands the car back to a rival. The server drives the rivals
// and referees: the race clock, the end of a race, the results, the session's points table and the next course.
// Each player's browser drives that player's car and reports it (see src/race/online.js).
export const CARS = 20;
const COUNTDOWN = 5.99; // seconds on the grid before GO, so everyone has the course built (the lights show the last 3)
const LAST_CALL = 60;   // seconds the field has after the winner crosses the line
const RESULTS_T = 12;   // seconds of results before the next race
const SNAP_T = 0.05;    // snapshots, 20 a second

// A car's state as a browser reports it, kept within what the game can produce.
function clean(s, r) {
  if (!Array.isArray(s) || s.length !== 8 || !s.every(Number.isFinite)) return null;
  const [travel, x, speed, frame, flags, jumpY, lap, fin] = s;
  return [U.clamp(travel, -50000, r.L * (r.laps + 1)), U.clamp(x, -3.2, 3.2), U.clamp(speed, 0, K.MAX_SPEED * 1.5),
    U.clamp(Math.round(frame), -2, 2), flags & 15, U.clamp(jumpY, 0, 5000), U.clamp(lap | 0, 0, r.laps + 1), Math.max(0, fin)];
}

export class Session {
  // opts: { diff } as the starting player has it set
  constructor(opts) {
    this.diff = U.clamp(opts.diff | 0, 0, 2);
    this.players = new Set(); this.seats = 0; this.races = 0; this.id = 0;
    this.order = U.shuffle(Math.random, THEMES.map((_, i) => i)); // every scenery once before any comes back
    this.race = null; this.state = 'race'; this.acc = 0; this.snapT = 0; this.wait = 0; this.doneT = 0; this.lastT = 0;
  }
  get empty() { return !this.players.size; }

  // p: { name, model, send(obj) }; gets a seat number, session points and, once racing, a car.
  add(p) {
    p.name = this.uniqueName(p.name); p.seat = ++this.seats; p.car = null; p.points = 0; p.last = 0;
    this.players.add(p);
    if (!this.race) this.newRace();
    else if (this.state === 'race' && this.takeOver(p)) this.sendRace(p);
    else p.send({ type: 'wait', next: this.state === 'results' ? Math.ceil(this.wait) : 0 });
  }
  remove(p) {
    this.players.delete(p);
    const c = p.car;
    p.car = null;
    if (!c || this.state !== 'race') return; // after the finish the results keep their name
    const used = new Set(this.race.cars.map(o => o.name));
    this.race.setDriver(c, { name: AI_NAMES.find(n => !used.has(n)) || 'RIVAL', model: c.model, color: c.color }, false);
    this.seatChanged(c);
  }
  uniqueName(name) {
    const taken = new Set([...this.players].map(o => o.name));
    for (let n = 2; taken.has(name); n++) name = name.replace(/\d*$/, '').slice(0, 6 - String(n).length) + n;
    return name;
  }
  driver(p) { return { name: p.name, plate: p.name, model: p.model, color: CAR_COLORS[(p.seat - 1) % CAR_COLORS.length], human: true, pidx: p.seat }; }
  owner(c) { for (const p of this.players) if (p.car === c) return p; return null; }
  broadcast(o, skip) { for (const p of this.players) if (p.car && p !== skip) p.send(o); }

  // A new course, with every player in the session on the back of the grid.
  newRace() {
    const p = Track.random();
    p.scenery = this.order[this.races++ % this.order.length];
    p.length = U.clamp(p.length, 3, 10); p.obst = Math.min(p.obst, 4 + this.diff * 4);
    const track = Track.build(p), [lo, hi] = AI_RANGE[this.diff], names = U.shuffle(Math.random, AI_NAMES);
    const ai = Array.from({ length: CARS }, (_, k) => ({ id: 'C' + k, name: names[k % names.length], model: U.pick(Math.random, MODELS),
      color: CAR_COLORS[2 + (k % 8)], aiTop: U.lerp(lo, hi, 1 - (k / CARS) * 0.95) }));
    const r = this.race = new Race({ track, mode: 'race', laps: lapsFor(track.N), humans: [], ai, diff: this.diff, energy: true, power: true, net: 'server' });
    r.count = COUNTDOWN;
    for (const pl of this.players) pl.car = null;
    [...this.players].slice(0, CARS).forEach((pl, k) => { pl.car = r.cars[CARS - 1 - k]; r.setDriver(pl.car, this.driver(pl), true); });
    this.id++; this.state = 'race'; this.doneT = 0; this.lastT = 0; this.acc = 0;
    for (const pl of this.players) if (pl.car) this.sendRace(pl);
  }
  // Mid-race join: the player takes over the last rival still racing.
  takeOver(p) {
    let c = null;
    for (const o of this.race.cars) if (!o.human && !o.finished && (!c || o.place > c.place)) c = o;
    if (!c) return false;
    p.car = c;
    this.race.setDriver(c, this.driver(p), true);
    this.seatChanged(c, p);
    return true;
  }
  seatChanged(c, skip) { this.broadcast({ type: 'seat', id: this.id, i: this.race.cars.indexOf(c), car: this.race.carInfo(c) }, skip); }
  sendRace(p) {
    const r = this.race;
    p.send({ type: 'race', id: this.id, code: r.track.code, laps: r.laps, diff: this.diff,
      cars: r.cars.map(c => r.carInfo(c)), you: r.cars.indexOf(p.car), snap: r.snapshot() });
  }

  message(p, m) {
    const r = this.race, c = p.car;
    if (!c || this.state !== 'race' || m.id !== this.id) return; // a report from a race that is over
    if (m.type === 'car') {
      const s = clean(m.s, r);
      if (s) r.applyCar(c, s);
    } else if (m.type === 'shock') {
      const t = r.cars[m.i];
      if (t && t !== c && !(t.superT > 0)) r.shockHit(t);
    }
  }

  tick(dt) {
    const r = this.race;
    if (!r) return;
    if (this.state === 'results') {
      if ((this.wait -= dt) <= 0) this.newRace();
      return;
    }
    for (this.acc += dt; this.acc >= K.STEP; this.acc -= K.STEP) r.update(K.STEP, []);
    for (const [type, i] of r.outbox) { // shocks that hit a player's car: that browser applies them
      const p = type === 'shock' && this.owner(r.cars[i]);
      if (p) p.send({ type: 'shocked', id: this.id });
    }
    r.outbox.length = 0;
    if ((this.snapT -= dt) <= 0) { this.snapT = SNAP_T; this.broadcast(Object.assign({ type: 'snap', id: this.id }, r.snapshot())); }
    // over once every player has finished, or LAST_CALL seconds after the winner
    const racing = [...this.players].filter(p => p.car);
    if (racing.length && racing.every(p => p.car.finished)) this.doneT += dt;
    if (r.cars.some(c => c.finished)) this.lastT += dt;
    if (this.doneT > 3 || this.lastT > LAST_CALL) this.endRace();
  }
  // Points as in the championship, for the players who raced; the table goes out with the results.
  endRace() {
    this.state = 'results'; this.wait = RESULTS_T;
    const order = this.race.results();
    for (const p of this.players) { p.last = p.car ? POINTS[order.indexOf(p.car)] || 0 : 0; p.points += p.last; }
    const table = [...this.players].sort((a, b) => b.points - a.points).map(p => ({ name: p.name, points: p.points, last: p.last }));
    this.broadcast({ type: 'results', id: this.id, snap: this.race.snapshot(), next: RESULTS_T, table });
  }

  status() {
    const r = this.race;
    let lead = r.cars[0];
    for (const c of r.cars) if (c.place < lead.place) lead = c;
    return { scenery: r.track.theme.name, lap: U.clamp(lead.lap, 1, r.laps), laps: r.laps, phase: this.state === 'results' ? 'results' : r.phase,
      diff: this.diff, players: [...this.players].map(p => p.name), full: this.players.size >= CARS };
  }
}
