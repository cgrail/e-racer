// Headless checks of the pickups, run from smoke.js: energy cells by place, the one boost or flash a car holds,
// and pickups a rival uses up, which come back sooner the further back a car is.
import { canvas } from './stubs.js';

const { K, U } = await import('../src/core/util.js');
const { Track } = await import('../src/world/track.js');
const { Race } = await import('../src/race/race.js');
const { MODELS, CAR_COLORS, SUPER_T, SHOCK_CAP, SHOCK_T } = await import('../src/race/specs.js');
const { Render } = await import('../src/render/index.js');
const g = canvas().getContext('2d');
const P1 = { id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] };
const rivals = (n, aiTop) => Array.from({ length: n }, (_, k) => ({ id: 'A' + k, name: 'AI', model: MODELS[k % MODELS.length], color: CAR_COLORS[(k + 2) % 10], aiTop }));
const onTrack = (track, fx) => track.segments.flatMap(sg => sg.obs.filter(o => o.fx === fx).map(o => ({ o, z: sg.index * K.SEG_LEN })));
// Steer for the next pickup of that kind on the car's road (or around it, when skip says so).
function steerFor(race, h, list, skip) {
  const next = list.find(c => !h.taken.has(c.o) && race.sees(h, c.o) && U.wrap(c.z - h.z, race.L) < 6000);
  if (!next) return U.clamp(-h.x * 3, -1, 1);
  const tx = skip && skip(next.o) ? next.o.x + (next.o.x > 0 ? -0.85 : 0.85) : next.o.x;
  return U.clamp((tx - h.x) * 4, -1, 1);
}
// Puts car c first (rivals far behind) or last (rivals far ahead), with its share of cells to match.
function placeAt(race, c, first) {
  race.cars.forEach((o, k) => { if (o !== c) { race.setTravel(o, c.travel + (first ? -9e5 : 9e5) - k * 1000); o.prevZ = o.z; } });
  race.rank(); c.cellD = null; race.cellNeed(c, 0);
}

{ // limited energy: cells get collected, the battery drains, running flat drops the car behind the last car
  const track = Track.build(Object.assign(Track.random(() => 0.3), { obst: 0 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [P1], ai: rivals(6, 0.4), energy: true });
  const h = race.humans[0];
  race.cars.forEach((c, k) => { if (!c.human) { race.setTravel(c, -20000 - k * 2000); c.prevZ = c.z; } }); // the slow rivals start behind, so none takes the cell first
  const cells = onTrack(track, 'energy');
  if (cells.length < 3) throw new Error('energy: too few cells placed');
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false };
  let took = 0, low = 1;
  for (let s = 0; s < 120 * 30; s++) {
    inp.steer = steerFor(race, h, cells);
    race.update(K.STEP, [inp]);
    took = Math.max(took, h.taken.size); low = Math.min(low, h.energy);
  }
  if (!took) throw new Error('energy: no cell collected');
  if (!(low < 1)) throw new Error('energy: battery did not drain');
  race.setTravel(h, Math.max(...race.cars.map(c => c.travel)) + 3000); race.rank(); // lead, so dropping to last shows
  const before = h.travel;
  h.energy = 0.0001;
  for (let s = 0; s < 10; s++) race.update(K.STEP, [inp]);
  if (!(h.travel < before) || h.place !== race.cars.length || !(h.energy > 0.5)) {
    throw new Error(`energy: running flat did not drop the car to last (travel ${before} -> ${h.travel}, place ${h.place}, energy ${h.energy})`);
  }
  console.log(`energy: ${cells.length} cells, collected up to ${took} per lap, flat battery drops to last OK`);
}

{ // cells by need: none for the leader until it is nearly empty, then one, and miss it to run flat; the car behind
  // the leader gets about one in four and has to take most of them to keep going flat out; the last car has them all
  const track = Track.build(Object.assign(Track.random(() => 0.5), { obst: 0, curves: 0, hills: 0 }));
  let cells;
  const run = (second, skip) => { // the car leads (or runs second) at full power, taking or skipping what it sees
    const race = new Race({ track, mode: 'race', laps: 50, humans: [P1], ai: rivals(19, 0.2), energy: true });
    const h = race.humans[0], parked = race.cars.filter(c => !c.human), front = parked[0];
    cells = onTrack(track, 'energy'); // placed anew for every race
    race.phase = 'race'; placeAt(race, h, true);
    if (second) { race.setTravel(front, h.travel + 5e6); race.rank(); h.cellD = null; race.cellNeed(h, 0); } // far ahead, out of reach
    const seen = cells.filter(c => race.sees(h, c.o)).length;
    let low = 1, most = 0, aims = 0, near = Infinity, n = 0;
    const skipped = ob => (ob.n == null ? (ob.n = n++) : ob.n) % 2 === 1 && skip === 'half' || skip === 'all';
    for (let s = 0; s < 120 * 90 && !(h.flatT > 0); s++) {
      parked.forEach(c => { if (c !== front) { c.speed = 0; c.x = 3; } else c.speed = 0; }); // off the road, behind
      const aim = h.cellAim;
      race.update(K.STEP, [{ throttle: 1, brake: 0, steer: steerFor(race, h, cells, skipped), analog: false }]);
      if (h.cellAim && h.cellAim !== aim) { aims++; near = Math.min(near, U.wrap(cells.find(c => c.o === h.cellAim).z - h.z, race.L) / K.SEG_LEN); }
      if (!second) most = Math.max(most, cells.filter(c => !h.taken.has(c.o) && race.sees(h, c.o)).length);
      low = Math.min(low, h.energy);
    }
    placeAt(race, h, false);
    return { seen, last: cells.filter(c => race.sees(h, c.o)).length, flat: h.flatT > 0, low, most, aims, near };
  };
  const lead = run(false), miss = run(false, 'all'), all = run(true), half = run(true, 'half');
  if (lead.seen || lead.most !== 1 || lead.aims < 4 || !(lead.near >= 79)) throw new Error(`energy: leader sees ${lead.seen} cells, then up to ${lead.most} at once, ${lead.aims} single cells, nearest ${lead.near} segments ahead`);
  if (lead.flat || !(lead.low > 0)) throw new Error(`energy: a leader taking its one cell each time ran flat (${lead.low})`);
  if (!miss.flat || miss.aims !== 1) throw new Error(`energy: a leader missing its one cell kept going (${miss.low}, ${miss.aims} cells)`);
  if (all.last !== cells.length || Math.abs(all.seen - cells.length * 0.29) > 2) throw new Error(`energy: second sees ${all.seen}, last ${all.last} of ${cells.length} cells`);
  if (all.flat || !(all.low > 0.3)) throw new Error(`energy: a car taking every cell in second ran low (${all.low})`);
  if (!half.flat) throw new Error(`energy: a car taking half the cells in second kept going (${half.low})`);
  console.log(`energy: leader sees no cells, then one ${Math.round(lead.near)} segments ahead when nearly empty (${lead.aims} in 90 s), runs flat missing it; second sees ${all.seen} of ${cells.length}, lasts on all, runs flat on half OK`);
}

{ // boost: one held at a time, from any place; it runs longer further back, passes top speed and smashes barriers
  const track = Track.build(Object.assign(Track.random(() => 0.6), { obst: 0, length: 15 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [Object.assign({}, P1, { model: 'pixel' })], ai: rivals(6, 0.3), power: true });
  const h = race.humans[0], halfW = K.CAR_W / 2 / track.roadW;
  placeAt(race, h, false); // the player runs last
  const orbs = onTrack(track, 'power'), pads = onTrack(track, 'shock');
  if (orbs.length < 2) throw new Error('power: too few orbs placed');
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false, power: false, shock: false };
  const both = orbs.concat(pads).sort((p, q) => p.z - q.z);
  for (let s = 0; s < 120 * 40 && !h.power; s++) {
    inp.steer = steerFor(race, h, both, ob => ob.fx === 'shock'); // around the flashes, for a boost
    race.update(K.STEP, [inp]);
  }
  if (h.power !== 1 || h.place !== 7) throw new Error(`power: no boost collected in last place (${h.power} in P${h.place})`);
  const orb = orbs.find(c => !h.taken.has(c.o)).o, pad = pads[0].o;
  race.hitObstacle(h, orb, halfW); race.hitObstacle(h, pad, halfW);
  if (h.power !== 1 || h.shock !== 0 || h.taken.has(orb) || h.taken.has(pad) || race.sees(h, orb) || race.sees(h, pad)) throw new Error('power: picked up a second boost or flash');
  Render.view(g, { x: 0, y: 0, w: K.W, h: K.H }, race, h, {}, { dt: 0.5 }); // HUD with a held boost
  const seg = track.findSegment(h.z + 3000), barrier = { name: 'barrier', v: 0, x: h.x, bx: h.x, ww: 1300, hw: 0.4, fx: 'crash', hit: false, fly: null };
  seg.obs.push(barrier);
  race.update(K.STEP, [Object.assign({}, inp, { steer: 0, shock: true })]); // either key fires what is held
  if (!(h.superT > SUPER_T * 1.9) || h.power !== 0) throw new Error(`power: boost from last place did not fire long (${h.superT}s)`);
  if (!race.sees(h, pad)) throw new Error('power: flashes not back on the road after firing');
  let top = 0;
  for (let s = 0; s < 120 * 2.5; s++) { race.update(K.STEP, [Object.assign({}, inp, { steer: U.clamp(-h.x * 3, -1, 1) })]); top = Math.max(top, h.speed); }
  if (!(top > h.spec.top * K.MAX_SPEED)) throw new Error('power: super power did not pass top speed');
  if (!barrier.hit || h.crashT > 0) throw new Error('power: barrier was not smashed aside');
  placeAt(race, h, true); h.superT = 0; h.taken.delete(orb); // now the player leads: a boost still, but a short one
  race.collectPower(h, orb);
  race.update(K.STEP, [Object.assign({}, inp, { power: true })]);
  if (h.place !== 1 || !h.taken.has(orb) || h.power !== 0 || !(h.superT > 0 && h.superT <= SUPER_T * 0.5)) throw new Error(`power: the leader's boost is wrong (${h.superT}s)`);
  console.log(`power: one boost at a time, ${orbs.length} orbs, long from last, short in the lead, ${Math.round(top / (h.spec.top * K.MAX_SPEED) * 100)}% of top speed, barrier smashed OK`);
}

{ // rivals use flashes or boosts, never both. A rival's orb stays on the road for the others; it saves its boost for
  // a player at the front close ahead, and fires it past its car's top speed, like a player's
  const track = Track.build(Object.assign(Track.random(() => 0.6), { obst: 0, curves: 0, length: 15 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [P1], ai: rivals(9, 0.7), power: true, diff: 1 });
  if (race.cars.some(c => !c.human && (c.shock == null) === (c.power == null))) throw new Error('power: a rival uses both flashes and boosts, or neither');
  for (const c of race.cars.filter(c => !c.human).slice(-2)) { c.shock = null; c.power = 0; } // the split is random: two use boosts
  const h = race.humans[0], [r, o] = race.cars.filter(c => !c.human && c.power === 0), halfW = K.CAR_W / 2 / track.roadW;
  const orb = onTrack(track, 'power')[0].o;
  race.hitObstacle(r, orb, halfW);
  if (r.power !== 1 || orb.takenAt != null || !race.sees(h, orb)) throw new Error('power: rival did not take the orb, or took it from the player');
  const drive = t => { for (let s = 0; s < 120 * t; s++) race.update(K.STEP, [{ throttle: 1, brake: 0, steer: U.clamp(-h.x * 3, -1, 1), analog: false }]); };
  const behind = () => { race.setTravel(r, h.travel - 3000); r.prevZ = r.z; r.x = h.x > 0 ? -0.5 : 0.5; race.rank(); };
  race.phase = 'race'; placeAt(race, h, false); behind(); drive(5); // the player runs last: the rival keeps its boost
  if (r.power !== 1 || r.superT > 0) throw new Error('power: rival fired its boost with no player at the front ahead');
  placeAt(race, h, true); behind(); // the player leads, the rival is right behind it
  let peak = 0;
  for (let s = 0; s < 120 * 6 && !(r.superT > 0 && r.superT < 0.5); s++) {
    drive(1 / 120);
    if (r.superT > 0) peak = Math.max(peak, r.speed);
  }
  if (r.power !== 0 || !(r.superMax > SUPER_T * 0.5) || !(peak > r.spec.top * K.MAX_SPEED)) throw new Error(`power: rival did not boost past its top speed (${r.power}, ${r.superMax}s, ${peak})`);
  race.setTravel(o, r.travel - 2000); r.superT = 1;
  Render.view(g, { x: 0, y: 0, w: K.W, h: K.H }, race, o, {}, { dt: 0.5, hud: false }); // the flames behind a boosting car
  console.log(`power: rivals use flashes or boosts, a rival saves its boost for the leader and fires it to ${Math.round(peak / (r.spec.top * K.MAX_SPEED) * 100)}% of its top speed OK`);
}

{ // flash (electro shock): pickups get collected, a flash needs a car ahead in range and holds it to SHOCK_CAP of top speed
  const track = Track.build(Object.assign(Track.random(() => 0.6), { obst: 0, length: 15 }));
  const ai = [0, 1].map(k => ({ id: 'A' + k, name: 'AI', model: 'flux', color: CAR_COLORS[k + 2], aiTop: 0.95 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [P1], ai });
  const h = race.humans[0], [a, b] = race.cars.filter(c => !c.human);
  a.shock = b.shock = null; // these rivals don't use shocks, so only the player's flash is in play
  const pads = onTrack(track, 'shock');
  if (pads.length < 2) throw new Error('shock: too few pickups placed');
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false, power: false, shock: false };
  for (let s = 0; s < 120 * 40 && !h.shock; s++) {
    inp.steer = steerFor(race, h, pads);
    race.update(K.STEP, [inp]);
  }
  if (h.shock !== 1) throw new Error('shock: no pickup collected');
  Render.view(g, { x: 0, y: 0, w: K.W, h: 148 }, race, h, {}, { dt: 0.5 }); // HUD with a held flash
  const drive = extra => race.update(K.STEP, [Object.assign({}, inp, { steer: U.clamp(-h.x * 3, -1, 1) }, extra)]);
  race.setTravel(a, h.travel - 5000); race.setTravel(b, h.travel - 9000);
  drive({ power: true });
  if (h.shock !== 1 || a.shockT || b.shockT) throw new Error('shock: fired with no car ahead');
  race.setTravel(a, h.travel + 3000); race.setTravel(b, h.travel + 20000);
  drive({ power: true }); // either key fires what is held
  if (h.shock !== 0 || !(a.shockT > 0) || b.shockT) throw new Error('shock: did not hit the nearest car ahead');
  const cap = a.spec.top * K.MAX_SPEED * SHOCK_CAP;
  let held = 0;
  for (let s = 0; s < 120 * (SHOCK_T + 0.5); s++) {
    drive({ throttle: 0 }); // coast, so ramming the shocked car can't push it past the cap
    if (a.shockT > 0 && s > 120) held = Math.max(held, a.speed / cap);
    if (s % 120 === 0) Render.view(g, { x: 0, y: 0, w: K.W, h: K.H }, race, h, {}, { dt: 0.5 }); // arcs on the shocked car
  }
  if (!(held > 0.5 && held <= 1.001) || a.shockT !== 0) throw new Error(`shock: speed not held to the cap (${held}, shockT ${a.shockT})`);
  console.log(`shock: ${pads.length} pickups, collected, kept with no target, nearest car ahead held to ${Math.round(SHOCK_CAP * 100)}% OK`);
}

{ // a cell or flash a rival takes is used up for a while: the longer the further ahead a car is, not at all for the last car,
  // and never the leader's one cell
  const track = Track.build(Object.assign(Track.random(() => 0.45), { obst: 0 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [P1], ai: rivals(2, 0.8), energy: true });
  const h = race.humans[0], [a, b] = race.cars.filter(c => !c.human), halfW = K.CAR_W / 2 / track.roadW;
  const [cell, cell2] = onTrack(track, 'energy').map(c => c.o).filter(o => o.tier < 0.25); // on every road but the leader's
  const take = (c, ob) => { const sg = track.segments.find(s => s.obs.includes(ob)); c.prevZ = sg.index * K.SEG_LEN - 10; c.z = sg.index * K.SEG_LEN + 10; c.x = ob.x; race.hits(c); };
  a.cellD = 1;
  placeAt(race, h, true); race.setTravel(b, h.travel + 5000); race.rank(); h.cellD = null; race.cellNeed(h, 0); // second, of three
  a.energy = 0.5; take(a, cell);
  if (!(a.energy > 0.5) || cell.takenAt !== race.time) throw new Error('energy: rival did not use up the cell');
  h.energy = 0.5; race.hitObstacle(h, cell, halfW);
  if (h.energy !== 0.5 || h.taken.has(cell)) throw new Error('energy: a cell a rival took was still there for the car in second');
  race.time += 3.1; race.hitObstacle(h, cell, halfW);
  if (!(h.energy > 0.5)) throw new Error('energy: the cell did not come back');
  placeAt(race, h, true); h.energy = 0.1; race.cellNeed(h, 0);
  const aim = h.cellAim;
  a.energy = 0.5; take(a, aim);
  if (!aim || aim.takenAt !== race.time) throw new Error('energy: no single cell for the leader, or the rival did not take it');
  race.hitObstacle(h, aim, halfW);
  if (!(h.energy > 0.45) || h.cellAim) throw new Error('energy: a rival took the leader\'s one cell away');
  placeAt(race, h, false); h.energy = 0.5; a.energy = 0.5; take(a, cell2); race.hitObstacle(h, cell2, halfW);
  if (!(h.energy > 0.5)) throw new Error('energy: a cell a rival took was gone for the last car');
  const pad = track.segments.flatMap(sg => sg.obs).find(o => o.fx === 'shock');
  placeAt(race, h, true);
  b.shock = null; race.hitObstacle(b, pad, halfW);
  if (pad.takenAt != null) throw new Error('shock: a rival without shocks used up the pickup');
  a.shock = 0; race.hitObstacle(a, pad, halfW);
  if (a.shock !== 1 || pad.takenAt !== race.time) throw new Error('shock: rival did not use up the pickup');
  race.hitObstacle(h, pad, halfW);
  if (h.shock !== 0) throw new Error('shock: a pickup a rival took was still there for the leader');
  race.time += 6.1; race.hitObstacle(h, pad, halfW);
  if (h.shock !== 1) throw new Error('shock: the pickup did not come back');
  console.log('pickups: a rival uses up what it takes, back after 6 s for the leader, 3 s in the middle, at once for the last car, the leader keeps its one cell OK');
}
