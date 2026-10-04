import { U } from '../core/util.js';

// Canvas helpers shared by all procedural art: offscreen canvases and pixel-art primitives.
export const S = U.shade;
export function make(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  return c;
}
export const flip = src => make(src.width, src.height, g => { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); });
export const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
export function P(g, c, p) {
  g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath(); g.fill();
}
export const C = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); g.fill(); };
export const E = (g, x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
export function glow(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, U.rgba(col, a)); gr.addColorStop(1, U.rgba(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
export function stripes(g, x, y, w, h, c1, c2, step) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  R(g, x, y, w, h, c1);
  for (let i = x - h; i < x + w + h; i += step * 2) P(g, c2, [i, y + h, i + step, y + h, i + step + h, y, i + h, y]);
  g.restore();
}
