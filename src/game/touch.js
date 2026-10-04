import { K } from '../core/util.js';
import { Input } from '../core/input.js';
import { cv } from './screen.js';
import { game, scenes } from './state.js';

// Touch controls for phones and tablets. They appear with the first touch and hide again on a key press, and
// each touch asks for fullscreen (in landscape) until the browser gives it.
// Racing: drag a finger left or right anywhere on the screen to steer (Input.setSteer); the car accelerates by
// itself (Input.setAuto); faint BRAKE, POWER and SHOCK buttons sit under the right thumb, pause top right.
// Elsewhere: a tap goes to the scene as a tap in canvas pixels (Input.tap: rowsNav picks the row, anything else
// takes it as OK), a faint BACK sits top left, and a text field brings up the keyboard while a name is typed.
// The buttons hold the keyboard's key codes (Input.virtual), so the scenes need nothing touch-specific.
let root = null, field = null, stick = null, on = false, mode = '';
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
// A button that holds code while a finger is on it.
function button(parent, cls, label, code) {
  const b = el('div', 'tb ' + cls, parent, label);
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
  const reach = () => Math.max(36, innerWidth * 0.07);
  const set = x => {
    const r = reach();
    ox = Math.min(Math.max(ox, x - r), x + r);
    const v = (x - ox) / r;
    Input.setSteer(Math.abs(v) < 0.08 ? 0 : v);
    knob.style.transform = `translateX(${(v * 34).toFixed(0)}px)`;
  };
  const stop = () => { id = null; Input.setSteer(null); base.style.display = 'none'; };
  layer.addEventListener('pointerdown', e => {
    if (id != null || e.target.closest('.tb')) return;
    id = e.pointerId; ox = e.clientX;
    layer.setPointerCapture(id);
    Object.assign(base.style, { left: ox + 'px', top: e.clientY + 'px', display: 'block' });
    set(e.clientX);
  });
  layer.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX); });
  const up = e => { if (e.pointerId === id) stop(); };
  layer.addEventListener('pointerup', up);
  layer.addEventListener('pointercancel', up);
  return { stop };
}

// Menus: a short, still touch is a tap, handed over in canvas pixels.
function taps(layer) {
  const downs = new Map();
  layer.addEventListener('pointerdown', e => {
    if (!e.target.closest('.tb')) downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
  });
  layer.addEventListener('pointerup', e => {
    const d = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 16 || e.timeStamp - d.t > 600) return;
    const b = cv.getBoundingClientRect();
    Input.tap((e.clientX - b.left) * K.W / b.width, (e.clientY - b.top) * K.H / b.height);
  });
  layer.addEventListener('pointercancel', e => downs.delete(e.pointerId));
}

function build() {
  root = el('div', 'touch', document.body);
  const drive = el('div', 'layer drive', root), menu = el('div', 'layer menu', root);
  stick = steering(drive);
  button(drive, 'brake', 'BRAKE', 'KeyS');
  button(drive, 'power', 'POWER', 'Space');
  button(drive, 'shock', 'SHOCK', 'KeyE');
  button(drive, 'corner pause', '❚❚', 'Escape');
  taps(menu);
  button(menu, 'corner back', 'BACK', 'Escape');

  // Typing a name or course code: the field forwards characters, Enter and Esc to Input.
  field = el('input', 'type', root);
  Object.assign(field, { type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, value: ' ' });
  field.setAttribute('autocorrect', 'off');
  field.placeholder = 'TAP TO TYPE';
  field.addEventListener('keydown', e => {
    e.stopPropagation();
    const code = e.key === 'Enter' ? 'Enter' : e.key === 'Escape' ? 'Escape' : null;
    if (code) { e.preventDefault(); Input.virtual(code, true); Input.virtual(code, false); field.blur(); }
  });
  field.addEventListener('input', e => {
    if (e.inputType && e.inputType.startsWith('delete')) Input.type('\b');
    else if (e.data) Input.type(e.data);
    field.value = ' '; // something left to delete, so Backspace always fires
  });
}

function releaseAll() {
  [...held].forEach(c => press(c, false));
  root.querySelectorAll('.tb.on').forEach(b => b.classList.remove('on'));
  stick.stop();
}

function show(v) {
  on = v;
  document.body.classList.toggle('touching', v);
  Input.setAuto(v);
  if (!v) releaseAll();
}

// Fullscreen needs a user gesture, so every touch asks while it isn't on (iPhone Safari has no fullscreen:
// there, adding the game to the home screen runs it without the browser bars).
function fullscreen(e) {
  const d = document.documentElement;
  if (e.pointerType !== 'touch' || document.fullscreenElement || !d.requestFullscreen || e.target === field) return;
  d.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
    .catch(() => {});
}

// iOS Safari ignores user-scalable=no: stop double-tap and pinch zoom by hand (not on the text field,
// which needs its tap to focus).
function noZoom() {
  let lastEnd = 0;
  const stop = e => { if (e.target !== field) e.preventDefault(); };
  document.addEventListener('touchend', e => {
    const now = e.timeStamp;
    if (now - lastEnd < 350) stop(e);
    lastEnd = now;
  }, { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) stop(e); }, { passive: false });
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
    noZoom();
  },
  // Called every frame: pick the layer for the current scene.
  update() {
    if (!root || !on) return;
    const racing = game.scene === scenes.RaceScene && !scenes.RaceScene.paused;
    const m = racing ? 'drive' : game.scene.editing ? 'menu typing' : 'menu';
    if (m === mode) return;
    if (racing !== mode.startsWith('drive')) releaseAll();
    if (!game.scene.editing) field.blur();
    mode = m;
    root.className = 'touch ' + m;
  },
};
