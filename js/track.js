'use strict';

// Course builder: generates a course from slider parameters or a course code.
// A course is fully described by 8 parameters (0-15) plus a seed, encoded as a 10-letter code.
// Any other word typed in as a code is hashed into a course too.
const Track = (() => {
  const LETTERS = 'ABCDEFGHIJKLMNOP';
  const KEYS = ['curves', 'sharp', 'hills', 'steep', 'scatter', 'obst', 'length', 'scenery'];

  function encode(p) {
    let s = '';
    for (const k of KEYS) s += LETTERS[U.clamp(p[k] | 0, 0, 15)];
    const sd = U.wrap(p.seed | 0, 676);
    return s + String.fromCharCode(65 + Math.floor(sd / 26), 65 + (sd % 26));
  }
  function decode(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
    const p = {};
    if (/^[A-P]{8}[A-Z]{2}$/.test(c)) {
      KEYS.forEach((k, i) => { p[k] = LETTERS.indexOf(c[i]); });
      p.seed = (c.charCodeAt(8) - 65) * 26 + (c.charCodeAt(9) - 65);
    } else {
      const r = U.rng(U.hash(c || 'ELECTRO'));
      for (const k of KEYS) p[k] = Math.floor(r() * 16);
      p.seed = Math.floor(r() * 676);
    }
    p.scenery %= THEMES.length;
    return p;
  }
  function random(rnd = Math.random) {
    const p = {};
    for (const k of KEYS) p[k] = Math.floor(rnd() * 16);
    p.scenery = Math.floor(rnd() * THEMES.length);
    p.seed = Math.floor(rnd() * 676);
    return p;
  }

  // opts.checkpoints: number of checkpoint gantries (time challenge); opts.scale: course length multiplier
  function build(params, opts = {}) {
    const P = params, theme = THEMES[P.scenery % THEMES.length];
    const code = encode(P);
    const rnd = U.rng(U.hash(code + (opts.scale || 1)));
    const roadW = K.ROAD_W * (theme.roadScale || 1);
    const segs = [];
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.world.y : 0);

    function seg(curve, y) {
      const n = segs.length;
      segs.push({
        index: n, curve, alt: Math.floor(n / K.RUMBLE_LEN) % 2 === 1, mark: null, fog: 1,
        p1: { world: { y: lastY(), z: n * K.SEG_LEN }, camera: {}, screen: {} },
        p2: { world: { y, z: (n + 1) * K.SEG_LEN }, camera: {}, screen: {} },
        sprites: [], obs: [],
      });
    }
    function road(enter, hold, leave, curve, y) {
      const y0 = lastY(), tot = enter + hold + leave;
      for (let n = 0; n < enter; n++) seg(U.easeIn(0, curve, n / enter), U.easeInOut(y0, y, (n + 1) / tot));
      for (let n = 0; n < hold; n++) seg(curve, U.easeInOut(y0, y, (enter + n + 1) / tot));
      for (let n = 0; n < leave; n++) seg(U.easeInOut(curve, 0, n / leave), U.easeInOut(y0, y, (enter + hold + n + 1) / tot));
    }

    // ---- road shape
    const cs = theme.curveScale || 1, hs = theme.hillScale || 1;
    const target = (700 + P.length * 150) * (opts.scale || 1);
    const curveProb = 0.25 + (P.curves / 15) * 0.6;
    const maxCurve = Math.min(7, (1.2 + (P.sharp / 15) * 5.3) * cs);
    const hillProb = (P.hills / 15) * 0.9;
    const maxH = (500 + (P.steep / 15) * 7500) * hs;
    road(0, K.START_SEG + 40, 0, 0, 0);
    while (segs.length < target - 150) {
      const L = [15, 25, 40, 60][Math.floor(rnd() * 4)];
      const enter = Math.round(L * (0.4 + rnd() * 0.4)), hold = Math.round(L * (0.3 + rnd() * 1.4));
      let curve = 0, y = lastY();
      if (rnd() < curveProb) curve = (rnd() < 0.5 ? -1 : 1) * maxCurve * (0.3 + 0.7 * rnd());
      if (hillProb > 0 && rnd() < hillProb) y = (rnd() * 2 - 1) * maxH;
      else if (rnd() < 0.4) y *= 0.4;
      road(enter, hold, enter, curve, y);
      if (curve && rnd() < 0.3) {
        const y2 = hillProb > 0 && rnd() < hillProb ? U.clamp(y + (rnd() * 2 - 1) * maxH * 0.5, -maxH, maxH) : y;
        road(enter, hold, enter, -curve * (0.6 + rnd() * 0.4), y2);
      }
      if (rnd() < 0.3 - (P.curves / 15) * 0.2) road(10, 20 + Math.floor(rnd() * 50), 10, 0, lastY());
    }
    road(40, 30, 40, 0, 0);
    road(0, 40, 0, 0, 0);

    const N = segs.length, S0 = K.START_SEG;

    // ---- roadside scenery
    function put(i, name, offset, extra) {
      const d = Art.DEF[name], s = segs[U.wrap(i, N)];
      const center = extra && extra.center;
      const ww = (extra && extra.ww) || d.ww, wN = ww / roadW;
      const side = offset < 0 ? -1 : 1;
      const mirrored = !!d.mirror && side > 0;
      const left = center ? offset - wN / 2 : side < 0 ? offset - wN : offset;
      const fx = mirrored ? 1 - d.hx : d.hx;
      s.sprites.push({
        name, v: Math.floor(rnd() * d.v), offset, ww, mirrored, center: !!center,
        hx: left + fx * wN, hw: (d.hit * wN) / 2, solid: d.hit > 0 && d.fx !== 'soft',
      });
    }
    const scat = 0.03 + (P.scatter / 15) * 0.5;
    const lampName = theme.night ? 'lampon' : 'lamp';
    for (let i = 0; i < N; i++) {
      const s = segs[i];
      if (Math.abs(i - S0) > 2) {
        for (const side of [-1, 1]) {
          if (rnd() < scat) {
            const name = U.pickWeighted(rnd, theme.scenery);
            const near = rnd() < 0.5;
            put(i, name, side * (1.25 + (near ? rnd() * 0.6 : 0.6 + rnd() * rnd() * 4)));
          }
        }
      }
      if (theme.lamps && i % theme.lamps === 0) { put(i, lampName, -1.12); put(i, lampName, 1.12); }
      if (Math.abs(s.curve) > 2.2 && i % 5 === 0) put(i, s.curve > 0 ? 'chevR' : 'chevL', (s.curve > 0 ? -1 : 1) * 1.15);
    }
    s0Decor();
    function s0Decor() {
      put(S0, 'gantry', 0, { center: true, ww: roadW * 2.6 });
      segs[S0].mark = 'start';
      const board = theme.id === 'future' ? 'neonsign' : 'billboard';
      put(S0 - 8, board, -1.3); put(S0 + 6, board, 1.3); put(S0 + 20, board, -1.3);
    }

    // ---- checkpoints (time challenge)
    const cps = [];
    const ncp = opts.checkpoints || 0;
    for (let j = 1; j <= ncp; j++) {
      const idx = S0 + Math.round((j * N) / (ncp + 1));
      segs[idx % N].mark = 'cp';
      put(idx, 'cpgantry', 0, { center: true, ww: roadW * 2.6 });
      cps.push((idx - S0) * K.SEG_LEN);
    }

    // ---- road hazards
    function obs(i, name, x, extra) {
      const d = Art.DEF[name], s = segs[U.wrap(i, N)];
      const ww = (extra && extra.ww) || d.ww, wN = ww / roadW;
      s.obs.push(Object.assign({ name, v: Math.floor(rnd() * d.v), x, bx: x, ww, hw: (d.hit * wN) / 2, fx: d.fx, hit: false, fly: null }, extra));
    }
    function group(i, type) {
      const side = rnd() < 0.5 ? -1 : 1;
      switch (type) {
        case 'cone': {
          const n = 3 + Math.floor(rnd() * 3);
          for (let k = 0; k < n; k++) obs(i + k * 2, 'cone', side * (0.92 - (k * 0.62) / (n - 1)));
          break;
        }
        case 'closure':
          obs(i, 'barrier', side * 0.62);
          for (let k = 1; k < 12; k++) obs(i + k * 3, 'cone', side * 0.28);
          obs(i + 36, 'barrier', side * 0.62);
          break;
        case 'barrier': obs(i - 5, 'cone', side * 0.8); obs(i - 3, 'cone', side * 0.62); obs(i, 'barrier', side * 0.55); break;
        case 'ebarrier': obs(i, 'ebarrier', side * 0.55); break;
        case 'puddle': obs(i, 'puddle', (rnd() * 2 - 1) * 0.6); break;
        case 'ice': obs(i, 'ice', (rnd() * 2 - 1) * 0.5); if (rnd() < 0.5) obs(i + 8, 'ice', (rnd() * 2 - 1) * 0.5); break;
        case 'log': obs(i, 'log', side * 0.5); break;
        case 'rockobs': obs(i, 'rockobs', (rnd() * 2 - 1) * 0.7); break;
        case 'boost': obs(i, 'boost', (rnd() * 2 - 1) * 0.6); break;
        case 'tumble': obs(i, 'tumble', (rnd() * 2 - 1) * 0.5, { moving: true, sp: 0.6 + rnd(), ph: rnd() * 6 }); break;
        case 'ramp':
          if (Math.abs(segs[i % N].curve) < 1.5) obs(i, 'ramp', 0, { ww: roadW * 2 });
          break;
      }
    }
    const obsProb = (P.obst / 15) * 0.03;
    if (obsProb > 0) {
      for (let i = S0 + 50; i < N - 50; i++) {
        if (rnd() >= obsProb) continue;
        group(i, U.pickWeighted(rnd, theme.obstacles));
        i += 40;
      }
    }

    const length = N * K.SEG_LEN;
    return {
      segments: segs, N, length, theme, params: Object.assign({}, P), code, roadW, cps,
      startZ: S0 * K.SEG_LEN,
      findSegment: z => segs[Math.floor(U.wrap(z, length) / K.SEG_LEN) % N],
    };
  }

  // Top-down outline (closed by spreading the end gap) and elevation profile for previews.
  function preview(t) {
    let a = 0, x = 0, y = 0;
    const pts = [], prof = [];
    for (let i = 0; i < t.N; i += 2) {
      a += t.segments[i].curve * 0.0084;
      x += Math.sin(a) * 2; y -= Math.cos(a) * 2;
      pts.push([x, y]);
      prof.push(t.segments[i].p1.world.y);
    }
    const gx = pts[pts.length - 1][0] - pts[0][0], gy = pts[pts.length - 1][1] - pts[0][1];
    pts.forEach((p, i) => { const f = i / (pts.length - 1); p[0] -= gx * f; p[1] -= gy * f; });
    return { pts, prof };
  }

  return { encode, decode, random, build, preview, KEYS };
})();
