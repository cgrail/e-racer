import { K, U } from '../core/util.js';
import { Art } from '../art/index.js';
import { project, blit, segment } from './road.js';
import { sky, background } from './sky.js';
import { particles, weather, zap, flames } from './effects.js';
import { hud } from './hud.js';

// Segment-based pseudo-3D renderer. Draws one player's view into a viewport (full screen or split).
// vp: {x,y,w,h}; car: the car the camera follows; vs: per-view persistent state; opts: {dt, hud, units}
export function view(g, vp, race, car, vs, opts) {
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
      if (ob.gone || (car.taken && (car.taken.has(ob) || !race.sees(car, ob)))) continue;
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
      const img = Art.car(c.model, c.color, c.frame, c.brake, c.plate);
      const dw = K.CAR_W * cs * sx, dh = (dw * img.height) / img.width * sprMul;
      if (dw > w * 1.2) continue;
      if (c.superT > 0) flames(g, cx - dw / 2, cy - dh, dw, dh);
      blit(g, img, cx - dw / 2, cy - dh, dw, dh);
      if (c.shockT > 0) zap(g, cx - dw / 2, cy - dh, dw, dh);
    }
    g.globalAlpha = 1;
  }
  g.globalAlpha = 1;

  // player car
  const pScale = 1 / K.CAM_H;
  const pw = K.CAR_W * pScale * sx;
  const img = Art.car(car.model, car.color, car.frame, car.brake, car.plate);
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
  if (car.shockT > 0) zap(g, w / 2 - pw / 2 + wig, by - ph, pw, ph);

  weather(g, w, h, horizon, th, car, vs, opts.dt || 0, race);
  if (race.flash > 0) { g.fillStyle = `rgba(230,235,255,${race.flash * 0.55})`; g.fillRect(0, 0, w, h); }
  if (opts.hud !== false) hud(g, w, h, race, car, split, opts);
  g.restore();
}
