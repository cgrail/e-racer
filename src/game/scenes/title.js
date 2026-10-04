import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { g, W, text } from '../screen.js';
import { go } from '../state.js';
import { logo, blinkOn } from '../ui.js';
import { drawAttract } from '../attract.js';
import { Online } from '../online.js';
import { Touch } from '../touch.js';

// Title screen over the attract-mode demo race. It looks for the race server: when it answers, Enter leads to
// online play (the Lobby), otherwise to the local game. Coming back here looks again.
export const Title = {
  t: 0, waiting: false,
  enter() {
    this.t = 0; this.waiting = false; Sound.enginesOff();
    if (!Online.available()) Online.connect();
  },
  update(dt) {
    this.t += dt;
    if (Input.menu().ok && !this.waiting) { Sound.fx.select(); this.waiting = true; }
    if (this.waiting && Online.state !== 'connecting') go(Online.available() ? 'Lobby' : 'MainMenu');
  },
  draw(dt) {
    drawAttract(dt, 0.2);
    const band = g.createLinearGradient(0, 30, 0, 130);
    band.addColorStop(0, 'rgba(0,0,30,0)'); band.addColorStop(0.2, 'rgba(0,0,30,0.55)');
    band.addColorStop(0.8, 'rgba(0,0,30,0.55)'); band.addColorStop(1, 'rgba(0,0,30,0)');
    g.fillStyle = band; g.fillRect(0, 30, W, 100);
    g.fillStyle = 'rgba(0,0,30,0.5)'; g.fillRect(0, 182, W, 28); g.fillRect(0, 246, W, 38);
    logo(W / 2, 40, 40);
    text('A TRIBUTE TO THE RACERS OF THE 80S & 90S', W / 2, 112, 8, '#9fb0ff', 'center');
    if (this.waiting) text('CONNECTING...', W / 2, 190, 16, '#ffffff', 'center');
    else if (blinkOn(this.t)) text(Input.touch() ? 'TAP TO START' : 'PRESS ENTER', W / 2, 190, 16, '#ffffff', 'center');
    if (Touch.homeHint()) text('FULL SCREEN: SHARE > ADD TO HOME SCREEN', W / 2, 252, 8, '#ffe040', 'center');
    else text(Online.available() ? 'ONLINE RACING  -  KEYBOARD OR GAMEPAD' : '1 OR 2 PLAYERS  -  KEYBOARD OR GAMEPAD', W / 2, 252, 8, '#c0c8ff', 'center');
    text('ALL GRAPHICS & MUSIC MADE IN CODE.', W / 2, 270, 8, '#7080b0', 'center');
  },
};
