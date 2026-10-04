import { K, U } from '../core/util.js';
import { text } from './text.js';

// In-race HUD: position, laps or time left, speed, gear, rev bar and messages.
export function hud(g, w, h, race, car, split, opts) {
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
