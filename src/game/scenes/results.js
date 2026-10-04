import { U } from '../../core/util.js';
import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { CARSPEC } from '../../race/specs.js';
import { g, W, text } from '../screen.js';
import { records, game, scenes, go } from '../state.js';
import { panel, blinkOn } from '../ui.js';
import { drawAttract } from '../attract.js';
import { POINTS, QUALIFY, DIFF_NAMES, recordKey } from '../session.js';

// Race or stage results, points and records.
export const Results = {
  t: 0, list: [], lines: [], qualified: true, newRecord: false,
  enter() {
    this.t = 0;
    this.list = game.race.results();
    const humans = game.race.humans;
    this.newRecord = false;
    const key = recordKey(game.race);
    for (const h of humans) {
      const best = game.race.mode === 'race' ? h.bestLap : h.finished ? h.finishTime : 0;
      if (best && (!records[key] || best < records[key])) { records[key] = best; this.newRecord = true; }
    }
    U.save('ecr.records', records);
    if (game.race.mode === 'race' && game.session.kind === 'champ') {
      this.list.forEach((c, i) => {
        const d = game.session.drivers.find(x => x.id === c.id);
        c.pts = i < POINTS.length ? POINTS[i] : 0;
        if (d) d.points += c.pts;
      });
      this.qualified = humans.some(h => h.place <= QUALIFY[game.session.diff]);
    } else if (game.race.mode === 'time') {
      this.qualified = humans.some(h => h.finished);
    } else this.qualified = true;
  },
  next() {
    if (game.session.kind === 'custom') { go('Builder'); return; }
    if (game.session.kind === 'champ') { go('Standings'); return; }
    if (!this.qualified) { scenes.GameEnd.set('GAME OVER', ['OUT OF TIME ON ' + game.race.track.theme.name, `REACHED STAGE ${game.session.idx + 1} OF ${game.session.courses.length}`]); go('GameEnd'); return; }
    game.session.idx++;
    if (game.session.idx >= game.session.courses.length) {
      scenes.GameEnd.set('CHALLENGE COMPLETE', ['ALL STAGES CLEARED', 'LEVEL ' + DIFF_NAMES[game.session.diff], 'CONGRATULATIONS!']);
      go('GameEnd');
    } else go('PreRace');
  },
  update(dt) {
    this.t += dt;
    if (Input.menu().ok && this.t > 0.5) { Sound.fx.select(); this.next(); }
  },
  draw(dt) {
    drawAttract(dt, 0.7);
    if (game.race.mode === 'race') {
      panel(20, 6, 440, 288, `RESULTS - ${game.race.track.theme.name}`);
      text('POS', 32, 26, 8, '#9fb0ff'); text('DRIVER', 70, 26, 8, '#9fb0ff'); text('CAR', 200, 26, 8, '#9fb0ff');
      text('TIME', 340, 26, 8, '#9fb0ff', 'right');
      if (game.session.kind === 'champ') text('PTS', 446, 26, 8, '#9fb0ff', 'right');
      const winner = this.list[0];
      this.list.forEach((c, i) => {
        const y = 38 + i * 11.4;
        if (c.human) { g.fillStyle = 'rgba(255,40,160,0.4)'; g.fillRect(28, y - 2, 424, 10); }
        const col = c.human ? '#ffffff' : '#c0c8ff';
        text(String(i + 1).padStart(2, ' '), 32, y, 8, col);
        text(c.name, 70, y, 8, col);
        text(CARSPEC[c.model].short, 200, y, 8, col);
        let tm;
        if (!c.finished) {
          const laps = Math.max(1, Math.ceil((winner.travel - c.travel) / game.race.L));
          tm = winner.finished ? `+${laps} LAP${laps > 1 ? 'S' : ''}` : '--';
        } else tm = i === 0 ? U.fmtTime(c.finishTime) : '+' + U.fmtTime(c.finishTime - winner.finishTime);
        text(tm, 340, y, 8, col, 'right');
        if (game.session.kind === 'champ' && c.pts) text(String(c.pts), 446, y, 8, '#ffe040', 'right');
      });
    } else {
      panel(60, 40, 360, 220, `STAGE RESULT - ${game.race.track.theme.name}`);
      game.race.humans.forEach((h, i) => {
        const y = 76 + i * 60;
        text(h.name, 80, y, 8, '#ffe040');
        text(h.finished ? 'TIME ' + U.fmtTime(h.finishTime) : 'OUT OF TIME', 80, y + 16, 16, h.finished ? '#ffffff' : '#ff4040');
        text(h.finished ? `TIME LEFT ${Math.ceil(h.timeLeft)} SEC` : `${Math.round((h.travel / game.race.L) * 100)}% OF STAGE COMPLETED`, 80, y + 38, 8, '#9fb0ff');
      });
    }
    let msg = '';
    if (game.session.kind === 'champ') msg = this.qualified ? 'QUALIFIED!' : 'NOT QUALIFIED';
    else if (game.session.kind === 'time') msg = this.qualified ? 'STAGE CLEARED!' : 'GAME OVER';
    if (this.newRecord) msg += (msg ? '  ' : '') + 'NEW RECORD!';
    if (msg && blinkOn(this.t, 1.5)) text(msg, W / 2, game.race.mode === 'race' ? 270 : 214, 8, this.qualified ? '#7fffb0' : '#ff5050', 'center');
    if (this.t > 0.5) text('ENTER', W / 2, game.race.mode === 'race' ? 281 : 236, 8, '#ffffff', 'center');
  },
};
