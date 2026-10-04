import { S, R, P, E } from './draw.js';

// The car models: rear views in a 72x40 box (ground at y 38) and the matching flank geometry. The body styles
// follow today's electric cars; names and badges are the game's own. s (-2..2) slides the parts that sit
// further forward towards the turn: the body by s, the deck by about 1.5s, the cabin by 2.5s to 3s.
const tyres = (g, y, w = 11, x0 = 5) => {
  for (const x of [x0, 72 - x0 - w]) {
    R(g, x, y, w, 38 - y, '#111'); R(g, x + 1, y + 1, w - 2, 2, '#2c2c2c');
    for (let ty = y + 6; ty < 37; ty += 4) R(g, x + 1, ty, w - 2, 1, '#262626');
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
const plate = (g, x, y, name) => {
  if (!name) { R(g, x, y, 14, 5, '#f4d000'); R(g, x + 2, y + 2, 10, 1, '#5a4a00'); return; }
  const w = name.length * 4 + 3, x0 = x + 7 - Math.ceil(w / 2);
  R(g, x0, y - 1, w, 7, '#f4d000');
  [...name].forEach((ch, i) => [...(GLYPHS[ch] || '00000')].forEach((row, r) => {
    for (let b = 0; b < 3; b++) if (+row & (4 >> b)) R(g, x0 + 2 + i * 4 + b, y + r, 1, 1, '#2a2000');
  }));
};
const pair = (g, s, x, y, w, h, c) => { R(g, x + s, y, w, h, c); R(g, 72 - x - w + s, y, w, h, c); }; // mirrored
const fins = (g, x, y, w, h) => { for (let i = x + 6; i < x + w - 4; i += 6) R(g, i, y, 1, h, '#333'); };
const round = (g, c, x, y, w, h, r) => {
  g.fillStyle = c; g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
};
const UPPER = '#eeeadc'; // the microbus's pale upper half

// k: palette { col, bD (dark), bL (light), bDD, glass, tl (tail lamp), tlL (lamp highlight) } and the plate text
export const REAR = {
  pixel(g, k, s) { // compact hatchback: upright tailgate, a black band joining the lamps
    tyres(g, 25);
    P(g, k.col, [6 + s, 15, 66 + s, 15, 59 + s * 2.5, 4, 13 + s * 2.5, 4]);
    P(g, k.glass, [10 + s * 2, 14, 62 + s * 2, 14, 57 + s * 2.5, 6, 15 + s * 2.5, 6]);
    R(g, 13 + s * 2.5, 3, 46, 2, k.bD);
    P(g, k.col, [5 + s, 31, 67 + s, 31, 66 + s, 15, 6 + s, 15]);
    R(g, 7 + s, 16, 58, 3, '#121417');
    R(g, 6 + s, 16, 15, 4, k.tl); R(g, 51 + s, 16, 15, 4, k.tl);
    R(g, 7 + s, 17, 5, 1, k.tlL); R(g, 60 + s, 17, 5, 1, k.tlL);
    R(g, 5 + s, 28, 62, 5, '#1a1a1a'); plate(g, 29 + s, 22, k.plate);
    R(g, 6 + s, 15, 60, 1, k.bL);
  },
  ridge(g, k, s) { // compact SUV: high, dark cladding, C-shaped lamps, roof rails
    tyres(g, 23);
    P(g, k.bD, [7 + s, 15, 65 + s, 15, 58 + s * 2.5, 4, 14 + s * 2.5, 4]);
    P(g, k.glass, [11 + s * 2, 14, 61 + s * 2, 14, 56 + s * 2.5, 6, 16 + s * 2.5, 6]);
    R(g, 13 + s * 2.5, 3, 46, 2, k.bDD);
    R(g, 16 + s * 2.5, 2, 3, 1, '#222'); R(g, 53 + s * 2.5, 2, 3, 1, '#222');
    P(g, k.col, [4 + s, 29, 68 + s, 29, 67 + s, 15, 5 + s, 15]);
    pair(g, s, 6, 16, 13, 2, k.tl); pair(g, s, 6, 16, 2, 6, k.tl); pair(g, s, 6, 20, 8, 2, k.tl); // C lamps
    pair(g, s, 7, 16, 4, 1, k.tlL);
    R(g, 4 + s, 27, 64, 6, '#222'); R(g, 26 + s, 31, 20, 1, '#b0b4b8');
    plate(g, 29 + s, 20, k.plate);
    R(g, 5 + s, 15, 62, 1, k.bL);
  },
  granite(g, k, s) { // mid-size SUV: tall and broad, slim lamps reaching into the tailgate, chrome trim
    tyres(g, 22, 12, 4);
    P(g, k.bD, [6 + s, 14, 66 + s, 14, 60 + s * 2.5, 2, 12 + s * 2.5, 2]);
    P(g, k.glass, [10 + s * 2, 13, 62 + s * 2, 13, 58 + s * 2.5, 4, 14 + s * 2.5, 4]);
    R(g, 12 + s * 2.5, 2, 48, 2, k.bDD);
    R(g, 14 + s * 2.5, 1, 4, 1, '#c0c4c8'); R(g, 54 + s * 2.5, 1, 4, 1, '#c0c4c8');
    P(g, k.col, [3 + s, 29, 69 + s, 29, 68 + s, 14, 4 + s, 14]);
    P(g, k.tl, [5 + s, 15, 25 + s, 15, 25 + s, 17, 9 + s, 19, 5 + s, 19]);
    P(g, k.tl, [67 + s, 15, 47 + s, 15, 47 + s, 17, 63 + s, 19, 67 + s, 19]);
    R(g, 6 + s, 16, 6, 1, k.tlL); R(g, 60 + s, 16, 6, 1, k.tlL);
    R(g, 25 + s, 16, 22, 1, '#c0c4c8');
    R(g, 3 + s, 26, 66, 5, '#202020'); R(g, 12 + s, 29, 48, 1, '#c0c4c8');
    plate(g, 29 + s, 20, k.plate);
    R(g, 4 + s, 14, 64, 1, k.bL);
  },
  beach(g, k, s) { // retro-styled electric microbus: tall, boxy, two-tone
    tyres(g, 23);
    P(g, k.col, [5 + s, 30, 67 + s, 30, 67 + s, 16, 5 + s, 16]);
    round(g, UPPER, 6 + s * 1.5, 1, 60, 17, 5);
    round(g, k.glass, 11 + s * 2, 4, 50, 10, 3);
    R(g, 9 + s * 2, 1, 54, 2, S(UPPER, 0.85));
    R(g, 5 + s, 17, 62, 4, '#151515');
    R(g, 6 + s, 17, 13, 4, k.tl); R(g, 53 + s, 17, 13, 4, k.tl);
    R(g, 7 + s, 18, 4, 1, k.tlL); R(g, 61 + s, 18, 4, 1, k.tlL);
    R(g, 4 + s, 27, 64, 6, '#1a1a1a'); plate(g, 29 + s, 22, k.plate);
  },
  aero(g, k, s) { // sportback: raked rear glass, ducktail, full-width segmented light bar
    tyres(g, 25);
    P(g, k.bD, [12 + s * 2, 15, 60 + s * 2, 15, 52 + s * 3, 6, 20 + s * 3, 6]);
    P(g, k.glass, [16 + s * 2.5, 14, 56 + s * 2.5, 14, 50 + s * 3, 7, 22 + s * 3, 7]);
    P(g, k.col, [3 + s, 32, 69 + s, 32, 68 + s, 18, 4 + s, 18]);
    P(g, k.bL, [5 + s * 1.5, 18, 67 + s * 1.5, 18, 62 + s * 2, 14, 10 + s * 2, 14]);
    R(g, 10 + s * 2, 14, 52, 1, S(k.col, 1.6));
    R(g, 5 + s, 19, 62, 2, k.tl);
    for (let i = 0; i < 4; i++) { R(g, 6 + s + i * 3, 19, 2, 2, k.tlL); R(g, 64 + s - i * 3, 19, 2, 2, k.tlL); }
    R(g, 4 + s, 28, 64, 5, '#161616'); fins(g, 4 + s, 29, 64, 4);
    plate(g, 29 + s, 22, k.plate);
  },
  wave(g, k, s) { // sleek sedan: rounded body, lit haunches, a light bar that thickens at the corners
    tyres(g, 25);
    P(g, k.bD, [13 + s * 2, 16, 59 + s * 2, 16, 51 + s * 3, 7, 21 + s * 3, 7]);
    P(g, k.glass, [16 + s * 2.5, 15, 56 + s * 2.5, 15, 50 + s * 3, 8, 22 + s * 3, 8]);
    round(g, k.col, 3 + s, 16, 66, 16, 6);
    E(g, 14 + s, 19, 10, 3, k.bL); E(g, 58 + s, 19, 10, 3, k.bL);
    P(g, k.bL, [10 + s * 1.5, 17, 62 + s * 1.5, 17, 58 + s * 2, 15, 14 + s * 2, 15]);
    R(g, 5 + s, 20, 62, 1, k.tl); R(g, 5 + s, 19, 13, 3, k.tl); R(g, 54 + s, 19, 13, 3, k.tl);
    R(g, 6 + s, 20, 4, 1, k.tlL); R(g, 62 + s, 20, 4, 1, k.tlL);
    R(g, 5 + s, 28, 62, 5, '#161616'); fins(g, 5 + s, 29, 62, 4);
    plate(g, 29 + s, 22, k.plate);
  },
  flux(g, k, s) { // low sports sedan: wide hips, raised active spoiler, ring lamps joined by a thin bar
    tyres(g, 25, 12, 4);
    P(g, k.bD, [14 + s * 2, 15, 58 + s * 2, 15, 50 + s * 3, 6, 22 + s * 3, 6]);
    P(g, k.glass, [17 + s * 2.5, 14, 55 + s * 2.5, 14, 49 + s * 3, 7, 23 + s * 3, 7]);
    P(g, k.col, [2 + s, 32, 70 + s, 32, 69 + s, 19, 3 + s, 19]);
    E(g, 12 + s, 20, 10, 3.5, k.col); E(g, 60 + s, 20, 10, 3.5, k.col);
    P(g, k.bL, [7 + s * 1.5, 19, 65 + s * 1.5, 19, 60 + s * 2, 15, 12 + s * 2, 15]);
    R(g, 22 + s * 2, 13, 2, 2, '#111'); R(g, 48 + s * 2, 13, 2, 2, '#111'); R(g, 10 + s * 2, 12, 52, 2, '#151515');
    R(g, 6 + s, 21, 60, 1, k.tl);
    for (const x of [4, 56]) { R(g, x + s, 19, 12, 5, k.tl); R(g, x + 3 + s, 20, 6, 3, '#2a0808'); }
    R(g, 5 + s, 20, 2, 1, k.tlL); R(g, 65 + s, 20, 2, 1, k.tlL);
    R(g, 3 + s, 28, 66, 5, '#141414'); fins(g, 3 + s, 29, 66, 4);
    plate(g, 29 + s, 23, k.plate);
  },
  blitz(g, k, s) { // low roadster: wide hips, small cabin under a black targa roof, slim lamps
    tyres(g, 26, 12, 4);
    P(g, k.bD, [20 + s * 2.5, 16, 52 + s * 2.5, 16, 47 + s * 3, 9, 25 + s * 3, 9]);
    P(g, k.glass, [22 + s * 2.5, 15, 50 + s * 2.5, 15, 46 + s * 3, 10, 26 + s * 3, 10]);
    R(g, 25 + s * 3, 8, 22, 2, '#141414');
    P(g, k.col, [3 + s, 33, 69 + s, 33, 68 + s, 21, 4 + s, 21]);
    E(g, 12 + s, 22, 10, 3, k.col); E(g, 60 + s, 22, 10, 3, k.col);
    P(g, k.bL, [7 + s * 1.5, 21, 65 + s * 1.5, 21, 58 + s * 2, 16, 14 + s * 2, 16]);
    P(g, k.tl, [5 + s, 22, 22 + s, 22, 20 + s, 24, 5 + s, 24]);
    P(g, k.tl, [67 + s, 22, 50 + s, 22, 52 + s, 24, 67 + s, 24]);
    R(g, 5 + s, 22, 4, 1, k.tlL); R(g, 63 + s, 22, 4, 1, k.tlL);
    R(g, 4 + s, 29, 64, 4, '#141414'); fins(g, 4 + s, 29, 64, 4);
    plate(g, 29 + s, 24, k.plate);
  },
};

// Right-hand flank geometry, in straight-on rear-art coordinates: body side top/bottom, deck height, body edge x,
// cabin rear edge [bottom x, bottom y, top x, top y], how far s slides it [bottom, top], and optionally how far
// the cabin reaches forward along the side [bottom, top] and its colour (default: the body's, darkened).
export const PROFILE = {
  pixel: { top: 15, bot: 33, deck: 14, edge: 67, cab: [66, 15, 59, 4], slide: [1, 2.5], len: [0.8, 0.65] },
  ridge: { top: 15, bot: 33, deck: 14, edge: 68, cab: [65, 15, 58, 4], slide: [1, 2.5], len: [0.8, 0.65] },
  granite: { top: 14, bot: 31, deck: 13, edge: 69, cab: [66, 14, 60, 2], slide: [1, 2.5], len: [0.82, 0.68] },
  beach: { top: 17, bot: 33, deck: 16, edge: 67, cab: [66, 16, 66, 1], slide: [1.5, 1.5], len: [0.95, 0.9], upper: UPPER },
  aero: { top: 18, bot: 33, deck: 14, edge: 69, cab: [60, 15, 52, 6], slide: [2, 3] },
  wave: { top: 16, bot: 33, deck: 15, edge: 69, cab: [59, 16, 51, 7], slide: [2, 3] },
  flux: { top: 19, bot: 33, deck: 15, edge: 70, cab: [58, 15, 50, 6], slide: [2, 3] },
  blitz: { top: 21, bot: 33, deck: 16, edge: 69, cab: [52, 16, 47, 9], slide: [2.5, 3], len: [0.55, 0.4] },
};
