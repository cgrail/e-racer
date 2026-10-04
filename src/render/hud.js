import { K, U } from '../core/util.js';
import { SUPER_T } from '../race/specs.js';
import { text } from './text.js';

// In-race HUD: position, laps or time left, speed, motor power meter and messages.
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
    if (car.energy != null) energyGauge(g, pad, pad + 15 + big, race, car, split);
    let gy = pad + 15 + big + (car.energy != null ? 22 : 0);
    if (car.power != null && powerGauge(g, pad, gy, race, car, split)) gy += 22;
    if (car.shock) shockGauge(g, pad, gy, race);
  }
  text(g, 'TIME ' + U.fmtTime(race.time), w - pad, pad, sm, '#ffffff', 'right');
  text(g, 'LAP  ' + U.fmtTime(car.lap >= 1 && !car.finished ? race.time - car.lapStart : car.lastLap), w - pad, pad + 10, sm, '#c0c8ff', 'right');
  if (car.bestLap && !split) text(g, 'BEST ' + U.fmtTime(car.bestLap), w - pad, pad + 20, sm, '#ffe040', 'right');

  // speed, motor power (kW drawn, cyan bars and a minus sign while regen braking)
  const v = Math.round((car.speed / K.MAX_SPEED) * K.MPH * (kmh ? 1.609 : 1));
  const yb = h - pad - (split ? 16 : 24);
  text(g, String(v).padStart(3, ' '), pad, yb, split ? 16 : 24, '#ffffff');
  text(g, kmh ? 'KM/H' : 'MPH', pad + (split ? 52 : 76), yb + (split ? 8 : 16), sm, '#ffe040');
  const bars = 16, bw = split ? 4 : 6, bh = split ? 14 : 22, rx = w - pad - bars * (bw + 1);
  const pw = car.pwr || 0, regen = pw < -0.02, lit = Math.round(U.clamp(Math.abs(pw), 0, 1) * bars);
  for (let i = 0; i < bars; i++) {
    const hh = Math.round(bh * (0.35 + (0.65 * i) / bars));
    g.fillStyle = i >= lit ? 'rgba(0,0,0,0.45)' : regen ? '#40d0ff' : i < 10 ? '#40e040' : i < 13 ? '#ffe040' : '#ff3030';
    g.fillRect(rx + i * (bw + 1), h - pad - hh, bw, hh);
  }
  const kw = Math.round(pw * car.spec.kw);
  text(g, `${regen ? '-' : ''}${Math.abs(kw)} KW`, rx, h - pad - bh - 10, sm, regen ? '#40d0ff' : '#ffe040');
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

// Battery gauge under the position: green, yellow below half, blinking red when low.
function energyGauge(g, x, y, race, car, split) {
  const bw = split ? 44 : 60, bh = split ? 5 : 7, e = car.energy, low = e < 0.2;
  text(g, 'ENERGY', x, y, 8, '#ffe040');
  const by = y + 10;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, by, bw + 2, bh + 2); g.fillRect(x + bw + 2, by + 2, 2, bh - 2);
  g.fillStyle = e > 0.5 ? '#40e080' : !low ? '#ffd040' : Math.floor(race.wtime * 4) % 2 ? '#ff3030' : '#801818';
  g.fillRect(x + 1, by + 1, Math.round(bw * e), bh);
}

// A held flash (electro shock): a crackling arc in a box.
function shockGauge(g, x, y, race) {
  text(g, 'FLASH', x, y, 8, '#40d8ff');
  const by = y + 10;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, by, 10, 10);
  g.strokeStyle = Math.floor(race.wtime * 6) % 2 ? '#ffffff' : '#40d8ff'; g.lineWidth = 1; g.beginPath();
  for (const [px, py] of [[1, 5], [3, 2], [5, 7], [7, 3], [9, 5]]) g.lineTo(x + px, by + py + 0.5);
  g.stroke();
}

// A held boost as a bolt; while its super power runs, a draining bar. Returns whether it drew.
function powerGauge(g, x, y, race, car, split) {
  const on = car.superT > 0;
  if (!on && !car.power) return false;
  text(g, 'BOOST', x, y, 8, on && Math.floor(race.wtime * 8) % 2 ? '#ffffff' : '#ff70ff');
  const by = y + 10;
  if (on) {
    const bw = split ? 44 : 60;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, by, bw + 2, 7);
    g.fillStyle = '#ff60ff'; g.fillRect(x + 1, by + 1, Math.round(bw * Math.min(1, car.superT / (car.superMax || SUPER_T))), 5);
    return true;
  }
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, by, 10, 10);
  g.fillStyle = '#fff060'; g.beginPath();
  for (const [px, py] of [[6, 1], [2, 6], [5, 6], [4, 9], [8, 4], [5, 4]]) g.lineTo(x + px, by + py);
  g.closePath(); g.fill();
  return true;
}
