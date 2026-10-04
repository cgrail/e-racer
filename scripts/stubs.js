// Browser stubs for the headless smoke test (smoke.js, flows.js): DOM, canvas, storage and a hand-driven
// animation frame, plus helpers that press keys through the game's real handlers.
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
export function canvas() {
  const c = { width: 300, height: 150, style: {}, requestFullscreen: () => Promise.resolve() };
  const g = context(c);
  c.getContext = () => g;
  return c;
}
const listeners = {};
export const define = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
define('window', { addEventListener: (type, fn) => (listeners[type] ||= []).push(fn) });
define('document', { createElement: canvas, getElementById: canvas, fullscreenElement: null });
define('navigator', { getGamepads: () => [] });
export const store = new Map();
define('localStorage', { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) });
let rafCb = null;
define('requestAnimationFrame', fn => { rafCb = fn; });

let now = 0;
export const hooks = []; // run before every frame (the online test's server and network)
export function frames(n, dt = 1 / 60) {
  for (let i = 0; i < n; i++) { now += dt * 1000; hooks.forEach(h => h(dt)); const cb = rafCb; rafCb = null; cb(now); }
}
export const key = (type, code, k = code.length === 1 ? code : code) =>
  (listeners[type] || []).forEach(fn => fn({ code, key: k, preventDefault() {} }));
export function tap(code, k) { key('keydown', code, k); frames(1); key('keyup', code, k); frames(1); }
export const hold = code => key('keydown', code);
export const release = code => key('keyup', code);
