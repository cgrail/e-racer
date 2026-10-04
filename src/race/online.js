import { K, U } from '../core/util.js';
import { CARSPEC, AI_SHOCKS } from './specs.js';

// Race methods for online races. Each player's browser drives that player's car; the server (server/session.js)
// drives the rivals and referees the race. A car driven elsewhere is a puppet (c.net): its state arrives over the
// network, and between updates it runs on at its last speed and eases onto the reported position. this.net is
// 'server' or 'client'. On a client race.humans is just the car driven here; on the server it is every player's car,
// so the rubber band and defending rivals work as offline. Shocks that land on a puppet queue in race.outbox.
// A car's state on the wire: [travel, x, speed, frame, flags, jumpY, lap, finishTime], flags 1 braking, 2 super power,
// 4 shocked, 8 can pick up a shock (so a browser sees a rival use up the pickup it drives over, as the server does).
const SNAP_TO = 4000; // a puppet further than this from its reported position jumps there
const QUIET_T = 1;    // seconds without word from a puppet before it rolls to a stop (a browser tab in the background)

// A car's driver, as the roster sends it.
export function carInfo(c) { return { name: c.name, plate: c.plate, model: c.model, color: c.color, human: c.human }; }

// Puts a new driver into car c, which keeps its place on the road: a player who joins (d.human) or a rival
// taking over from a player who left. net: whether the car is driven elsewhere.
export function setDriver(c, d, net) {
  Object.assign(c, { name: d.name, plate: d.plate || '', model: d.model, spec: CARSPEC[d.model], color: d.color, human: !!d.human, net });
  c.pidx = c.human ? (d.pidx == null ? 99 : d.pidx) : -1;
  c.autopilot = false; c.msg = null; c.aiLane = U.clamp(c.x, -0.85, 0.85); c.aiRun = 0; c.aiPrey = null;
  c.power = !net && c.human && this.power ? 0 : null;
  c.shock = net || !this.shocks ? null : c.human || Math.random() < AI_SHOCKS[this.diff] ? 0 : null;
  c.nets = net ? { travel: c.travel, x: c.x, jumpY: c.jumpY } : null; c.netT = 0;
  this.humans = this.cars.filter(o => o.human && (!o.net || this.net === 'server'));
}

// A browser's copy of the race: car i is driven here, every other car is a puppet.
export function joinAs(i) {
  this.cars.forEach((c, k) => this.setDriver(c, Object.assign(this.carInfo(c), { pidx: k === i ? 0 : 99 }), k !== i));
  return this.cars[i];
}

export function drivePuppet(c, dt) {
  const n = c.nets;
  if (!n) return;
  if ((c.netT += dt) > QUIET_T) c.speed = Math.max(0, c.speed - K.MAX_SPEED * 0.4 * dt);
  n.travel += c.speed * dt;
  const z0 = c.z, before = c.travel, err = n.travel - c.travel;
  this.setTravel(c, Math.abs(err) > SNAP_TO ? n.travel : c.travel + c.speed * dt + err * Math.min(1, dt * 4));
  const moved = c.travel - before;
  c.prevZ = moved > 0 && moved < SNAP_TO ? z0 : c.z;
  c.x += (n.x - c.x) * Math.min(1, dt * 8);
  c.jumpY += (n.jumpY - c.jumpY) * Math.min(1, dt * 12);
  c.alt = this.roadY(c.z) + c.jumpY; c.air = c.jumpY > 20;
  if (!c.human) this.hits(c); // rivals knock cones and use up cells in every browser, as on the server
}

export function packCar(c) {
  const n = c.nets || c, r = (v, k = 1) => Math.round(v * k) / k; // a puppet is passed on as last reported
  const flags = (c.brake ? 1 : 0) | (c.superT > 0 ? 2 : 0) | (c.shockT > 0 ? 4 : 0) | (c.shock === 0 ? 8 : 0);
  return [r(n.travel), r(n.x, 1000), r(c.speed), c.frame, flags, r(n.jumpY), c.lap, r(c.finishTime, 1000)];
}

// hard: put the car straight there (joining), instead of easing a puppet towards it.
export function applyCar(c, s, hard) {
  const [travel, x, speed, frame, flags, jumpY, lap, fin] = s;
  if (c.net) { c.nets = { travel, x, jumpY }; c.netT = 0; }
  if (hard) { this.setTravel(c, travel); c.prevZ = c.z; c.x = x; c.jumpY = jumpY; c.alt = this.roadY(c.z) + jumpY; }
  c.speed = speed; c.frame = frame; c.brake = !!(flags & 1);
  if (c.net) c.superT = flags & 2 ? 0.2 : 0;
  if (flags & 4 && this.net === 'client') c.shockT = Math.max(c.shockT, 0.2); // the server times a player's shock itself
  if (c.net && !c.human && this.net === 'client') c.shock = flags & 8 ? 0 : null;
  if (lap > c.lap && c.taken) c.taken.clear();
  c.lap = lap; c.finished = fin > 0; c.finishTime = fin;
}

export function snapshot() {
  return { t: Math.round(this.time * 1000) / 1000, ph: this.phase === 'race' ? 1 : 0, n: Math.round(this.count * 100) / 100, cars: this.cars.map(c => this.packCar(c)) };
}

// The server's clock and cars, in a browser.
export function applySnapshot(s, hard) {
  if (this.phase === 'countdown') this.count = s.ph ? Math.min(this.count, 0) : s.n;
  if (hard || Math.abs(this.time - s.t) > 0.25) this.time = s.t;
  s.cars.forEach((cs, i) => { if (this.cars[i] && this.cars[i].net) this.applyCar(this.cars[i], cs, hard); });
}
