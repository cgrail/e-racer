import { U } from '../core/util.js';
import { Track } from '../world/track.js';
import { CARSPEC } from '../race/specs.js';

// Saved settings, course-builder state and records, plus the live game state.
export const DEFAULTS = { players: 1, mode: 0, diff: 0, cars: ['flux', 'wave'], names: ['', ''], music: 0, units: 0, energy: 0, power: 0 };
export const settings = Object.assign({}, DEFAULTS, U.load('ecr.settings', {}));
delete settings.manual; // gearbox option from before the cars went single-speed
settings.cars = DEFAULTS.cars.map((m, i) => (CARSPEC[settings.cars[i]] ? settings.cars[i] : m)); // models since retired
settings.mode = U.clamp(settings.mode | 0, 0, 2); // online play was a game mode for a while; it has its own screen now
settings.names = DEFAULTS.names.map((n, i) => U.plateName((settings.names || [])[i])); // player names, shown on the number plate
export const custom = Object.assign({ params: null, type: 0, laps: 3 }, U.load('ecr.custom', {}));
if (!custom.params) custom.params = Track.decode('ELECTRORACER');
export const records = U.load('ecr.records', {});
export const saveAll = () => { U.save('ecr.settings', settings); U.save('ecr.custom', custom); };

// Shared game state: the active scene, the current session (championship, challenge, custom or online) and race.
export const game = { scene: null, session: null, race: null };
// Scene registry, filled by main.js. Scenes switch by name so scene modules never import each other.
export const scenes = {};
export function go(name) { game.scene = scenes[name]; if (game.scene.enter) game.scene.enter(); }
