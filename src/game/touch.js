import { K } from '../core/util.js';
import { Input } from '../core/input.js';
import { Art } from '../art/index.js';
import { MODELS, CAR_COLORS } from '../race/specs.js';
import { game, scenes } from './state.js';
import { rowsDrawn } from './ui.js';

// Touch controls for phones and tablets. They appear with the first touch and hide again on a key press, and
// each touch asks for fullscreen (in landscape) until the browser gives it. The game then fills the screen: a
// phone held upright gets it turned a quarter (style.css), so the game and this layer share a 'stage' frame.
// Racing: drag a finger left or right anywhere on the screen to steer (Input.setSteer); the car accelerates by
// itself (Input.setAuto); faint BRAKE and fire buttons sit under the right thumb, pause top right. The fire button
// says BOOST or FLASH for what the car holds (one at a time), and is blank while it holds neither.
// Elsewhere: a tap goes to the scene as a tap in canvas pixels (Input.tap: rowsNav picks the row, anything else
// takes it as OK); < and > in the bottom corners while the scene shows rows, BACK top left, all in the menus'
// panel style; and a text field brings up the keyboard while a name is typed.
// The buttons hold the keyboard's key codes (Input.virtual), so the scenes need nothing touch-specific.
let root = null, field = null, stick = null, fire = null, on = false, mode = '', item = '';
const held = new Set();

function press(code, down) {
  if (down) held.add(code); else held.delete(code);
  Input.virtual(code, down);
}

function el(tag, cls, parent, label) {
  const e = document.createElement(tag);
  e.className = cls;
  if (label) e.textContent = label;
  parent.appendChild(e);
  return e;
}
// A pointer in stage coordinates. Upright, the stage is turned a quarter clockwise: its x runs down the screen.
const upright = () => matchMedia('(orientation: portrait)').matches;

// The stage is the viewport less the status bar's safe-area inset at the top, where an iPhone fades whatever sits
// under it. (Home screen apps get an opaque status bar, index.html, so their viewport already starts below it: a
// see-through one gave a viewport short by the bar and clipped below that.) The camera in landscape and the home bar
// may overlap the stage, so the buttons keep clear of them (--l, --r, --t, --b on its edges).
let safe = null;
function fit() {
  if (!root) return;
  const s = getComputedStyle(safe), i = {};
  for (const k of ['Top', 'Right', 'Bottom', 'Left']) i[k] = parseFloat(s['padding' + k]) || 0;
  const up = upright(), w = innerWidth, y0 = i.Top, h = innerHeight - y0;
  const v = up ? [w, y0, h, w, 'rotate(90deg)'] : [0, y0, w, h, 'none'];
  const d = document.documentElement.style;
  ['--sl', '--st', '--sw', '--sh'].forEach((k, n) => d.setProperty(k, v[n] + 'px'));
  d.setProperty('--rot', v[4]);
  // the stage's left, right, top and bottom edges: turned, they are the screen's top, bottom, right and left
  const edges = up ? [0, i.Bottom, i.Right, i.Left] : [i.Left, i.Right, 0, i.Bottom];
  ['--l', '--r', '--t', '--b'].forEach((k, n) => root.style.setProperty(k, edges[n] + 'px'));
}
function local(e) {
  const b = root.getBoundingClientRect();
  return upright() ? { x: e.clientY - b.top, y: b.right - e.clientX } : { x: e.clientX - b.left, y: e.clientY - b.top };
}

// A button that holds code while a finger is on it.
function button(parent, cls, label, code) {
  const b = el('div', 'btn ' + cls, parent, label);
  const up = e => { b.classList.remove('on'); press(code, false); e.preventDefault(); };
  b.addEventListener('pointerdown', e => {
    b.setPointerCapture(e.pointerId); b.classList.add('on'); press(code, true); e.preventDefault();
  });
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  return b;
}

// Steering: the first finger down outside the buttons sets a centre, and its sideways distance from it steers.
// The centre trails the finger past full lock, so turning back starts at once.
function steering(layer) {
  const base = el('div', 'stick', layer), knob = el('div', 'knob', base);
  let id = null, ox = 0;
  const reach = () => Math.max(36, root.offsetWidth * 0.07);
  const set = x => {
    const r = reach();
    ox = Math.min(Math.max(ox, x - r), x + r);
    const v = (x - ox) / r;
    Input.setSteer(Math.abs(v) < 0.08 ? 0 : v);
    knob.style.transform = `translateX(${(v * 34).toFixed(0)}px)`;
  };
  const stop = () => { id = null; Input.setSteer(null); base.style.display = 'none'; };
  layer.addEventListener('pointerdown', e => {
    if (id != null || e.target.closest('.btn')) return;
    const p = local(e);
    id = e.pointerId; ox = p.x;
    layer.setPointerCapture(id);
    Object.assign(base.style, { left: p.x + 'px', top: p.y + 'px', display: 'block' });
    set(p.x);
  });
  layer.addEventListener('pointermove', e => { if (e.pointerId === id) set(local(e).x); });
  const up = e => { if (e.pointerId === id) stop(); };
  layer.addEventListener('pointerup', up);
  layer.addEventListener('pointercancel', up);
  return { stop };
}

// Menus: a short, still touch is a tap, handed over in canvas pixels.
function taps(layer) {
  const downs = new Map();
  layer.addEventListener('pointerdown', e => {
    if (!e.target.closest('.btn')) downs.set(e.pointerId, { ...local(e), t: e.timeStamp });
  });
  layer.addEventListener('pointerup', e => {
    const d = downs.get(e.pointerId), p = local(e);
    downs.delete(e.pointerId);
    if (!d || Math.hypot(p.x - d.x, p.y - d.y) > 16 || e.timeStamp - d.t > 600) return;
    Input.tap(p.x * K.W / root.offsetWidth, p.y * K.H / root.offsetHeight); // the canvas fills the stage
  });
  layer.addEventListener('pointercancel', e => downs.delete(e.pointerId));
}

function build() {
  root = el('div', 'touch', document.body);
  const drive = el('div', 'layer drive', root), menu = el('div', 'layer menu', root);
  stick = steering(drive);
  button(drive, 'tb brake', 'BRAKE', 'KeyS');
  fire = button(drive, 'tb fire', '', 'Space');
  button(drive, 'tb pause', '❚❚', 'Escape');
  taps(menu);
  button(menu, 'mb back', 'BACK', 'Escape');
  button(menu, 'mb prev', '<', 'ArrowLeft');
  button(menu, 'mb next', '>', 'ArrowRight');

  // Typing a name or course code: the field forwards characters, Enter and Esc to Input. Each change to its text
  // goes over as backspaces for what went and characters for what came, so a word an Android keyboard is still
  // composing ('C', 'CH', 'CHR'...) is left alone until it is done. Then the field goes back to a single space:
  // something left to delete, so Backspace always fires.
  field = el('input', 'type', root);
  Object.assign(field, { type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, value: ' ' });
  field.setAttribute('autocorrect', 'off');
  field.placeholder = 'TAP TO TYPE';
  let sent = ' ';
  const sync = done => {
    const v = field.value;
    let i = 0;
    while (i < v.length && v[i] === sent[i]) i++;
    Input.type('\b'.repeat(sent.length - i) + v.slice(i));
    sent = v;
    if (done) field.value = sent = ' ';
  };
  field.addEventListener('keydown', e => {
    e.stopPropagation();
    const code = e.key === 'Enter' ? 'Enter' : e.key === 'Escape' ? 'Escape' : null;
    if (code) { e.preventDefault(); Input.virtual(code, true); Input.virtual(code, false); field.blur(); }
  });
  field.addEventListener('input', e => sync(!e.isComposing));
  field.addEventListener('compositionend', () => sync(true));
  field.addEventListener('focus', () => { field.value = sent = ' '; });
}

function releaseAll() {
  [...held].forEach(c => press(c, false));
  root.querySelectorAll('.btn.on').forEach(b => b.classList.remove('on'));
  stick.stop();
}

function show(v) {
  on = v;
  if (v) fit();
  document.body.classList.toggle('touching', v);
  Input.setAuto(v);
  if (!v) releaseAll();
}

// The fire button's label: what player 1's car holds.
function showItem() {
  const c = game.race && game.race.humans.find(h => h.pidx === 0);
  const k = !c ? '' : c.power > 0 ? 'BOOST' : c.shock > 0 ? 'FLASH' : '';
  if (k === item) return;
  item = k; fire.textContent = k;
  fire.classList.toggle('boost', k === 'BOOST');
  fire.classList.toggle('flash', k === 'FLASH');
}

// Fullscreen needs a user gesture, so the first touch (and every one after, while it isn't on) asks for it.
// iPhone Safari has no fullscreen: there the game started from the home screen runs without the browser bars
// (index.html, manifest.webmanifest), and the title screen says so (Touch.homeHint).
const fsEnabled = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
function fullscreen(e) {
  const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
  if (e.pointerType !== 'touch' || !req || fsOn() || e.target === field) return;
  Promise.resolve(req.call(d, { navigationUI: 'hide' }))
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => {});
}
// The home screen icon: a car on the road at dusk, drawn like everything else.
function homeIcon() {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = c.height = 180;
  const sky = g.createLinearGradient(0, 0, 0, 180);
  [[0, '#101a70'], [0.5, '#ff2890'], [0.5, '#30303a'], [1, '#18181e']].forEach(([t, col]) => sky.addColorStop(t, col));
  g.fillStyle = sky; g.fillRect(0, 0, 180, 180);
  g.imageSmoothingEnabled = false;
  g.drawImage(Art.car(MODELS[0], CAR_COLORS[0], 0, false), 18, 72, 144, 80);
  document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'apple-touch-icon', href: c.toDataURL() }));
}

// The page stays put: no scrolling (which would also slide the browser bars in and out), and no double-tap
// or pinch zoom, which iOS Safari allows despite user-scalable=no. The text field keeps its own touches.
function noScroll() {
  let lastEnd = 0;
  const stop = e => { if (e.target !== field) e.preventDefault(); };
  document.addEventListener('touchend', e => {
    const now = e.timeStamp;
    if (now - lastEnd < 350) stop(e);
    lastEnd = now;
  }, { passive: false });
  document.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, stop, { passive: false });
}

export const Touch = {
  init() {
    if (typeof document === 'undefined' || !document.body) return; // headless smoke test
    build();
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !on) show(true); }, true);
    window.addEventListener('pointerup', fullscreen, true);
    window.addEventListener('keydown', () => { if (on) show(false); });
    noScroll();
    homeIcon();
    safe = el('div', 'safe', document.body);
    const refit = () => { fit(); setTimeout(fit, 300); }; // iOS settles its insets a moment after turning
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    if (window.visualViewport) visualViewport.addEventListener('resize', fit);
  },
  // Whether to tell the player that the home screen gives full screen: on touch, with no fullscreen to ask for.
  homeHint() { return on && !fsEnabled() && !standalone(); },
  // Called every frame: pick the layer for the current scene.
  update() {
    if (!root || !on) return;
    const racing = game.scene === scenes.RaceScene && !scenes.RaceScene.paused;
    if (racing) showItem();
    const rows = rowsDrawn();
    const m = racing ? 'drive' : 'menu' + (game.scene.editing ? ' typing' : rows ? ' rows' : '');
    if (m === mode) return;
    if (racing !== mode.startsWith('drive')) releaseAll();
    if (!game.scene.editing) field.blur();
    mode = m;
    root.className = 'touch ' + m;
  },
};
