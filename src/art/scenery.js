import { S, R, P, C, E, glow, stripes } from './draw.js';

// Painters for roadside scenery and road hazards. Each draws one sprite variant into a canvas.
export function pine(g, w, h, r, o) {
  const leaf = o.leaf || '#1e6a2c', dk = S(leaf, 0.65), lt = S(leaf, 1.3);
  R(g, 14, 50, 4, 14, '#5a3a1e'); R(g, 14, 50, 1, 14, '#7a5232');
  for (let i = 0; i < 4; i++) {
    const top = 1 + i * 11, bot = top + 19 + i, hw = 5 + i * 3.4 + r() * 1.5;
    P(g, dk, [16, top, 16 + hw, bot, 16 - hw, bot]);
    P(g, leaf, [16, top, 16 + hw * 0.25, bot - 1, 16 - hw + 1, bot - 1]);
    P(g, lt, [16, top + 2, 16 - hw * 0.15, bot - 4, 16 - hw + 3, bot - 2]);
    if (o.snow) {
      const m = top + (bot - top) * 0.55;
      P(g, '#f6faff', [16, top, 16 + hw * 0.55, m, 16 + hw * 0.1, top + (bot - top) * 0.4, 16 - hw * 0.55, m]);
      R(g, 16 - hw + 1, bot - 2, hw * 2 - 2, 2, '#e4ecf6');
    }
  }
}
export function oak(g, w, h, r, o) {
  const leaf = o.leaf || '#2f7d2a', dk = S(leaf, 0.6), lt = S(leaf, 1.35);
  P(g, '#5c3b20', [21, 56, 27, 56, 26, 30, 22, 30]);
  g.strokeStyle = '#5c3b20'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(24, 38); g.lineTo(14, 26); g.moveTo(24, 36); g.lineTo(34, 24); g.stroke();
  for (let i = 0; i < 16; i++) C(g, 24 + (r() - 0.5) * 24, 22 + (r() - 0.5) * 18, 6 + r() * 4, dk);
  for (let i = 0; i < 12; i++) C(g, 22 + (r() - 0.5) * 22, 19 + (r() - 0.5) * 16, 5 + r() * 4, leaf);
  for (let i = 0; i < 9; i++) C(g, 18 + (r() - 0.5) * 16, 14 + (r() - 0.5) * 12, 2 + r() * 2.5, lt);
}
export function poplar(g, w, h, r, o) {
  const leaf = o.leaf || '#2d6e2e', dk = S(leaf, 0.65), lt = S(leaf, 1.35);
  R(g, 9, 48, 2, 16, '#5a3a1e');
  E(g, 10, 28, 9, 26, dk); E(g, 9, 26, 7, 22, leaf); E(g, 7, 22, 3, 14, lt);
  for (let i = 0; i < 14; i++) R(g, 4 + r() * 12, 6 + r() * 42, 2, 1, dk);
}
export function palm(g, w, h, r) {
  for (let i = 0; i < 14; i++) {
    const y = 62 - i * 4, x = 20 + Math.sin(i / 14 * 1.6) * 6;
    R(g, x, y - 4, 5, 5, i % 2 ? '#8a6038' : '#a77a48');
  }
  g.lineCap = 'round';
  for (const a of [-2.9, -2.4, -1.9, -1.3, -0.8, -0.2, 0.3]) {
    const ex = 27 + Math.cos(a) * 21, ey = 10 + Math.sin(a) * 9 + 10;
    for (const [col, lw] of [['#1f6a24', 4], ['#3c9a3a', 2]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(27, 10);
      g.quadraticCurveTo(27 + Math.cos(a) * 13, 6 + Math.sin(a) * 10, ex, ey); g.stroke();
    }
  }
  C(g, 25, 12, 2, '#5a3a1a'); C(g, 29, 13, 2, '#5a3a1a');
}
export function cactus(g) {
  const c = '#3f8f3a', dk = S(c, 0.7), lt = S(c, 1.35);
  R(g, 12, 8, 8, 40, c); C(g, 16, 8, 4, c);
  R(g, 4, 18, 5, 12, c); C(g, 6.5, 18, 2.5, c); R(g, 4, 28, 10, 4, c);
  R(g, 23, 12, 5, 12, c); C(g, 25.5, 12, 2.5, c); R(g, 18, 22, 10, 4, c);
  R(g, 14, 6, 1, 42, lt); R(g, 18, 6, 1, 42, dk); R(g, 5, 18, 1, 12, lt); R(g, 24, 12, 1, 12, lt);
}
export function deadtree(g, w, h, r, o) {
  g.strokeStyle = o.col || '#4a3c32'; g.lineCap = 'round';
  const br = (x, y, a, len, wd, d) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    if (d > 0) {
      br(x2, y2, a - 0.35 - r() * 0.35, len * 0.72, wd * 0.65, d - 1);
      br(x2, y2, a + 0.35 + r() * 0.35, len * 0.72, wd * 0.65, d - 1);
    }
  };
  br(20, 56, -Math.PI / 2 + (r() - 0.5) * 0.2, 17, 5, 4);
}
export function reeds(g, w, h, r) {
  for (let i = 0; i < 16; i++) {
    const x = 3 + r() * 26, ht = 12 + r() * 18, lean = (r() - 0.5) * 6;
    g.strokeStyle = r() < 0.5 ? '#6f7a3a' : '#8a8a48'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 32); g.quadraticCurveTo(x, 32 - ht * 0.5, x + lean, 32 - ht); g.stroke();
    if (r() < 0.4) E(g, x + lean, 32 - ht + 2, 1.3, 3, '#5a3a20');
  }
}
export function bush(g, w, h, r, o) {
  const c = o.leaf || '#2e7a30';
  for (let i = 0; i < 10; i++) C(g, 7 + r() * 18, 12 + r() * 3, 4 + r() * 3, S(c, 0.7));
  for (let i = 0; i < 8; i++) C(g, 8 + r() * 16, 10 + r() * 3, 3 + r() * 3, c);
  for (let i = 0; i < 5; i++) C(g, 9 + r() * 12, 8 + r() * 3, 1.5 + r() * 1.5, S(c, 1.3));
}
export function rock(g, w, h, r, o) {
  const c = o.col || '#8a8680', cx = w / 2, cy = h * 0.62, pts = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    pts.push(cx + Math.cos(a) * w * 0.47 * (0.85 + r() * 0.15), Math.min(h - 1, cy + Math.sin(a) * h * 0.58 * (0.8 + r() * 0.2)));
  }
  pts.push(w * 0.97, h - 1, w * 0.03, h - 1);
  P(g, S(c, 0.7), pts);
  P(g, c, [w * 0.12, h * 0.75, w * 0.3, h * 0.2, w * 0.55, h * 0.12, w * 0.62, h * 0.55, w * 0.4, h * 0.85]);
  P(g, S(c, 1.3), [w * 0.25, h * 0.4, w * 0.32, h * 0.22, w * 0.5, h * 0.16, w * 0.42, h * 0.38]);
  R(g, 0, h - 2, w, 2, 'rgba(0,0,0,0.25)');
  if (o.snow) P(g, '#f4f8ff', [w * 0.2, h * 0.36, w * 0.32, h * 0.18, w * 0.6, h * 0.1, w * 0.8, h * 0.3, w * 0.55, h * 0.26]);
}
export function cliff(g, w, h, r) {
  const pts = [0, h];
  for (let i = 0; i <= 10; i++) pts.push(i / 10 * w, h * (0.05 + r() * 0.25 + (i === 0 || i === 10 ? 0.3 : 0)));
  pts.push(w, h);
  P(g, '#6e6a64', pts);
  g.save(); P(g, 'rgba(0,0,0,0)', pts); g.clip();
  for (let y = 10; y < h; y += 7 + r() * 5) R(g, 0, y, w, 2, 'rgba(40,36,30,0.35)');
  for (let i = 0; i < 9; i++) P(g, '#8c877e', [r() * w, h * 0.2 + r() * h * 0.6, r() * w, h * 0.1 + r() * h * 0.5, r() * w, h * 0.3 + r() * h * 0.6]);
  R(g, 0, h * 0.85, w, h * 0.15, 'rgba(0,0,0,0.25)');
  g.restore();
}
export function lamp(g, w, h, r, o) {
  R(g, 3, 10, 3, 84, '#5a5e66'); R(g, 3, 10, 1, 84, '#8a8e96'); R(g, 1, 90, 7, 6, '#44474e');
  R(g, 3, 8, 26, 3, '#5a5e66'); R(g, 3, 8, 26, 1, '#8a8e96');
  R(g, 24, 7, 12, 5, '#3a3c42'); R(g, 25, 12, 10, 2, o.on ? '#fff6c0' : '#d8d8d0');
  if (o.on) glow(g, 30, 14, 10, '#fff0a0', 0.6);
}
export function chevron(g) {
  R(g, 13, 16, 2, 16, '#555'); R(g, 1, 2, 26, 15, '#111'); R(g, 2, 3, 24, 13, '#f8d000');
  for (const k of [0, 1]) P(g, '#111', [5 + k * 10, 4, 11 + k * 10, 9.5, 5 + k * 10, 15, 8 + k * 10, 15, 14 + k * 10, 9.5, 8 + k * 10, 4]);
}
const BOARDS = [
  { text: 'TURBO', bg: '#d02020', fg: '#ffffff' }, { text: 'ELECTRO', bg: '#2040c0', fg: '#ffdd00' },
  { text: 'SPEED', bg: '#ffd000', fg: '#c01010' }, { text: 'OIL', bg: '#101010', fg: '#ffb000' },
  { text: 'GO!', bg: '#20a040', fg: '#ffffff' }, { text: 'TYRES', bg: '#e8e8e8', fg: '#202020' },
];
export function billboard(g, w, h, r, o, v) {
  const b = BOARDS[v % BOARDS.length];
  R(g, 10, 28, 3, 20, '#444'); R(g, 59, 28, 3, 20, '#444');
  R(g, 2, 2, 68, 30, '#1a1a1a'); R(g, 4, 4, 64, 26, b.bg);
  g.font = 'bold 14px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(b.text, 37, 18);
  g.fillStyle = b.fg; g.fillText(b.text, 36, 17);
  R(g, 4, 4, 64, 2, 'rgba(255,255,255,0.25)');
}
const NEON = [['HYPER', '#00f0ff'], ['2099', '#ff3ad8'], ['ZOOM', '#7dff4a'], ['NEON', '#ffd23a']];
export function neonsign(g, w, h, r, o, v) {
  const [t, c] = NEON[v % NEON.length];
  R(g, 10, 28, 3, 20, '#2a2040'); R(g, 59, 28, 3, 20, '#2a2040');
  R(g, 2, 2, 68, 30, '#0c0620'); g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(4.5, 4.5, 63, 25);
  g.font = 'bold 14px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = c; g.shadowBlur = 6; g.fillStyle = c; g.fillText(t, 36, 17); g.fillText(t, 36, 17);
  g.shadowBlur = 0;
}
export function worksign(g) {
  R(g, 9, 18, 2, 18, '#666');
  P(g, '#d01818', [10, 0, 20, 18, 0, 18]); P(g, '#ffffff', [10, 4, 16.5, 16, 3.5, 16]);
  R(g, 9, 7, 2, 5, '#111'); R(g, 9, 13, 2, 2, '#111');
}
export function cell(g) { // energy cell pickup
  glow(g, 12, 15, 13, '#60ffb0', 0.55);
  R(g, 9, 2, 6, 3, '#d8d8d8'); R(g, 9, 2, 6, 1, '#ffffff');
  R(g, 6, 4, 12, 22, '#0c3a2a'); R(g, 7, 5, 10, 20, '#20d080'); R(g, 7, 5, 3, 20, '#80ffc0');
  P(g, '#fff6a0', [14, 7, 8, 16, 12, 16, 10, 23, 16, 13, 12, 13]);
}
export function cone(g) {
  R(g, 0, 14, 12, 2, '#222');
  P(g, '#ff6a00', [6, 0, 10.5, 14, 1.5, 14]);
  P(g, '#ffffff', [3.8, 7, 8.2, 7, 9.2, 10, 2.8, 10]);
  R(g, 5, 1, 1, 12, 'rgba(255,255,255,0.3)');
}
export function barrier(g) {
  R(g, 6, 12, 3, 12, '#666'); R(g, 39, 12, 3, 12, '#666');
  stripes(g, 0, 4, 48, 10, '#ffffff', '#d82020', 5);
  R(g, 0, 13, 48, 1, 'rgba(0,0,0,0.3)');
  C(g, 4, 3, 2.5, '#ffb000'); C(g, 44, 3, 2.5, '#ffb000');
}
export function ebarrier(g) {
  R(g, 2, 2, 4, 22, '#2a1a48'); R(g, 42, 2, 4, 22, '#2a1a48');
  glow(g, 24, 10, 22, '#ff2ad4', 0.5);
  R(g, 4, 7, 40, 6, '#ff2ad4'); R(g, 4, 9, 40, 2, '#ffd0f4');
  R(g, 3, 2, 2, 22, '#00f0ff'); R(g, 43, 2, 2, 22, '#00f0ff');
}
export function puddle(g) {
  E(g, 32, 6, 31, 5, 'rgba(30,50,80,0.85)'); E(g, 30, 5, 24, 3, 'rgba(70,100,140,0.7)');
  R(g, 14, 4, 10, 1, 'rgba(220,235,255,0.6)'); R(g, 36, 6, 14, 1, 'rgba(220,235,255,0.5)');
}
export function ice(g) {
  E(g, 32, 6, 31, 5, 'rgba(200,235,255,0.85)'); E(g, 30, 5, 22, 3, 'rgba(240,250,255,0.8)');
  R(g, 10, 5, 14, 1, '#ffffff'); R(g, 38, 7, 12, 1, '#ffffff');
}
export function log(g, w, h, r) {
  R(g, 4, 4, 54, 11, '#6b4423'); R(g, 4, 4, 54, 2, '#8a5a30'); R(g, 4, 12, 54, 3, '#4a2e18');
  for (let i = 0; i < 6; i++) R(g, 8 + r() * 44, 6 + r() * 6, 6, 1, '#4a2e18');
  E(g, 58, 9.5, 4, 5.5, '#c8a070'); E(g, 58, 9.5, 2, 3, '#a07848');
  R(g, 2, 15, 60, 2, 'rgba(0,0,0,0.3)');
}
export function ramp(g) {
  P(g, '#3a3a3a', [0, 28, 128, 28, 116, 4, 12, 4]);
  g.save(); P(g, '#000', [6, 27, 122, 27, 112, 5, 16, 5]); g.clip();
  stripes(g, 0, 4, 128, 24, '#f0c000', '#1a1a1a', 8);
  g.restore();
  R(g, 14, 4, 100, 2, '#fff2a0');
}
export function boost(g) {
  R(g, 2, 2, 60, 10, '#101830');
  glow(g, 32, 7, 30, '#00f0ff', 0.35);
  for (let k = 0; k < 3; k++) { const x = 13 + k * 14; P(g, '#00f0ff', [x, 11, x + 6, 3, x + 12, 11, x + 9, 11, x + 6, 7, x + 3, 11]); }
}
export function pylon(g, w, h, r, o, v) {
  const c = v % 2 ? '#ff2ad4' : '#00f0ff';
  glow(g, 7, 36, 14, c, 0.35);
  R(g, 4, 6, 6, 66, '#1a1030'); R(g, 6, 8, 2, 60, c); C(g, 7, 5, 3, '#ffffff'); glow(g, 7, 5, 7, c, 0.8);
}
export function tower(g, w, h, r, o, v) {
  const c = v % 2 ? '#00e8ff' : '#ff3ad8';
  P(g, '#1c1438', [8, 112, 48, 112, 42, 16, 14, 16]);
  P(g, '#281c50', [28, 112, 48, 112, 42, 16, 28, 16]);
  for (let y = 22; y < 108; y += 6) for (let x = 16; x < 40; x += 4) if (r() < 0.55) R(g, x, y, 2, 2, r() < 0.3 ? '#ffe070' : c);
  R(g, 14, 16, 28, 2, c); R(g, 27, 2, 2, 14, '#666'); C(g, 28, 2, 2, '#ff2020');
}
export function house(g, w, h, r, o, v) {
  const walls = ['#e8dcc0', '#d8c8a8', '#f0e8e0', '#c8b090'], roofs = ['#8a3a2a', '#5a4a3a', '#3a4a5a', '#9a4a20'];
  const wall = walls[v % 4], roof = o.snow ? '#f4f8ff' : roofs[(v + 1) % 4];
  R(g, 6, 18, 44, 26, wall); R(g, 6, 40, 44, 4, S(wall, 0.8));
  R(g, 38, 4, 6, 12, '#6a4a3a');
  P(g, roof, [2, 20, 28, 3, 54, 20]); P(g, S(roof === '#f4f8ff' ? '#c8d8e8' : roof, 0.75), [2, 20, 54, 20, 54, 22, 2, 22]);
  const win = o.lit ? '#ffe9a0' : '#8fb8e0';
  R(g, 11, 25, 8, 7, win); R(g, 37, 25, 8, 7, win); R(g, 25, 30, 7, 14, '#5a3a2a');
  R(g, 14, 25, 1, 7, '#fff'); R(g, 40, 25, 1, 7, '#fff');
}
export function building(g, w, h, r, o, v) {
  const cols = ['#8a94a6', '#a89a88', '#6a7a8a', '#b0b0b8'];
  const c = cols[v % 4], top = 4 + Math.floor(r() * 24);
  R(g, 2, top, 44, 96 - top, c); R(g, 30, top, 16, 96 - top, S(c, 0.82));
  for (let y = top + 4; y < 90; y += 6) for (let x = 6; x < 42; x += 6) R(g, x, y, 3, 3, o.lit ? (r() < 0.5 ? '#ffe070' : '#2a2a3a') : '#5a7090');
}
export function windmill(g, w, h, r, o, v) {
  P(g, '#d8d2c8', [17, 96, 31, 96, 28, 30, 20, 30]); P(g, '#b8b2a8', [24, 96, 31, 96, 28, 30, 24, 30]);
  R(g, 21, 76, 6, 20, '#6a4a3a'); P(g, '#7a3a2a', [18, 32, 24, 22, 30, 32]);
  g.save(); g.translate(24, 28); g.rotate(v * Math.PI / 8 + 0.3);
  for (let k = 0; k < 4; k++) {
    g.rotate(Math.PI / 2);
    R(g, -1, 2, 2, 22, '#5a4030');
    R(g, 1, 6, 5, 18, 'rgba(240,236,220,0.92)');
    for (let y = 8; y < 24; y += 4) R(g, 1, y, 5, 1, '#5a4030');
  }
  g.restore(); C(g, 24, 28, 2, '#333');
}
export function tumble(g, w, h, r) {
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    g.beginPath(); const a = r() * 6.28;
    g.arc(12 + (r() - 0.5) * 6, 12 + (r() - 0.5) * 6, 4 + r() * 6, a, a + 2 + r() * 2); g.stroke();
  }
}
export function snowman(g) {
  C(g, 12, 23, 8, '#f4f8ff'); C(g, 12, 11, 6, '#ffffff'); C(g, 10, 21, 7, '#ffffff');
  R(g, 7, 2, 10, 4, '#222'); R(g, 5, 6, 14, 2, '#222');
  R(g, 10, 9, 1, 1, '#111'); R(g, 14, 9, 1, 1, '#111'); P(g, '#ff8a20', [12, 11, 17, 12, 12, 13]);
  R(g, 11, 18, 2, 2, '#222'); R(g, 11, 23, 2, 2, '#222'); R(g, 6, 15, 12, 2, '#c02020');
}
export function gantry(g, w, h, r, o) {
  for (const x of [4, 178]) {
    R(g, x, 0, 10, 72, '#6a6e78'); R(g, x, 0, 3, 72, '#9aa0aa');
    for (let y = 4; y < 72; y += 8) R(g, x + 3, y, 7, 2, '#4a4e58');
  }
  if (o.cp) {
    R(g, 14, 6, 164, 22, '#111'); R(g, 15, 7, 162, 20, '#ffd000');
    g.font = 'bold 13px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#111'; g.fillText('CHECKPOINT', 96, 17);
  } else {
    R(g, 14, 6, 164, 22, '#111');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 32; x++) if ((x + y) % 2) R(g, 15 + x * 5, 7 + y * 5, 5, 5, '#ffffff');
  }
  for (let x = 22; x < 176; x += 22) C(g, x, 31, 2, o.cp ? '#ffb000' : '#ff3030');
}
