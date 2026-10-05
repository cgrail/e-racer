// Touch menus: the pages (game/page.js) that the online and local menus, the course builder and the pause menu
// become on a touch screen, all in the stage, on a stand-in DOM, tapped through from the online menu to a race and
// back.
import { El, store, frames, tap } from './stubs.js';

const { Input } = await import('../src/core/input.js');
const { Page } = await import('../src/game/page.js');
const { go, custom, scenes } = await import('../src/game/state.js');
const fail = msg => { throw new Error('pages: ' + msg); };
const expect = name => { if (window.__ecr.scene !== name) fail(`expected scene ${name}, got ${window.__ecr.scene}`); };
const make = document.createElement, s = window.__ecr.settings, stage = new El('div');
document.createElement = t => new El(t);
Input.setAuto(true); // touch on: the menus are pages, with BUTTONS for the racing buttons' side

const show = () => Page.update(true, stage);
const all = () => stage.all();
const find = (test, what) => all().find(test) || fail('no ' + what);
const title = () => find(e => e.className === 'title', 'title').textContent;
const heads = () => all().filter(e => e.className === 'head').map(e => e.children[e.children.length - 1].textContent);
const button = label => find(e => e.tagName === 'BUTTON' && e.textContent === label, 'button ' + label);
const opt = label => find(e => /^opt/.test(e.className) && e.all().some(k => k.className === 'k' && k.textContent === label), 'row ' + label);
const step = (label, dir) => opt(label).children[dir < 0 ? 0 : 2].fire('click');
const input = label => opt(label).all().find(e => e.tagName === 'INPUT');
const type = (inp, v) => { inp.focus(); inp.value = v; inp.fire('input', {}); inp.fire('keydown', { key: 'Enter' }); inp.fire('change'); };

expect('Lobby'); show(); // where the phone name test left off: the online menu, no race running
if (title() !== 'ONLINE RACE' || heads().join() !== 'RACE SERVER,YOUR CAR,OPTIONS,HOW TO DRIVE') fail('online page: ' + title() + ' ' + heads());
opt('BUTTONS');
if (button('START RACE').className !== 'go' || !Page.covers()) fail('START RACE should be the green action over the whole canvas');
const car = s.cars[0];
step('CAR', 1); if (s.cars[0] === car) fail('▸ did not change the car');
step('CAR', -1); if (s.cars[0] !== car) fail('◂ did not change the car back');
const name = input('NAME');
type(name, 'zed-9x');
if (name.value !== 'ZED9X' || s.names[0] !== 'ZED9X') fail('typed name not cleaned up and kept: ' + s.names[0]);
s.names[0] = 'ABC'; show(); if (name.value !== 'ABC') fail('name field not brought up to date');
button('◂').fire('click'); frames(1); expect('Title'); // back presses Esc
if (show() || stage.children.length) fail('page left up on the title');

go('MainMenu'); show();
s.players = 1; show();
if (title() !== 'LOCAL GAME' || heads().join() !== 'RACE SETUP,PLAYER 1,OPTIONS,HOW TO DRIVE') fail('local page: ' + heads());
opt('BUTTONS');
step('PLAYERS', 1); if (s.players !== 2 || !heads().includes('PLAYER 2')) fail('a second player did not get a card');
step('PLAYERS', -1); if (s.players !== 1 || heads().includes('PLAYER 2')) fail('the second player card stayed');
while (s.mode !== 2) step('GAME', 1);
button('BUILD COURSE').fire('click'); expect('Builder');
if (title() !== 'COURSE BUILDER') fail('builder page not up after BUILD COURSE: ' + title());

custom.params.curves = 5; show();
step('CURVES', 1); if (custom.params.curves !== 6) fail('▸ did not move the slider');
if (opt('CURVES').all().filter(e => e.tagName === 'I' && e.style.background).length !== 6) fail('slider notches not lit');
opt('CURVES').children[1].fire('click', { clientX: 100 + 150 * 0.2 }); if (custom.params.curves !== 3) fail('tapping the slider did not set it: ' + custom.params.curves);
const bar = opt('CURVES').all().find(e => /notches/.test(e.className)); // the stage turned a quarter: the slider runs down the screen
bar.getBoundingClientRect = () => ({ left: 0, top: 200, width: 20, height: 150 });
opt('CURVES').children[1].fire('click', { clientX: 5, clientY: 200 + 150 * 0.6 }); if (custom.params.curves !== 9) fail('tapping the turned slider did not set it: ' + custom.params.curves);
const code = input('ENTER CODE'), before = scenes.Builder.track.code;
code.focus(); code.value = 'hello world'; code.fire('input', {}); code.blur(); code.fire('change');
if (scenes.Builder.track.code === before || code.value !== '') fail('typing a word did not build a course');
if (find(e => e.className === 'big', 'course code').textContent !== scenes.Builder.track.code) fail('preview does not show the new code');
const typed = scenes.Builder.track.code;
button('RANDOMISE').fire('click'); if (scenes.Builder.track.code === typed) fail('RANDOMISE did not change the course');
button('RACE!').fire('click'); expect('PreRace');
if (show()) fail('page left up before the race');

tap('Enter'); expect('RaceScene'); tap('Escape'); show(); // the pause menu: a page in the stage, over the race
if (!stage.all().some(e => e.className === 'page over') || Page.covers() || title() !== 'PAUSED') fail('pause page not over the race');
button('CONTINUE').fire('click'); if (scenes.RaceScene.paused || show()) fail('CONTINUE did not go on');
tap('Escape'); show(); button('◂').fire('click'); frames(1); if (scenes.RaceScene.paused) fail('back did not go on');
const side = () => [s.buttons, JSON.parse(store.get('ecr.settings')).buttons].join();
tap('Escape'); show(); if (side() !== '0,0') fail('racing buttons not on the left to begin with');
step('BUTTONS', 1); if (side() !== '1,1') fail('BUTTONS did not move the racing buttons right and save it');
step('BUTTONS', -1); if (side() !== '0,0') fail('BUTTONS did not move the racing buttons back left');
button('CONTINUE').fire('click');
tap('Escape'); show(); button('QUIT TO MENU').fire('click'); expect('MainMenu');
if (stage.children.length !== 1 || stage.children[0].className !== 'page' || title() !== 'LOCAL GAME') fail('quitting did not take the pause page away');

Page.update(false, stage); if (stage.children.length) fail('a key press (touch off) did not take the page away');
document.createElement = make; Input.setAuto(false);
console.log('touch pages: online menu (car, name, back), local menu (players, game), course builder (slider, turned slider, code, randomise), pause menu (continue, back, buttons side, quit) OK');
