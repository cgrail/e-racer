import { Sound } from '../../audio/sound.js';
import { CARSPEC, MODELS } from '../../race/specs.js';
import { W, text } from '../screen.js';
import { settings, go } from '../state.js';
import { panel, logo, rowsDraw, rowsNav, carPanel } from '../ui.js';
import { drawAttract } from '../attract.js';
import { DIFF_NAMES, startSession } from '../session.js';

// Main menu: players, game mode, level, cars, music and units.
export const MainMenu = {
  sel: 0, t: 0,
  enter() { this.t = 0; Sound.enginesOff(); },
  rows() {
    const s = settings, r = [];
    const opt = (label, opts, get, set, extra) => r.push(Object.assign({ label, opts, val: get(), set }, extra));
    opt('PLAYERS', ['1 PLAYER', '2 PLAYERS'], () => s.players - 1, v => { s.players = v + 1; });
    opt('GAME', ['CHAMPIONSHIP', 'TIME CHALLENGE', 'COURSE BUILDER'], () => s.mode, v => { s.mode = v; });
    opt('LEVEL', DIFF_NAMES, () => s.diff, v => { s.diff = v; });
    if (s.mode !== 1) {
      opt('ENERGY', ['UNLIMITED', 'LIMITED'], () => s.energy, v => { s.energy = v; });
      opt('POWER-UPS', ['OFF', 'ON'], () => s.power, v => { s.power = v; });
    }
    for (let p = 0; p < s.players; p++) {
      opt(`P${p + 1} CAR`, MODELS.map(m => CARSPEC[m].short), () => MODELS.indexOf(s.cars[p]), v => { s.cars[p] = MODELS[v]; }, { car: p });
    }
    opt('MUSIC', Sound.songs.concat(['OFF']), () => (s.music < 0 ? Sound.songs.length : s.music), v => {
      s.music = v >= Sound.songs.length ? -1 : v;
      Sound.playMusic(s.music);
    });
    opt('UNITS', ['MPH', 'KM/H'], () => s.units, v => { s.units = v; });
    r.push({ label: s.mode === 2 ? 'BUILD COURSE >' : 'START GAME >', action: () => (s.mode === 2 ? go('Builder') : startSession(s.mode === 0 ? 'champ' : 'time')) });
    return r;
  },
  update(dt) {
    this.t += dt;
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
    const cur = rows[this.sel];
    carPanel(296, 40, 174, 214, cur && cur.car != null ? cur.car : 0, this.t);
    const help = settings.players === 2
      ? 'P1: WASD SPACE POWER   P2: ARROWS ENTER POWER'
      : 'ARROWS/WASD DRIVE   SPACE/ENTER POWER-UP';
    text(help, W / 2, 262, 8, '#c0c8ff', 'center');
    text('ESC PAUSE   M MUSIC   F FULLSCREEN', W / 2, 276, 8, '#7080b0', 'center');
  },
};
