import { S, make, flip, P, E, grad } from './draw.js';
import { REAR, PROFILE } from './carmodels.js';

// Player and rival cars: rear view, and a 3/4 view showing the flank when steering. They are drawn at SS times
// the 72x40 layout, so they stay smooth when scaled down to the screen, and carry a 72x40 copy (mip) for far away.
const carCache = new Map(), SS = 2, CACHE_MAX = 320; // drawn on demand, so a full cache just starts again
const lamps = brake => [brake ? '#ff4a3a' : '#b81410', brake ? '#ffe0c0' : '#ff6048'];
function drawRear(g, model, col, s, brake, plate) {
  const [tl, tlL] = lamps(brake);
  REAR[model](g, { col, bD: S(col, 0.62), bL: S(col, 1.35), bDD: S(col, 0.4), glass: '#1d2a3c', tl, tlL, plate,
    glow: brake ? 'rgba(255,70,40,1)' : 'rgba(255,30,20,0.8)', blur: (brake ? 4 : 2.5) * SS, sh: PROFILE[model].lamp[0] }, s);
}

const TURN = [[1, 0], [0.88, 10], [0.78, 18]]; // per steer level: rear-face squash, flank width
const VY = -20, Q = 0.15; // vanishing point height (sprite y) and how far the nose shrinks towards it
const GLASS = '#1d2a3c', SHINE = 'rgba(160,190,230,0.35)';

// Side of the car as seen when it yaws right: it starts at the rear face's edge (ex) and recedes over
// fw px towards a vanishing point up on the horizon, so the nose sits higher and smaller than the tail.
// Points are (d, y, x): d runs 0 at the tail to 1 at the nose, y and x are in rear-art pixels.
function drawFlank(g, p, col, tl, ex, fw, cb, ct) {
  const VX = ex + fw / Q, a = Q / (1 - Q), sc = d => 1 / (1 + a * d);
  const pt = (d, y, x = ex) => { const s = sc(d); return [VX + (x - VX) * s, VY + (y - VY) * s]; };
  const poly = (colr, pts) => P(g, colr, pts.flat());
  const [cy, ry] = [p.cab[1], p.cab[3]], cx = y => cb + (ct - cb) * (y - cy) / (ry - cy); // cabin leans in
  const gh = (d, y) => pt(d, y, cx(y));
  const [lb, lt] = p.len, [h0, h1] = p.hood, bot = p.bot;
  // the body side's top edge, tail to nose: waist, then the wing dropping to a rounded nose
  const edge = [[0, p.top], [lb, p.top + 0.5], [Math.min(0.97, lb + 0.08), h0], [0.94, h1], [1, h1 + 2]];
  const side = [...edge, [1, bot - 2.5], [0.96, bot], [0, bot]];
  const band = (y0, y1, colr) => poly(colr, [pt(0, y0), pt(1, y0), pt(1, y1), pt(0, y1)]);
  const r = p.whl[2], wheels = [p.whl[0], p.whl[1]].map(d => [...pt(d, 38 - r), sc(d)]);
  const discs = (o, colr, dx = 0, dy = 0) => { // wheel-sized ellipses, o px larger, edge-on as the side recedes
    for (const [x, y, s] of wheels) { const ey = (r + o) * s, ew = ey * fw / 46; E(g, x + dx * ew, y + dy * ey, ew, ey, colr); }
  };

  poly('rgba(0,0,0,0.5)', [pt(0, bot), pt(1, bot), pt(0.9, 38), pt(0, 38)]); // shade under the car
  const top = Math.min(cy, h0) - 1; // deck and bonnet mirror the sky, brightest towards the cabin
  poly(grad(g, 0, top, 0, p.top + 1, [[0, S(col, 1.45)], [1, S(col, 1.12)]]),
    [[cb, cy], gh(lb, cy), pt(1, h1, cb + 2), ...edge.map(([d, y]) => pt(d, y)).reverse()]);
  const t = y => (y - p.top) / (bot - p.top); // the side panel: a bright crease under its edge, then the ground's shadow
  g.save(); poly(grad(g, 0, p.top, 0, bot, [[0, S(col, 1.1)], [t(p.top + 2.5), S(col, 1.02)], [t(p.top + 3.5), S(col, 0.84)],
    [t(bot - 5), S(col, 0.7)], [1, S(col, 0.5)]]), side.map(([d, y]) => pt(d, y))); g.clip();
  poly('rgba(255,255,255,0.45)', [...edge.map(([d, y]) => pt(d, y + 0.3)), ...edge.map(([d, y]) => pt(d, y + 1.1)).reverse()]);
  band(bot - 6, bot - 5.4, 'rgba(255,255,255,0.18)'); // the sill's crease
  band(bot - 2.5, bot, p.clad ? '#262626' : '#161616');
  discs(1.6, p.clad ? '#202020' : '#0c0c0c'); discs(0.6, '#060606'); // arches
  poly(tl, [pt(0, p.lamp[0]), pt(0.06, p.lamp[0] + 0.5), pt(0.05, p.lamp[1]), pt(0, p.lamp[1])]); // lamp wrap
  poly('#f2eed8', [pt(0.92, h1 + 2), pt(1, h1 + 2.5), pt(1, h1 + 4.5), pt(0.93, h1 + 4)]); // headlamp
  for (const d of [lb - 0.02, ...p.doors]) poly(S(col, 0.55), [pt(d, cy + 1), pt(d + 0.02, cy + 1), pt(d + 0.02, bot - 3), pt(d, bot - 3)]);
  g.restore();
  discs(0, '#141414'); discs(-r * 0.34, '#8c939b', 0.16); discs(-r * 0.7, '#4c5258', 0.33); // tyres, rims, hubs
  discs(-r * 0.8, '#d4d9de', -0.75, -1.5); // a glint on each rim
  // greenhouse: pillars in the cabin colour, side glass, a mirror at the foot of the windscreen
  const up = p.upper ? S(p.upper, 0.85) : S(col, 0.62), bend = (lb - lt) * 0.3;
  poly(up, [gh(0, cy), gh(0, ry), gh(lt, ry), gh(lt + bend, ry + 1.2), gh(lb, cy)]);
  const c0 = p.cpil, y0 = cy - 1, y1 = ry + 1.5;
  poly(grad(g, 0, y1, 0, y0, [[0, S(GLASS, 1.4)], [1, S(GLASS, 0.6)]]),
    [gh(c0, y0), gh(c0 + 0.03, y1 + 0.5), gh(c0 + 0.08, y1), gh(lt - 0.02, y1), gh(lt + bend - 0.03, y1 + 1.2), gh(lb - 0.06, y0)]);
  poly(SHINE, [gh(lt - 0.12, y1), gh(lt - 0.04, y1), gh(lb - 0.2, y0), gh(lb - 0.28, y0)]);
  for (const d of p.doors) poly(up, [gh(d, y0 + 1), gh(d, y1 - 1), gh(d + 0.035, y1 - 1), gh(d + 0.035, y0 + 1)]);
  const m = lb - 0.07, mx = cx(cy);
  poly(S(col, 0.7), [pt(m, cy - 2.5, mx - 0.5), pt(m, cy - 2.5, mx + 2.5), pt(m + 0.02, cy + 0.5, mx + 2), pt(m + 0.02, cy + 0.5, mx - 0.5)]);
}

// steer: -2..2 (0 straight, 1 slight, 2 full lock). Left turns mirror the layout, not the rear art.
// plate: the player's name on the number plate ('' for a plain one).
const big = fn => make(72 * SS, 40 * SS, g => { g.scale(SS, SS); fn(g); }); // a 72x40 layout, drawn at SS
function shadow(g) { // soft, darkest under the middle of the car
  g.save(); g.translate(36, 36.5); g.scale(1, 0.13);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 37);
  gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(-37, -37, 74, 74); g.restore();
}
function drawCar(g, model, col, steer, brake, plate) {
  shadow(g);
  const k = Math.min(2, Math.abs(steer)), dir = Math.sign(steer);
  if (!k) { drawRear(g, model, col, 0, brake, plate); return; }
  const p = PROFILE[model], [f, fw] = TURN[k], ox = 36 - (72 * f + fw) / 2;
  const rear = big(h => drawRear(h, model, col, k * dir, brake, plate));
  g.drawImage(rear, dir > 0 ? ox : 72 - ox - 72 * f, 0, 72 * f, 40);
  const side = big(h => drawFlank(h, p, col, lamps(brake)[0], ox + (p.edge + k) * f - 0.5, fw,
    ox + (p.cab[0] + p.slide[0] * k) * f, ox + (p.cab[2] + p.slide[1] * k) * f));
  g.drawImage(dir > 0 ? side : flip(side), 0, 0, 72, 40);
}
export function car(model, col, steer, brake, plate = '') {
  const key = model + col + steer + (brake ? 1 : 0) + plate;
  let img = carCache.get(key);
  if (img) return img;
  if (carCache.size >= CACHE_MAX) carCache.clear();
  img = big(g => drawCar(g, model, col, steer, brake, plate));
  img.mip = make(72, 40, g => { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, 72, 40); });
  carCache.set(key, img);
  return img;
}
