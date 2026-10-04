// Headless smoke test: runs the real game modules in Node against stubbed browser APIs.
// It catches load-order, import and runtime errors in game flow, simulation and rendering;
// it says nothing about how things look. Usage: npm run smoke
import { registerHooks } from 'node:module';

registerHooks({ // CSS imports are Vite's job; treat them as empty modules here
  load(url, ctx, next) {
    return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, ctx);
  },
});

// ---------------------------------------------------------------- browser stubs
const gradient = { addColorStop() {} };
function context(canvas) {
  const t = { canvas };
  return new Proxy(t, {
    get: (o, k) => (k in o ? o[k] : k === 'measureText' ? s => ({ width: String(s).length * 8 }) : () => gradient),
    set: (o, k, v) => { o[k] = v; return true; },
  });
}
function canvas() {
  const c = { width: 300, height: 150, style: {}, requestFullscreen: () => Promise.resolve() };
  const g = context(c);
  c.getContext = () => g;
  return c;
}
const listeners = {};
const define = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
define('window', { addEventListener: (type, fn) => (listeners[type] ||= []).push(fn) });
define('document', { createElement: canvas, getElementById: canvas, fullscreenElement: null });
define('navigator', { getGamepads: () => [] });
const store = new Map();
define('localStorage', { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) });
let rafCb = null;
define('requestAnimationFrame', fn => { rafCb = fn; });

let now = 0;
function frames(n, dt = 1 / 60) {
  for (let i = 0; i < n; i++) { now += dt * 1000; const cb = rafCb; rafCb = null; cb(now); }
}
const key = (type, code, k = code.length === 1 ? code : code) =>
  (listeners[type] || []).forEach(fn => fn({ code, key: k, preventDefault() {} }));
function tap(code, k) { key('keydown', code, k); frames(1); key('keyup', code, k); frames(1); }
const hold = code => key('keydown', code);
const release = code => key('keyup', code);

// ---------------------------------------------------------------- module-level checks
const { K, U } = await import('../src/core/util.js');
const { THEMES } = await import('../src/world/themes.js');
const { Track } = await import('../src/world/track.js');
const { Race } = await import('../src/race/race.js');
const { MODELS, CAR_COLORS } = await import('../src/race/specs.js');
const { Render } = await import('../src/render/index.js');
const { Art } = await import('../src/art/index.js');

for (const m of MODELS) for (let f = -2; f <= 2; f++) for (const b of [false, true]) Art.car(m, CAR_COLORS[0], f, b);
const g = canvas().getContext('2d');
THEMES.forEach((th, i) => {
  const params = Object.assign(Track.random(() => 0.5), { scenery: i, obst: 15 });
  const track = Track.build(params, i % 2 ? { checkpoints: 4, scale: 1.8 } : {});
  if (Track.encode(Track.decode(track.code)) !== track.code) throw new Error('course code does not round-trip: ' + track.code);
  const humans = [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: MODELS[i % 3], color: CAR_COLORS[0] },
    { id: 'P2', name: 'P2', human: true, pidx: 1, model: MODELS[(i + 1) % 3], color: CAR_COLORS[1] }];
  const ai = Array.from({ length: 8 }, (_, k) => ({ id: 'A' + k, name: 'AI', model: MODELS[k % 3], color: CAR_COLORS[k + 2], aiTop: 0.8 }));
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

{ // electric drive: single speed up to top speed, the kW meter reads power drawn and goes negative under regen
  const track = Track.build(Object.assign(Track.random(() => 0.5), { obst: 0, curves: 0, hills: 0 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'volt', color: CAR_COLORS[0] }], ai: [] });
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
  const ai = Array.from({ length: 6 }, (_, k) => ({ id: 'A' + k, name: 'AI', model: MODELS[k % 3], color: CAR_COLORS[k + 2], aiTop: 0.4 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'volt', color: CAR_COLORS[0] }], ai, energy: true });
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
  const before = h.travel;
  if (h.place === race.cars.length) throw new Error('energy: player should be ahead of someone before running flat');
  h.energy = 0.0001;
  for (let s = 0; s < 10; s++) race.update(K.STEP, [inp]);
  if (!(h.travel < before) || h.place !== race.cars.length || !(h.energy > 0.5)) {
    throw new Error(`energy: running flat did not drop the car to last (travel ${before} -> ${h.travel}, place ${h.place}, energy ${h.energy})`);
  }
  console.log(`energy: ${cells.length} cells, collected up to ${took} per lap, flat battery drops to last OK`);
}

{ // power-ups: orbs get collected, a charge fires super power past top speed and smashes barriers
  const track = Track.build(Object.assign(Track.random(() => 0.6), { obst: 0, length: 15 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'spark', color: CAR_COLORS[0] }], ai: [], power: true });
  const h = race.humans[0];
  const orbs = track.segments.flatMap(sg => sg.obs.filter(o => o.fx === 'power').map(o => ({ o, z: sg.index * K.SEG_LEN })));
  if (orbs.length < 2) throw new Error('power: too few orbs placed');
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false, power: false };
  for (let s = 0; s < 120 * 40 && !h.power; s++) {
    const next = orbs.find(c => U.wrap(c.z - h.z, race.L) < 6000);
    inp.steer = next ? U.clamp((next.o.x - h.x) * 4, -1, 1) : 0;
    race.update(K.STEP, [inp]);
  }
  if (!h.power) throw new Error('power: no orb collected');
  const seg = track.findSegment(h.z + 3000), barrier = { name: 'barrier', v: 0, x: h.x, bx: h.x, ww: 1300, hw: 0.4, fx: 'crash', hit: false, fly: null };
  seg.obs.push(barrier);
  race.update(K.STEP, [Object.assign({}, inp, { steer: 0, power: true })]);
  if (!(h.superT > 0) || h.power !== 0) throw new Error('power: charge did not fire');
  let top = 0;
  for (let s = 0; s < 120 * 2.5; s++) { race.update(K.STEP, [Object.assign({}, inp, { steer: U.clamp(-h.x * 3, -1, 1) })]); top = Math.max(top, h.speed); }
  if (!(top > h.spec.top * K.MAX_SPEED)) throw new Error('power: super power did not pass top speed');
  if (!barrier.hit || h.crashT > 0) throw new Error('power: barrier was not smashed aside');
  console.log(`power: ${orbs.length} orbs, charge fired, ${Math.round(top / (h.spec.top * K.MAX_SPEED) * 100)}% of top speed, barrier smashed OK`);
}

{ // rubber band: rivals far ahead of the humans slow down, far behind speed up, close ones race unaided
  const track = Track.build(Track.random(() => 0.4));
  const ai = [0, 1, 2].map(k => ({ id: 'A' + k, name: 'AI', model: 'volt', color: CAR_COLORS[k + 2], aiTop: 0.8 }));
  const race = new Race({ track, mode: 'race', laps: 3, humans: [{ id: 'P1', name: 'P1', human: true, pidx: 0, model: 'volt', color: CAR_COLORS[0] }], ai, diff: 0 });
  const [a, b, c] = race.cars.filter(x => !x.human), h = race.humans[0];
  race.setTravel(h, 100000); race.setTravel(a, 200000); race.setTravel(b, 101000); race.setTravel(c, 10000);
  const fa = race.rubberBand(a), fb = race.rubberBand(b), fc = race.rubberBand(c);
  if (!(fa < 0.9 && fb === 1 && fc > 1.1)) throw new Error(`rubber band factors wrong: ahead ${fa}, close ${fb}, behind ${fc}`);
  console.log(`rubber band: ahead x${fa.toFixed(2)}, close x${fb}, behind x${fc.toFixed(2)} OK`);
}

{ // audio: a stub Web Audio graph; every song sequences a full loop, and the game flow below runs with sound on
  const made = {};
  const node = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : /^(frequency|gain|Q|pan|threshold|ratio)$/.test(k) ? (o[k] = node()) : () => {}) });
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
  Sound.stopMusic(); window.AudioContext = undefined;
  console.log(`music: ${Sound.songs.length} songs sequenced (${Sound.songs.join(', ')}) OK`);
}

// ---------------------------------------------------------------- game flow through the real key handlers
await import('../src/main.js');
const expect = name => { if (window.__ecr.scene !== name) throw new Error(`expected scene ${name}, got ${window.__ecr.scene}`); };
const moved = () => { if (!(window.__ecr.race.humans.every(h => h.travel > 2000))) throw new Error('player cars did not drive'); };
frames(5);
tap('Enter'); expect('MainMenu'); // title -> main menu
tap('ArrowUp'); tap('Enter'); // wrap to START GAME (championship)
frames(5); expect('PreRace'); tap('Enter'); expect('RaceScene'); // pre-race -> race
hold('ArrowUp'); frames(60 * 20); release('ArrowUp'); moved();
tap('Escape'); tap('ArrowUp'); tap('Enter'); // pause -> QUIT TO MENU (menu cursor stays on START)
expect('MainMenu');
tap('ArrowDown'); tap('Enter'); // PLAYERS -> 2 players
tap('ArrowDown'); tap('Enter'); // GAME -> time challenge
tap('ArrowUp'); tap('ArrowUp'); tap('Enter'); frames(5); tap('Enter'); expect('RaceScene');
if (window.__ecr.race.mode !== 'time' || window.__ecr.race.humans.length !== 2) throw new Error('expected a 2P time challenge');
hold('KeyW'); hold('ArrowUp'); frames(60 * 20); release('KeyW'); release('ArrowUp'); moved();
tap('Escape'); tap('ArrowUp'); tap('Enter');
tap('ArrowDown'); tap('ArrowDown'); tap('Enter'); // GAME -> course builder
tap('ArrowUp'); tap('ArrowUp'); tap('Enter'); expect('Builder'); // BUILD COURSE
for (let i = 0; i < 12; i++) tap('ArrowDown');
tap('Enter'); frames(5); tap('Enter'); expect('RaceScene'); // RACE! -> pre-race -> race
hold('KeyW'); hold('ArrowUp'); frames(60 * 10); moved();
console.log('game flow: title, menu, championship, 2P time challenge, course builder race OK');
