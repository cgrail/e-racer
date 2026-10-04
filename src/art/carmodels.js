import { S, R, P, grad } from './draw.js';

// The car models: rear views in a 72x40 box (ground at y 38) and the matching flank geometry. The body styles
// follow today's electric cars: rounded shells, big glass, slim light signatures; names and badges are the
// game's own. s (-2..2) slides the parts that sit further forward towards the turn: the body by s, the deck
// by about 1.5s, the cabin by 2s to 3s.
const W = a => `rgba(255,255,255,${a})`, B = a => `rgba(0,0,0,${a})`;
// The rear tyres' treads, rounded, in the arches' shadow at the top. When the car turns (k.turned), the flank
// draws them in perspective instead.
const tyres = (g, k) => {
  const [y, w, x0] = k.tyre;
  if (k.turned) return;
  for (const x of [x0, 72 - x0 - w]) {
    round(g, grad(g, x, 0, x + w, 0, [[0, '#050505'], [0.5, '#2c2c2e'], [1, '#050505']]), x, y, w, 38.5 - y, 1.5);
    for (let ty = y + 5; ty < 37; ty += 3) R(g, x + 1, ty, w - 2, 0.7, B(0.55));
    R(g, x, y, w, 3, B(0.6));
  }
};
// Number plate, 14 px wide at x. A player's name widens it around the same centre, in a 3x5 pixel font:
// each glyph is five rows, top to bottom, of three pixels (a digit 0-7, 4 = left pixel).
const GLYPHS = {
  A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227',
  J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '75557', P: '65644', Q: '25563', R: '65655',
  S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
  0: '25552', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34652', 7: '71222', 8: '25252', 9: '25316',
};
const PLATE = '#f2f2ec', INK = '#1c1c24';
const plate = (g, x, y, name) => {
  if (!name) { round(g, B(0.7), x - 0.5, y - 0.5, 15, 6, 1); round(g, PLATE, x, y, 14, 5, 0.8); R(g, x + 2, y + 2, 10, 1, '#4a4a52'); return; }
  const w = name.length * 4 + 3, x0 = x + 7 - Math.ceil(w / 2);
  round(g, B(0.7), x0 - 0.5, y - 1.5, w + 1, 8, 1); round(g, PLATE, x0, y - 1, w, 7, 0.8);
  [...name].forEach((ch, i) => [...(GLYPHS[ch] || '00000')].forEach((row, r) => {
    for (let b = 0; b < 3; b++) if (+row & (4 >> b)) R(g, x0 + 2 + i * 4 + b, y + r, 1, 1, INK);
  }));
};
const pair = (g, s, x, y, w, h, c) => { R(g, x + s, y, w, h, c); R(g, 72 - x - w + s, y, w, h, c); }; // mirrored
const fins = (g, x, y, w, h) => { for (let i = x + 4; i < x + w - 3; i += 5) R(g, i, y, 1, h, '#34343a'); };
const round = (g, c, x, y, w, h, r) => {
  g.fillStyle = c; g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
};
const UPPER = '#eeeadc'; // the microbus's pale upper half

// Smooth body parts: an outline given by the [dx, y, r, k] corners of its right half, mirrored about x 36. Each
// corner is rounded by r, and slides by k * s (default 1), since parts further forward slide further as the car turns.
function trace(g, half, s) {
  const pts = [...half, ...half.slice().reverse().map(([x, y, r, k]) => [-x, y, r, k])]
    .map(([x, y, r = 0, k = 1]) => [36 + x + k * s, y, r]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = pts.length;
  g.beginPath(); g.moveTo(...mid(pts[n - 1], pts[0]));
  pts.forEach((p, i) => g.arcTo(p[0], p[1], ...mid(p, pts[(i + 1) % n]), p[2]));
  g.closePath();
}
const shape = (g, c, half, s) => { trace(g, half, s); g.fillStyle = c; g.fill(); };
const within = (g, half, s, fn) => { g.save(); trace(g, half, s); g.clip(); fn(); g.restore(); };
// The body: its colour inset from a darker rim where it curves away, glossed like paint under an open sky (the
// top surfaces mirror the sky down to a bright crease at the shoulder, k.sh, and the ground darkens the rest down
// to the sills), with a glint along its upper contour. fn draws the details inside the outline, then the sides
// roll off into shadow.
function shell(g, k, s, half, fn, col = k.col, rim = k.bD) {
  shape(g, rim, half, s);
  shape(g, col, half.map(([x, y, r, q]) => [x - 1.5, y, r, q]), s);
  const y0 = Math.min(...half.map(p => p[1])), h = 38 - y0, t = y => (y - y0) / h;
  const m = Math.max(...half.map(p => p[0])), x0 = 36 + s - m;
  within(g, half, s, () => {
    R(g, 0, y0, 72, h, grad(g, 0, y0, 0, 38, [[0, W(0.22)], [t(k.sh - 1.5), W(0.4)], [t(k.sh - 0.3), W(0.08)],
      [t(k.sh + 0.2), B(0.04)], [t(30), B(0.2)], [1, B(0.5)]]));
    const hy = k.sh - 2, hx = edgeAt(half, hy) - 5.5; // a glint on each haunch
    for (const x of [36 - hx, 36 + hx]) {
      g.save(); g.translate(x + s * 1.2, hy); g.scale(1, 0.32);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 6); gr.addColorStop(0, W(0.6)); gr.addColorStop(1, W(0));
      g.fillStyle = gr; g.fillRect(-6, -6, 12, 12); g.restore();
    }
    trace(g, half, s); g.lineWidth = 1.2;
    g.strokeStyle = grad(g, 0, y0, 0, 38, [[0, W(0.75)], [t(k.sh), W(0.3)], [t(k.sh + 3), W(0)]]); g.stroke();
    fn();
    R(g, 0, y0, 72, h, grad(g, x0, 0, x0 + m * 2, 0, [[0, B(0.5)], [0.07, B(0.18)], [0.17, B(0)], [0.83, B(0)], [0.93, B(0.18)], [1, B(0.5)]]));
  });
}
// How far out an outline's right half reaches at height y: its outermost crossing, ignoring the rounding.
function edgeAt(half, y) {
  let x = 0;
  half.forEach(([xa, ya], i) => {
    const [xb, yb] = half[i + 1] || half[i];
    if ((ya - y) * (yb - y) <= 0 && ya !== yb) x = Math.max(x, xa + (xb - xa) * (y - ya) / (yb - ya));
  });
  return x || half[0][0];
}
// Tinted glass mirroring the sky at the top, with two streaks of reflection.
const glass = (g, k, s, half) => {
  const y0 = half[0][1], y1 = half[half.length - 1][1], x = 36 + s * 2.5;
  shape(g, grad(g, 0, y0, 0, y1, [[0, S(k.glass, 1.7)], [0.45, k.glass], [1, S(k.glass, 0.4)]]), half, s);
  within(g, half, s, () => {
    P(g, W(0.12), [x + 6, y0, x + 13, y0, x + 6, y1, x - 1, y1]);
    P(g, W(0.2), [x + 15, y0, x + 16.5, y0, x + 9.5, y1, x + 8, y1]);
  });
};
// Inside a shell: the lower body shaded from y0, and a black bumper or cladding from y1 down.
const skirt = (g, k, y0, y1, c = '#181818') => {
  R(g, 0, y0, 72, y1 - y0, grad(g, 0, y0, 0, y1, [[0, S(k.col, 0.82)], [1, S(k.col, 0.58)]]));
  R(g, 0, y0, 72, 0.6, W(0.22));
  R(g, 0, y1, 72, 40 - y1, grad(g, 0, y1, 0, 38, [[0, S(c, 1.12)], [0.3, c], [1, S(c, 0.4)]]));
  R(g, 0, y1, 72, 0.6, W(0.1));
};
// A lamp outline [x, y]... on the left, drawn with its mirror image on the right, in a dark bezel if given.
const lamps = (g, s, c, pts, bezel) => {
  for (const p of [pts.flatMap(([x, y]) => [x + s, y]), pts.flatMap(([x, y]) => [72 - x + s, y])]) {
    if (bezel) { P(g, c, p); g.lineWidth = 1; g.strokeStyle = bezel; g.stroke(); }
    P(g, c, p);
  }
};
const BEZEL = '#240606';
const lit = (g, k, fn) => { g.save(); g.shadowColor = k.glow; g.shadowBlur = k.blur; fn(); g.restore(); }; // lamps glowing
const mirrors = (g, s, c, dx, y) => { // door mirrors sticking out dx from the centre, seen from behind
  for (const x of [36 - dx - 4, 36 + dx]) {
    round(g, c, x + s * 2, y, 4, 3, 1); R(g, x + s * 2 + 0.5, y + 0.4, 3, 0.6, W(0.3)); R(g, x + s * 2 + 0.5, y + 2, 3, 1, '#141414');
  }
};

// k: palette { col, bD (dark), bL (light), bDD, glass, tl (tail lamp), tlL (lamp highlight) }, the lamps' glow and
// blur, the shoulder line sh, the tyres (PROFILE's tyre, and turned) and the plate text
export const REAR = {
  pixel(g, k, s) { // compact hatchback: upright tailgate, black glass running down into a band joining the lamps
    tyres(g, k);
    const H = [[21, 3, 3, 2.5], [27, 12, 4, 1.8], [31, 16, 3, 1.3], [32, 26, 3], [31, 33, 2], [24, 34]];
    mirrors(g, s, k.bD, 26, 11);
    shell(g, k, s, H, () => {
      glass(g, k, s, [[18, 5, 2, 2.5], [25, 18, 1, 1.5]]);
      R(g, 14 + s * 2.5, 3, 44, 2, '#121417'); R(g, 9 + s * 1.5, 15, 54, 4, '#121417'); // spoiler, the band
      lit(g, k, () => { R(g, 31 + s * 2.5, 3, 10, 1, k.tl); lamps(g, s, k.tl, [[4, 15], [20, 15], [18, 19], [4, 19]], BEZEL); });
      lamps(g, s, k.tlL, [[5, 16], [10, 16], [10, 17], [5, 17]]);
      skirt(g, k, 27, 30); pair(g, s, 7, 31, 3, 1, '#6a1010');
    });
    plate(g, 29 + s, 22, k.plate);
  },
  ridge(g, k, s) { // compact SUV: tall and rounded, lamps in a grid of square pixels, dark cladding, roof rails
    tyres(g, k);
    const H = [[22, 2, 3, 2.5], [28, 12, 3, 1.8], [32, 15, 3, 1.3], [33, 25, 3], [32, 33, 2], [24, 34]];
    mirrors(g, s, k.bD, 27, 10);
    shell(g, k, s, H, () => {
      glass(g, k, s, [[19, 4, 2, 2.5], [25, 14, 1, 1.6]]);
      R(g, 14 + s * 2.5, 2, 44, 2, k.bDD);
      R(g, 0, 16, 72, 5, '#141418'); // a black band across, lamps of square pixels at its ends
      lit(g, k, () => { for (const x of [4, 52]) for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) R(g, x + s + i * 3, 17 + j * 2, 2, 1, j ? k.tl : k.tlL); });
      skirt(g, k, 24, 27, '#232323'); R(g, 26 + s, 31, 20, 1, '#b0b4b8');
    });
    pair(g, s * 2.5, 16, 0.5, 6, 1.5, '#222'); // roof rails
    plate(g, 29 + s, 21, k.plate);
  },
  granite(g, k, s) { // mid-size SUV: tall, smooth and broad, slim lamps joined by a light bar, chrome trim
    tyres(g, k);
    const H = [[22, 1, 4, 2.5], [28, 11, 4, 1.8], [33, 14, 3, 1.3], [34, 24, 3], [33, 32, 3], [25, 34]];
    mirrors(g, s, k.bD, 28, 9);
    shell(g, k, s, H, () => {
      glass(g, k, s, [[20, 3, 3, 2.5], [26, 12.5, 1, 1.7]]);
      R(g, 13 + s * 2.5, 1, 46, 2, k.bDD);
      R(g, 0, 14, 72, 1, k.bL);
      lit(g, k, () => { lamps(g, s, k.tl, [[2, 15], [22, 15], [22, 16], [3, 18]], BEZEL); R(g, 22 + s, 15, 28, 1, k.tl); });
      lamps(g, s, k.tlL, [[4, 15], [10, 15], [10, 16], [4, 16]]);
      skirt(g, k, 25, 29, '#202020'); R(g, 14 + s, 31, 44, 1, '#c0c4c8');
    });
    plate(g, 29 + s, 21, k.plate);
  },
  beach(g, k, s) { // retro-styled electric microbus: tall, rounded and two-tone, lamps joined by a light line
    tyres(g, k);
    const L = [[29, 16, 0, 1.5], [29, 34, 4]], U = [[27.5, 0, 7, 2], [28.5, 18, 0, 1.5]];
    mirrors(g, s, S(UPPER, 0.8), 29, 12);
    shell(g, k, s, L, () => {
      lit(g, k, () => { R(g, 7 + s * 1.5, 19, 58, 1, k.tl); lamps(g, s, k.tl, [[6, 18], [20, 18], [19, 21], [6, 21]], BEZEL); });
      lamps(g, s, k.tlL, [[7, 19], [12, 19], [12, 20], [7, 20]]);
      skirt(g, k, 27, 30); pair(g, s, 8, 31, 3, 1, '#6a1010');
    });
    shell(g, k, s, U, () => {
      glass(g, k, s, [[24, 3, 3, 2], [24.5, 14, 3, 1.6]]);
      lit(g, k, () => R(g, 32 + s * 2, 1, 8, 1, k.tl));
    }, UPPER, S(UPPER, 0.82));
    plate(g, 29 + s, 23, k.plate);
  },
  aero(g, k, s) { // sportback: glass raked down to a ducktail, a full-width light blade
    tyres(g, k);
    const H = [[14, 6, 3, 3], [23, 13, 3, 2.2], [31, 17, 3, 1.3], [33, 24, 2], [32, 32, 3], [24, 34]];
    mirrors(g, s, k.bD, 22, 12);
    shell(g, k, s, H, () => {
      glass(g, k, s, [[12.5, 7.5, 2, 3], [21, 14, 1, 2.2]]);
      R(g, 0, 15.5, 72, 1, k.bL);
      lit(g, k, () => { R(g, 0, 19, 72, 1, k.tl); lamps(g, s, k.tl, [[2, 18], [14, 19], [14, 21], [2, 22]], BEZEL); });
      lamps(g, s, k.tlL, [[3, 19], [8, 19], [8, 20], [3, 20]]);
      skirt(g, k, 26, 29); R(g, 12 + s, 33, 48, 1, '#3a3a3a');
    });
    plate(g, 29 + s, 23, k.plate);
  },
  wave(g, k, s) { // sleek sedan: rounded all over, glass roof, slim wrap-around lamps, ducktail
    tyres(g, k);
    const H = [[13, 6, 4, 3], [22, 14, 3, 2.2], [30, 16, 3, 1.5], [33, 21, 3], [33, 27, 2], [31, 33, 3], [24, 34]];
    mirrors(g, s, k.bD, 21, 12);
    shell(g, k, s, H, () => {
      glass(g, k, s, [[12, 6.5, 3, 3], [21.5, 14.5, 1, 2.2]]);
      R(g, 0, 16, 72, 1, k.bL);
      lit(g, k, () => lamps(g, s, k.tl, [[2, 18], [19, 18.5], [17, 20.5], [3, 21]], BEZEL)); lamps(g, s, k.tlL, [[4, 19], [9, 19], [9, 20], [4, 20]]);
      skirt(g, k, 26, 30);
    });
    plate(g, 29 + s, 23, k.plate);
  },
  flux(g, k, s) { // low sports sedan: wide hips, narrow glass, a light strip across, finned diffuser
    tyres(g, k);
    const H = [[12, 6, 3, 3], [21, 14, 3, 2.2], [27, 16, 3, 1.6], [33, 18, 3, 1.2], [34, 23, 3], [33, 33, 3], [24, 34]];
    mirrors(g, s, k.bD, 20, 12);
    shell(g, k, s, H, () => {
      glass(g, k, s, [[11, 7.5, 2, 3], [19.5, 14, 1, 2.2]]);
      R(g, 0, 16.5, 72, 1, k.bL);
      R(g, 0, 19, 72, 3, '#1a0808');
      lit(g, k, () => { R(g, 0, 20, 72, 1, k.tl); lamps(g, s, k.tl, [[1, 18], [13, 19], [13, 22], [1, 22]], BEZEL); });
      lamps(g, s, k.tlL, [[2, 19], [7, 19], [7, 20], [2, 20]]);
      skirt(g, k, 26, 29); fins(g, 20 + s, 30, 32, 4);
    });
    plate(g, 29 + s, 23, k.plate);
  },
  blitz(g, k, s) { // low roadster: wings rising over the rear wheels, a bubble cabin under a black glass roof
    tyres(g, k);
    const H = [[10, 17, 2, 1.6], [20, 16, 3, 1.5], [26, 14.5, 4, 1.4], [32, 17, 3, 1.2], [34, 22, 3], [33, 31, 3], [26, 34]];
    mirrors(g, s, k.bD, 14, 13);
    shape(g, '#141414', [[9, 7, 4, 3], [15, 18, 0, 2.5]], s);
    glass(g, k, s, [[8, 9.5, 3, 3], [12.5, 17, 0, 2.5]]);
    shell(g, k, s, H, () => {
      lit(g, k, () => lamps(g, s, k.tl, [[2, 19.5], [17, 18], [16, 20], [2.5, 21.5]], BEZEL)); lamps(g, s, k.tlL, [[3, 19.5], [8, 19], [8, 20], [3, 20.5]]);
      skirt(g, k, 26, 29); fins(g, 18 + s, 30, 36, 4);
    });
    plate(g, 29 + s, 23, k.plate);
  },
};

// Right-hand flank geometry, in straight-on rear-art coordinates: body side top/bottom, body edge x,
// cabin rear edge [bottom x, bottom y, top x, top y] and how far s slides it [bottom, top]. Along the side (0 tail,
// 1 nose): len, where the windscreen meets the bonnet and the roof [bottom, top]; hood, the wing's height at the
// windscreen and at the nose; whl, the wheels [rear, front, radius]; lamp, the tail lamp's rows; cpil, where the
// side glass starts; doors, where the door pillars stand; clad, dark arches and sills; upper, the cabin's colour;
// tyre, the rear tyres seen from behind [top y, width, x from the side].
export const PROFILE = {
  pixel: { top: 16, bot: 33, edge: 68, cab: [64, 15, 57, 3], slide: [1.8, 2.5], len: [0.78, 0.6],
    hood: [17, 20], whl: [0.16, 0.85, 6.5], lamp: [15, 19], cpil: 0.06, doors: [0.42], tyre: [27, 11, 5] },
  ridge: { top: 15, bot: 33, edge: 69, cab: [64, 14, 58, 2], slide: [1.8, 2.5], len: [0.76, 0.58],
    hood: [16, 19], whl: [0.17, 0.83, 7.5], lamp: [16, 22], cpil: 0.08, doors: [0.42], tyre: [25, 12, 4], clad: true },
  granite: { top: 14, bot: 32, edge: 70, cab: [64, 13, 58, 1], slide: [1.8, 2.5], len: [0.74, 0.56],
    hood: [15, 18], whl: [0.17, 0.83, 8], lamp: [15, 18], cpil: 0.08, doors: [0.42], tyre: [24, 12, 4], clad: true },
  beach: { top: 18, bot: 33, edge: 65, cab: [64.5, 18, 63.5, 2], slide: [1.5, 2], len: [0.95, 0.84],
    hood: [19, 21], whl: [0.14, 0.86, 7], lamp: [18, 21], cpil: 0.06, doors: [0.3, 0.62], tyre: [28, 11, 6], upper: UPPER },
  aero: { top: 18, bot: 33, edge: 69, cab: [59, 14, 50, 6], slide: [2.2, 3], len: [0.66, 0.42],
    hood: [19, 22], whl: [0.19, 0.82, 7], lamp: [19, 21], cpil: 0.04, doors: [0.36], tyre: [27, 11, 5] },
  wave: { top: 18, bot: 33, edge: 69, cab: [58, 14.5, 49, 6], slide: [2.2, 3], len: [0.68, 0.44],
    hood: [18, 22], whl: [0.19, 0.82, 7], lamp: [18, 21], cpil: 0.06, doors: [0.38], tyre: [27, 11, 5] },
  flux: { top: 19, bot: 33, edge: 70, cab: [57, 14, 48, 6], slide: [2.2, 3], len: [0.64, 0.42],
    hood: [20, 23], whl: [0.2, 0.82, 7.5], lamp: [19, 22], cpil: 0.04, doors: [0.34], tyre: [27, 12, 4] },
  blitz: { top: 18, bot: 33, edge: 70, cab: [51, 17.5, 45, 7], slide: [2.5, 3], len: [0.55, 0.4],
    hood: [21, 24], whl: [0.2, 0.84, 7.5], lamp: [18, 21.5], cpil: 0.04, doors: [], tyre: [27, 12, 3] },
};
