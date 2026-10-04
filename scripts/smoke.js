// Headless smoke test: runs the real game modules in Node against stubbed browser APIs.
// It catches load-order, import and runtime errors in game flow, simulation and rendering;
// it says nothing about how things look. Usage: npm run smoke
import { canvas, define } from './stubs.js';

// ---------------------------------------------------------------- module-level checks
const { K, U } = await import('../src/core/util.js');
const { THEMES } = await import('../src/world/themes.js');
const { Track } = await import('../src/world/track.js');
const { Race } = await import('../src/race/race.js');
const { MODELS, CAR_COLORS } = await import('../src/race/specs.js');
const { Render } = await import('../src/render/index.js');
const { Art } = await import('../src/art/index.js');

for (const m of MODELS) for (let f = -2; f <= 2; f++) for (const b of [false, true]) { Art.car(m, CAR_COLORS[0], f, b); Art.car(m, CAR_COLORS[1], f, b, 'QW3RT9'); }
const g = canvas().getContext('2d');
THEMES.forEach((th, i) => {
  const params = Object.assign(Track.random(() => 0.5), { scenery: i, obst: 15 });
  const track = Track.build(params, i % 2 ? { checkpoints: 4, scale: 1.8 } : {});
  if (Track.encode(Track.decode(track.code)) !== track.code) throw new Error('course code does not round-trip: ' + track.code);
  const humans = [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: MODELS[i % MODELS.length], color: CAR_COLORS[0] },
    { id: 'P2', name: 'P2', human: true, pidx: 1, model: MODELS[(i + 5) % MODELS.length], color: CAR_COLORS[1] }];
  const ai = Array.from({ length: 8 }, (_, k) => ({ id: 'A' + k, name: 'AI', model: MODELS[k % MODELS.length], color: CAR_COLORS[k + 2], aiTop: 0.8 }));
  const race = new Race({ track, mode: i % 2 ? 'time' : 'race', laps: 2, humans, ai, diff: 1 });
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false };
  const vs = [{}, {}];
  for (let s = 0; s < 120 * 40; s++) {
    inp.steer = Math.sin(s / 90);
    race.update(K.STEP, [inp, Object.assign({}, inp, { steer: -inp.steer })]);
    if (s % 60 === 0) {
      Render.view(g, { x: 0, y: 0, w: K.W, h: K.H }, race, race.humans[0], vs[0], { dt: 0.5 });
      Render.view(g, { x: 0, y: 0, w: K.W, h: 148 }, race, race.humans[1], vs[1], { dt: 0.5 });
    }
  }
  if (!(race.humans[0].travel > 0)) throw new Error(`${th.id}: player car did not move`);
});
console.log(`modules: ${THEMES.length} sceneries built, raced and rendered`);

{ // hazards never start hidden behind a crest: line of sight from the camera, 18 to 50 segments back, clears the road
  let groups = 0;
  for (let n = 0; n < 40; n++) {
    const t = Track.build(Object.assign(Track.random(U.rng(n + 1)), { obst: 15, hills: 15, steep: 8 + (n % 8) }));
    const gy = k => t.segments[U.wrap(k, t.N)].p1.world.y;
    const blocked = i => [18, 34, 50].some(d => { const c = i - d, y0 = gy(c) + K.CAM_H, y1 = gy(i) + 150;
      for (let k = c + 1; k < i; k++) if (gy(k) > y0 + ((y1 - y0) * (k - c)) / (i - c)) return true; return false; });
    let last = -99;
    for (const s of t.segments) {
      if (!s.obs.length) continue;
      if (s.index - last > 30 && ++groups && blocked(s.index)) throw new Error(`hazard behind a crest: ${t.code} segment ${s.index}`);
      last = s.index;
    }
  }
  console.log(`hazards: ${groups} groups on 40 hilly courses, none hidden behind a crest OK`);
}

{ // electric drive: single speed up to top speed, the kW meter reads power drawn and goes negative under regen
  const track = Track.build(Object.assign(Track.random(() => 0.5), { obst: 0, curves: 0, hills: 0 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }], ai: [] });
  const h = race.humans[0], top = h.spec.top * K.MAX_SPEED, inp = { throttle: 1, brake: 0, steer: 0, analog: false };
  let t80 = 0, peak = 0;
  for (let s = 0; s < 120 * 12; s++) {
    race.update(K.STEP, [Object.assign({}, inp, { steer: U.clamp(-h.x * 3, -1, 1) })]);
    if (race.phase === 'race') { if (!t80 && h.speed > top * 0.8) t80 = race.time; peak = Math.max(peak, h.pwr); }
  }
  if (!(h.speed > top * 0.95) || !t80 || t80 > 4) throw new Error(`drive: did not reach top speed (${Math.round(h.speed / top * 100)}%, 80% after ${t80}s)`);
  if (!(peak > 0.8)) throw new Error('drive: kW meter never near rated power under full throttle: ' + peak);
  for (let s = 0; s < 60; s++) race.update(K.STEP, [Object.assign({}, inp, { throttle: 0, brake: 1 })]);
  if (!(h.pwr < -0.3)) throw new Error('drive: no regen while braking: ' + h.pwr);
  console.log(`drive: 80% of top speed after ${t80.toFixed(1)}s, peak ${Math.round(peak * h.spec.kw)} kW, regen ${Math.round(h.pwr * h.spec.kw)} kW OK`);
}

{ // limited energy: cells get collected, the battery drains, running flat drops the car behind the last car
  const track = Track.build(Object.assign(Track.random(() => 0.3), { obst: 0 }));
  const ai = Array.from({ length: 6 }, (_, k) => ({ id: 'A' + k, name: 'AI', model: MODELS[k % MODELS.length], color: CAR_COLORS[k + 2], aiTop: 0.4 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }], ai, energy: true });
  const h = race.humans[0];
  const cells = track.segments.flatMap(sg => sg.obs.filter(o => o.fx === 'energy').map(o => ({ o, z: sg.index * K.SEG_LEN })));
  if (cells.length < 3) throw new Error('energy: too few cells placed');
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false };
  let took = 0, low = 1;
  for (let s = 0; s < 120 * 30; s++) {
    const next = cells.find(c => U.wrap(c.z - h.z, race.L) < 6000); // steer for the next cell
    inp.steer = next ? U.clamp((next.o.x - h.x) * 4, -1, 1) : 0;
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

{ // power-ups: from last place an orb gives the most charges, a charge fires super power past top speed and smashes barriers; the top three get none
  const { SUPER_T } = await import('../src/race/specs.js');
  const track = Track.build(Object.assign(Track.random(() => 0.6), { obst: 0, length: 15 }));
  const ai = Array.from({ length: 6 }, (_, k) => ({ id: 'A' + k, name: 'AI', model: 'aero', color: CAR_COLORS[k + 2], aiTop: 0.3 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'pixel', color: CAR_COLORS[0] }], ai, power: true });
  const h = race.humans[0], rivals = race.cars.filter(c => !c.human);
  rivals.forEach((c, k) => race.setTravel(c, 400000 + k * 3000)); // far ahead: the player runs last
  const orbs = track.segments.flatMap(sg => sg.obs.filter(o => o.fx === 'power').map(o => ({ o, z: sg.index * K.SEG_LEN })));
  if (orbs.length < 2) throw new Error('power: too few orbs placed');
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false, power: false };
  for (let s = 0; s < 120 * 40 && !h.power; s++) {
    const next = orbs.find(c => U.wrap(c.z - h.z, race.L) < 6000);
    inp.steer = next ? U.clamp((next.o.x - h.x) * 4, -1, 1) : 0;
    race.update(K.STEP, [inp]);
  }
  if (h.power !== 3 || h.place !== 7) throw new Error(`power: last place should get 3 charges, got ${h.power} in P${h.place}`);
  const seg = track.findSegment(h.z + 3000), barrier = { name: 'barrier', v: 0, x: h.x, bx: h.x, ww: 1300, hw: 0.4, fx: 'crash', hit: false, fly: null };
  seg.obs.push(barrier);
  race.update(K.STEP, [Object.assign({}, inp, { steer: 0, power: true })]);
  if (!(h.superT > SUPER_T * 1.9) || h.power !== 2) throw new Error(`power: charge from last place did not fire long (${h.superT}s)`);
  let top = 0;
  for (let s = 0; s < 120 * 2.5; s++) { race.update(K.STEP, [Object.assign({}, inp, { steer: U.clamp(-h.x * 3, -1, 1) })]); top = Math.max(top, h.speed); }
  if (!(top > h.spec.top * K.MAX_SPEED)) throw new Error('power: super power did not pass top speed');
  if (!barrier.hit || h.crashT > 0) throw new Error('power: barrier was not smashed aside');
  rivals.forEach((c, k) => race.setTravel(c, h.travel - 50000 - k * 3000)); // now all behind: the player leads
  race.rank(); h.power = 0;
  const orb = orbs[0].o; h.taken.delete(orb);
  race.collectPower(h, orb);
  if (h.place !== 1 || h.power !== 0 || h.taken.has(orb)) throw new Error('power: the leader should get nothing and leave the orb');
  console.log(`power: ${orbs.length} orbs, 3 charges in last, none in first, long charge fired, ${Math.round(top / (h.spec.top * K.MAX_SPEED) * 100)}% of top speed, barrier smashed OK`);
}

{ // electro shock (every race, no option needed): pickups get collected, a shock needs a car ahead in range and holds it to SHOCK_CAP of top speed
  const { SHOCK_CAP, SHOCK_T } = await import('../src/race/specs.js');
  const track = Track.build(Object.assign(Track.random(() => 0.6), { obst: 0, length: 15 }));
  const ai = [0, 1].map(k => ({ id: 'A' + k, name: 'AI', model: 'flux', color: CAR_COLORS[k + 2], aiTop: 0.95 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }], ai });
  const h = race.humans[0], [a, b] = race.cars.filter(c => !c.human);
  a.shock = b.shock = null; // these rivals don't use shocks, so only the player's shock is in play
  const pads = track.segments.flatMap(sg => sg.obs.filter(o => o.fx === 'shock').map(o => ({ o, z: sg.index * K.SEG_LEN })));
  if (pads.length < 2) throw new Error('shock: too few pickups placed');
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false, power: false, shock: false };
  for (let s = 0; s < 120 * 40 && !h.shock; s++) {
    const next = pads.find(c => U.wrap(c.z - h.z, race.L) < 6000);
    inp.steer = next ? U.clamp((next.o.x - h.x) * 4, -1, 1) : 0;
    race.update(K.STEP, [inp]);
  }
  if (h.shock !== 1) throw new Error('shock: no pickup collected');
  Render.view(g, { x: 0, y: 0, w: K.W, h: 148 }, race, h, {}, { dt: 0.5 }); // HUD with a held shock
  const drive = extra => race.update(K.STEP, [Object.assign({}, inp, { steer: U.clamp(-h.x * 3, -1, 1) }, extra)]);
  race.setTravel(a, h.travel - 5000); race.setTravel(b, h.travel - 9000);
  drive({ shock: true });
  if (h.shock !== 1 || a.shockT || b.shockT) throw new Error('shock: fired with no car ahead');
  race.setTravel(a, h.travel + 3000); race.setTravel(b, h.travel + 20000);
  drive({ shock: true });
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

{ // a cell a rival drives over is used up for every car until it comes back
  const track = Track.build(Object.assign(Track.random(() => 0.45), { obst: 0 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }],
    ai: [{ id: 'A0', name: 'AI', model: 'wave', color: CAR_COLORS[2], aiTop: 0.8 }], energy: true });
  const h = race.humans[0], a = race.cars.find(c => !c.human), halfW = K.CAR_W / 2 / track.roadW;
  const sg = track.segments.find(s => s.obs.some(o => o.fx === 'energy')), cell = sg.obs.find(o => o.fx === 'energy');
  a.energy = 0.5; a.prevZ = sg.index * K.SEG_LEN - 10; a.z = sg.index * K.SEG_LEN + 10; a.x = cell.x;
  race.hits(a);
  if (!(a.energy > 0.5) || !(cell.backAt > race.time)) throw new Error('energy: rival did not use up the cell');
  h.energy = 0.5; race.hitObstacle(h, cell, halfW);
  if (h.energy !== 0.5 || h.taken.has(cell)) throw new Error('energy: a cell a rival took was still collectable');
  race.time += 30; race.hitObstacle(h, cell, halfW);
  if (!(h.energy > 0.5)) throw new Error('energy: the cell did not come back');
  console.log('energy: a rival uses up the cell it drives over, it comes back later OK');
}

{ // likewise a shock pickup a rival collects; a rival that doesn't use shocks leaves it
  const track = Track.build(Object.assign(Track.random(() => 0.45), { obst: 0 }));
  const ai = [0, 1].map(k => ({ id: 'A' + k, name: 'AI', model: 'wave', color: CAR_COLORS[k + 2], aiTop: 0.8 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }], ai });
  const h = race.humans[0], [a, b] = race.cars.filter(c => !c.human), halfW = K.CAR_W / 2 / track.roadW;
  const pad = track.segments.flatMap(sg => sg.obs).find(o => o.fx === 'shock');
  b.shock = null; race.hitObstacle(b, pad, halfW);
  if (pad.backAt) throw new Error('shock: a rival without shocks used up the pickup');
  a.shock = 0; race.hitObstacle(a, pad, halfW);
  if (a.shock !== 1 || !(pad.backAt > race.time)) throw new Error('shock: rival did not use up the pickup');
  race.hitObstacle(h, pad, halfW);
  if (h.shock !== 0) throw new Error('shock: a pickup a rival took was still collectable');
  race.time += 30; race.hitObstacle(h, pad, halfW);
  if (h.shock !== 1) throw new Error('shock: the pickup did not come back');
  console.log('shock: a rival uses up the pickup it collects, it comes back later OK');
}

{ // active rivals: they recharge from cells, collect and fire shocks, and keep changing lanes
  const track = Track.build(Object.assign(Track.random(() => 0.45), { obst: 4 }));
  const ai = Array.from({ length: 10 }, (_, k) => ({ id: 'A' + k, name: 'AI', model: MODELS[k % MODELS.length], color: CAR_COLORS[k % 10], aiTop: 0.7 + k * 0.01 }));
  const race = new Race({ track, mode: 'race', laps: 9, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }], ai, energy: true, diff: 2 });
  const h = race.humans[0], rivals = race.cars.filter(c => !c.human), inp = { throttle: 1, brake: 0, steer: 0, analog: false };
  rivals.forEach(c => { c.shock = 0; }); // every rival uses shocks here
  let charged = 0, fired = 0, zapped = 0, wasShocked = false;
  const prev = rivals.map(c => ({ e: c.energy, s: c.shock, x: c.x, moved: 0 }));
  for (let s = 0; s < 120 * 90; s++) {
    race.update(K.STEP, [Object.assign({}, inp, { steer: U.clamp(-h.x * 3, -1, 1), throttle: race.time % 10 < 8 ? 1 : 0 })]);
    rivals.forEach((c, i) => {
      const p = prev[i];
      if (c.energy > p.e + 0.05) charged++;
      if (p.s === 1 && c.shock === 0) fired++;
      p.moved += Math.abs(c.x - p.x); p.e = c.energy; p.s = c.shock; p.x = c.x;
    });
    if (h.shockT > 0 && !wasShocked) zapped++;
    wasShocked = h.shockT > 0;
  }
  const busy = prev.filter(p => p.moved > 4).length;
  if (!charged || !fired || busy < rivals.length * 0.7) throw new Error(`rivals: cells ${charged}, shocks fired ${fired}, lane-changing ${busy}/${rivals.length}`);
  console.log(`rivals: ${charged} cells taken, ${fired} shocks fired (${zapped} at the player), ${busy}/${rivals.length} changing lanes in 90s OK`);
}

{ // rubber band: rivals far ahead of the humans slow down, far behind speed up, close ones race unaided
  const track = Track.build(Track.random(() => 0.4));
  const ai = [0, 1, 2].map(k => ({ id: 'A' + k, name: 'AI', model: 'aero', color: CAR_COLORS[k + 2], aiTop: 0.8 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }], ai, diff: 0 });
  const [a, b, c] = race.cars.filter(x => !x.human), h = race.humans[0];
  race.setTravel(h, 100000); race.setTravel(a, 200000); race.setTravel(b, 101000); race.setTravel(c, 10000);
  const fa = race.rubberBand(a), fb = race.rubberBand(b), fc = race.rubberBand(c);
  if (!(fa < 0.9 && fb === 1 && fc > 1.1)) throw new Error(`rubber band factors wrong: ahead ${fa}, close ${fb}, behind ${fc}`);
  console.log(`rubber band: ahead x${fa.toFixed(2)}, close x${fb}, behind x${fc.toFixed(2)} OK`);
}

{ // audio: a stub Web Audio graph; every song sequences a full loop, and the game flow below runs with sound on
  const made = {};
  const node = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : /^(frequency|gain|Q|pan|threshold|ratio|delayTime|detune)$/.test(k) ? (o[k] = node()) : () => {}) });
  const ctx = new Proxy({ currentTime: 0, sampleRate: 8000, state: 'running', destination: node(),
    createBuffer: (c, len) => ({ getChannelData: () => new Float32Array(len) }) }, {
    get: (o, k) => (k in o ? o[k] : () => { made[k] = (made[k] || 0) + 1; return node(); }),
  });
  window.AudioContext = function () { return ctx; };
  let tick = null; // the sequencer's interval, driven by hand so nothing keeps Node alive
  define('setInterval', fn => { tick = fn; return 1; }); define('clearInterval', () => { tick = null; });
  const { Sound } = await import('../src/audio/sound.js');
  Sound.init();
  for (let i = 0; i < Sound.songs.length; i++) {
    const before = made.createOscillator || 0;
    Sound.playMusic(i);
    for (let s = 0; s < 40 * 40; s++) { ctx.currentTime += 0.025; tick(); }
    if (!((made.createOscillator || 0) - before > 500)) throw new Error(`music: ${Sound.songs[i]} played no notes`);
  }
  for (let sp = 0; sp <= 1.3; sp += 0.1) Sound.engine(0, true, sp, 1 - sp, 0, 0, 0); // drone into the jet layer
  Sound.enginesOff();
  Sound.stopMusic(); window.AudioContext = undefined;
  console.log(`music: ${Sound.songs.length} songs sequenced (${Sound.songs.join(', ')}) OK`);
}

await import('./flows.js'); // game flow through the real key handlers, then online
