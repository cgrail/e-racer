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

await import('./pickups.js'); // energy cells by place, one boost or flash at a time, pickups rivals use up
await import('./update.js'); // the deploy hook: GET /update asks for a deploy, at most once per cooldown

{ // active rivals: they recharge from cells, collect and fire shocks, and keep changing lanes
  const track = Track.build(Object.assign(Track.random(() => 0.45), { obst: 4 }));
  const ai = Array.from({ length: 10 }, (_, k) => ({ id: 'A' + k, name: 'AI', model: MODELS[k % MODELS.length], color: CAR_COLORS[k % 10], aiTop: 0.7 + k * 0.01 }));
  const race = new Race({ track, mode: 'race', laps: 9, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'aero', color: CAR_COLORS[0] }], ai, energy: true, diff: 1 });
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

{ // Hard: a rival behind a leading player in a fast car hunts them down, shocks them and drives past; on Easy it can't
  const run = diff => {
    const track = Track.build(Object.assign(Track.random(() => 0.5), { obst: 0, curves: 0, hills: 0, length: 15 }));
    const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'flux', color: CAR_COLORS[0] }],
      ai: [{ id: 'A0', name: 'AI', model: 'wave', color: CAR_COLORS[2], aiTop: 0.95 }], diff });
    const h = race.humans[0], a = race.cars.find(c => !c.human);
    race.phase = 'race'; race.setTravel(h, 30000); race.setTravel(a, 22000); h.x = 0; a.x = a.aiLane = 0;
    h.speed = h.spec.top * K.MAX_SPEED; a.speed = 0.95 * K.MAX_SPEED;
    a.aiAggro = 1; a.shock = 1; a.aiFireT = 0; // aggressive and armed
    let shot = false;
    for (let s = 0; s < 120 * 12; s++) {
      race.update(K.STEP, [{ throttle: 1, brake: 0, steer: U.clamp(-h.x * 3, -1, 1), analog: false }]);
      shot = shot || h.shockT > 0;
    }
    return { shot, past: a.travel - h.travel };
  };
  const hard = run(2), easy = run(0);
  if (!hard.shot || !(hard.past > 0)) throw new Error(`hard: rival did not shock and pass the player (shot ${hard.shot}, ${Math.round(hard.past)} ahead)`);
  if (!(easy.past < 0)) throw new Error('easy: rival should not catch a player at top speed');
  console.log(`hard: rival shocks the leader and drives past (${Math.round(hard.past)} ahead after 12s), not on easy OK`);
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
await import('./pages.js'); // the touch menus' pages, tapped through
