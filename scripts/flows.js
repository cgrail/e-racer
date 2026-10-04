// Game flows for the smoke test, run after smoke.js's module checks: the real main.js driven through its key
// handlers (title, menus, championship, 2P time challenge, course builder), then an online session against the
// real server lobby behind a fake WebSocket.
import { define, store, hooks, frames, tap, hold, release } from './stubs.js';

// ---------------------------------------------------------------- game flow through the real key handlers
store.set('ecr.settings', JSON.stringify({ cars: ['volt', 'ion'], names: ['toolongname!'], units: 0, energy: 0, power: 1 })); // from an older version: retired cars, a bad name, MPH as the default, options since gone
await import('../src/main.js');
if (window.__ecr.settings.cars.join() !== 'flux,wave') throw new Error('retired car models not replaced: ' + window.__ecr.settings.cars);
if (window.__ecr.settings.names.join() !== 'TOOLON,') throw new Error('saved names not cleaned up: ' + window.__ecr.settings.names);
if (window.__ecr.settings.units !== 1 || 'energy' in window.__ecr.settings || 'power' in window.__ecr.settings) throw new Error('old settings not moved to KM/H without the energy and power-up options');
const expect = name => { if (window.__ecr.scene !== name) throw new Error(`expected scene ${name}, got ${window.__ecr.scene}`); };
const moved = () => { if (!(window.__ecr.race.humans.every(h => h.travel > 2000))) throw new Error('player cars did not drive'); };
frames(5);
window.__ecr.settings.names[0] = ''; // a new player: the title asks for a name first
tap('Enter'); expect('NameEntry');
tap('Enter'); expect('NameEntry'); // no name yet: Enter does nothing
for (const [code, k] of [['KeyR', 'r'], ['Minus', '-'], ['KeyF', 'f'], ['Digit1', '1']]) tap(code, k);
tap('Enter'); expect('MainMenu'); // name -> main menu (no race server here)
if (window.__ecr.settings.names[0] !== 'RF1') throw new Error('name not asked for first: ' + window.__ecr.settings.names[0]);
tap('ArrowUp'); tap('Enter'); // wrap to START GAME (championship)
frames(5); expect('PreRace'); tap('Enter'); expect('RaceScene'); // pre-race -> race
if (!window.__ecr.race.energy || !window.__ecr.race.power) throw new Error('a championship race should have limited energy and power-ups');
hold('ArrowUp'); frames(60 * 20); release('ArrowUp'); moved();
tap('Escape'); tap('ArrowUp'); tap('Enter'); // pause -> QUIT TO MENU (menu cursor stays on START)
expect('MainMenu');
tap('ArrowDown'); tap('Enter'); // PLAYERS -> 2 players
tap('ArrowDown'); tap('Enter'); // GAME -> time challenge
tap('ArrowUp'); tap('ArrowUp'); tap('Enter'); frames(5); tap('Enter'); expect('RaceScene');
if (window.__ecr.race.mode !== 'time' || window.__ecr.race.humans.length !== 2) throw new Error('expected a 2P time challenge');
hold('KeyW'); hold('ArrowUp'); frames(60 * 20); release('KeyW'); release('ArrowUp'); moved();
tap('Escape'); tap('ArrowUp'); tap('Enter');
tap('ArrowDown'); tap('ArrowDown'); tap('Enter'); // GAME -> course builder
tap('ArrowUp'); tap('ArrowUp'); tap('Enter'); expect('Builder'); // BUILD COURSE
for (let i = 0; i < 12; i++) tap('ArrowDown');
tap('Enter'); frames(5); tap('Enter'); expect('RaceScene'); // RACE! -> pre-race -> race
hold('KeyW'); hold('ArrowUp'); frames(60 * 10); moved();
{ // touch controls: the car accelerates by itself, and the on-screen BRAKE holds KeyS
  const { Input } = await import('../src/core/input.js');
  release('KeyW'); release('ArrowUp'); Input.setAuto(true);
  const car = window.__ecr.race.humans[0], t0 = car.travel;
  frames(60 * 5);
  if (car.travel - t0 < 2000) throw new Error('touch: the car did not accelerate by itself');
  const v0 = car.speed;
  Input.virtual('KeyS', true); frames(60 * 2); Input.virtual('KeyS', false);
  if (!(car.speed < v0 * 0.8)) throw new Error('touch: BRAKE did not slow the car');
  const x0 = car.x;
  Input.setSteer(1); frames(30); Input.setSteer(null);
  if (!(car.x > x0 + 0.1)) throw new Error('touch: dragging right did not steer right');
  const touch = (x, y) => { Input.tap(x, y); frames(1); }, race = window.__ecr.scenes.RaceScene;
  tap('Escape'); // pause menu rows from y 120, spread 20 apart on touch: CONTINUE, RESTART RACE, QUIT TO MENU
  touch(200, 170); if (!race.paused || race.psel !== 2) throw new Error('touch: menu rows did not spread out for touch');
  touch(200, 137); if (!race.paused || race.psel !== 1) throw new Error('touch: tapping a row did not select it');
  touch(200, 122); if (!race.paused || race.psel !== 0) throw new Error('touch: tapping a row confirmed it before selecting');
  touch(20, 20); if (!race.paused) throw new Error('touch: a tap beside the rows did something');
  touch(200, 122); if (race.paused) throw new Error('touch: tapping the selected row did not confirm it');
  Input.setAuto(false); hold('KeyW'); hold('ArrowUp');
}
console.log('game flow: title, name for a new player, menu, championship, 2P time challenge, course builder race, touch driving and menus OK');

// ---------------------------------------------------------------- online: the real server lobby behind a fake WebSocket
{
  const { Lobby } = await import('../server/lobby.js');
  const { Online } = await import('../src/game/online.js');
  const net = []; // deliveries in both directions, handed over between frames as JSON like real traffic
  const outages = ['hang', 'refuse']; // the first connection never answers, the second is refused
  define('location', { href: 'http://localhost:5173/' });
  define('WebSocket', class {
    constructor(url) {
      if (url !== 'ws://localhost:5173/ws') throw new Error('online: socket url ' + url);
      const out = outages.shift();
      if (out) { if (out === 'refuse') net.push(() => this.onclose()); return; }
      this.readyState = 1;
      net.push(() => {
        this.cl = Lobby.connect(o => { const data = JSON.stringify(o); net.push(() => this.onmessage && this.onmessage({ data })); });
        this.onopen();
      });
    }
    send(data) { net.push(() => this.cl && Lobby.message(this.cl, JSON.parse(data))); }
    close() { this.readyState = 3; if (this.cl) Lobby.close(this.cl); this.cl = null; }
  });
  hooks.push(dt => { Lobby.tick(dt); for (const f of net.splice(0)) f(); });
  const fail = msg => { throw new Error('online: ' + msg); };

  release('KeyW'); release('ArrowUp');
  tap('Escape'); tap('ArrowUp'); tap('Enter'); expect('MainMenu'); // quit the course-builder race
  tap('Escape'); expect('Title'); // the title looks for the race server, which never answers
  tap('Enter'); frames(60); expect('Title'); // still waiting
  frames(60 * 2.5); expect('MainMenu'); // after 3 seconds it is the local game
  tap('Escape'); expect('Title'); frames(3); // it looks again: refused
  tap('Enter'); frames(2); expect('MainMenu'); // the local game straight away
  if (Online.state !== 'error' || Online.error !== 'NO RACE SERVER FOUND') fail('no server should show as such, got ' + Online.state);
  tap('Escape'); expect('Title'); frames(3); // back on the title it looks again, and now the server is up
  window.__ecr.settings.names[0] = '';
  tap('Enter'); expect('NameEntry'); tap('Escape'); frames(2); expect('Lobby'); // no name: asked, and skipped
  if (Online.state !== 'lobby' || Online.status !== null) fail('online menu should show no session, got ' + Online.state);
  // rows: START RACE (the cursor starts here), NAME, CAR, LEVEL, MUSIC, UNITS
  tap('ArrowDown'); tap('Enter'); // NAME: edit
  for (let i = 0; i < 6; i++) tap('Backspace');
  for (const [code, k] of [['KeyA', 'a'], ['KeyC', 'c'], ['KeyE', 'e'], ['Digit1', '!'], ['Digit7', '7'], ['KeyF', 'f'], ['KeyX', 'x'], ['KeyY', 'y']]) tap(code, k);
  tap('Enter');
  if (window.__ecr.settings.names[0] !== 'ACE7FX') fail('name not typed in: ' + window.__ecr.settings.names[0]);
  tap('ArrowUp'); tap('Enter'); frames(3); expect('RaceScene'); // START RACE
  const race = () => window.__ecr.race, sv = () => Lobby.session.race;
  const me = race().humans[0], mi = race().cars.indexOf(me);
  if (race().net !== 'client' || race().cars.length !== 20 || race().humans.length !== 1 || mi !== 19) fail('own car not set up at the back of a 20-car grid');
  if (me.name !== 'ACE7FX' || me.plate !== 'ACE7FX' || me.model !== 'flux' || !race().energy || !race().power) fail('name, car or options not carried online');
  if (race().track.code !== sv().track.code || sv().humans.length !== 1 || !sv().cars[mi].net) fail('server race does not match');

  const bob = [], cl2 = Lobby.connect(o => bob.push(JSON.parse(JSON.stringify(o)))); // a second player, mid-flight
  Lobby.message(cl2, { type: 'hello', name: 'bob!', model: 'pixel' }); Lobby.message(cl2, { type: 'join' });
  const bi = bob.find(m => m.type === 'race').you;
  frames(3);
  if (!race().cars[bi].human || race().cars[bi].plate !== 'BOB' || race().cars[bi].model !== 'pixel' || sv().humans.length !== 2) fail('second player did not take over a rival');
  hold('ArrowUp'); frames(60 * 20);
  if (!(me.travel > 2000) || Math.abs(sv().cars[mi].travel - me.travel) > 3000) fail(`server copy of the car does not follow (${me.travel} / ${sv().cars[mi].travel})`);
  if (!(race().cars.some(c => !c.human && c.travel > 2000))) fail('rivals do not move in the browser');

  me.power = 0; me.shock = 1; me.superT = 0; // hold a flash and fire it: it lands on the server's car
  if (!race().shockTarget(me)) fail('no car ahead to shock');
  tap('KeyE'); frames(2);
  const ti = race().cars.findIndex(c => c.net && c.shockT > 2.5); // the car it hit here (the nearest ahead when it fired)
  if (ti < 0 || !(sv().cars[ti].shockT > 0) || (ti === bi && !bob.some(m => m.type === 'shocked'))) fail('shock did not reach the server');
  frames(60 * 4);
  sv().shockHit(sv().cars[mi]); frames(3); // a rival's shock on the server lands in the browser
  if (!(me.shockT > 0)) fail(`shock from the server did not land (state ${Online.state}, superT ${me.superT}, power ${me.power}, svShockT ${sv().cars[mi].shockT}, svSuper ${sv().cars[mi].superT})`);

  Lobby.close(cl2); frames(3); // the second player drops: a rival takes the car back
  if (race().cars[bi].human || sv().cars[bi].human || sv().humans.length !== 1 || race().cars[bi].plate) fail('dropped player not replaced by a rival');

  race().setTravel(me, race().L * race().laps - 2000); me.prevZ = me.z; me.lap = race().laps; // last metres of the race
  frames(60 * 6); expect('Results');
  if (!me.finished || Online.state !== 'results' || !sv().cars[mi].finished) fail('race did not end with the player finished');
  const top = Online.table && Online.table[0];
  if (!top || top.name !== 'ACE7FX' || top.points !== 20 || top.last !== 20) fail('session points table wrong: ' + JSON.stringify(Online.table));
  release('ArrowUp'); frames(60 * 13); expect('RaceScene'); // the session's points, then the next race starts by itself
  if (Online.id !== 2 || race().humans[0].name !== 'ACE7FX' || race().cars.indexOf(race().humans[0]) !== 19) fail('next race not joined');
  frames(60 * 3);
  tap('Escape'); tap('ArrowDown'); tap('Enter'); frames(3); expect('Lobby'); // pause -> LEAVE RACE
  if (Lobby.session !== null || Online.status !== null) fail('session should end with its last player');
  tap('Escape'); expect('Title'); tap('Enter'); frames(2); expect('Lobby'); // still connected: straight back online
  tap('Enter'); frames(3); expect('RaceScene'); // START RACE again
  const ws = Online.ws; Lobby.close(ws.cl); ws.cl = null; ws.onclose(); frames(2); expect('Lobby'); // the server goes away mid-race
  if (Online.state !== 'error' || Online.error !== 'CONNECTION LOST') fail('lost connection not shown, got ' + Online.state);
  tap('ArrowDown'); tap('Enter'); expect('MainMenu'); // PLAY OFFLINE
  if (Online.state !== 'off' || Lobby.clients.size !== 0 || Lobby.session !== null) fail('playing offline should disconnect');
  console.log('online: no server (silent or refused) -> local game, server -> name skipped -> online menu, start, mid-race join and drop, state sync, shocks both ways, race end, points, next race, leave, connection lost -> offline OK');
}

// ---------------------------------------------------------------- a phone asks for a name on a page of its own
{ // askname.js builds the page with the DOM, which isn't here: a stand-in form takes its events
  const { Input } = await import('../src/core/input.js');
  const fail = msg => { throw new Error('phone name: ' + msg); };
  const el = () => ({ on: {}, addEventListener(t, fn) { this.on[t] = fn; }, blur() {}, focus() {} });
  const input = el(), skip = el(), form = Object.assign(el(), { remove() { form.gone = true; }, querySelector: s => (s === 'input' ? input : skip) });
  const make = document.createElement;
  document.createElement = t => (t === 'form' ? form : make(t));
  document.body = { appendChild() {} };
  Input.setAuto(true); window.__ecr.settings.names[0] = '';
  tap('Escape'); expect('Title'); tap('Enter'); expect('NameEntry'); // the title looks for the server again, and finds it
  tap('KeyA', 'a'); tap('Enter'); expect('NameEntry'); // keys go to the page, not the canvas entry
  input.value = 'ab-c'; input.on.input({});
  if (input.value !== 'ABC') fail('typed name not cleaned up: ' + input.value);
  form.on.submit({ preventDefault() {} }); frames(3); expect('Lobby');
  if (!form.gone || window.__ecr.settings.names[0] !== 'ABC') fail('START did not keep the name: ' + window.__ecr.settings.names[0]);
  window.__ecr.settings.names[0] = ''; form.gone = false;
  tap('Escape'); expect('Title'); tap('Enter'); expect('NameEntry');
  skip.on.click(); frames(3); expect('Lobby');
  if (!form.gone || window.__ecr.settings.names[0] !== '') fail('SKIP did not go on without a name');
  document.createElement = make; delete document.body; Input.setAuto(false);
  console.log('phone name page: START keeps the name, SKIP goes on without one OK');
}
