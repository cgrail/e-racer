import { K, U } from '../core/util.js';

// Per-view particles (dust, spray, sparks, boost) and weather (rain, snow, leaves, lightning).
export function particles(g, w, h, car, vs, dt, pw, by, th) {
  const ps = vs.parts || (vs.parts = []);
  const sp = car.speed / K.MAX_SPEED;
  const emit = (n, col, spread, up, size) => {
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      ps.push({ x: w / 2 + side * pw * 0.38, y: by - 3, vx: side * (10 + Math.random() * spread), vy: -(Math.random() * up), life: 0.5, col, size });
    }
  };
  if (dt > 0) {
    if (car.rough > 0.2 && Math.random() < car.rough) emit(1, U.shade(th.ground[0], 0.8), 60, 60, 3);
    if (car.splashT > 0) emit(3, 'rgba(200,220,255,0.8)', 120, 140, 2);
    if (car.skid > 0.4 && !car.offroad && Math.random() < 0.5) emit(1, 'rgba(220,220,220,0.5)', 30, 30, 4);
    if (car.boostT > 0) {
      ps.push({ x: w / 2 + (Math.random() - 0.5) * pw * 0.5, y: by - pw * 0.08, vx: 0, vy: 40, life: 0.18, col: Math.random() < 0.5 ? '#ffd040' : '#ff6020', size: 3 });
    }
  }
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt;
    if (p.life <= 0) { ps.splice(i, 1); continue; }
    g.fillStyle = p.col; g.globalAlpha = Math.min(1, p.life * 3);
    g.fillRect(p.x, p.y, p.size, p.size);
  }
  g.globalAlpha = 1;
  if (sp > 2) ps.length = 0;
}

export function weather(g, w, h, horizon, th, car, vs, dt, race) {
  const sp = car.speed / K.MAX_SPEED;
  if (th.weather === 'rain') {
    const drops = vs.rain || (vs.rain = Array.from({ length: 110 }, () => ({ x: Math.random() * w, y: Math.random() * h, l: 6 + Math.random() * 8 })));
    const slant = 0.2 + sp * 0.5 + race.wind * 0.6;
    g.strokeStyle = 'rgba(180,200,240,0.45)'; g.lineWidth = 1; g.beginPath();
    for (const d of drops) {
      d.y += (380 + sp * 300) * dt; d.x -= slant * 200 * dt;
      if (d.y > h) { d.y = -10; d.x = Math.random() * (w + 60); }
      if (d.x < -20) d.x += w + 40;
      g.moveTo(d.x, d.y); g.lineTo(d.x + slant * d.l, d.y - d.l);
    }
    g.stroke();
  } else if (th.weather === 'snow') {
    const fl = vs.snow || (vs.snow = Array.from({ length: 80 }, () => ({ x: Math.random() * w, y: Math.random() * h })));
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const f of fl) {
      f.x += ((f.x - w / 2) * sp * 1.3 + Math.sin(race.wtime + f.y) * 10) * dt;
      f.y += (25 + (f.y - horizon * 0.7) * sp * 1.3) * dt;
      if (f.x < 0 || f.x > w || f.y > h || f.y < 0) { f.x = w / 2 + (Math.random() - 0.5) * w * 0.7; f.y = Math.random() * h * 0.6; }
      const s = 1 + (Math.abs(f.x - w / 2) / w) * 3;
      g.fillRect(f.x, f.y, s, s);
    }
  } else if (th.weather === 'leaves') {
    const lv = vs.leaves || (vs.leaves = Array.from({ length: 26 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 6, c: U.pick(Math.random, ['#c8641e', '#d8a020', '#a8401a']) })));
    const dir = race.wind >= 0 ? 1 : -1;
    for (const l of lv) {
      l.x += (dir * (90 + Math.abs(race.wind) * 260) + (l.x - w / 2) * sp * 0.6) * dt;
      l.y += (30 + Math.sin(race.wtime * 3 + l.r) * 40) * dt; l.r += dt * 6;
      if (l.x < -10 || l.x > w + 10 || l.y > h) { l.x = dir > 0 ? -5 : w + 5; l.y = Math.random() * h * 0.8; }
      g.fillStyle = l.c; g.fillRect(l.x, l.y, 2 + Math.abs(Math.sin(l.r)) * 2, 2);
    }
  }
}
