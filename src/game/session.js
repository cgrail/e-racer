import { U } from '../core/util.js';
import { THEME_INDEX } from '../world/themes.js';
import { Track } from '../world/track.js';
import { Race } from '../race/race.js';
import { MODELS, CAR_COLORS } from '../race/specs.js';
import { settings, custom, game, go } from './state.js';

// Sessions: championship, time challenge and custom races, their drivers, courses and race setup.
export const AI_NAMES = ['K.MORGAN', 'R.BLAKE', 'T.VANCE', 'S.IKEDA', 'L.MORETTI', 'P.DUBOIS', 'J.KOVACS', 'A.LINDQVIST',
  'M.OKAFOR', 'H.SCHULZ', 'D.PETROV', 'C.ALVAREZ', 'B.BRENNAN', 'W.CHEN', 'F.FONTAINE', 'G.GALLAGHER',
  'N.HOLM', 'E.JANSEN', 'V.KAPOOR', 'O.LARSEN', 'I.MENDES', 'Z.NOVAK'];
export const AI_RANGE = [[0.64, 0.8], [0.7, 0.87], [0.76, 0.93]];
export const POINTS = [20, 15, 12, 10, 8, 6, 4, 3, 2, 1];
export const QUALIFY = [10, 6, 3];
export const DIFF_NAMES = ['EASY', 'MEDIUM', 'HARD'];
export const CHAMP = [
  ['forest', 'desert', 'motorway', 'marsh', 'snow', 'night'],
  ['mountains', 'fog', 'roadworks', 'windy', 'storm', 'future'],
  ['night', 'snow', 'storm', 'fog', 'mountains', 'future'],
];
export const STAGES = [
  ['forest', 'desert', 'snow', 'night', 'marsh'],
  ['motorway', 'fog', 'windy', 'mountains', 'storm'],
  ['roadworks', 'storm', 'future', 'snow', 'mountains'],
];

export function makeDrivers(nAI) {
  const hum = [];
  for (let p = 0; p < settings.players; p++) {
    hum.push({ id: 'P' + (p + 1), name: 'PLAYER ' + (p + 1), human: true, pidx: p, model: settings.cars[p], color: CAR_COLORS[p], manual: settings.manual[p], points: 0 });
  }
  const names = U.shuffle(Math.random, AI_NAMES);
  const ai = [];
  for (let k = 0; k < nAI; k++) {
    ai.push({ id: 'AI' + k, name: names[k], human: false, model: MODELS[Math.floor(Math.random() * 3)], color: CAR_COLORS[2 + (k % 8)], skill: 1 - (k / nAI) * 0.95, points: 0 });
  }
  return hum.concat(ai);
}
export function course(kind, diff, idx) {
  const list = kind === 'time' ? STAGES[diff] : CHAMP[diff];
  const r = U.rng(1000 + diff * 97 + idx * 13 + (kind === 'time' ? 5000 : 0));
  const cl = v => U.clamp(Math.floor(v), 0, 15);
  const params = {
    curves: cl(5 + diff * 2 + idx * 0.5 + r() * 3), sharp: cl(3 + diff * 3 + idx * 0.5 + r() * 3),
    hills: cl(4 + diff * 2 + r() * 6), steep: cl(3 + diff * 2 + r() * 6), scatter: cl(7 + r() * 6),
    obst: cl(2 + diff * 3 + idx * 0.5 + r() * 3), length: kind === 'time' ? cl(9 + diff * 2 + r() * 3) : cl(4 + r() * 5),
    scenery: THEME_INDEX(list[idx]), seed: Math.floor(r() * 676),
  };
  return { params };
}
export function startSession(kind) {
  const n = 20 - settings.players;
  game.session = { kind, diff: settings.diff, idx: 0, drivers: makeDrivers(kind === 'champ' ? n : 0) };
  if (kind === 'custom') {
    game.session.courses = [{ params: Object.assign({}, custom.params) }];
    game.session.time = custom.type === 1;
    if (!game.session.time) game.session.drivers = game.session.drivers.concat(makeDrivers(n).filter(d => !d.human));
  } else {
    const list = kind === 'time' ? STAGES : CHAMP;
    game.session.courses = list[settings.diff].map((_, i) => course(kind, settings.diff, i));
    game.session.time = kind === 'time';
  }
  go('PreRace');
}
export function makeRace() {
  const c = game.session.courses[game.session.idx];
  const track = Track.build(c.params, game.session.time ? { checkpoints: 4, scale: 1.8 } : {});
  const humans = game.session.drivers.filter(d => d.human);
  const [lo, hi] = AI_RANGE[game.session.diff];
  let ai;
  if (game.session.time) {
    ai = Array.from({ length: 10 }, (_, k) => ({ id: 'T' + k, name: 'TRAFFIC', model: MODELS[k % 3], color: CAR_COLORS[2 + (k % 8)], aiTop: lo - 0.1 + (k % 4) * 0.02 }));
  } else {
    ai = game.session.drivers.filter(d => !d.human).map(d => Object.assign({}, d, { aiTop: U.lerp(lo, hi, d.skill) + game.session.idx * 0.004 }));
  }
  const laps = game.session.kind === 'custom' ? custom.laps : track.N < 1300 ? 4 : track.N < 2000 ? 3 : 2;
  return new Race({ track, mode: game.session.time ? 'time' : 'race', laps, humans, ai, diff: game.session.diff, energy: settings.energy === 1, power: settings.power === 1 });
}
export const recordKey = r => r.track.code + (r.mode === 'time' ? 'T' : 'R');
