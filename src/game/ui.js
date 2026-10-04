import { K, U } from '../core/util.js';
import { Input } from '../core/input.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';
import { Render } from '../render/index.js';
import { CARSPEC, CAR_COLORS } from '../race/specs.js';
import { g, text } from './screen.js';
import { settings, saveAll } from './state.js';

// Menu widgets: panels, the logo, option rows, the car panel and course map / elevation previews, and the cards
// that touch menus show them on (game/page.js).

export function panel(x, y, w, h, title) {
  g.fillStyle = 'rgba(8,10,40,0.86)'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#4a6cff'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.strokeStyle = '#1c2a80'; g.lineWidth = 1; g.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  if (title) {
    const gr = g.createLinearGradient(0, y + 6, 0, y + 18);
    gr.addColorStop(0, '#3050ff'); gr.addColorStop(1, '#101a70');
    g.fillStyle = gr; g.fillRect(x + 6, y + 6, w - 12, 13);
    text(title, x + w / 2, y + 9, 8, '#ffe040', 'center');
  }
}
// 'ELECTRO' in chrome over 'CAR RACER' in gold; flat puts both on one line for menu headers.
export function logo(cx, y, size = 40, flat = false) {
  const sub = flat ? size : Math.round(size * 0.4);
  const parts = flat
    ? [['ELECTRO', cx - size * 8.5, y, size, 0], ['CAR RACER', cx - size * 0.5, y, size, 1]]
    : [['ELECTRO', cx - size * 3.5, y, size, 0], ['CAR RACER', cx - sub * 4.5, y + size + 6, sub, 1]];
  g.textAlign = 'left'; g.textBaseline = 'top';
  for (const [str, x, yy, sz, gold] of parts) {
    const x0 = Math.round(x), sh = Math.max(1, Math.round(sz / 20));
    g.font = Render.font(sz);
    g.fillStyle = '#0a0a30';
    for (const [dx, dy] of [[-sh, 0], [sh, 0], [0, -sh], [0, sh + 1], [sh + 1, sh + 1]]) g.fillText(str, x0 + dx, yy + dy);
    const gr = g.createLinearGradient(0, yy, 0, yy + sz);
    const stops = gold ? ['#fff6a0', '#ffb020', '#a02010', '#ffd060'] : ['#ffffff', '#a8ccff', '#2a3c90', '#d8e8ff'];
    [0, 0.45, 0.5, 1].forEach((t, i) => gr.addColorStop(t, stops[i]));
    g.fillStyle = gr; g.fillText(str, x0, yy);
  }
}
// Draws option rows lh apart. Returns the spacing.
export function rowsDraw(rows, sel, x, y, w, lh = 14) {
  rows.forEach((r, i) => {
    const on = i === sel;
    if (on) {
      const gr = g.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(255,40,160,0.6)'); gr.addColorStop(1, 'rgba(60,80,255,0.25)');
      g.fillStyle = gr; g.fillRect(x, y + i * lh - 3, w, lh - 1);
    }
    const yy = y + i * lh;
    text(r.label, x + 6, yy, 8, on ? '#ffffff' : r.action ? '#7fffb0' : '#9fb0ff');
    if (r.slider != null) {
      const cx = x + w - 6 - r.slider * 6;
      for (let k = 0; k < r.slider; k++) {
        g.fillStyle = k < r.val ? SLIDER(k) : 'rgba(255,255,255,0.12)';
        g.fillRect(cx + k * 6, yy, 5, 7);
      }
    } else if (r.opts) {
      const v = r.opts[r.val];
      text(on ? `< ${v} >` : v, x + w - 6, yy, 8, on ? '#ffe040' : '#ffc040', 'right');
    } else if (r.value) {
      text(r.value, x + w - 6, yy, 8, on ? '#ffe040' : '#ffc040', 'right');
    }
  });
  return lh;
}
// A slider's k-th notch: green, then yellow, then red.
export const SLIDER = k => (k < 5 ? '#40e040' : k < 10 ? '#ffe040' : '#ff5030');
// What a row does, for rowsNav and the touch menus' pages (game/page.js): set a value, step an option on (round
// and round) or a slider (held at its ends), or act.
export function rowSet(r, v) { r.set(v); Sound.fx.tick(); saveAll(); }
export function rowStep(r, step) { rowSet(r, r.slider != null ? U.clamp(r.val + step, 0, r.slider) : U.wrap(r.val + step, r.opts.length)); }
export function rowAct(r) { Sound.fx.select(); r.action(); }
export function rowsNav(rows, st) {
  const m = Input.menu();
  if (m.up) { st.sel = U.wrap(st.sel - 1, rows.length); Sound.fx.tick(); }
  if (m.down) { st.sel = U.wrap(st.sel + 1, rows.length); Sound.fx.tick(); }
  const r = rows[st.sel];
  if (r.slider != null || r.opts) {
    const step = (m.left ? -1 : 0) + (m.right ? 1 : 0) + (m.ok && r.opts ? 1 : 0);
    if (step) rowStep(r, step);
  } else if (m.ok && r.action) rowAct(r);
  return m;
}
// Which side the touch racing buttons sit (game/touch.js), for the menus while on touch.
export function buttonsRow() {
  return { key: 'buttons', label: 'BUTTONS', opts: ['LEFT', 'RIGHT'], val: settings.buttons, set: v => { settings.buttons = v; } };
}
// A player's name row (it goes on the number plate) for a menu scene st with editing, who, buf and t. On a page
// it is a text field (field: its value, how to clean what is typed, and what to do with it once typed).
export function nameRow(st, p, label) {
  const typing = st.editing && st.who === p;
  return { key: 'name' + p, label, car: p, value: typing ? st.buf + (blinkOn(st.t, 3) ? '_' : ' ') : settings.names[p] || '-',
    action: () => { st.editing = true; st.who = p; st.buf = settings.names[p]; },
    field: { value: settings.names[p], hint: 'YOUR NAME', clean: U.plateName, apply: v => { settings.names[p] = v; saveAll(); } } };
}
// While st.editing: letters and digits, up to 6; Enter keeps the name (with need, only once there is one), Esc cancels.
export function typeName(st, need = false) {
  for (const ch of Input.typed()) {
    if (ch === '\b') st.buf = st.buf.slice(0, -1);
    else if (/^[a-z0-9]$/i.test(ch) && st.buf.length < 6) { st.buf += ch.toUpperCase(); Sound.fx.tick(); }
  }
  if ((Input.pressed('Enter') || Input.pressed('NumpadEnter')) && (st.buf || !need)) {
    st.editing = false; settings.names[st.who] = st.buf; saveAll(); Sound.fx.select();
  } else if (Input.pressed('Escape')) { st.editing = false; Sound.fx.back(); }
}
export function carPanel(x, y, w, h, p, t, plate = settings.names[p]) {
  const model = settings.cars[p], spec = CARSPEC[model];
  panel(x, y, w, h, `PLAYER ${p + 1} CAR`);
  const frame = [0, 2, 0, -2][Math.floor(t / 1.2) % 4];
  const img = Art.car(model, CAR_COLORS[p], frame, Math.floor(t / 1.2) % 4 === 2, plate);
  g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 10, y + 24, w - 20, 82);
  g.drawImage(img, Math.round(x + w / 2 - 72), y + 26, 144, 80);
  text(spec.name, x + w / 2, y + 112, 8, '#ffffff', 'center');
  carBars(spec).forEach(([lab, v], i) => {
    const yy = y + 128 + i * 20;
    text(lab, x + 12, yy, 8, '#9fb0ff');
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 12, yy + 10, w - 24, 5);
    g.fillStyle = '#ffe040'; g.fillRect(x + 12, yy + 10, (w - 24) * v, 5);
  });
  text(carSpeed(spec), x + w / 2, y + 192, 8, '#7fffb0', 'center');
}
const carBars = spec => [['TOP SPEED', spec.top], ['ACCELERATION', spec.acc / 1.25], ['GRIP', spec.grip / 1.25]];
const carSpeed = spec => `${Math.round(spec.top * K.MPH * (settings.units ? 1.609 : 1))} ${settings.units ? 'KM/H' : 'MPH'}  ${spec.kw} KW`;
// carPanel as a card for a page (game/page.js), with the player's rows (under the player's head, so without the
// P1 or P2 in front).
export function carCard(p, rows, t, head = `PLAYER ${p + 1}`) {
  const model = settings.cars[p], spec = CARSPEC[model], plate = settings.names[p], k = Math.floor(t / 1.2) % 4;
  const draw = c => c.drawImage(Art.car(model, CAR_COLORS[p], [0, 2, 0, -2][k], k === 2, plate), 0, 0);
  rows = rows.map(r => Object.assign({}, r, { label: r.label.replace(/^P\d /, '') }));
  return { head, ico: '🚗', rows, pic: { w: 144, h: 80, key: model + plate + k, draw },
    lines: [[spec.name, '#ffffff'], [carSpeed(spec), '#7fffb0']], bars: carBars(spec) };
}
// How to drive on a touch screen, for the pages: a button as it looks while racing, and what it does.
export const TOUCH_DRIVE = [
  ['DRAG', 'steer', 'A FINGER ANYWHERE, LEFT OR RIGHT, TO STEER. THE CAR ACCELERATES BY ITSELF.'],
  ['BRAKE', 'brake', 'HALFWAY UP THE LEFT EDGE, UNDER YOUR THUMB (OR THE RIGHT: SEE BUTTONS).'],
  ['BOOST', 'boost', 'SUPER POWER, FOR LONGER THE FURTHER BACK YOU ARE.'],
  ['FLASH', 'flash', 'ZAPS THE CAR AHEAD. YOU HOLD A BOOST OR A FLASH, ONE AT A TIME.'],
  ['CELLS', 'cell', 'DRIVE THROUGH THEM TO RECHARGE YOUR BATTERY.'],
  ['❚❚', '', 'TOP RIGHT PAUSES.'],
];
export function drawMap(pv, x, y, w, h, col = '#ffffff', c = g) {
  const { pts } = pv;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [px, py] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  const s = Math.min((w - 12) / (x1 - x0 || 1), (h - 12) / (y1 - y0 || 1));
  const ox = x + w / 2 - ((x0 + x1) / 2) * s, oy = y + h / 2 - ((y0 + y1) / 2) * s;
  for (const [lw, stroke] of [[4, '#000'], [2, col]]) {
    c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(ox + px * s, oy + py * s) : c.moveTo(ox + px * s, oy + py * s)));
    c.closePath(); c.stroke();
  }
  const st = pts[Math.floor(K.START_SEG / 2)];
  c.fillStyle = '#ff3030'; c.fillRect(ox + st[0] * s - 3, oy + st[1] * s - 3, 6, 6);
}
export function drawProfile(pv, x, y, w, h, c = g) {
  const p = pv.prof;
  let lo = Math.min(...p), hi = Math.max(...p);
  if (hi - lo < 2000) { const m = (hi + lo) / 2; lo = m - 1000; hi = m + 1000; }
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y, w, h);
  c.fillStyle = '#4a8a3a'; c.beginPath(); c.moveTo(x, y + h);
  p.forEach((v, i) => c.lineTo(x + (i / (p.length - 1)) * w, y + h - 2 - ((v - lo) / (hi - lo)) * (h - 4)));
  c.lineTo(x + w, y + h); c.closePath(); c.fill();
}
export function blinkOn(t, rate = 2) { return Math.floor(t * rate) % 2 === 0; }
