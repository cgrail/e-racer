'use strict';

// Global constants shared by every module.
const K = (() => {
  const SEG_LEN = 200, CAM_H = 1500, FOV = 100;
  const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
  return {
    W: 480, H: 300,              // internal resolution (upscaled with nearest-neighbour)
    SEG_LEN,                     // world length of one road segment
    RUMBLE_LEN: 3,               // segments per rumble strip / lane dash
    ROAD_W: 1800,                // half road width in world units
    CAM_H, CAM_DEPTH,
    PLAYER_Z: CAM_H * CAM_DEPTH, // distance from camera to the player's car
    MAX_SPEED: SEG_LEN * 60,     // world units per second at 100% speed
    MPH: 175,                    // displayed mph at MAX_SPEED
    CAR_W: 750,                  // car width in world units
    CAR_LEN: 520,                // collision length of a car
    START_SEG: 60,               // segment of the start / finish line
    GRAVITY: 30000,
    STEP: 1 / 120,               // physics step
  };
})();

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  easeIn: (a, b, p) => a + (b - a) * p * p,
  easeInOut: (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5),
  wrap: (v, m) => ((v % m) + m) % m,
  expFog: (d, density) => 1 / Math.exp(d * d * density),

  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  pick: (rnd, arr) => arr[Math.floor(rnd() * arr.length)],
  pickWeighted(rnd, list) {
    let tot = 0;
    for (const [, w] of list) tot += w;
    let r = rnd() * tot;
    for (const [item, w] of list) if ((r -= w) <= 0) return item;
    return list[list.length - 1][0];
  },
  shuffle(rnd, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },

  rgb(hex) {
    let h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  // f < 1 darkens, f > 1 lightens towards white
  shade(hex, f) {
    const c = U.rgb(hex).map(v => (f <= 1 ? v * f : v + (255 - v) * (f - 1)));
    return `rgb(${c.map(v => Math.round(U.clamp(v, 0, 255))).join(',')})`;
  },
  mix(a, b, t) {
    const x = U.rgb(a), y = U.rgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  },
  rgba(hex, a) { return `rgba(${U.rgb(hex).join(',')},${a})`; },

  fmtTime(t) {
    if (!isFinite(t) || t <= 0) return `0'00"00`;
    const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
    return `${m}'${String(s).padStart(2, '0')}"${String(cs).padStart(2, '0')}`;
  },
  // world units -> kilometres (MAX_SPEED world units per second == K.MPH)
  km: units => (units * (K.MPH * 0.44704)) / K.MAX_SPEED / 1000,
  ordinal(n) {
    const s = n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH';
    return n + s;
  },

  load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  },
  save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  },
};
