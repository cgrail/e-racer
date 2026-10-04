import { U } from '../../core/util.js';
import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { CARSPEC } from '../../race/specs.js';
import { g, W, text } from '../screen.js';
import { game, scenes, go } from '../state.js';
import { panel } from '../ui.js';
import { drawAttract } from '../attract.js';
import { DIFF_NAMES } from '../session.js';

// Championship standings between races, and the decision to go on or end the season.
export const Standings = {
  t: 0,
  enter() { this.t = 0; },
  update(dt) {
    this.t += dt;
    if (!(Input.menu().ok && this.t > 0.5)) return;
    Sound.fx.select();
    const sorted = game.session.drivers.slice().sort((a, b) => b.points - a.points);
    const last = game.session.idx >= game.session.courses.length - 1;
    if (!scenes.Results.qualified || last) {
      const lines = game.session.drivers.filter(d => d.human).map(d => `${d.name}: ${U.ordinal(sorted.indexOf(d) + 1)} WITH ${d.points} PTS`);
      if (!scenes.Results.qualified) scenes.GameEnd.set('GAME OVER', ['FAILED TO QUALIFY'].concat(lines));
      else {
        const champ = sorted[0];
        scenes.GameEnd.set(champ.human ? 'CHAMPION!' : 'CHAMPIONSHIP OVER', [`${champ.name} WINS THE ${DIFF_NAMES[game.session.diff]} TITLE`].concat(lines));
      }
      go('GameEnd');
    } else { game.session.idx++; go('PreRace'); }
  },
  draw(dt) {
    drawAttract(dt, 0.7);
    panel(60, 6, 360, 288, `STANDINGS AFTER RACE ${game.session.idx + 1}`);
    const sorted = game.session.drivers.slice().sort((a, b) => b.points - a.points);
    sorted.forEach((d, i) => {
      const y = 28 + i * 12.2;
      if (d.human) { g.fillStyle = 'rgba(255,40,160,0.4)'; g.fillRect(68, y - 2, 344, 10); }
      const col = d.human ? '#ffffff' : '#c0c8ff';
      text(String(i + 1).padStart(2, ' '), 76, y, 8, col);
      text(d.name, 110, y, 8, col);
      text(CARSPEC[d.model].short, 260, y, 8, col);
      text(String(d.points), 404, y, 8, '#ffe040', 'right');
    });
    if (this.t > 0.5) text('ENTER', W / 2, 280, 8, '#ffffff', 'center');
  },
};
