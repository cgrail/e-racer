import { U } from '../core/util.js';
import { make, flip } from './draw.js';
import { pine, oak, poplar, palm, cactus, deadtree, reeds, bush, rock, cliff, lamp, chevron, billboard, neonsign, worksign, cone, barrier, ebarrier, puddle, ice, log, ramp, boost, pylon, tower, house, building, windmill, tumble, snowman, gantry, cell, orb } from './scenery.js';

// Sprite table: every scenery and hazard sprite, pre-rendered once (with variants and mirrors).
// name -> definition. ww = width in world units, hit = collision width fraction,
// hx = collision centre (fraction of canvas width), fx = effect when driven into.
export const DEF = {
  pine: { w: 32, h: 64, ww: 1500, hit: 0.3, v: 3, draw: pine },
  snowpine: { w: 32, h: 64, ww: 1500, hit: 0.3, v: 3, draw: pine, o: { leaf: '#2a5a40', snow: true } },
  oak: { w: 48, h: 56, ww: 2100, hit: 0.25, v: 3, draw: oak },
  autumnoak: { w: 48, h: 56, ww: 2100, hit: 0.25, v: 3, draw: (g, w, h, r, o, v) => oak(g, w, h, r, { leaf: ['#c8641e', '#d8a020', '#a8401a'][v % 3] }) },
  poplar: { w: 20, h: 64, ww: 900, hit: 0.4, v: 2, draw: poplar },
  autumnpoplar: { w: 20, h: 64, ww: 900, hit: 0.4, v: 2, draw: (g, w, h, r, o, v) => poplar(g, w, h, r, { leaf: v ? '#d89a28' : '#c06020' }) },
  palm: { w: 48, h: 64, ww: 1800, hit: 0.2, hx: 0.48, v: 2, draw: palm },
  cactus: { w: 32, h: 48, ww: 900, hit: 0.4, v: 1, draw: cactus },
  deadtree: { w: 40, h: 56, ww: 1500, hit: 0.2, v: 3, draw: deadtree },
  reeds: { w: 32, h: 32, ww: 1100, hit: 0, v: 3, draw: reeds },
  bush: { w: 32, h: 20, ww: 1000, hit: 0, v: 3, draw: bush },
  rock: { w: 32, h: 22, ww: 1100, hit: 0.8, v: 3, draw: rock },
  snowrock: { w: 32, h: 22, ww: 1500, hit: 0.8, v: 2, draw: rock, o: { col: '#9aa0aa', snow: true } },
  boulder: { w: 64, h: 44, ww: 2200, hit: 0.85, v: 2, draw: rock, o: { col: '#9a8a78' } },
  cliff: { w: 96, h: 96, ww: 4200, hit: 0.95, v: 2, draw: cliff },
  lamp: { w: 40, h: 96, ww: 1100, hit: 0.12, hx: 0.11, v: 1, mirror: true, draw: lamp },
  lampon: { w: 40, h: 96, ww: 1100, hit: 0.12, hx: 0.11, v: 1, mirror: true, draw: lamp, o: { on: true } },
  chevR: { w: 28, h: 32, ww: 700, hit: 0.15, v: 1, draw: chevron },
  chevL: { w: 28, h: 32, ww: 700, hit: 0.15, v: 1, draw: chevron, flipped: true },
  billboard: { w: 72, h: 48, ww: 2600, hit: 0.85, v: 6, draw: billboard },
  neonsign: { w: 72, h: 48, ww: 2600, hit: 0.85, v: 4, draw: neonsign },
  worksign: { w: 20, h: 36, ww: 600, hit: 0.2, v: 1, draw: worksign },
  house: { w: 56, h: 44, ww: 3000, hit: 0.9, v: 4, draw: house },
  snowhouse: { w: 56, h: 44, ww: 3000, hit: 0.9, v: 4, draw: house, o: { snow: true } },
  nighthouse: { w: 56, h: 44, ww: 3000, hit: 0.9, v: 4, draw: house, o: { lit: true } },
  building: { w: 48, h: 96, ww: 3200, hit: 0.9, v: 4, draw: building },
  nightbuilding: { w: 48, h: 96, ww: 3200, hit: 0.9, v: 4, draw: building, o: { lit: true } },
  tower: { w: 56, h: 112, ww: 3000, hit: 0.8, v: 2, draw: tower },
  windmill: { w: 48, h: 96, ww: 2400, hit: 0.3, v: 4, anim: 6, draw: windmill },
  snowman: { w: 24, h: 32, ww: 650, hit: 0.7, v: 1, draw: snowman },
  pylon: { w: 14, h: 72, ww: 450, hit: 0.5, v: 2, draw: pylon },
  gantry: { w: 192, h: 72, ww: 4600, hit: 0, v: 1, draw: gantry },
  cpgantry: { w: 192, h: 72, ww: 4600, hit: 0, v: 1, draw: gantry, o: { cp: true } },
  // obstacles on the road
  cone: { w: 12, h: 16, ww: 260, hit: 1, v: 1, fx: 'soft', draw: cone },
  barrier: { w: 48, h: 24, ww: 1300, hit: 0.95, v: 1, fx: 'crash', avoid: 1, draw: barrier },
  ebarrier: { w: 48, h: 24, ww: 1300, hit: 0.95, v: 1, fx: 'crash', avoid: 1, draw: ebarrier },
  puddle: { w: 64, h: 12, ww: 1500, hit: 0.9, v: 1, fx: 'splash', avoid: 1, flat: 1, draw: puddle },
  ice: { w: 64, h: 12, ww: 1700, hit: 0.9, v: 1, fx: 'ice', flat: 1, draw: ice },
  log: { w: 64, h: 18, ww: 1600, hit: 0.95, v: 2, fx: 'crash', avoid: 1, draw: log },
  rockobs: { w: 32, h: 22, ww: 900, hit: 0.85, v: 3, fx: 'crash', avoid: 1, draw: rock, o: { col: '#8a7a6a' } },
  ramp: { w: 128, h: 28, ww: 3600, hit: 1, v: 1, fx: 'jump', draw: ramp },
  boost: { w: 64, h: 14, ww: 1000, hit: 0.9, v: 1, fx: 'boost', flat: 1, draw: boost },
  tumble: { w: 24, h: 24, ww: 600, hit: 0.8, v: 2, fx: 'soft', draw: tumble },
  cell: { w: 24, h: 28, ww: 560, hit: 1.6, v: 1, fx: 'energy', draw: cell },
  orb: { w: 24, h: 24, ww: 600, hit: 1.6, v: 1, fx: 'power', draw: orb },
};
for (const [name, d] of Object.entries(DEF)) {
  d.frames = [];
  for (let v = 0; v < d.v; v++) {
    const rnd = U.rng(U.hash(name) + v * 977);
    let c = make(d.w, d.h, g => d.draw(g, d.w, d.h, rnd, d.o || {}, v));
    if (d.flipped) c = flip(c);
    d.frames.push(c);
  }
  if (d.mirror) d.mframes = d.frames.map(flip);
  d.hx = d.hx == null ? 0.5 : d.hx;
}

export function get(name, v, mirrored) {
  const d = DEF[name];
  return (mirrored && d.mframes ? d.mframes : d.frames)[v % d.frames.length];
}
