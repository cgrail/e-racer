import { Input } from '../core/input.js';
import { game, scenes } from './state.js';

// On-screen controls for phones and tablets. They appear with the first touch and hide again on a key press.
// Racing: steering pad, BRAKE, POWER, SHOCK and pause; the car accelerates by itself (Input.setAuto).
// Elsewhere: a d-pad, OK and BACK, plus a text field that brings up the keyboard while a name or code is typed.
// The buttons hold the same key codes as the keyboard (Input.virtual), so every scene works unchanged.
let root = null, field = null, on = false, mode = '';
const held = new Set();

function press(code, down) {
  if (down) held.add(code); else held.delete(code);
  Input.virtual(code, down);
}
function releaseAll() { [...held].forEach(c => press(c, false)); }

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
// One pad for both steering directions, so a thumb can slide from left to right without lifting.
function steerPad(parent) {
  const pad = el('div', 'steer', parent);
  const l = el('div', 'tb', pad, '◀'), r = el('div', 'tb', pad, '▶');
  const fingers = new Map();
  const apply = () => {
    const sides = [...fingers.values()];
    const left = sides.includes(-1), right = sides.includes(1);
    l.classList.toggle('on', left); r.classList.toggle('on', right);
    if (left !== held.has('KeyA')) press('KeyA', left);
    if (right !== held.has('KeyD')) press('KeyD', right);
  };
  const side = e => { const b = pad.getBoundingClientRect(); return e.clientX < b.left + b.width / 2 ? -1 : 1; };
  pad.addEventListener('pointerdown', e => {
    pad.setPointerCapture(e.pointerId); fingers.set(e.pointerId, side(e)); apply(); e.preventDefault();
  });
  pad.addEventListener('pointermove', e => { if (fingers.has(e.pointerId)) { fingers.set(e.pointerId, side(e)); apply(); } });
  const up = e => { fingers.delete(e.pointerId); apply(); };
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.reset = () => { fingers.clear(); apply(); };
  return pad;
}

function build() {
  root = el('div', 'touch', document.body);
  const drive = el('div', 'layer drive', root), menu = el('div', 'layer menu', root);
  const pad = steerPad(el('div', 'left', drive));
  const right = el('div', 'right', drive);
  button(right, 'small', 'SHOCK', 'KeyE');
  button(right, 'small', 'POWER', 'Space');
  button(right, 'big', 'BRAKE', 'KeyS');
  button(drive, 'corner', '❚❚', 'Escape');

  const dpad = el('div', 'left dpad', menu);
  [['▲', 'ArrowUp', 'u'], ['◀', 'ArrowLeft', 'l'], ['▶', 'ArrowRight', 'r'], ['▼', 'ArrowDown', 'd']]
    .forEach(([t, code, cls]) => button(dpad, cls, t, code));
  const ok = el('div', 'right', menu);
  button(ok, 'small', 'BACK', 'Escape');
  button(ok, 'big', 'OK', 'Enter');

  const root2 = document.documentElement;
  if (root2.requestFullscreen) {
    const fs = el('div', 'tb corner fs', root, '⛶');
    fs.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      root2.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
        .catch(() => {});
    });
  }

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
  root.pad = pad;
}

function show(v) {
  on = v;
  document.body.classList.toggle('touching', v);
  Input.setAuto(v);
  if (!v) { releaseAll(); root.pad.reset(); }
}

export const Touch = {
  init() {
    if (typeof document === 'undefined' || !document.body) return; // headless smoke test
    build();
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !on) show(true); }, true);
    window.addEventListener('keydown', () => { if (on) show(false); });
  },
  // Called every frame: pick the layer for the current scene.
  update() {
    if (!root || !on) return;
    const racing = game.scene === scenes.RaceScene && !scenes.RaceScene.paused;
    const m = racing ? 'drive' : game.scene.editing ? 'menu typing' : 'menu';
    if (m === mode) return;
    if (racing !== mode.startsWith('drive')) { releaseAll(); root.pad.reset(); }
    if (!game.scene.editing) field.blur();
    mode = m;
    root.className = 'touch ' + m;
  },
};
