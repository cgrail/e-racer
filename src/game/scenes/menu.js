import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { CARSPEC, MODELS } from '../../race/specs.js';
import { W, text } from '../screen.js';
import { settings, saveAll, go } from '../state.js';
import { panel, logo, rowsDraw, rowsNav, carPanel, blinkOn } from '../ui.js';
import { drawAttract } from '../attract.js';
import { DIFF_NAMES, startSession } from '../session.js';

// Main menu: players, game mode, level, cars and names, music and units.
export const MainMenu = {
  sel: 0, t: 0, editing: false, who: 0, buf: '',
  enter() { this.t = 0; this.editing = false; Sound.enginesOff(); },
  rows() {
    const s = settings, r = [], online = s.mode === 3;
    const opt = (label, opts, get, set, extra) => r.push(Object.assign({ label, opts, val: get(), set }, extra));
    if (online) opt('PLAYERS', ['1 PLAYER'], () => 0, () => {}); // one player per browser online
    else opt('PLAYERS', ['1 PLAYER', '2 PLAYERS'], () => s.players - 1, v => { s.players = v + 1; });
    opt('GAME', ['CHAMPIONSHIP', 'TIME CHALLENGE', 'COURSE BUILDER', 'ONLINE RACE'], () => s.mode, v => { s.mode = v; });
    opt('LEVEL', DIFF_NAMES, () => s.diff, v => { s.diff = v; });
    if (s.mode !== 1) {
      opt('ENERGY', ['UNLIMITED', 'LIMITED'], () => s.energy, v => { s.energy = v; });
      opt('POWER-UPS', ['OFF', 'ON'], () => s.power, v => { s.power = v; });
    }
    for (let p = 0; p < (online ? 1 : s.players); p++) {
      opt(`P${p + 1} CAR`, MODELS.map(m => CARSPEC[m].short), () => MODELS.indexOf(s.cars[p]), v => { s.cars[p] = MODELS[v]; }, { car: p });
      const typing = this.editing && this.who === p;
      r.push({ label: `P${p + 1} NAME`, car: p, value: typing ? this.buf + (blinkOn(this.t, 3) ? '_' : ' ') : s.names[p] || '-',
        action: () => { this.editing = true; this.who = p; this.buf = s.names[p]; } });
    }
    opt('MUSIC', Sound.songs.concat(['OFF']), () => (s.music < 0 ? Sound.songs.length : s.music), v => {
      s.music = v >= Sound.songs.length ? -1 : v;
      Sound.playMusic(s.music);
    });
    opt('UNITS', ['MPH', 'KM/H'], () => s.units, v => { s.units = v; });
    const start = ['START GAME >', 'START GAME >', 'BUILD COURSE >', 'GO ONLINE >'][s.mode];
    r.push({ label: start, action: () => (s.mode === 2 ? go('Builder') : online ? go('Lobby') : startSession(s.mode === 0 ? 'champ' : 'time')) });
    return r;
  },
  // Typing a name: letters and digits, up to 6 (it goes on the number plate).
  type() {
    for (const ch of Input.typed()) {
      if (ch === '\b') this.buf = this.buf.slice(0, -1);
      else if (/^[a-z0-9]$/i.test(ch) && this.buf.length < 6) { this.buf += ch.toUpperCase(); Sound.fx.tick(); }
    }
    if (Input.pressed('Enter') || Input.pressed('NumpadEnter')) {
      this.editing = false; settings.names[this.who] = this.buf; saveAll(); Sound.fx.select();
    } else if (Input.pressed('Escape')) { this.editing = false; Sound.fx.back(); }
  },
  update(dt) {
    this.t += dt;
    if (this.editing) { this.type(); return; }
    const rows = this.rows();
    this.sel = Math.min(this.sel, rows.length - 1);
    const m = rowsNav(rows, this);
    if (m.back) { Sound.fx.back(); go('Title'); }
  },
  draw(dt) {
    drawAttract(dt, 0.55);
    logo(W / 2, 8, 16, true);
    text('A TRIBUTE TO THE RACERS OF THE 80S & 90S', W / 2, 27, 8, '#9fb0ff', 'center');
    const rows = this.rows();
    panel(10, 40, 278, 214, 'OPTIONS');
    rowsDraw(rows, this.sel, 16, 64, 266);
    const cur = rows[this.sel], p = cur && cur.car != null ? cur.car : 0;
    carPanel(296, 40, 174, 214, p, this.t, this.editing && this.who === p ? this.buf : settings.names[p]);
    let help = settings.players === 2 && settings.mode !== 3 ? 'P1: WASD SPACE E   P2: ARROWS ENTER .' : 'ARROWS/WASD DRIVE  SPACE POWER  E SHOCK';
    if (this.editing) help = 'TYPE A NAME (UP TO 6)  ENTER OK  ESC CANCEL';
    text(help, W / 2, 262, 8, '#c0c8ff', 'center');
    text('ESC PAUSE   M MUSIC   F FULLSCREEN', W / 2, 276, 8, '#7080b0', 'center');
  },
};
