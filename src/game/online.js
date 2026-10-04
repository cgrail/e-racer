import { Sound } from '../audio/sound.js';
import { Track } from '../world/track.js';
import { Race } from '../race/race.js';
import { CARSPEC, MODELS } from '../race/specs.js';
import { settings, game, go } from './state.js';

// Online races, browser side: the WebSocket to the race server (server/), its lobby status, and this browser's copy
// of the shared race. Only the player's own car is driven here; it is reported 20 times a second, and every other
// car follows the server's snapshots (race/online.js). main.js calls poll() once a frame, so messages are handled
// between frames. state: off, connecting, lobby, waiting (joined, for the next race), race, results or error.
const SEND_T = 0.05;

export const Online = {
  ws: null, state: 'off', status: null, error: '', inbox: [], snap: null,
  id: 0, me: null, sendT: 0, next: 0, waitNext: 0, table: null,

  url() { // next to the page, so the game also works from a sub-path behind a proxy
    const u = new URL('ws', location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.href;
  },
  connect() {
    this.close();
    this.state = 'connecting';
    let ws;
    try { ws = new WebSocket(this.url()); } catch (e) { this.fail('NO RACE SERVER FOUND'); return; }
    this.ws = ws;
    ws.onopen = () => this.send({ type: 'hello', name: settings.names[0], model: settings.cars[0] });
    ws.onmessage = ev => {
      if (this.ws !== ws) return; // a socket we have let go of
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'snap') this.snap = m; else this.inbox.push(m); // only the latest snapshot matters
    };
    ws.onclose = () => { if (this.ws === ws) this.fail(this.state === 'connecting' ? 'NO RACE SERVER FOUND' : 'CONNECTION LOST'); };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* already closed */ } };
  },
  close() {
    const ws = this.ws;
    this.ws = null; this.state = 'off'; this.status = null; this.error = ''; this.inbox.length = 0; this.snap = null; this.me = null;
    if (ws) try { ws.close(); } catch (e) { /* already closed */ }
  },
  // Lost the server: back to the lobby, which shows why.
  fail(msg) {
    const racing = this.racing();
    this.close();
    this.state = 'error'; this.error = msg;
    if (racing) { Sound.enginesOff(); go('Lobby'); }
  },
  racing() { return this.state === 'race' || this.state === 'results'; },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  start() { this.error = ''; this.state = 'waiting'; this.send({ type: 'start', diff: settings.diff, energy: settings.energy === 1, power: settings.power === 1 }); },
  join() { this.error = ''; this.state = 'waiting'; this.send({ type: 'join' }); },
  leave() { this.send({ type: 'leave' }); this.state = 'lobby'; this.me = null; },

  poll(dt) {
    while (this.inbox.length) this.handle(this.inbox.shift());
    const r = game.race;
    if (this.state === 'results') this.next = Math.max(0, this.next - dt);
    if (this.state !== 'race' || !r || !r.net) return;
    if (this.snap && this.snap.id === this.id) r.applySnapshot(this.snap);
    this.snap = null;
    for (const [type, i] of r.outbox) this.send({ type, id: this.id, i });
    r.outbox.length = 0;
    if ((this.sendT -= dt) <= 0) { this.sendT = SEND_T; this.send({ type: 'car', id: this.id, s: r.packCar(this.me) }); }
  },

  handle(m) {
    const r = game.race, mine = r && r.net && m.id === this.id;
    switch (m.type) {
      case 'status': this.status = m.session; if (this.state === 'connecting') this.state = 'lobby'; break;
      case 'wait': this.state = 'waiting'; this.waitNext = m.next; break;
      case 'race': this.begin(m); break;
      case 'seat': if (mine) r.setDriver(r.cars[m.i], known(m.car), true); break;
      case 'shocked': if (mine && this.state === 'race' && !(this.me.superT > 0)) { r.shockHit(this.me); Sound.fx.zap(); } break;
      case 'results':
        if (!mine) break;
        r.applySnapshot(m.snap);
        this.state = 'results'; this.next = m.next; this.table = m.table || null;
        Sound.enginesOff(); go('Results');
        break;
      case 'error': {
        const racing = this.racing();
        this.error = m.message; this.state = 'lobby'; this.me = null;
        if (racing) { Sound.enginesOff(); go('Lobby'); }
        break;
      }
    }
  },

  // A race to drive in: the same course from its code, the same cars in the same order, and car `you` is ours.
  begin(m) {
    const track = Track.build(Track.decode(m.code));
    const race = new Race({ track, mode: 'race', laps: m.laps, humans: [], ai: m.cars.map((d, i) => Object.assign(known(d), { id: 'C' + i })),
      diff: m.diff, energy: m.energy, power: m.power, net: 'client' });
    this.me = race.joinAs(m.you);
    race.applySnapshot(m.snap, true);
    race.applyCar(this.me, m.snap.cars[m.you], true);
    this.me.lapStart = race.time;
    this.id = m.id; this.snap = null; this.sendT = 0; this.state = 'race'; this.error = '';
    game.race = race;
    game.session = { kind: 'online', diff: m.diff, idx: 0, courses: [], drivers: [] };
    go('RaceScene');
  },
};

// A car from the server, with a model this version of the game knows.
const known = d => Object.assign({}, d, { model: CARSPEC[d.model] ? d.model : MODELS[0] });
