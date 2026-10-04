import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { g, W, text } from '../screen.js';
import { settings, go } from '../state.js';
import { panel, logo, carPanel, typeName, blinkOn, TOUCH_TYPE } from '../ui.js';
import { drawAttract } from '../attract.js';
import { Online } from '../online.js';
import { askName } from '../askname.js';

// A new player's first stop: the title leads here while player 1 has no name. Enter needs at least one letter;
// Esc (or a pad's B, as a pad can't type) goes on without one, and the title asks again next time. Then on to the
// online menu or the local game, as the title would have: the race server may still be answering meanwhile.
// On a phone it is a plain page instead, upright (askname.js), and a phone starts here while there is no name (main.js).
const INFO = '#9fb0ff', SLOT = 28, GAP = 6, X0 = 149 - (6 * SLOT + 5 * GAP) / 2;

export const NameEntry = {
  t: 0, editing: true, who: 0, buf: '', waiting: false, asking: false,
  enter() {
    this.t = 0; this.who = 0; this.buf = ''; this.waiting = false; Sound.enginesOff();
    this.asking = Input.touch() && askName(named => { Sound.fx[named ? 'select' : 'back'](); this.asking = false; this.waiting = true; });
    this.editing = !this.asking;
  },
  update(dt) {
    this.t += dt;
    if (this.asking) return;
    if (this.waiting) { if (Online.state !== 'connecting') go(Online.available() ? 'Lobby' : 'MainMenu'); return; }
    if (Input.menu().back && !Input.pressed('Backspace')) { Sound.fx.back(); this.editing = false; this.waiting = true; return; }
    typeName(this, true);
    if (!this.editing) this.waiting = true;
  },
  draw(dt) {
    drawAttract(dt, 0.55);
    logo(W / 2, 8, 16, true);
    text('WELCOME, NEW RACER!', W / 2, 27, 8, INFO, 'center');
    panel(10, 40, 278, 214, 'YOUR NAME');
    text('WHAT SHOULD WE CALL YOU?', 149, 70, 8, '#ffffff', 'center');
    for (let i = 0; i < 6; i++) { // one box per letter, the next one lit while typing
      const x = X0 + i * (SLOT + GAP), cur = this.editing && i === this.buf.length;
      g.fillStyle = cur ? 'rgba(255,40,160,0.45)' : 'rgba(0,0,0,0.35)'; g.fillRect(x, 92, SLOT, 34);
      g.fillStyle = i < this.buf.length ? '#ffe040' : cur && blinkOn(this.t, 3) ? '#ffffff' : '#4a6cff';
      g.fillRect(x + 2, 122, SLOT - 4, 2);
      if (this.buf[i]) text(this.buf[i], x + SLOT / 2, 97, 24, '#ffe040', 'center');
    }
    text('UP TO 6 LETTERS AND DIGITS.', 149, 142, 8, '#ffffff', 'center');
    text('IT GOES ON YOUR NUMBER PLATE', 149, 166, 8, INFO, 'center');
    text('AND IN THE RESULTS.', 149, 178, 8, INFO, 'center');
    text('YOU CAN CHANGE IT IN THE MENU.', 149, 200, 8, '#7080b0', 'center');
    if (this.waiting) text('CONNECTING...', 149, 226, 8, '#ffffff', 'center');
    carPanel(296, 40, 174, 214, 0, this.t, this.buf);
    if (Input.touch()) { text(TOUCH_TYPE, W / 2, 268, 8, '#c0c8ff', 'center'); return; }
    text('TYPE YOUR NAME  ENTER OK  ESC SKIP', W / 2, 262, 8, '#c0c8ff', 'center');
  },
};
