import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { CARSPEC, MODELS } from '../../race/specs.js';
import { W, text } from '../screen.js';
import { settings, go } from '../state.js';
import { panel, logo, rowsDraw, rowsNav, carPanel, nameRow, typeName, TOUCH_HELP, TOUCH_TYPE } from '../ui.js';
import { drawAttract } from '../attract.js';
import { DIFF_NAMES } from '../session.js';
import { Online } from '../online.js';

// The online menu, where the title screen leads when the race server answers. The first row starts a session (with
// the level below it) or joins the race that is running, in place of a rival; then name, car and
// sound. If the server stops answering, the player can try again or play offline (the local MainMenu).
const INFO = '#9fb0ff';

export const Lobby = {
  sel: 0, key: 'go', t: 0, editing: false, who: 0, buf: '',
  enter() { this.t = 0; this.key = 'go'; this.editing = false; Sound.enginesOff(); if (Online.state === 'off') Online.connect(); },
  offline() { Online.close(); go('MainMenu'); },
  rows() {
    const s = settings, st = Online.state, live = Online.status, r = [];
    if (st === 'error') r.push({ key: 'retry', label: 'TRY AGAIN', action: () => Online.connect() });
    if (st === 'error' || st === 'connecting') {
      r.push({ key: 'offline', label: 'PLAY OFFLINE >', action: () => this.offline() });
      return r;
    }
    const opt = (key, label, opts, get, set, extra) => r.push(Object.assign({ key, label, opts, val: get(), set }, extra));
    if (st === 'lobby' && !(live && live.full)) r.push({ key: 'go', label: live ? 'JOIN RACE >' : 'START RACE >', action: () => (live ? Online.join() : Online.start()) });
    r.push(nameRow(this, 0, 'NAME'));
    opt('car', 'CAR', MODELS.map(m => CARSPEC[m].short), () => MODELS.indexOf(s.cars[0]), v => { s.cars[0] = MODELS[v]; });
    if (!live) // a new session takes the level
      opt('level', 'LEVEL', DIFF_NAMES, () => s.diff, v => { s.diff = v; });
    opt('music', 'MUSIC', Sound.songs.concat(['OFF']), () => (s.music < 0 ? Sound.songs.length : s.music), v => {
      s.music = v >= Sound.songs.length ? -1 : v;
      Sound.playMusic(s.music);
    });
    opt('units', 'UNITS', ['MPH', 'KM/H'], () => s.units, v => { s.units = v; });
    return r;
  },
  // What the panel says under the rows: [text, colour] lines, 33 characters at most.
  lines() {
    const s = Online.status, st = Online.state;
    if (st === 'connecting') return [['CONNECTING...', '#ffffff']];
    if (st === 'error') return [[Online.error, '#ff5050'], ['THE RACE SERVER DOES NOT ANSWER.', INFO], ['TRY AGAIN, OR PLAY OFFLINE.', INFO]];
    if (st === 'waiting') return [['YOU ARE IN!', '#7fffb0'], [Online.waitNext ? `THE NEXT RACE STARTS IN ${Online.waitNext}S.` : 'YOU START IN THE NEXT RACE.', '#ffffff']];
    const out = Online.error ? [[Online.error, '#ff5050']] : [];
    if (!s) return out.concat([['NO RACE RUNNING: START ONE.', '#ffffff'], ['OTHERS CAN JOIN ANY TIME AND', INFO], ['TAKE OVER A RIVAL\'S CAR.', INFO]]);
    const phase = s.phase === 'results' ? 'RESULTS' : s.phase === 'countdown' ? 'ON THE GRID' : `LAP ${s.lap}/${s.laps}`;
    out.push([`RACE ON: ${s.scenery}  ${phase}`, '#ffffff'],
      [`LEVEL ${DIFF_NAMES[s.diff]}`, '#ffe040'],
      [`PLAYERS (${s.players.length}):`, INFO]);
    for (let i = 0; i < Math.min(s.players.length, 8); i += 4) out.push([s.players.slice(i, i + 4).join(' ') + (i === 4 && s.players.length > 8 ? ' ...' : ''), '#7fffb0']);
    if (s.full) out.push(['THE RACE IS FULL.', '#ff5050']);
    return out;
  },
  update(dt) {
    this.t += dt;
    if (this.editing) { typeName(this); return; }
    const rows = this.rows(), k = rows.findIndex(r => r.key === this.key); // the cursor stays on its row as rows come and go
    this.sel = k >= 0 ? k : Math.min(this.sel, rows.length - 1);
    const m = rowsNav(rows, this);
    this.key = rows[this.sel].key;
    if (m.back) { Sound.fx.back(); go('Title'); }
  },
  draw(dt) {
    drawAttract(dt, 0.55);
    logo(W / 2, 8, 16, true);
    text('ONLINE: RACE OTHER PLAYERS AND RIVALS', W / 2, 27, 8, INFO, 'center');
    const rows = this.rows();
    panel(10, 40, 278, 214, 'ONLINE RACE');
    const y0 = 70 + rows.length * rowsDraw(rows, this.sel, 16, 64, 266, 14, 108);
    this.lines().slice(0, Math.floor((250 - y0) / 12)).forEach(([s, col], i) => text(s, 22, y0 + i * 12, 8, col));
    carPanel(296, 40, 174, 214, 0, this.t, this.editing ? this.buf : settings.names[0]);
    if (Input.touch()) { text(this.editing ? TOUCH_TYPE : TOUCH_HELP, W / 2, 268, 8, '#c0c8ff', 'center'); return; }
    text(this.editing ? 'TYPE A NAME (UP TO 6)  ENTER OK  ESC CANCEL' : 'ARROWS/WASD DRIVE  SPACE POWER  E SHOCK', W / 2, 262, 8, '#c0c8ff', 'center');
    text('ESC BACK   M MUSIC   F FULLSCREEN', W / 2, 276, 8, '#7080b0', 'center');
  },
};
