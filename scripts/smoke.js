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
const { K } = await import('../src/util.js');
const { THEMES } = await import('../src/themes.js');
const { Track } = await import('../src/track.js');
const { Race, MODELS, CAR_COLORS } = await import('../src/race.js');
const { Render } = await import('../src/render.js');
const { Art } = await import('../src/art.js');

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
  const inp = { throttle: 1, brake: 0, steer: 0, analog: false, gearUp: false, gearDown: false };
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
