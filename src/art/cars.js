import { S, make, flip, P, E } from './draw.js';
import { REAR, PROFILE } from './carmodels.js';

// Player and rival cars: rear view, and a 3/4 view showing the flank when steering.
const carCache = {};
function drawRear(g, model, col, s, brake, plate) {
  REAR[model](g, { col, bD: S(col, 0.62), bL: S(col, 1.35), bDD: S(col, 0.4), glass: '#1d2a3c',
    tl: brake ? '#ff4a3a' : '#a81010', tlL: brake ? '#ffe0c0' : '#ff5040', plate }, s);
}

const TURN = [[1, 0], [0.9, 8], [0.8, 15]]; // per steer level: rear-face squash, flank width
const VY = -20, Q = 0.15; // vanishing point height (sprite y) and how far the nose shrinks towards it

// Side of the car as seen when it yaws right: it starts at the rear face's edge (ex) and recedes over
// fw px towards a vanishing point up on the horizon, so the nose sits higher and smaller than the tail.
function drawFlank(g, p, col, ex, fw, cb, ct) {
  const VX = ex + fw / Q, a = Q / (1 - Q), t = d => (1 - 1 / (1 + a * d)) / Q;
  const pt = (d, y, x = ex) => { const s = 1 - Q * t(d); return [VX + (x - VX) * s, VY + (y - VY) * s]; };
  const poly = (colr, ...pts) => P(g, colr, pts.flat());
  const sh = p.deck + 1, dark = S(col, 0.5);
  poly('rgba(0,0,0,0.5)', pt(0, p.bot), pt(1, p.bot), pt(0.9, 37), pt(0, 37)); // shade under the car
  poly('#1a1a1a', pt(0, p.bot - 4), pt(1, p.bot - 4), pt(1, p.bot), pt(0, p.bot)); // sill
  for (const d of [0.16, 0.86]) { // wheels seen nearly edge-on, their tops hidden in the arches
    const [x, gy] = pt(d, 38), ry = 7 * (1 - Q * t(d)), rx = Math.max(1, fw * 0.1);
    E(g, x - rx * 0.5, gy - ry, rx + 1.5, ry, '#111');
    E(g, x + rx * 0.3, gy - ry, rx * 0.6, ry * 0.6, '#3a3a3a');
  }
  poly(S(col, 0.8), pt(0, p.top), pt(1, p.top), pt(1, p.bot - 4), pt(0, p.bot - 4)); // door panel
  poly(S(col, 1.12), [ex - 3, p.deck], pt(1, sh, ex - 3), pt(1, p.top), pt(0, p.top)); // shoulder
  poly(S(col, 1.45), pt(0, p.top - 1), pt(1, p.top - 1), pt(1, p.top + 0.6), pt(0, p.top + 0.6)); // crease
  poly(dark, pt(0.36, p.top + 3), pt(0.62, p.top + 3), pt(0.62, p.top + 6), pt(0.36, p.top + 6)); // side intake
  poly(S(col, 1.6), pt(0, p.top + 2), pt(0.05, p.top + 2), pt(0.05, p.top + 4), pt(0, p.top + 4)); // side marker
  const [lb, lt] = p.len || [0.62, 0.42];
  poly(p.upper ? S(p.upper, 0.85) : S(col, 0.62), [cb, p.cab[1]], pt(lb, p.cab[1], cb), pt(lt, p.cab[3], ct), [ct, p.cab[3]]);
  poly('#1d2a3c', [cb + 1, p.cab[1] - 1], pt(lb - 0.04, p.cab[1] - 1, cb), pt(lt - 0.02, p.cab[3] + 1.5, ct), [ct + 1, p.cab[3] + 1.5]);
}

// steer: -2..2 (0 straight, 1 slight, 2 full lock). Left turns mirror the layout, not the rear art.
// plate: the player's name on the number plate ('' for a plain one).
function drawCar(g, model, col, steer, brake, plate) {
  E(g, 36, 37, 34, 3.5, 'rgba(0,0,0,0.45)');
  const k = Math.min(2, Math.abs(steer)), dir = Math.sign(steer);
  if (!k) { drawRear(g, model, col, 0, brake, plate); return; }
  const p = PROFILE[model], [f, fw] = TURN[k], ox = 36 - (72 * f + fw) / 2;
  const rear = make(72, 40, h => drawRear(h, model, col, k * dir, brake, plate));
  g.drawImage(rear, dir > 0 ? ox : 72 - ox - 72 * f, 0, 72 * f, 40);
  const side = make(72, 40, h => drawFlank(h, p, col, ox + (p.edge + k) * f - 0.5, fw,
    ox + (p.cab[0] + p.slide[0] * k) * f, ox + (p.cab[2] + p.slide[1] * k) * f));
  g.drawImage(dir > 0 ? side : flip(side), 0, 0);
}
export function car(model, col, steer, brake, plate = '') {
  const key = model + col + steer + (brake ? 1 : 0) + plate;
  return carCache[key] || (carCache[key] = make(72, 40, g => drawCar(g, model, col, steer, brake, plate)));
}
