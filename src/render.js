import { K, U } from './util.js';
import { Art } from './art.js';

// Segment-based pseudo-3D renderer. Draws one player's view into a viewport (full screen or split).
export const Render = (() => {
  const layerCache = {};
  const STARS = Array.from({ length: 70 }, (_, i) => { const r = U.rng(i * 31 + 7); return [r(), r(), r()]; });

  function font(size) { return `${size}px "Press Start 2P", monospace`; }
  function text(g, s, x, y, size = 8, col = '#fff', align = 'left', shadow = '#000') {
    g.font = font(size); g.textAlign = align; g.textBaseline = 'top';
    if (shadow) { g.fillStyle = shadow; const o = Math.max(1, Math.round(size / 8)); g.fillText(s, x + o, y + o); }
    g.fillStyle = col; g.fillText(s, x, y);
  }
  function poly(g, col, x1, y1, x2, y2, x3, y3, x4, y4) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4);
    g.closePath(); g.fill();
  }
  function project(p, camX, camY, camZ, sx, sy, cx, horizon, roadW) {
    p.camera.x = -camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    const s = K.CAM_DEPTH / p.camera.z;
    p.screen.scale = s;
    p.screen.x = Math.round(cx + s * p.camera.x * sx);
    p.screen.y = Math.round(horizon - s * p.camera.y * sy);
    p.screen.w = Math.round(s * roadW * sx);
  }
  function blit(g, img, x, y, w, h) {
    g.imageSmoothingEnabled = w < img.width;
    g.drawImage(img, x, y, w, h);
  }

  // ------------------------------------------------------------ sky & background
  function sky(g, w, horizon, th, car, race) {
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
  function background(g, w, h, horizon, th, car, race) {
    const layers = layerCache[th.id] || (layerCache[th.id] = th.bg.map(L => Object.assign({ img: Art.bgLayer(L, th) }, L)));
    for (const L of layers) {
      const dh = Math.max(4, Math.round(h * L.h)), dw = (L.img.width * dh) / L.img.height;
      const off = U.wrap(car.bgOff * L.par * w * 0.0012 + (L.drift ? race.wtime * L.drift : 0), dw);
      const y = Math.round(horizon - dh + (L.y || 0) * h + 1);
      g.imageSmoothingEnabled = false;
      for (let x = -off; x < w; x += dw) g.drawImage(L.img, Math.floor(x), y, Math.ceil(dw) + 1, dh);
    }
  }

  // ------------------------------------------------------------ road
  function segment(g, w, h, s, th, lanes) {
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

  // ------------------------------------------------------------ main view
  // vp: {x,y,w,h}; car: the car the camera follows; vs: per-view persistent state; opts: {dt, hud, units}
  function view(g, vp, race, car, vs, opts) {
    const { w, h } = vp, T = race.track, th = T.theme, segs = T.segments, N = T.N;
    const split = h < 200;
    g.save();
    g.beginPath(); g.rect(vp.x, vp.y, w, h); g.clip();
    g.translate(vp.x, vp.y);
    const horizon = Math.round(h * (split ? 0.4 : 0.47)), sx = w / 2, sy = h - horizon;
    const sprMul = split ? 0.72 : 1;
    const DD = split ? 220 : 300;
    const camZ = U.wrap(car.z - K.PLAYER_Z, T.length);
    const base = T.findSegment(camZ), basePct = (camZ % K.SEG_LEN) / K.SEG_LEN;
    const camY = race.roadY(car.z) + K.CAM_H + car.jumpY * 0.7;
    const camX = car.x * T.roadW;
    const lanes = th.lanes || 2;

    sky(g, w, horizon, th, car, race);
    background(g, w, h, horizon, th, car, race);
    g.fillStyle = th.farGround; g.fillRect(0, horizon, w, h - horizon);

    // project near -> far
    const list = vs.list || (vs.list = []);
    const buckets = vs.buckets || (vs.buckets = []);
    list.length = 0;
    let x = 0, dx = -(base.curve * basePct);
    for (let n = 0; n < DD; n++) {
      const s = segs[(base.index + n) % N];
      const zc = camZ - (s.index < base.index ? T.length : 0);
      project(s.p1, camX - x, camY, zc, sx, sy, w / 2, horizon, T.roadW);
      project(s.p2, camX - x - dx, camY, zc, sx, sy, w / 2, horizon, T.roadW);
      x += dx; dx += s.curve;
      s.fog = U.expFog(n / DD, th.fog);
      list.push(s);
      if (buckets[n]) buckets[n].length = 0; else buckets[n] = [];
    }
    for (const c of race.cars) {
      if (c === car) continue;
      const n = U.wrap(Math.floor(c.z / K.SEG_LEN) - base.index, N);
      if (n < DD) buckets[n].push(c);
    }

    // paint far -> near: road, then that segment's sprites and cars
    const frameT = Math.floor(race.wtime * 8);
    for (let n = DD - 1; n >= 0; n--) {
      const s = list[n], p1 = s.p1.screen;
      if (s.p1.camera.z > K.CAM_DEPTH && s.p2.screen.y < s.p1.screen.y) segment(g, w, h, s, th, lanes);
      if (s.p1.camera.z < 60 || s.fog < 0.03) continue;
      const scale = p1.scale;
      g.globalAlpha = Math.min(1, s.fog * 1.2);
      for (const sp of s.sprites) {
        const d = Art.DEF[sp.name];
        const img = d.anim ? d.frames[(frameT + sp.v) % d.frames.length] : Art.get(sp.name, sp.v, sp.mirrored);
        const dw = sp.ww * scale * sx;
        if (dw < 0.5) continue;
        const dh = (dw * img.height) / img.width * sprMul;
        const bx = p1.x + scale * sp.offset * T.roadW * sx;
        const lx = sp.center ? bx - dw / 2 : sp.offset < 0 ? bx - dw : bx;
        if (lx > w || lx + dw < 0) continue;
        blit(g, img, lx, p1.y - dh, dw, dh);
      }
      for (const ob of s.obs) {
        if (ob.gone) continue;
        const img = Art.get(ob.name, ob.v);
        const dw = ob.ww * scale * sx;
        if (dw < 0.5) continue;
        const dh = (dw * img.height) / img.width * sprMul;
        const bx = p1.x + scale * ob.x * T.roadW * sx;
        const lift = ob.fly ? ob.fly.y * scale * sy : 0;
        blit(g, img, bx - dw / 2, p1.y - dh - lift, dw, dh);
      }
      const b = buckets[n];
      if (b.length > 1) b.sort((a, c) => c.z - a.z);
      for (const c of b) {
        const pct = (c.z % K.SEG_LEN) / K.SEG_LEN;
        const cs = U.lerp(s.p1.screen.scale, s.p2.screen.scale, pct);
        if (c.z - camZ < 0 && n === 0) continue;
        const cx = U.lerp(p1.x, s.p2.screen.x, pct) + cs * c.x * T.roadW * sx;
        const cy = U.lerp(p1.y, s.p2.screen.y, pct) - c.jumpY * cs * sy;
        const img = Art.car(c.model, c.color, c.frame, c.brake);
        const dw = K.CAR_W * cs * sx, dh = (dw * img.height) / img.width * sprMul;
        if (dw > w * 1.2) continue;
        blit(g, img, cx - dw / 2, cy - dh, dw, dh);
      }
      g.globalAlpha = 1;
    }
    g.globalAlpha = 1;

    // player car
    const pScale = 1 / K.CAM_H;
    const pw = K.CAR_W * pScale * sx;
    const img = Art.car(car.model, car.color, car.frame, car.brake);
    const ph = (pw * img.height) / img.width * sprMul;
    let by = h - 2 - car.jumpY * 0.3 * pScale * sy;
    if (car.speed > 200 && !car.air) by -= car.offroad ? Math.random() * 2.5 : (Math.floor(race.wtime * 24) % 2) * 0.6;
    const wig = car.crashT > 0 ? Math.sin(car.crashT * 40) * 3 : 0;
    if (th.night) {
      g.globalCompositeOperation = 'lighter';
      const lg = g.createLinearGradient(0, h, 0, horizon);
      lg.addColorStop(0, 'rgba(255,240,190,0.2)'); lg.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = lg; g.beginPath();
      g.moveTo(w / 2 - pw * 0.4, by - ph * 0.4); g.lineTo(w / 2 - w * 0.2, horizon + sy * 0.12);
      g.lineTo(w / 2 + w * 0.2, horizon + sy * 0.12); g.lineTo(w / 2 + pw * 0.4, by - ph * 0.4);
      g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    particles(g, w, h, car, vs, opts.dt || 0, pw, by, th);
    blit(g, img, Math.round(w / 2 - pw / 2 + wig), Math.round(by - ph), pw, ph);

    weather(g, w, h, horizon, th, car, vs, opts.dt || 0, race);
    if (race.flash > 0) { g.fillStyle = `rgba(230,235,255,${race.flash * 0.55})`; g.fillRect(0, 0, w, h); }
    if (opts.hud !== false) hud(g, w, h, race, car, split, opts);
    g.restore();
  }

  // ------------------------------------------------------------ effects
  function particles(g, w, h, car, vs, dt, pw, by, th) {
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

  function weather(g, w, h, horizon, th, car, vs, dt, race) {
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

  // ------------------------------------------------------------ HUD
  function hud(g, w, h, race, car, split, opts) {
    const pad = split ? 4 : 8, big = split ? 16 : 24, sm = 8;
    const kmh = opts.units === 1;
    if (race.mode === 'time') {
      text(g, 'TIME', pad, pad, sm, '#ffe040');
      const t = Math.ceil(car.timeLeft), low = t <= 10 && !car.finished;
      text(g, String(t), pad, pad + 11, big, low && Math.floor(race.wtime * 4) % 2 ? '#ff3030' : '#ffffff');
      const prog = U.clamp(car.travel / race.L, 0, 1), bw = split ? 120 : 160;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(w / 2 - bw / 2, pad + 11, bw, 5);
      g.fillStyle = '#60ff60'; g.fillRect(w / 2 - bw / 2, pad + 11, bw * prog, 5);
      for (const cp of race.track.cps) { g.fillStyle = '#ffd000'; g.fillRect(w / 2 - bw / 2 + (bw * cp) / race.L, pad + 9, 1, 9); }
      text(g, `STAGE  CP ${car.cpNext}/${race.track.cps.length}`, w / 2, pad, sm, '#ffffff', 'center');
    } else {
      text(g, 'POS', pad, pad, sm, '#ffe040');
      text(g, String(car.place), pad, pad + 11, big, '#ffffff');
      text(g, '/' + race.cars.length, pad + big * String(car.place).length + 2, pad + 11 + big - 8, sm, '#c0c8ff');
      text(g, `LAP ${U.clamp(car.lap, 1, race.laps)}/${race.laps}`, w / 2, pad, split ? 8 : 16, '#ffffff', 'center');
    }
    text(g, 'TIME ' + U.fmtTime(race.time), w - pad, pad, sm, '#ffffff', 'right');
    text(g, 'LAP  ' + U.fmtTime(car.lap >= 1 && !car.finished ? race.time - car.lapStart : car.lastLap), w - pad, pad + 10, sm, '#c0c8ff', 'right');
    if (car.bestLap && !split) text(g, 'BEST ' + U.fmtTime(car.bestLap), w - pad, pad + 20, sm, '#ffe040', 'right');

    // speed, gear, revs
    const v = Math.round((car.speed / K.MAX_SPEED) * K.MPH * (kmh ? 1.609 : 1));
    const yb = h - pad - (split ? 16 : 24);
    text(g, String(v).padStart(3, ' '), pad, yb, split ? 16 : 24, '#ffffff');
    text(g, kmh ? 'KM/H' : 'MPH', pad + (split ? 52 : 76), yb + (split ? 8 : 16), sm, '#ffe040');
    const gx = pad + (split ? 92 : 116), gs = split ? 16 : 22;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(gx, yb - 2, gs + 4, gs + 4);
    g.strokeStyle = '#ffe040'; g.lineWidth = 1; g.strokeRect(gx + 0.5, yb - 1.5, gs + 3, gs + 3);
    text(g, String(car.gear), gx + 2 + (gs - (split ? 8 : 16)) / 2, yb + (split ? 2 : 1), split ? 8 : 16, '#ffffff', 'left', null);
    text(g, car.manual ? 'M' : 'A', gx + gs + 8, yb + gs - 6, sm, '#c0c8ff');
    const bars = 16, bw = split ? 4 : 6, bh = split ? 14 : 22, rx = w - pad - bars * (bw + 1);
    const lit = Math.round(U.clamp(car.rpm, 0, 1.05) * bars);
    for (let i = 0; i < bars; i++) {
      const hh = Math.round(bh * (0.35 + (0.65 * i) / bars));
      g.fillStyle = i < lit ? (i < 10 ? '#40e040' : i < 13 ? '#ffe040' : '#ff3030') : 'rgba(0,0,0,0.45)';
      g.fillRect(rx + i * (bw + 1), h - pad - hh, bw, hh);
    }
    text(g, 'RPM', rx, h - pad - bh - 10, sm, '#ffe040');
    if (race.track.theme.wind) {
      const wd = race.wind, n = Math.min(3, Math.round(Math.abs(wd) * 4));
      text(g, 'WIND ' + (wd < 0 ? '<'.repeat(n) : '>'.repeat(n)), w - pad, h - pad - bh - (split ? 22 : 24), sm, '#a0d8ff', 'right');
    }

    // start lights
    if (race.phase === 'countdown') {
      const lx = w / 2 - 34, ly = split ? 26 : 40, lit = 3 - Math.ceil(race.count) + 1;
      g.fillStyle = '#111'; g.fillRect(lx, ly, 68, 24); g.strokeStyle = '#666'; g.strokeRect(lx + 0.5, ly + 0.5, 67, 23);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i < lit ? '#ff2020' : '#401010';
        g.beginPath(); g.arc(lx + 14 + i * 20, ly + 12, 7, 0, 7); g.fill();
      }
    } else if (race.time < 1 && !race.attract) {
      const lx = w / 2 - 34, ly = split ? 26 : 40;
      g.fillStyle = '#111'; g.fillRect(lx, ly, 68, 24);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#20ff40'; g.beginPath(); g.arc(lx + 14 + i * 20, ly + 12, 7, 0, 7); g.fill(); }
    }
    if (car.msg) {
      const fs = split ? 12 : 16, blink = car.msg.t > 90 || Math.floor(car.msg.t * 6) % 2 === 0 || car.msg.t < 1;
      if (blink) text(g, car.msg.text, w / 2, Math.round(h * (split ? 0.32 : 0.3)), fs, car.msg.col, 'center');
    }
  }

  return { view, text, font };
})();
