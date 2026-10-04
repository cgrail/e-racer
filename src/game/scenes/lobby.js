import { Sound } from '../../audio/sound.js';
import { CARSPEC } from '../../race/specs.js';
import { W, text } from '../screen.js';
import { settings, go } from '../state.js';
import { panel, rowsDraw, rowsNav, blinkOn } from '../ui.js';
import { drawAttract } from '../attract.js';
import { DIFF_NAMES } from '../session.js';
import { Online } from '../online.js';

// Online lobby: connects to the race server and shows the session that is running, if any. With none, the player
// starts one with their level and options; otherwise they join the race and take over a rival's car.
const INFO = '#9fb0ff';
const options = s => `${DIFF_NAMES[s.diff]}  ENERGY ${s.energy ? 'LIMITED' : 'UNLIMITED'}  POWER-UPS ${s.power ? 'ON' : 'OFF'}`;

export const Lobby = {
  sel: 0, t: 0,
  enter() { this.t = 0; this.sel = 0; if (Online.state === 'off') Online.connect(); },
  back() { Online.close(); go('MainMenu'); },
  rows() {
    const r = [], s = Online.status;
    if (Online.state === 'lobby' && !s) r.push({ label: 'START SESSION >', action: () => Online.start() });
    if (Online.state === 'lobby' && s && !s.full) r.push({ label: 'JOIN RACE >', action: () => Online.join() });
    if (Online.state === 'error') r.push({ label: 'TRY AGAIN', action: () => Online.connect() });
    r.push({ label: '< BACK', action: () => this.back() });
    return r;
  },
  // What the panel says: [text, colour] lines.
  lines() {
    const s = Online.status, st = Online.state;
    if (st === 'connecting') return [['CONNECTING TO THE RACE SERVER...', '#ffffff']];
    if (st === 'error') return [[Online.error, '#ff5050'], ['', ''], ['ONLINE RACES NEED THE GAME SERVER.', INFO], ['START IT WITH "NPM START" AND PLAY FROM', INFO], ['THE ADDRESS IT PRINTS.', INFO]];
    if (st === 'waiting') return [['YOU ARE IN!', '#7fffb0'], [Online.waitNext ? `THE NEXT RACE STARTS IN ${Online.waitNext} SEC.` : 'YOU START IN THE NEXT RACE.', '#ffffff']];
    const out = Online.error ? [[Online.error, '#ff5050'], ['', '']] : [];
    if (!s) {
      return out.concat([['NO RACE RUNNING.', '#ffffff'], ['', ''], ['START A SESSION WITH YOUR LEVEL AND OPTIONS:', INFO],
        [options({ diff: settings.diff, energy: settings.energy, power: settings.power }), '#ffe040'], ['', ''],
        ['OTHERS CAN JOIN AT ANY TIME. THEY TAKE OVER', INFO], ['A RIVAL\'S CAR, AND A RIVAL TAKES OVER THE', INFO], ['CAR OF A PLAYER WHO LEAVES.', INFO]]);
    }
    const phase = s.phase === 'results' ? 'RESULTS' : s.phase === 'countdown' ? 'ON THE GRID' : `LAP ${s.lap}/${s.laps}`;
    out.push([`RACE ON: ${s.scenery}  ${phase}`, '#ffffff'], [options(s), '#ffe040'], ['', ''], [`PLAYERS (${s.players.length}):`, INFO]);
    for (let i = 0; i < s.players.length; i += 6) out.push([s.players.slice(i, i + 6).join(' '), '#7fffb0']);
    out.push(['', ''], [s.full ? 'THE RACE IS FULL.' : 'JOIN TO TAKE OVER THE LAST RIVAL ON THE ROAD.', INFO]);
    return out;
  },
  update(dt) {
    this.t += dt;
    const rows = this.rows();
    this.sel = Math.min(this.sel, rows.length - 1);
    if (rowsNav(rows, this).back) { Sound.fx.back(); this.back(); }
  },
  draw(dt) {
    drawAttract(dt, 0.6);
    text('ONLINE RACE', W / 2, 8, 16, '#ffe040', 'center');
    text('RACE OTHER PLAYERS ACROSS THE NET', W / 2, 27, 8, INFO, 'center');
    panel(30, 40, 420, 222, 'RACE SERVER');
    this.lines().slice(0, 11).forEach(([s, col], i) => { if (s) text(s, 46, 64 + i * 13, 8, col); });
    const rows = this.rows();
    rowsDraw(rows, this.sel, 40, 262 - 8 - rows.length * 14, 400);
    if (Online.state === 'waiting' && blinkOn(this.t)) text('WAITING...', W / 2, 200, 8, '#ffffff', 'center');
    const name = settings.names[0] || 'RACER';
    text(`YOU: ${name} IN THE ${CARSPEC[settings.cars[0]].name}`, W / 2, 268, 8, '#c0c8ff', 'center');
    text('NAME AND CAR ARE SET IN THE MAIN MENU', W / 2, 282, 8, '#7080b0', 'center');
  },
};
