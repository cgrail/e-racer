import { U } from '../../core/util.js';
import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { Track } from '../../world/track.js';
import { Render } from '../../render/index.js';
import { g, W, H, text } from '../screen.js';
import { records, game, go } from '../state.js';
import { panel, drawMap, drawProfile, blinkOn } from '../ui.js';
import { QUALIFY, DIFF_NAMES, makeRace, recordKey } from '../session.js';

// Pre-race briefing: course map, elevation, laps or checkpoints, conditions and record.
export const PreRace = {
  t: 0, vs: {}, pv: null,
  enter() {
    this.t = 0; this.vs = {};
    game.race = makeRace();
    this.pv = Track.preview(game.race.track);
    Sound.enginesOff();
  },
  update(dt) {
    this.t += dt;
    const m = Input.menu();
    if (m.ok) { Sound.fx.select(); go('RaceScene'); }
    if (m.back) { Sound.fx.back(); go('MainMenu'); }
  },
  draw(dt) {
    Render.view(g, { x: 0, y: 0, w: W, h: H }, game.race, game.race.humans[0], this.vs, { dt: 0, hud: false });
    g.fillStyle = 'rgba(0,0,20,0.55)'; g.fillRect(0, 0, W, H);
    const th = game.race.track.theme;
    let head;
    if (game.session.kind === 'champ') head = `CHAMPIONSHIP ${DIFF_NAMES[game.session.diff]} - RACE ${game.session.idx + 1} OF ${game.session.courses.length}`;
    else if (game.session.kind === 'time') head = `TIME CHALLENGE ${DIFF_NAMES[game.session.diff]} - STAGE ${game.session.idx + 1} OF ${game.session.courses.length}`;
    else head = 'CUSTOM COURSE';
    panel(30, 20, 420, 250, head);
    text(th.name, 150, 46, 24, '#ffffff', 'center');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(50, 80, 200, 120);
    drawMap(this.pv, 50, 80, 200, 120, '#ffe040');
    drawProfile(this.pv, 50, 206, 200, 22);
    const info = [];
    if (game.race.mode === 'race') {
      info.push(['LAPS', String(game.race.laps)], ['CARS', String(game.race.cars.length)]);
      if (game.session.kind === 'champ') info.push(['QUALIFY', 'TOP ' + QUALIFY[game.session.diff]]);
    } else {
      info.push(['CHECKPOINTS', String(game.race.track.cps.length)], ['START TIME', Math.round(game.race.legTime[0]) + ' SEC']);
    }
    if (game.race.energy) info.push(['ENERGY', 'COLLECT CELLS']);
    if (game.race.power) info.push(['POWER KEY', game.race.humans.length > 1 ? 'SPACE / ENTER' : 'SPACE']);
    if (game.race.shocks) info.push(['SHOCK KEY', game.race.humans.length > 1 ? 'E / .' : 'E']);
    info.push(['DISTANCE', U.km(game.race.track.length * game.race.laps).toFixed(1) + ' KM']);
    if (th.weather || th.wind || th.night || th.fog > 8) {
      info.push(['CONDITIONS', th.night ? 'DARK' : th.weather === 'snow' ? 'SNOW' : th.weather === 'rain' ? 'STORM' : th.wind ? 'GUSTS' : 'FOGGY']);
    }
    const rec = records[recordKey(game.race)];
    info.push([game.race.mode === 'race' ? 'LAP RECORD' : 'RECORD', rec ? U.fmtTime(rec) : '--']);
    const dy = info.length > 8 ? 16 : 18; // keep the last row clear of the course code
    info.forEach(([a, b], i) => {
      text(a, 268, 84 + i * dy, 8, '#9fb0ff');
      text(b, 436, 84 + i * dy, 8, '#ffe040', 'right');
    });
    text('CODE ' + game.race.track.code, 352, 228, 8, '#7fffb0', 'center');
    if (blinkOn(this.t)) text('PRESS ENTER TO RACE', W / 2, 244, 8, '#ffffff', 'center');
  },
};
