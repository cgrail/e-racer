import { K } from '../../core/util.js';
import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { Render } from '../../render/index.js';
import { NO_INPUT } from '../../race/specs.js';
import { g, W, H } from '../screen.js';
import { settings, saveAll, game, go } from '../state.js';
import { panel, rowsDraw, rowsNav, buttonsRow } from '../ui.js';
import { makeRace } from '../session.js';
import { Online } from '../online.js';

// The race itself: fixed-step simulation, full or split-screen views, engines and the pause menu (on a touch screen
// a page over the race, where it can also move the racing buttons to the other side: game/page.js).
// Online the race goes on while paused (the car coasts), and the server ends it (game/online.js).
export const RaceScene = {
  acc: 0, vs: [{}, {}], paused: false, psel: 0,
  enter() { this.acc = 0; this.vs = [{}, {}]; this.paused = false; },
  pauseRows() {
    const rows = [{ go: true, label: 'CONTINUE', action: () => { this.paused = false; } }];
    if (game.race.net) rows.push({ label: 'LEAVE RACE', action: () => { Sound.enginesOff(); Online.leave(); go('Lobby'); } });
    else {
      rows.push({ label: 'RESTART RACE', action: () => { game.race = makeRace(); this.enter(); } },
        { label: 'QUIT TO MENU', action: () => { Sound.enginesOff(); go('MainMenu'); } });
    }
    if (Input.touch()) rows.push(buttonsRow());
    return rows;
  },
  page() {
    if (!this.paused) return null;
    const rows = this.pauseRows(), net = !!game.race.net;
    return { title: 'PAUSED', over: true, go: rows.filter(r => r.go), cards: [{ head: net ? 'ONLINE RACE' : 'RACE', ico: '🏁',
      rows: rows.filter(r => !r.go), note: net ? 'THE RACE GOES ON WHILE YOU ARE HERE.' : null }] };
  },
  update(dt) {
    const online = !!game.race.net;
    if (this.paused) {
      const m = rowsNav(this.pauseRows(), { get sel() { return RaceScene.psel; }, set sel(v) { RaceScene.psel = v; } });
      if (m.pause && this.paused) this.paused = false;
      if (!online || game.scene !== this) return;
    } else if (Input.menu().pause) { this.paused = true; this.psel = 0; Sound.enginesOff(); if (!online) return; }
    if (Input.pressed('KeyM')) {
      settings.music = settings.music + 1 >= Sound.songs.length ? -1 : settings.music + 1;
      Sound.playMusic(settings.music); saveAll();
    }
    const two = game.race.humans.length > 1;
    const inputs = game.race.humans.map((h, i) => (this.paused ? Object.assign({}, NO_INPUT) : Input.player(i, two)));
    this.acc += Math.min(dt, 0.1);
    let first = true;
    while (this.acc >= K.STEP) {
      game.race.update(K.STEP, inputs);
      if (first) { inputs.forEach(i => { i.power = false; i.shock = false; }); first = false; }
      this.acc -= K.STEP;
    }
    if (!this.paused) game.race.humans.forEach((h, i) => Sound.engine(i, true, h.speed / (h.spec.top * K.MAX_SPEED), h.pwr, h.skid, h.rough, two ? (i ? 0.6 : -0.6) : 0));
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
    if (this.paused && !Input.touch()) { // on touch the pause menu is a page over the race
      g.fillStyle = 'rgba(0,0,20,0.6)'; g.fillRect(0, 0, W, H);
      panel(140, 90, 200, 100, 'PAUSED');
      rowsDraw(this.pauseRows(), this.psel, 150, 120, 180);
    }
  },
};
