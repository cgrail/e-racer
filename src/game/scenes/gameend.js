import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { W, text } from '../screen.js';
import { go } from '../state.js';
import { blinkOn } from '../ui.js';
import { drawAttract } from '../attract.js';

// End of a championship or challenge: game over, champion or challenge complete.
export const GameEnd = {
  t: 0, title: '', lines: [],
  set(title, lines) { this.title = title; this.lines = lines; },
  enter() { this.t = 0; },
  update(dt) {
    this.t += dt;
    if (Input.menu().ok && this.t > 1) { Sound.fx.select(); go('MainMenu'); }
  },
  draw(dt) {
    drawAttract(dt, 0.5);
    text(this.title, W / 2, 80, 24, blinkOn(this.t, 2) ? '#ffe040' : '#ffffff', 'center');
    this.lines.forEach((l, i) => text(l, W / 2, 130 + i * 16, 8, '#ffffff', 'center'));
    if (this.t > 1) text('PRESS ENTER', W / 2, 250, 8, '#c0c8ff', 'center');
  },
};
