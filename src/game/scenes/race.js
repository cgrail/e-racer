import { K } from '../../core/util.js';
import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { Render } from '../../render/index.js';
import { g, W, H } from '../screen.js';
import { settings, saveAll, game, go } from '../state.js';
import { panel, rowsDraw, rowsNav } from '../ui.js';
import { makeRace } from '../session.js';

// The race itself: fixed-step simulation, full or split-screen views, engines and the pause menu.
export const RaceScene = {
  acc: 0, vs: [{}, {}], paused: false, psel: 0,
  enter() { this.acc = 0; this.vs = [{}, {}]; this.paused = false; },
  pauseRows() {
    return [
      { label: 'CONTINUE', action: () => { this.paused = false; } },
      { label: 'RESTART RACE', action: () => { game.race = makeRace(); this.enter(); } },
      { label: 'QUIT TO MENU', action: () => { Sound.enginesOff(); go('MainMenu'); } },
    ];
  },
  update(dt) {
    if (this.paused) {
      const m = rowsNav(this.pauseRows(), { get sel() { return RaceScene.psel; }, set sel(v) { RaceScene.psel = v; } });
      if (m.pause && this.paused) this.paused = false;
      return;
    }
    if (Input.menu().pause) { this.paused = true; this.psel = 0; Sound.enginesOff(); return; }
    if (Input.pressed('KeyM')) {
      settings.music = settings.music + 1 >= Sound.songs.length ? -1 : settings.music + 1;
      Sound.playMusic(settings.music); saveAll();
    }
    const two = game.race.humans.length > 1;
    const inputs = game.race.humans.map((h, i) => Input.player(i, two));
    this.acc += Math.min(dt, 0.1);
    let first = true;
    while (this.acc >= K.STEP) {
      game.race.update(K.STEP, inputs);
      if (first) { inputs.forEach(i => { i.power = false; }); first = false; }
      this.acc -= K.STEP;
    }
    game.race.humans.forEach((h, i) => Sound.engine(i, true, h.speed / (h.spec.top * K.MAX_SPEED), h.pwr, h.skid, h.rough, two ? (i ? 0.6 : -0.6) : 0));
    if (game.race.over) { Sound.enginesOff(); go('Results'); }
  },
  draw(dt) {
    const opts = { dt: this.paused ? 0 : dt, units: settings.units };
    if (game.race.humans.length === 1) Render.view(g, { x: 0, y: 0, w: W, h: H }, game.race, game.race.humans[0], this.vs[0], opts);
    else {
      const hh = (H - 4) / 2;
      Render.view(g, { x: 0, y: 0, w: W, h: hh }, game.race, game.race.humans[0], this.vs[0], opts);
      Render.view(g, { x: 0, y: hh + 4, w: W, h: hh }, game.race, game.race.humans[1], this.vs[1], opts);
      const gr = g.createLinearGradient(0, hh, 0, hh + 4);
      gr.addColorStop(0, '#6a8aff'); gr.addColorStop(1, '#101a70');
      g.fillStyle = gr; g.fillRect(0, hh, W, 4);
    }
    if (this.paused) {
      g.fillStyle = 'rgba(0,0,20,0.6)'; g.fillRect(0, 0, W, H);
      panel(140, 90, 200, 100, 'PAUSED');
      rowsDraw(this.pauseRows(), this.psel, 150, 120, 180);
    }
  },
};
