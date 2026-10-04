import './style.css';
import { Input } from './core/input.js';
import { Sound } from './audio/sound.js';
import { cv, g } from './game/screen.js';
import { settings, game, scenes, go } from './game/state.js';
import { Title } from './game/scenes/title.js';
import { MainMenu } from './game/scenes/menu.js';
import { Builder } from './game/scenes/builder.js';
import { PreRace } from './game/scenes/prerace.js';
import { RaceScene } from './game/scenes/race.js';
import { Results } from './game/scenes/results.js';
import { Standings } from './game/scenes/standings.js';
import { GameEnd } from './game/scenes/gameend.js';
import { Lobby } from './game/scenes/lobby.js';
import { Online } from './game/online.js';
import { Touch } from './game/touch.js';

// Entry point: wires up the scenes, audio start-up, fullscreen key, touch controls and the main loop.
let musicStarted = false;
Input.onGesture(() => {
  Sound.init();
  if (!musicStarted) { musicStarted = true; Sound.playMusic(settings.music); }
});
window.addEventListener('keydown', e => {
  if (e.code === 'KeyF' && !game.scene.editing) { // not while typing a course code or a name
    if (document.fullscreenElement) document.exitFullscreen();
    else if (cv.requestFullscreen) cv.requestFullscreen().catch(() => {});
  }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  Input.poll();
  Online.poll(dt);
  Touch.update();
  game.scene.update(dt);
  g.imageSmoothingEnabled = false;
  game.scene.draw(dt);
  Input.endFrame();
  requestAnimationFrame(frame);
}

Object.assign(scenes, { Title, MainMenu, Builder, PreRace, RaceScene, Results, Standings, GameEnd, Lobby });

// Debug handle for the console and scripts/smoke.js.
window.__ecr = {
  scenes,
  get scene() { return Object.keys(scenes).find(k => scenes[k] === game.scene); },
  get race() { return game.race; },
  settings,
};

Touch.init();
go('Title');
requestAnimationFrame(frame);
