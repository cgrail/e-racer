import { U } from '../core/util.js';
import { Art } from '../art/index.js';

// Sky gradient, sun/moon/stars and the scrolling parallax background layers.
const layerCache = {};
const STARS = Array.from({ length: 70 }, (_, i) => { const r = U.rng(i * 31 + 7); return [r(), r(), r()]; });

export function sky(g, w, horizon, th, car, race) {
  const gr = g.createLinearGradient(0, 0, 0, horizon);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
  g.fillStyle = gr; g.fillRect(0, 0, w, horizon + 1);
  if (th.stars) {
    for (const [x, y, b] of STARS) {
      const tw = 0.5 + 0.5 * Math.sin(race.wtime * 2 + b * 20);
      g.fillStyle = `rgba(255,255,255,${0.3 + b * 0.5 * tw})`;
      g.fillRect(Math.floor(U.wrap(x * w - car.bgOff * 0.15, w)), Math.floor(y * horizon * 0.8), 1, 1);
    }
  }
  const bodyX = o => U.wrap(o.x * w - car.bgOff * w * 0.0004 + 60, w + 120) - 60;
  if (th.moon) {
    const x = bodyX(th.moon), y = horizon * th.moon.y;
    g.fillStyle = 'rgba(255,255,220,0.12)'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
    g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
    g.fillStyle = th.sky[0]; g.beginPath(); g.arc(x + 4, y - 2, 8, 0, 7); g.fill();
  }
  if (th.sun) {
    const sn = th.sun, x = bodyX(sn), y = horizon * sn.y, r = Math.round(sn.r * w / 480);
    if (sn.retro) {
      const sg = g.createLinearGradient(0, y - r, 0, y + r);
      sg.addColorStop(0, '#ffe050'); sg.addColorStop(1, '#ff2aa0');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = th.sky[1];
      for (let k = 0; k < 5; k++) g.fillRect(x - r, y + k * r * 0.2 + 2, r * 2, 1 + k * 0.6);
    } else {
      const sg = g.createRadialGradient(x, y, 0, x, y, r * 3);
      sg.addColorStop(0, U.rgba(sn.col, 0.6)); sg.addColorStop(1, U.rgba(sn.col, 0));
      g.fillStyle = sg; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      g.fillStyle = sn.col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }
}
export function background(g, w, h, horizon, th, car, race) {
  const layers = layerCache[th.id] || (layerCache[th.id] = th.bg.map(L => Object.assign({ img: Art.bgLayer(L, th) }, L)));
  for (const L of layers) {
    const dh = Math.max(4, Math.round(h * L.h)), dw = (L.img.width * dh) / L.img.height;
    const off = U.wrap(car.bgOff * L.par * w * 0.0012 + (L.drift ? race.wtime * L.drift : 0), dw);
    const y = Math.round(horizon - dh + (L.y || 0) * h + 1);
    g.imageSmoothingEnabled = false;
    for (let x = -off; x < w; x += dw) g.drawImage(L.img, Math.floor(x), y, Math.ceil(dw) + 1, dh);
  }
}
