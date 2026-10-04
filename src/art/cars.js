import { S, make, flip, R, P, C, E } from './draw.js';

// Player and rival cars: rear view, and a 3/4 view showing the flank when steering.
const carCache = {};
// Rear face in a 72x40 box. s (-2..2) slides the parts that sit further forward towards the turn.
function drawRear(g, model, col, s, brake) {
  const bD = S(col, 0.62), bL = S(col, 1.35), bDD = S(col, 0.4);
  const glass = '#1d2a3c', tl = brake ? '#ff4a3a' : '#a81010', tlL = brake ? '#ffe0c0' : '#ff5040';
  const tyre = x => { R(g, x, 24, 11, 14, '#111'); R(g, x + 1, 25, 9, 2, '#2c2c2c'); R(g, x + 1, 30, 9, 1, '#262626'); R(g, x + 1, 34, 9, 1, '#262626'); };
  tyre(5); tyre(56);
  if (model === 'volt') { // wedge coupe
    P(g, col, [4 + s, 30, 68 + s, 30, 67 + s, 17, 5 + s, 17]);
    R(g, 4 + s, 28, 64, 5, '#1a1a1a'); R(g, 6 + s, 29, 60, 1, '#333');
    P(g, bL, [6 + s * 1.5, 17, 66 + s * 1.5, 17, 62 + s * 2, 12, 10 + s * 2, 12]);
    P(g, bD, [15 + s * 2, 12, 57 + s * 2, 12, 50 + s * 3, 3, 22 + s * 3, 3]);
    P(g, glass, [18 + s * 2, 12, 54 + s * 2, 12, 48 + s * 3, 5, 24 + s * 3, 5]);
    for (let i = 0; i < 3; i++) R(g, 21 + s * 2.4, 6 + i * 2, 30, 1, bD);
    R(g, 23 + s * 3, 3, 26, 1, bL);
    R(g, 4 + s * 1.5, 13, 64, 3, bD); R(g, 4 + s * 1.5, 13, 64, 1, bL);
    R(g, 7 + s, 19, 14, 5, tl); R(g, 8 + s, 20, 5, 2, tlL);
    R(g, 51 + s, 19, 14, 5, tl); R(g, 59 + s, 20, 5, 2, tlL);
    R(g, 29 + s, 21, 14, 5, '#f4d000'); R(g, 31 + s, 23, 10, 1, '#5a4a00');
    R(g, 14 + s, 32, 4, 2, '#999'); R(g, 54 + s, 32, 4, 2, '#999');
    R(g, 5 + s, 17, 62, 1, bL);
  } else if (model === 'spark') { // two-seat roadster
    g.fillStyle = col; g.beginPath();
    if (g.roundRect) g.roundRect(5 + s, 15, 62, 15, 5); else g.rect(5 + s, 15, 62, 15);
    g.fill();
    R(g, 7 + s, 27, 58, 5, '#1a1a1a');
    P(g, bL, [8 + s * 1.5, 17, 64 + s * 1.5, 17, 58 + s * 2, 12, 14 + s * 2, 12]);
    P(g, 'rgba(170,210,240,0.5)', [16 + s * 3, 10, 56 + s * 3, 10, 52 + s * 3.5, 2, 20 + s * 3.5, 2]);
    R(g, 20 + s * 3.5, 2, 32, 1, '#222');
    R(g, 22 + s * 2.5, 9, 9, 4, '#222'); R(g, 41 + s * 2.5, 9, 9, 4, '#222');
    C(g, 27 + s * 3, 6, 3.5, '#3a2416'); C(g, 45 + s * 3, 6, 3.5, '#c89a50');
    C(g, 14 + s, 21, 3.2, tl); C(g, 22 + s, 21, 2.6, '#e08a00');
    C(g, 58 + s, 21, 3.2, tl); C(g, 50 + s, 21, 2.6, '#e08a00');
    if (brake) { C(g, 14 + s, 21, 1.5, tlL); C(g, 58 + s, 21, 1.5, tlL); }
    R(g, 29 + s, 21, 14, 5, '#f4d000'); R(g, 31 + s, 23, 10, 1, '#5a4a00');
    R(g, 8 + s, 16, 56, 1, bL);
    R(g, 50 + s, 31, 5, 2, '#999');
  } else { // ion speedster concept
    P(g, col, [2 + s, 30, 70 + s, 30, 68 + s, 17, 4 + s, 17]);
    R(g, 6 + s, 27, 60, 6, '#111');
    for (let x = 12; x < 62; x += 6) R(g, x + s, 28, 1, 5, '#333');
    R(g, 5 + s, 20, 62, 3, tl); R(g, 5 + s, 20, 62, 1, tlL);
    E(g, 26 + s * 2, 15, 9, 6, col); E(g, 46 + s * 2, 15, 9, 6, col);
    E(g, 24 + s * 2, 13, 4, 2, bL); E(g, 44 + s * 2, 13, 4, 2, bL);
    P(g, glass, [14 + s * 2, 13, 58 + s * 2, 13, 53 + s * 2.5, 9, 19 + s * 2.5, 9]);
    R(g, 15 + s * 1.5, 11, 2, 6, '#222'); R(g, 55 + s * 1.5, 11, 2, 6, '#222');
    R(g, 6 + s * 2, 7, 60, 4, bD); R(g, 6 + s * 2, 7, 60, 1, bL);
    R(g, 4 + s * 2, 5, 3, 8, bDD); R(g, 65 + s * 2, 5, 3, 8, bDD);
    R(g, 4 + s, 17, 64, 1, bL);
  }
}

// Right-hand flank geometry, in straight-on rear-art coordinates: body side top/bottom, deck height,
// body edge x, cabin rear edge [bottom x, bottom y, top x, top y] and how far s slides it [bottom, top].
const PROFILE = {
  volt: { top: 17, bot: 33, deck: 12, edge: 68, cab: [57, 12, 50, 3], slide: [2, 3], glass: '#1d2a3c' },
  spark: { top: 15, bot: 32, deck: 12, edge: 67, cab: [56, 10, 52, 2], slide: [3, 3.5], glass: 'rgba(170,210,240,0.5)', open: true },
  ion: { top: 17, bot: 33, deck: 14, edge: 70, cab: [58, 13, 53, 9], slide: [2, 2.5], glass: '#1d2a3c' },
};
const TURN = [[1, 0], [0.86, 10], [0.74, 18]]; // per steer level: rear-face squash, flank width

// Side of the car as seen when it yaws right: starts at the rear face's edge (ex) and recedes over fw px.
function drawFlank(g, p, col, k, ex, fw, cb, ct) {
  const c = 0.03 * k, X = d => ex + d * fw, Y = (d, y) => y * (1 - d * c), pt = (d, y) => [X(d), Y(d, y)];
  const poly = (colr, ...pts) => P(g, colr, pts.flat());
  const corner = [ex - 3, p.deck]; // rear deck's outer corner, so the shoulder meets the rear face
  poly(S(col, 0.78), corner, pt(0.3, p.deck + 1), pt(1, p.top - 1), pt(1, p.bot), pt(0, p.bot), pt(0, p.top));
  poly(S(col, 1.35), corner, pt(0.3, p.deck + 1), pt(1, p.top - 1), pt(1, p.top), pt(0.3, p.deck + 2), [ex - 3, p.deck + 1]);
  poly('#1a1a1a', pt(0, p.bot - 4), pt(1, p.bot - 4), pt(1, p.bot), pt(0, p.bot));
  poly(S(col, 1.6), pt(0.94, p.top + 2), pt(1, p.top + 1), pt(1, p.top + 4), pt(0.94, p.top + 4));
  for (const d of [0.2, 0.84]) {
    // same size as the rear tyres (y 24..38) and resting on the same ground line, scaled for distance
    const ry = 7 * (1 - d * c), x = X(d), y = Y(d, 38) - ry, rx = Math.max(1.2, fw * 0.11);
    E(g, x, y - 1, rx + 1, ry + 1, S(col, 0.35));
    E(g, x, y, rx, ry, '#111');
    E(g, x, y, rx * 0.45, ry * 0.45, '#5a5a5a');
  }
  const cl = fw * (p.open ? 0.3 : 0.6); // cabin length on screen
  if (p.open) { // convertible: just the windscreen frame and the door top
    poly('#222', [cb, p.cab[1]], [cb + cl, Y(0.3, p.cab[1] + 1)], [ct + cl * 0.8, Y(0.3, p.cab[3] + 1)], [ct, p.cab[3]], [ct + 1, p.cab[3]], [cb + 1, p.cab[1] - 1]);
    return;
  }
  poly(S(col, 0.62), [cb, p.cab[1]], [cb + cl, Y(0.6, p.cab[1] + 1)], [ct + cl * 0.75, Y(0.45, p.cab[3] + 1)], [ct, p.cab[3]]);
  poly(p.glass, [cb + 1, p.cab[1] - 1], [cb + cl - 1, Y(0.6, p.cab[1])], [ct + cl * 0.75 - 1.5, Y(0.45, p.cab[3] + 2)], [ct + 1, p.cab[3] + 1.5]);
}

// steer: -2..2 (0 straight, 1 slight, 2 full lock). Left turns mirror the layout, not the rear art.
function drawCar(g, model, col, steer, brake) {
  E(g, 36, 37, 34, 3.5, 'rgba(0,0,0,0.45)');
  const k = Math.min(2, Math.abs(steer)), dir = Math.sign(steer);
  if (!k) { drawRear(g, model, col, 0, brake); return; }
  const p = PROFILE[model], [f, fw] = TURN[k], ox = 36 - (72 * f + fw) / 2;
  const rear = make(72, 40, h => drawRear(h, model, col, k * dir, brake));
  g.drawImage(rear, dir > 0 ? ox : 72 - ox - 72 * f, 0, 72 * f, 40);
  const side = make(72, 40, h => drawFlank(h, p, col, k, ox + (p.edge + k) * f - 0.5, fw,
    ox + (p.cab[0] + p.slide[0] * k) * f, ox + (p.cab[2] + p.slide[1] * k) * f));
  g.drawImage(dir > 0 ? side : flip(side), 0, 0);
}
export function car(model, col, steer, brake) {
  const key = model + col + steer + (brake ? 1 : 0);
  return carCache[key] || (carCache[key] = make(72, 40, g => drawCar(g, model, col, steer, brake)));
}
