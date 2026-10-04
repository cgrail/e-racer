import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { CARSPEC, MODELS } from '../../race/specs.js';
import { W, text } from '../screen.js';
import { settings, go } from '../state.js';
import { panel, logo, rowsDraw, rowsNav, carPanel, carCard, nameRow, buttonsRow, typeName, TOUCH_DRIVE } from '../ui.js';
import { drawAttract } from '../attract.js';
import { DIFF_NAMES, QUALIFY, CHAMP, STAGES, startSession } from '../session.js';

// Main menu of the local game (online play has the Lobby, when the race server answers): players, game mode,
// level, cars and names, music and units, and on touch the side for the racing buttons. On a touch screen it is a
// page (game/page.js), a card per sec of rows.
export const MainMenu = {
  sel: 0, t: 0, editing: false, who: 0, buf: '',
  enter() { this.t = 0; this.editing = false; Sound.enginesOff(); },
  rows() {
    const s = settings, r = [];
    let sec = 'race';
    const opt = (label, opts, get, set, extra) => r.push(Object.assign({ sec, label, opts, val: get(), set }, extra));
    opt('PLAYERS', ['1 PLAYER', '2 PLAYERS'], () => s.players - 1, v => { s.players = v + 1; });
    opt('GAME', ['CHAMPIONSHIP', 'TIME CHALLENGE', 'COURSE BUILDER'], () => s.mode, v => { s.mode = v; });
    opt('LEVEL', DIFF_NAMES, () => s.diff, v => { s.diff = v; });
    for (let p = 0; p < s.players; p++) {
      sec = 'p' + p;
      opt(`P${p + 1} CAR`, MODELS.map(m => CARSPEC[m].short), () => MODELS.indexOf(s.cars[p]), v => { s.cars[p] = MODELS[v]; }, { car: p });
      r.push(Object.assign(nameRow(this, p, `P${p + 1} NAME`), { sec }));
    }
    sec = 'sound';
    opt('MUSIC', Sound.songs.concat(['OFF']), () => (s.music < 0 ? Sound.songs.length : s.music), v => {
      s.music = v >= Sound.songs.length ? -1 : v;
      Sound.playMusic(s.music);
    });
    opt('UNITS', ['MPH', 'KM/H'], () => s.units, v => { s.units = v; });
    if (Input.touch()) r.push(Object.assign(buttonsRow(), { sec }));
    r.push({ go: true, label: s.mode === 2 ? 'BUILD COURSE >' : 'START GAME >', action: () => (s.mode === 2 ? go('Builder') : startSession(s.mode === 0 ? 'champ' : 'time')) });
    return r;
  },
  page() {
    const s = settings, rows = this.rows(), sec = k => rows.filter(r => r.sec === k);
    const about = [
      `${CHAMP[s.diff].length} RACES AGAINST ${20 - s.players} RIVALS. FINISH IN THE TOP ${QUALIFY[s.diff]} TO GO ON.`,
      `${STAGES[s.diff].length} STAGES AGAINST THE CLOCK. EVERY CHECKPOINT GIVES YOU MORE TIME.`,
      'DESIGN YOUR OWN COURSE, OR TURN ANY WORD INTO ONE.',
    ][s.mode];
    return {
      title: 'LOCAL GAME',
      cards: [
        { head: 'RACE SETUP', ico: '🏁', rows: sec('race'), note: about },
        ...Array.from({ length: s.players }, (_, p) => carCard(p, sec('p' + p), this.t)),
        { head: 'OPTIONS', ico: '⚙', rows: sec('sound') },
        { head: 'HOW TO DRIVE', ico: '📋', help: TOUCH_DRIVE },
      ],
      go: rows.filter(r => r.go),
      foot: s.players > 1 ? 'PLAYER 2 DRIVES WITH THE KEYBOARD OR A PAD' : null,
    };
  },
  update(dt) {
    this.t += dt;
    if (this.editing) { typeName(this); return; }
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
    let help = settings.players === 2 ? 'P1: WASD SPACE E   P2: ARROWS ENTER .' : 'ARROWS/WASD DRIVE  SPACE POWER  E SHOCK';
    if (this.editing) help = 'TYPE A NAME (UP TO 6)  ENTER OK  ESC CANCEL';
    text(help, W / 2, 262, 8, '#c0c8ff', 'center');
    text('ESC PAUSE   M MUSIC   F FULLSCREEN', W / 2, 276, 8, '#7080b0', 'center');
  },
};
