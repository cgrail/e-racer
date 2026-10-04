// Pixel-font text (Press Start 2P, monospace fallback).
export function font(size) { return `${size}px "Press Start 2P", monospace`; }
export function text(g, s, x, y, size = 8, col = '#fff', align = 'left', shadow = '#000') {
  g.font = font(size); g.textAlign = align; g.textBaseline = 'top';
  if (shadow) { g.fillStyle = shadow; const o = Math.max(1, Math.round(size / 8)); g.fillText(s, x + o, y + o); }
  g.fillStyle = col; g.fillText(s, x, y);
}
