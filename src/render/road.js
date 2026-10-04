import { K } from '../core/util.js';

// Road geometry: projecting segment edges to the screen and painting one road segment.
export function poly(g, col, x1, y1, x2, y2, x3, y3, x4, y4) {
  g.fillStyle = col; g.beginPath();
  g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4);
  g.closePath(); g.fill();
}
export function project(p, camX, camY, camZ, sx, sy, cx, horizon, roadW) {
  p.camera.x = -camX;
  p.camera.y = p.world.y - camY;
  p.camera.z = p.world.z - camZ;
  const s = K.CAM_DEPTH / p.camera.z;
  p.screen.scale = s;
  p.screen.x = Math.round(cx + s * p.camera.x * sx);
  p.screen.y = Math.round(horizon - s * p.camera.y * sy);
  p.screen.w = Math.round(s * roadW * sx);
}
export function blit(g, img, x, y, w, h) {
  g.imageSmoothingEnabled = w < img.width;
  g.drawImage(img, x, y, w, h);
}

export function segment(g, w, h, s, th, lanes) {
  const p1 = s.p1.screen, p2 = s.p2.screen;
  const x1 = p1.x, y1 = Math.min(p1.y, h + 2000), w1 = p1.w, x2 = p2.x, y2 = p2.y, w2 = p2.w;
  const k = s.alt ? 1 : 0;
  g.fillStyle = th.ground[k];
  g.fillRect(0, y2, w, Math.min(y1, h) - y2 + 1);
  if (th.grid && s.index % 6 === 0) { g.fillStyle = '#5a1a8a'; g.fillRect(0, y2, w, 1); }
  const r1 = w1 / Math.max(6, 2 * lanes), r2 = w2 / Math.max(6, 2 * lanes);
  poly(g, th.rumble[k], x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
  poly(g, th.rumble[k], x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2);
  poly(g, th.road[k], x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
  if (s.mark) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = -1 + (2 * i) / n, b = -1 + (2 * (i + 1)) / n;
      const col = s.mark === 'cp' ? (i % 2 ? '#ffd000' : '#111') : i % 2 ? '#ffffff' : '#111111';
      poly(g, col, x1 + w1 * a, y1, x1 + w1 * b, y1, x2 + w2 * b, y2, x2 + w2 * a, y2);
    }
  } else if (!s.alt && lanes > 1) {
    const l1 = w1 / Math.max(32, 8 * lanes), l2 = w2 / Math.max(32, 8 * lanes);
    for (let lane = 1; lane < lanes; lane++) {
      const f = -1 + (2 * lane) / lanes, lx1 = x1 + w1 * f, lx2 = x2 + w2 * f;
      poly(g, th.lane, lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2);
    }
  }
  if (th.night && s.index % 4 === 0) {
    const sz = Math.max(1, w1 * 0.012);
    g.fillStyle = '#ffe9a0';
    g.fillRect(x1 - w1 * 0.97, y1 - sz, sz, sz); g.fillRect(x1 + w1 * 0.97 - sz, y1 - sz, sz, sz);
  }
  if (s.fog < 0.995) {
    g.globalAlpha = 1 - s.fog; g.fillStyle = th.fogCol;
    g.fillRect(0, y2, w, Math.min(y1, h) - y2 + 1);
    g.globalAlpha = 1;
  }
}
