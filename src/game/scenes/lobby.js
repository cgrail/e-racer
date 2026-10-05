import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { CARSPEC, MODELS } from '../../race/specs.js';
import { W, text } from '../screen.js';
import { settings, go } from '../state.js';
import { panel, logo, rowsDraw, rowsNav, carPanel, carCard, nameRow, buttonsRow, typeName, TOUCH_DRIVE } from '../ui.js';
import { drawAttract } from '../attract.js';
import { DIFF_NAMES } from '../session.js';
import { Online } from '../online.js';

// The online menu, where the title screen leads when the race server answers. The first row starts a session (with
// the level below it) or joins the race that is running, in place of a rival; then name, car, sound and units (and
// on touch the side for the racing buttons). If the server stops answering, the player can try again or play offline
// (the local MainMenu). On a touch screen it is a page (game/page.js): name and options top left, the race server
// under them, the car on the right with the go rows under it, and how to drive behind HELP.
const INFO = '#9fb0ff';

export const Lobby = {
  sel: 0, key: 'go', t: 0, editing: false, who: 0, buf: '',
  enter() { this.t = 0; this.key = 'go'; this.editing = false; Sound.enginesOff(); if (Online.state === 'off') Online.connect(); },
  offline() { Online.close(); go('MainMenu'); },
  rows() {
    const s = settings, st = Online.state, live = Online.status, r = [];
    if (st === 'error') r.push({ key: 'retry', go: true, label: 'TRY AGAIN', action: () => Online.connect() });
    if (st === 'error' || st === 'connecting') {
      r.push({ key: 'offline', go: true, label: 'PLAY OFFLINE >', action: () => this.offline() });
      return r;
    }
    let sec = 'more';
    const opt = (key, label, opts, get, set, extra) => r.push(Object.assign({ key, sec, label, opts, val: get(), set }, extra));
    if (st === 'lobby' && !(live && live.full)) r.push({ key: 'go', go: true, label: live ? 'JOIN RACE >' : 'START RACE >', action: () => (live ? Online.join() : Online.start()) });
    r.push(Object.assign(nameRow(this, 0, 'NAME'), { sec }));
    sec = 'car';
    opt('car', 'CAR', MODELS.map(m => CARSPEC[m].short), () => MODELS.indexOf(s.cars[0]), v => { s.cars[0] = MODELS[v]; });
    sec = 'more';
    if (!live) // a new session takes the level
      opt('level', 'LEVEL', DIFF_NAMES, () => s.diff, v => { s.diff = v; });
    opt('music', 'MUSIC', Sound.songs.concat(['OFF']), () => (s.music < 0 ? Sound.songs.length : s.music), v => {
      s.music = v >= Sound.songs.length ? -1 : v;
      Sound.playMusic(s.music);
    });
    opt('units', 'UNITS', ['MPH', 'KM/H'], () => s.units, v => { s.units = v; });
    if (Input.touch()) r.push(Object.assign(buttonsRow(), { sec }));
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
  page() {
    const rows = this.rows(), sec = k => rows.filter(r => r.sec === k), server = { head: 'RACE SERVER', ico: '📡', lines: this.lines() };
    const page = { title: 'ONLINE RACE', cards: [server], go: rows.filter(r => r.go) };
    if (!sec('car').length) return page; // no server: just what happened, and the way on
    page.cards = [{ head: 'OPTIONS', ico: '⚙', rows: sec('more') }, server, carCard(0, sec('car'), this.t, 'YOUR CAR')];
    return Object.assign(page, { help: TOUCH_DRIVE });
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
    const y0 = 70 + rows.length * rowsDraw(rows, this.sel, 16, 64, 266);
    this.lines().slice(0, Math.floor((250 - y0) / 12)).forEach(([s, col], i) => text(s, 22, y0 + i * 12, 8, col));
    carPanel(296, 40, 174, 214, 0, this.t, this.editing ? this.buf : settings.names[0]);
    text(this.editing ? 'TYPE A NAME (UP TO 6)  ENTER OK  ESC CANCEL' : 'ARROWS/WASD DRIVE  SPACE POWER  E SHOCK', W / 2, 262, 8, '#c0c8ff', 'center');
    text('ESC BACK   M MUSIC   F FULLSCREEN', W / 2, 276, 8, '#7080b0', 'center');
  },
};
