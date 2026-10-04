import { K, U } from '../core/util.js';
import { Input } from '../core/input.js';
import { Sound } from '../audio/sound.js';
import { Art } from '../art/index.js';
import { Render } from '../render/index.js';
import { CARSPEC, CAR_COLORS } from '../race/specs.js';
import { g, text } from './screen.js';
import { settings, saveAll } from './state.js';

// Menu widgets: panels, the logo, option rows, the car panel and course map / elevation previews.
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
export function rowsDraw(rows, sel, x, y, w, lh = 14) {
  rows.forEach((r, i) => {
    const yy = y + i * lh, on = i === sel;
    if (on) {
      const gr = g.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(255,40,160,0.6)'); gr.addColorStop(1, 'rgba(60,80,255,0.25)');
      g.fillStyle = gr; g.fillRect(x, yy - 3, w, lh - 1);
    }
    text(r.label, x + 6, yy, 8, on ? '#ffffff' : r.action ? '#7fffb0' : '#9fb0ff');
    if (r.slider != null) {
      const cx = x + w - 6 - r.slider * 6;
      for (let k = 0; k < r.slider; k++) {
        g.fillStyle = k < r.val ? (k < 5 ? '#40e040' : k < 10 ? '#ffe040' : '#ff5030') : 'rgba(255,255,255,0.12)';
        g.fillRect(cx + k * 6, yy, 5, 7);
      }
    } else if (r.opts) {
      const v = r.opts[r.val];
      text(on ? `< ${v} >` : v, x + w - 6, yy, 8, on ? '#ffe040' : '#ffc040', 'right');
    } else if (r.value) {
      text(r.value, x + w - 6, yy, 8, on ? '#ffe040' : '#ffc040', 'right');
    }
  });
}
export function rowsNav(rows, st) {
  const m = Input.menu();
  if (m.up) { st.sel = U.wrap(st.sel - 1, rows.length); Sound.fx.tick(); }
  if (m.down) { st.sel = U.wrap(st.sel + 1, rows.length); Sound.fx.tick(); }
  const r = rows[st.sel];
  if (r.slider != null || r.opts) {
    const step = (m.left ? -1 : 0) + (m.right ? 1 : 0) + (m.ok && r.opts ? 1 : 0);
    if (step) {
      r.set(r.slider != null ? U.clamp(r.val + step, 0, r.slider) : U.wrap(r.val + step, r.opts.length));
      Sound.fx.tick(); saveAll();
    }
  } else if (m.ok && r.action) { Sound.fx.select(); r.action(); }
  return m;
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
  const bars = [['TOP SPEED', spec.top], ['ACCELERATION', spec.acc / 1.25], ['GRIP', spec.grip / 1.25]];
  bars.forEach(([lab, v], i) => {
    const yy = y + 128 + i * 20;
    text(lab, x + 12, yy, 8, '#9fb0ff');
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 12, yy + 10, w - 24, 5);
    g.fillStyle = '#ffe040'; g.fillRect(x + 12, yy + 10, (w - 24) * v, 5);
  });
  const mph = Math.round(spec.top * K.MPH * (settings.units ? 1.609 : 1));
  text(`${mph} ${settings.units ? 'KM/H' : 'MPH'}  ${spec.kw} KW`, x + w / 2, y + 192, 8, '#7fffb0', 'center');
}
export function drawMap(pv, x, y, w, h, col = '#ffffff') {
  const { pts } = pv;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [px, py] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  const s = Math.min((w - 12) / (x1 - x0 || 1), (h - 12) / (y1 - y0 || 1));
  const ox = x + w / 2 - ((x0 + x1) / 2) * s, oy = y + h / 2 - ((y0 + y1) / 2) * s;
  for (const [lw, c] of [[4, '#000'], [2, col]]) {
    g.strokeStyle = c; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(ox + px * s, oy + py * s) : g.moveTo(ox + px * s, oy + py * s)));
    g.closePath(); g.stroke();
  }
  const st = pts[Math.floor(K.START_SEG / 2)];
  g.fillStyle = '#ff3030'; g.fillRect(ox + st[0] * s - 3, oy + st[1] * s - 3, 6, 6);
}
export function drawProfile(pv, x, y, w, h) {
  const p = pv.prof;
  let lo = Math.min(...p), hi = Math.max(...p);
  if (hi - lo < 2000) { const m = (hi + lo) / 2; lo = m - 1000; hi = m + 1000; }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, h);
  g.fillStyle = '#4a8a3a'; g.beginPath(); g.moveTo(x, y + h);
  p.forEach((v, i) => g.lineTo(x + (i / (p.length - 1)) * w, y + h - 2 - ((v - lo) / (hi - lo)) * (h - 4)));
  g.lineTo(x + w, y + h); g.closePath(); g.fill();
}
export function blinkOn(t, rate = 2) { return Math.floor(t * rate) % 2 === 0; }
