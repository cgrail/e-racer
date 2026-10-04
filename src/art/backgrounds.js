import { U } from '../core/util.js';
import { S, make, R, P, E } from './draw.js';

// Parallax background layers (mountains, cities, clouds, ...) for each scenery.
const TAU = Math.PI * 2;
function ridge(n, rnd, comps, jag) {
  const ph = comps.map(() => rnd() * TAU), nz = Array.from({ length: n }, () => rnd() - 0.5), out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i % n) / n * TAU;
    let v = comps.reduce((a, [f, amp], k) => a + amp * Math.sin(t * f + ph[k]), 0.5);
    out.push(v + nz[i % n] * jag);
  }
  return out;
}
function fillRidge(g, W, H, ys, col, scale) {
  g.beginPath(); g.moveTo(0, H);
  ys.forEach((v, i) => g.lineTo(i / (ys.length - 1) * W, H - v * H * scale));
  g.lineTo(W, H); g.closePath();
  g.fillStyle = col; g.fill();
}
export function bgLayer(L, th) {
  const rnd = U.rng(U.hash(th.id + L.t + L.col));
  const W = 512;
  switch (L.t) {
    case 'mountains': return make(W, 128, (g, w, H) => {
      const ys = ridge(128, rnd, [[2, 0.2], [5, 0.13], [9, 0.07], [17, 0.04]], 0.05 * (L.jag || 1));
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, S(L.col, 1.15)); gr.addColorStop(1, S(L.col, 0.8));
      fillRidge(g, W, H, ys, gr, 0.95);
      if (L.cap) {
        g.save(); g.clip();
        const lvl = H * (L.capLevel || 0.42);
        g.fillStyle = L.cap; g.beginPath(); g.moveTo(0, 0);
        for (let i = 0; i <= 64; i++) g.lineTo(i / 64 * W, lvl + Math.sin(i * 2.7) * 4 + (rnd() - 0.5) * 8);
        g.lineTo(W, 0); g.closePath(); g.fill();
        g.restore();
      }
      g.strokeStyle = U.rgba('#ffffff', 0.18); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < ys.length - 1; i++) if (ys[i + 1] > ys[i]) {
        g.moveTo(i / 128 * W, H - ys[i] * H * 0.95); g.lineTo((i + 1) / 128 * W, H - ys[i + 1] * H * 0.95);
      }
      g.stroke();
    });
    case 'hills': return make(W, 64, (g, w, H) => {
      fillRidge(g, W, H, ridge(128, rnd, [[2, 0.18], [3, 0.12], [7, 0.06]], 0), L.col, 0.9);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    case 'dunes': return make(W, 48, (g, w, H) => {
      const ys = ridge(128, rnd, [[3, 0.15], [5, 0.1], [11, 0.04]], 0);
      fillRidge(g, W, H, ys, L.col, 0.85);
      g.strokeStyle = S(L.col, 1.25); g.beginPath();
      ys.forEach((v, i) => g.lineTo(i / 128 * W, H - v * H * 0.85 + 1)); g.stroke();
    });
    case 'treeline': return make(W, 48, (g, w, H) => {
      R(g, 0, H * 0.6, W, H * 0.4, L.col);
      for (let x = 0; x < W; x += 3 + rnd() * 5) {
        const tw = 6 + rnd() * 8, th2 = 8 + rnd() * 18, c = rnd() < 0.5 ? L.col : S(L.col, 0.85);
        for (const ox of [0, -W]) {
          P(g, c, [x + ox, H * 0.62, x + ox + tw / 2, H * 0.62 - th2, x + ox + tw, H * 0.62]);
          if (L.snow) P(g, '#e8f0f8', [x + ox + tw * 0.3, H * 0.62 - th2 * 0.6, x + ox + tw / 2, H * 0.62 - th2, x + ox + tw * 0.7, H * 0.62 - th2 * 0.6]);
        }
      }
    });
    case 'city': return make(W, 96, (g, w, H) => {
      let x = 0;
      while (x < W) {
        const bw = 8 + rnd() * 22, bh = H * (0.2 + rnd() * 0.7), c = S(L.col, 0.85 + rnd() * 0.3);
        R(g, x, H - bh, bw, bh, c);
        for (let y = H - bh + 3; y < H - 2; y += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3) if (rnd() < 0.35) R(g, wx, y, 1, 2, L.lit);
        if (rnd() < 0.15) { R(g, x + bw / 2, H - bh - 8, 1, 8, c); R(g, x + bw / 2, H - bh - 9, 1, 1, '#ff3030'); }
        x += bw + rnd() * 3;
      }
    });
    case 'mesas': return make(W, 96, (g, w, H) => {
      fillRidge(g, W, H, ridge(128, rnd, [[3, 0.05], [7, 0.03]], 0).map(v => v * 0.4), S(L.col, 0.85), 1);
      for (let k = 0; k < 6; k++) {
        const cx = rnd() * W, tw = 30 + rnd() * 60, ht = H * (0.4 + rnd() * 0.45), c = S(L.col, 0.9 + rnd() * 0.25);
        for (const ox of [0, -W, W]) {
          P(g, c, [cx + ox - tw, H, cx + ox - tw * 0.55, H - ht, cx + ox + tw * 0.55, H - ht, cx + ox + tw, H]);
          for (let y = H - ht + 6; y < H; y += 7) R(g, cx + ox - tw * 0.55 - (y - H + ht) * 0.4, y, tw * 1.1 + (y - H + ht) * 0.8, 1, U.rgba('#000000', 0.12));
          R(g, cx + ox - tw * 0.55, H - ht, tw * 1.1, 2, S(L.col, 1.3));
        }
      }
    });
    case 'neon': return make(W, 128, (g, w, H) => {
      const ys = ridge(64, rnd, [[2, 0.2], [5, 0.12], [9, 0.08]], 0.06);
      fillRidge(g, W, H, ys, '#170634', 0.9);
      g.save(); g.clip();
      g.strokeStyle = U.rgba(L.col, 0.35); g.lineWidth = 1;
      for (let y = H; y > 0; y -= 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      ys.forEach((v, i) => { const x = i / 64 * W; g.beginPath(); g.moveTo(x, H - v * H * 0.9); g.lineTo(x + (x - W / 2) * 0.1, H); g.stroke(); });
      g.restore();
      g.shadowColor = L.col; g.shadowBlur = 4; g.strokeStyle = L.col; g.lineWidth = 1.5;
      g.beginPath(); ys.forEach((v, i) => g.lineTo(i / 64 * W, H - v * H * 0.9)); g.stroke();
    });
    case 'clouds': return make(W, 64, (g, w, H) => {
      for (let k = 0; k < 9; k++) {
        const cx = rnd() * W, cy = 16 + rnd() * 34, sz = 8 + rnd() * 10;
        for (const ox of [0, -W, W]) {
          for (let i = 0; i < 6; i++) E(g, cx + ox + (i - 2.5) * sz * 0.8, cy - Math.sin(i / 5 * Math.PI) * sz * 0.5, sz, sz * 0.6, U.rgba(L.col, 0.85));
          E(g, cx + ox, cy + sz * 0.35, sz * 2.6, sz * 0.3, U.rgba('#b8c4d8', 0.6));
        }
      }
    });
  }
  return make(W, 8, () => {});
}
