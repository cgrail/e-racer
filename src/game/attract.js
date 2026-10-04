import { Track } from '../world/track.js';
import { Race } from '../race/race.js';
import { MODELS, CAR_COLORS } from '../race/specs.js';
import { Render } from '../render/index.js';
import { g, W, H } from './screen.js';

// Attract mode: a self-driving demo race shown behind the menus.
let attract = null, attractCam = null, attractT = 0, attractVS = {};
function newAttract() {
  const p = Track.random();
  p.obst = Math.min(p.obst, 5); p.length = 5;
  const ai = Array.from({ length: 12 }, (_, k) => ({ id: 'A' + k, name: '', model: MODELS[k % 3], color: CAR_COLORS[k % CAR_COLORS.length], aiTop: 0.72 + (11 - k) * 0.012 }));
  attract = new Race({ track: Track.build(p), mode: 'race', laps: 99, humans: [], ai, attract: true });
  attractCam = attract.cars[7]; attractT = 0; attractVS = {};
  for (let i = 0; i < 240; i++) attract.update(1 / 30, []); // start the demo already under way
}
export function drawAttract(dt, dim) {
  if (!attract || (attractT += dt) > 25) newAttract();
  attract.update(Math.min(dt, 0.05), []);
  Render.view(g, { x: 0, y: 0, w: W, h: H }, attract, attractCam, attractVS, { dt, hud: false });
  if (dim) { g.fillStyle = `rgba(0,0,20,${dim})`; g.fillRect(0, 0, W, H); }
}
