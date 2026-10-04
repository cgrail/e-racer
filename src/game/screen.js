import { K } from '../core/util.js';
import { Render } from '../render/index.js';

// The game canvas (fixed 480x300, upscaled with nearest-neighbour) and its text helper.
export const cv = document.getElementById('screen');
export const g = cv.getContext('2d');
cv.width = K.W; cv.height = K.H;
export const W = K.W, H = K.H;

export const text = (s, x, y, size, col, align, shadow) => Render.text(g, s, x, y, size, col, align, shadow);
