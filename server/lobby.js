import { U } from '../src/core/util.js';
import { MODELS } from '../src/race/specs.js';
import { Session, CARS } from './session.js';

// Everyone connected, and the one online session they can start or join. When nobody is racing there is no
// session; the first player to start one sets it up, and it ends when the last player leaves. server.js feeds
// this the WebSocket traffic; scripts/smoke.js feeds it directly. Messages are JSON objects with a type:
//   browser -> server   hello {name, model}            name and car, sent on connecting
//                       start {diff, energy, power}    start a session, or join the one that is running
//                       join | leave                   take a car in the running session / give it back
//                       car {id, s} | shock {id, i}    in a race: this player's car, a shock fired at car i
//   server -> browser   status {session}               to browsers not in the session, now and every second
//                       race {id, code, laps, diff, energy, power, cars, you, snap}   a race to drive in
//                       seat {id, i, car} | snap {id, t, ph, n, cars} | shocked {id}
//                       results {id, snap, next, table: [{name, points, last}]}   the session's points after the race
//                       wait {next}                    joined, for the next race | error {message}
export const Lobby = {
  clients: new Set(), session: null, statusT: 0,

  connect(send) {
    const cl = { send, name: 'RACER', model: MODELS[0], inSession: false };
    this.clients.add(cl);
    send(this.status());
    return cl;
  },
  close(cl) { this.leave(cl); this.clients.delete(cl); },
  leave(cl) {
    if (cl.inSession && this.session) {
      this.session.remove(cl);
      if (this.session.empty) this.session = null;
    }
    cl.inSession = false;
  },

  message(cl, m) {
    switch (m.type) {
      case 'hello':
        if (cl.inSession) return;
        cl.name = U.plateName(m.name) || 'RACER';
        cl.model = MODELS.includes(m.model) ? m.model : MODELS[0];
        cl.send(this.status());
        return;
      case 'start':
        if (!this.session) this.session = new Session(m);
      // falls through: whoever presses start second just joins
      case 'join':
        if (cl.inSession) return;
        if (!this.session) { cl.send({ type: 'error', message: 'NO RACE RUNNING' }); return; }
        if (this.session.players.size >= CARS) { cl.send({ type: 'error', message: 'THE RACE IS FULL' }); return; }
        cl.inSession = true;
        this.session.add(cl);
        return;
      case 'leave':
        this.leave(cl);
        cl.send(this.status());
        return;
      default:
        if (cl.inSession && this.session) this.session.message(cl, m);
    }
  },

  tick(dt) {
    if (this.session) this.session.tick(dt);
    if ((this.statusT -= dt) > 0) return;
    this.statusT = 1;
    const st = this.status();
    for (const cl of this.clients) if (!cl.inSession) cl.send(st);
  },
  status() { return { type: 'status', session: this.session ? this.session.status() : null }; },
  // A crash in the session ends the session, not the server.
  abort(err) {
    console.error(err);
    for (const cl of this.clients) {
      if (cl.inSession) { cl.inSession = false; cl.send({ type: 'error', message: 'THE RACE STOPPED ON THE SERVER' }); }
    }
    this.session = null;
  },
};
