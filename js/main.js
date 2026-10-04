'use strict';

// Game flow: title, menus, R.E.C.S. course editor, championship / time challenge, results.
(() => {
  const cv = document.getElementById('screen');
  const g = cv.getContext('2d');
  cv.width = K.W; cv.height = K.H;
  const W = K.W, H = K.H;

  const DEFAULTS = { players: 1, mode: 0, diff: 0, cars: ['esprit', 'elan'], manual: [false, false], music: 0, units: 0 };
  const settings = Object.assign({}, DEFAULTS, U.load('lotus3.settings', {}));
  const recs = Object.assign({ params: null, type: 0, laps: 3 }, U.load('lotus3.recs', {}));
  if (!recs.params) recs.params = Track.decode('LOTUSTHREE');
  const records = U.load('lotus3.records', {});
  const saveAll = () => { U.save('lotus3.settings', settings); U.save('lotus3.recs', recs); };

  const AI_NAMES = ['K.MORGAN', 'R.BLAKE', 'T.VANCE', 'S.IKEDA', 'L.MORETTI', 'P.DUBOIS', 'J.KOVACS', 'A.LINDQVIST',
    'M.OKAFOR', 'H.SCHULZ', 'D.PETROV', 'C.ALVAREZ', 'B.BRENNAN', 'W.CHEN', 'F.FONTAINE', 'G.GALLAGHER',
    'N.HOLM', 'E.JANSEN', 'V.KAPOOR', 'O.LARSEN', 'I.MENDES', 'Z.NOVAK'];
  const AI_RANGE = [[0.64, 0.8], [0.7, 0.87], [0.76, 0.93]];
  const POINTS = [20, 15, 12, 10, 8, 6, 4, 3, 2, 1];
  const QUALIFY = [10, 6, 3];
  const DIFF_NAMES = ['EASY', 'MEDIUM', 'HARD'];
  const CHAMP = [
    ['forest', 'desert', 'motorway', 'marsh', 'snow', 'night'],
    ['mountains', 'fog', 'roadworks', 'windy', 'storm', 'future'],
    ['night', 'snow', 'storm', 'fog', 'mountains', 'future'],
  ];
  const STAGES = [
    ['forest', 'desert', 'snow', 'night', 'marsh'],
    ['motorway', 'fog', 'windy', 'mountains', 'storm'],
    ['roadworks', 'storm', 'future', 'snow', 'mountains'],
  ];

  let scene = null;
  const go = s => { scene = s; if (s.enter) s.enter(); };
  let session = null, race = null;

  // ------------------------------------------------------------ drawing helpers
  const text = (s, x, y, size, col, align, shadow) => Render.text(g, s, x, y, size, col, align, shadow);
  function panel(x, y, w, h, title) {
    g.fillStyle = 'rgba(8,10,40,0.86)'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#4a6cff'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.strokeStyle = '#1c2a80'; g.lineWidth = 1; g.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
    if (title) {
      const gr = g.createLinearGradient(0, y + 6, 0, y + 18);
      gr.addColorStop(0, '#3050ff'); gr.addColorStop(1, '#101a70');
      g.fillStyle = gr; g.fillRect(x + 6, y + 6, w - 12, 13);
      text(title, x + w / 2, y + 9, 8, '#ffe040', 'center');
    }
  }
  function logo(cx, y, size = 40) {
    g.font = Render.font(size); g.textAlign = 'left'; g.textBaseline = 'top';
    const total = size * 9, x0 = Math.round(cx - total / 2);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 3], [3, 3]]) {
      g.fillStyle = '#0a0a30'; g.fillText('LOTUS', x0 + dx, y + dy); g.fillText('III', x0 + size * 6 + dx, y + dy);
    }
    const chrome = g.createLinearGradient(0, y, 0, y + size);
    chrome.addColorStop(0, '#ffffff'); chrome.addColorStop(0.45, '#a8ccff'); chrome.addColorStop(0.5, '#2a3c90'); chrome.addColorStop(1, '#d8e8ff');
    g.fillStyle = chrome; g.fillText('LOTUS', x0, y);
    const gold = g.createLinearGradient(0, y, 0, y + size);
    gold.addColorStop(0, '#fff6a0'); gold.addColorStop(0.45, '#ffb020'); gold.addColorStop(0.5, '#a02010'); gold.addColorStop(1, '#ffd060');
    g.fillStyle = gold; g.fillText('III', x0 + size * 6, y);
  }
  function rowsDraw(rows, sel, x, y, w, lh = 14) {
    rows.forEach((r, i) => {
      const yy = y + i * lh, on = i === sel;
      if (on) {
        const gr = g.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, 'rgba(255,40,160,0.6)'); gr.addColorStop(1, 'rgba(60,80,255,0.25)');
        g.fillStyle = gr; g.fillRect(x, yy - 3, w, lh - 1);
      }
      text(r.label, x + 6, yy, 8, on ? '#ffffff' : r.action ? '#7fffb0' : '#9fb0ff');
      if (r.slider != null) {
        const cx = x + w - 6 - r.slider * 6;
        for (let k = 0; k < r.slider; k++) {
          g.fillStyle = k < r.val ? (k < 5 ? '#40e040' : k < 10 ? '#ffe040' : '#ff5030') : 'rgba(255,255,255,0.12)';
          g.fillRect(cx + k * 6, yy, 5, 7);
        }
      } else if (r.opts) {
        const v = r.opts[r.val];
        text(on ? `< ${v} >` : v, x + w - 6, yy, 8, on ? '#ffe040' : '#ffc040', 'right');
      } else if (r.value) {
        text(r.value, x + w - 6, yy, 8, on ? '#ffe040' : '#ffc040', 'right');
      }
    });
  }
  function rowsNav(rows, st) {
    const m = Input.menu();
    if (m.up) { st.sel = U.wrap(st.sel - 1, rows.length); Sound.fx.tick(); }
    if (m.down) { st.sel = U.wrap(st.sel + 1, rows.length); Sound.fx.tick(); }
    const r = rows[st.sel];
    if (r.slider != null || r.opts) {
      const step = (m.left ? -1 : 0) + (m.right ? 1 : 0) + (m.ok && r.opts ? 1 : 0);
      if (step) {
        r.set(r.slider != null ? U.clamp(r.val + step, 0, r.slider) : U.wrap(r.val + step, r.opts.length));
        Sound.fx.tick(); saveAll();
      }
    } else if (m.ok && r.action) { Sound.fx.select(); r.action(); }
    return m;
  }
  function carPanel(x, y, w, h, p, t) {
    const model = settings.cars[p], spec = CARSPEC[model];
    panel(x, y, w, h, `PLAYER ${p + 1} CAR`);
    const frame = [0, 1, 0, -1][Math.floor(t / 1.2) % 4];
    const img = Art.car(model, CAR_COLORS[p], frame, Math.floor(t / 1.2) % 4 === 2);
    g.imageSmoothingEnabled = false;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 10, y + 24, w - 20, 82);
    g.drawImage(img, Math.round(x + w / 2 - 72), y + 26, 144, 80);
    text(spec.name, x + w / 2, y + 112, 8, '#ffffff', 'center');
    const bars = [['TOP SPEED', spec.top], ['ACCELERATION', spec.acc / 1.25], ['GRIP', spec.grip / 1.25]];
    bars.forEach(([lab, v], i) => {
      const yy = y + 128 + i * 20;
      text(lab, x + 12, yy, 8, '#9fb0ff');
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 12, yy + 10, w - 24, 5);
      g.fillStyle = '#ffe040'; g.fillRect(x + 12, yy + 10, (w - 24) * v, 5);
    });
    const mph = Math.round(spec.top * K.MPH * (settings.units ? 1.609 : 1));
    text(`${mph} ${settings.units ? 'KM/H' : 'MPH'}  ${settings.manual[p] ? 'MANUAL' : 'AUTO'}`, x + w / 2, y + 192, 8, '#7fffb0', 'center');
  }
  function drawMap(pv, x, y, w, h, col = '#ffffff') {
    const { pts } = pv;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [px, py] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const s = Math.min((w - 12) / (x1 - x0 || 1), (h - 12) / (y1 - y0 || 1));
    const ox = x + w / 2 - ((x0 + x1) / 2) * s, oy = y + h / 2 - ((y0 + y1) / 2) * s;
    for (const [lw, c] of [[4, '#000'], [2, col]]) {
      g.strokeStyle = c; g.lineWidth = lw; g.lineJoin = 'round'; g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(ox + px * s, oy + py * s) : g.moveTo(ox + px * s, oy + py * s)));
      g.closePath(); g.stroke();
    }
    const st = pts[Math.floor(K.START_SEG / 2)];
    g.fillStyle = '#ff3030'; g.fillRect(ox + st[0] * s - 3, oy + st[1] * s - 3, 6, 6);
  }
  function drawProfile(pv, x, y, w, h) {
    const p = pv.prof;
    let lo = Math.min(...p), hi = Math.max(...p);
    if (hi - lo < 2000) { const m = (hi + lo) / 2; lo = m - 1000; hi = m + 1000; }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, h);
    g.fillStyle = '#4a8a3a'; g.beginPath(); g.moveTo(x, y + h);
    p.forEach((v, i) => g.lineTo(x + (i / (p.length - 1)) * w, y + h - 2 - ((v - lo) / (hi - lo)) * (h - 4)));
    g.lineTo(x + w, y + h); g.closePath(); g.fill();
  }
  function blinkOn(t, rate = 2) { return Math.floor(t * rate) % 2 === 0; }

  // ------------------------------------------------------------ attract mode (background demo race)
  let attract = null, attractCam = null, attractT = 0, attractVS = {};
  function newAttract() {
    const p = Track.random();
    p.obst = Math.min(p.obst, 5); p.length = 5;
    const ai = Array.from({ length: 12 }, (_, k) => ({ id: 'A' + k, name: '', model: MODELS[k % 3], color: CAR_COLORS[k % CAR_COLORS.length], aiTop: 0.72 + (11 - k) * 0.012 }));
    attract = new Race({ track: Track.build(p), mode: 'race', laps: 99, humans: [], ai, attract: true });
    attractCam = attract.cars[7]; attractT = 0; attractVS = {};
    for (let i = 0; i < 240; i++) attract.update(1 / 30, []); // start the demo already under way
  }
  function drawAttract(dt, dim) {
    if (!attract || (attractT += dt) > 25) newAttract();
    attract.update(Math.min(dt, 0.05), []);
    Render.view(g, { x: 0, y: 0, w: W, h: H }, attract, attractCam, attractVS, { dt, hud: false });
    if (dim) { g.fillStyle = `rgba(0,0,20,${dim})`; g.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------ sessions
  function makeDrivers(nAI) {
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
  function course(kind, diff, idx) {
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
  function startSession(kind) {
    const n = 20 - settings.players;
    session = { kind, diff: settings.diff, idx: 0, drivers: makeDrivers(kind === 'champ' ? n : 0) };
    if (kind === 'recs') {
      session.courses = [{ params: Object.assign({}, recs.params) }];
      session.time = recs.type === 1;
      if (!session.time) session.drivers = session.drivers.concat(makeDrivers(n).filter(d => !d.human));
    } else {
      const list = kind === 'time' ? STAGES : CHAMP;
      session.courses = list[settings.diff].map((_, i) => course(kind, settings.diff, i));
      session.time = kind === 'time';
    }
    go(PreRace);
  }
  function makeRace() {
    const c = session.courses[session.idx];
    const track = Track.build(c.params, session.time ? { checkpoints: 4, scale: 1.8 } : {});
    const humans = session.drivers.filter(d => d.human);
    const [lo, hi] = AI_RANGE[session.diff];
    let ai;
    if (session.time) {
      ai = Array.from({ length: 10 }, (_, k) => ({ id: 'T' + k, name: 'TRAFFIC', model: MODELS[k % 3], color: CAR_COLORS[2 + (k % 8)], aiTop: lo - 0.1 + (k % 4) * 0.02 }));
    } else {
      ai = session.drivers.filter(d => !d.human).map(d => Object.assign({}, d, { aiTop: U.lerp(lo, hi, d.skill) + session.idx * 0.004 }));
    }
    const laps = session.kind === 'recs' ? recs.laps : track.N < 1300 ? 4 : track.N < 2000 ? 3 : 2;
    return new Race({ track, mode: session.time ? 'time' : 'race', laps, humans, ai, diff: session.diff });
  }
  const recordKey = r => r.track.code + (r.mode === 'time' ? 'T' : 'R');

  // ------------------------------------------------------------ scenes
  const Title = {
    t: 0,
    enter() { this.t = 0; Sound.enginesOff(); },
    update(dt) {
      this.t += dt;
      if (Input.menu().ok) { Sound.fx.select(); go(MainMenu); }
    },
    draw(dt) {
      drawAttract(dt, 0.2);
      const band = g.createLinearGradient(0, 30, 0, 130);
      band.addColorStop(0, 'rgba(0,0,30,0)'); band.addColorStop(0.2, 'rgba(0,0,30,0.55)');
      band.addColorStop(0.8, 'rgba(0,0,30,0.55)'); band.addColorStop(1, 'rgba(0,0,30,0)');
      g.fillStyle = band; g.fillRect(0, 30, W, 100);
      g.fillStyle = 'rgba(0,0,30,0.5)'; g.fillRect(0, 182, W, 28); g.fillRect(0, 246, W, 38);
      logo(W / 2, 46, 40);
      text('THE ULTIMATE CHALLENGE', W / 2, 96, 8, '#ffe040', 'center');
      text('WEB REMAKE', W / 2, 110, 8, '#9fb0ff', 'center');
      if (blinkOn(this.t)) text('PRESS ENTER', W / 2, 190, 16, '#ffffff', 'center');
      text('1 OR 2 PLAYERS  -  KEYBOARD OR GAMEPAD', W / 2, 252, 8, '#c0c8ff', 'center');
      text('FAN REMAKE. ALL GRAPHICS & MUSIC ORIGINAL.', W / 2, 270, 8, '#7080b0', 'center');
    },
  };

  const MainMenu = {
    sel: 0, t: 0,
    enter() { this.t = 0; Sound.enginesOff(); },
    rows() {
      const s = settings, r = [];
      const opt = (label, opts, get, set, extra) => r.push(Object.assign({ label, opts, val: get(), set }, extra));
      opt('PLAYERS', ['1 PLAYER', '2 PLAYERS'], () => s.players - 1, v => { s.players = v + 1; });
      opt('GAME', ['CHAMPIONSHIP', 'TIME CHALLENGE', 'R.E.C.S.'], () => s.mode, v => { s.mode = v; });
      opt('LEVEL', DIFF_NAMES, () => s.diff, v => { s.diff = v; });
      for (let p = 0; p < s.players; p++) {
        opt(`P${p + 1} CAR`, MODELS.map(m => CARSPEC[m].short), () => MODELS.indexOf(s.cars[p]), v => { s.cars[p] = MODELS[v]; }, { car: p });
        opt(`P${p + 1} GEARS`, ['AUTOMATIC', 'MANUAL'], () => (s.manual[p] ? 1 : 0), v => { s.manual[p] = v === 1; }, { car: p });
      }
      opt('MUSIC', Sound.songs.concat(['OFF']), () => (s.music < 0 ? Sound.songs.length : s.music), v => {
        s.music = v >= Sound.songs.length ? -1 : v;
        Sound.playMusic(s.music);
      });
      opt('UNITS', ['MPH', 'KM/H'], () => s.units, v => { s.units = v; });
      r.push({ label: s.mode === 2 ? 'BUILD COURSE >' : 'START GAME >', action: () => (s.mode === 2 ? go(Recs) : startSession(s.mode === 0 ? 'champ' : 'time')) });
      return r;
    },
    update(dt) {
      this.t += dt;
      const rows = this.rows();
      this.sel = Math.min(this.sel, rows.length - 1);
      const m = rowsNav(rows, this);
      if (m.back) { Sound.fx.back(); go(Title); }
    },
    draw(dt) {
      drawAttract(dt, 0.55);
      logo(W / 2, 8, 16);
      text('THE ULTIMATE CHALLENGE', W / 2, 27, 8, '#ffe040', 'center');
      const rows = this.rows();
      panel(10, 40, 278, 214, 'OPTIONS');
      rowsDraw(rows, this.sel, 16, 64, 266);
      const cur = rows[this.sel];
      carPanel(296, 40, 174, 214, cur && cur.car != null ? cur.car : 0, this.t);
      const help = settings.players === 2
        ? 'P1: WASD Q/E GEARS   P2: ARROWS ,/. GEARS'
        : 'ARROWS/WASD DRIVE  Q/E OR CTRL/SHIFT GEARS';
      text(help, W / 2, 262, 8, '#c0c8ff', 'center');
      text('ESC PAUSE   M MUSIC   F FULLSCREEN', W / 2, 276, 8, '#7080b0', 'center');
    },
  };

  const Recs = {
    sel: 0, editing: false, buf: '', pv: null, track: null, t: 0,
    enter() { this.editing = false; this.refresh(); },
    refresh() {
      this.track = Track.build(recs.params, recs.type === 1 ? { checkpoints: 4, scale: 1.8 } : {});
      this.pv = Track.preview(this.track);
      saveAll();
    },
    rows() {
      const p = recs.params, r = [];
      const set = k => v => { p[k] = v; this.refresh(); };
      r.push({ label: 'SCENERY', opts: THEMES.map(t => t.name), val: p.scenery, set: set('scenery') });
      for (const [k, lab] of [['curves', 'CURVES'], ['sharp', 'SHARPNESS'], ['hills', 'HILLS'], ['steep', 'STEEPNESS'],
        ['scatter', 'SCATTER'], ['obst', 'OBSTACLES'], ['length', 'LENGTH']]) {
        r.push({ label: lab, slider: 15, val: p[k], set: set(k) });
      }
      r.push({ label: 'RACE TYPE', opts: ['RACE (20 CARS)', 'TIME TRIAL'], val: recs.type, set: v => { recs.type = v; this.refresh(); } });
      if (recs.type === 0) r.push({ label: 'LAPS', opts: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], val: recs.laps - 1, set: v => { recs.laps = v + 1; } });
      r.push({ label: 'ENTER CODE', value: this.editing ? this.buf + (blinkOn(this.t, 3) ? '_' : ' ') : '', action: () => { this.editing = true; this.buf = ''; } });
      r.push({ label: 'RANDOMISE', action: () => { recs.params = Track.random(); this.refresh(); } });
      r.push({ label: 'RACE! >', action: () => startSession('recs') });
      r.push({ label: '< BACK', action: () => go(MainMenu) });
      return r;
    },
    update(dt) {
      this.t += dt;
      if (this.editing) {
        for (const ch of Input.typed()) {
          if (ch === '\b') this.buf = this.buf.slice(0, -1);
          else if (/^[a-z]$/i.test(ch) && this.buf.length < 10) { this.buf += ch.toUpperCase(); Sound.fx.tick(); }
        }
        if (Input.pressed('Enter') || Input.pressed('NumpadEnter')) {
          this.editing = false;
          if (this.buf) { recs.params = Track.decode(this.buf); this.refresh(); Sound.fx.select(); }
        } else if (Input.pressed('Escape')) { this.editing = false; Sound.fx.back(); }
        return;
      }
      const rows = this.rows();
      this.sel = Math.min(this.sel, rows.length - 1);
      const m = rowsNav(rows, this);
      if (m.back && !this.editing) { Sound.fx.back(); go(MainMenu); }
    },
    draw(dt) {
      drawAttract(dt, 0.6);
      text('R.E.C.S.', W / 2, 8, 16, '#ffe040', 'center');
      text('RACING ENVIRONMENT CONSTRUCTION SET', W / 2, 27, 8, '#9fb0ff', 'center');
      const rows = this.rows();
      panel(10, 40, 252, 236, 'COURSE DESIGN');
      rowsDraw(rows, this.sel, 16, 62, 240, 14);
      panel(270, 40, 200, 236, 'COURSE PREVIEW');
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(280, 62, 180, 118);
      drawMap(this.pv, 280, 62, 180, 118, '#ffe040');
      text('ELEVATION', 280, 186, 8, '#9fb0ff');
      drawProfile(this.pv, 280, 196, 180, 26);
      text('COURSE CODE', 370, 230, 8, '#9fb0ff', 'center');
      text(this.track.code, 370, 244, 16, '#7fffb0', 'center');
      const km = U.km(this.track.length).toFixed(1);
      text(`${THEMES[recs.params.scenery].name}  ${km} KM`, 370, 262, 8, '#ffffff', 'center');
      text(this.editing ? 'TYPE ANY WORD - IT BECOMES A COURSE!  ENTER TO BUILD' : 'LEFT/RIGHT ADJUST   ENTER SELECT', W / 2, 284, 8, '#c0c8ff', 'center');
    },
  };

  const PreRace = {
    t: 0, vs: {}, pv: null,
    enter() {
      this.t = 0; this.vs = {};
      race = makeRace();
      this.pv = Track.preview(race.track);
      Sound.enginesOff();
    },
    update(dt) {
      this.t += dt;
      const m = Input.menu();
      if (m.ok) { Sound.fx.select(); go(RaceScene); }
      if (m.back) { Sound.fx.back(); go(MainMenu); }
    },
    draw(dt) {
      Render.view(g, { x: 0, y: 0, w: W, h: H }, race, race.humans[0], this.vs, { dt: 0, hud: false });
      g.fillStyle = 'rgba(0,0,20,0.55)'; g.fillRect(0, 0, W, H);
      const th = race.track.theme;
      let head;
      if (session.kind === 'champ') head = `CHAMPIONSHIP ${DIFF_NAMES[session.diff]} - RACE ${session.idx + 1} OF ${session.courses.length}`;
      else if (session.kind === 'time') head = `TIME CHALLENGE ${DIFF_NAMES[session.diff]} - STAGE ${session.idx + 1} OF ${session.courses.length}`;
      else head = 'R.E.C.S. CUSTOM COURSE';
      panel(30, 20, 420, 250, head);
      text(th.name, 150, 46, 24, '#ffffff', 'center');
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(50, 80, 200, 120);
      drawMap(this.pv, 50, 80, 200, 120, '#ffe040');
      drawProfile(this.pv, 50, 206, 200, 22);
      const info = [];
      if (race.mode === 'race') {
        info.push(['LAPS', String(race.laps)], ['CARS', String(race.cars.length)]);
        if (session.kind === 'champ') info.push(['QUALIFY', 'TOP ' + QUALIFY[session.diff]]);
      } else {
        info.push(['CHECKPOINTS', String(race.track.cps.length)], ['START TIME', Math.round(race.legTime[0]) + ' SEC']);
      }
      info.push(['DISTANCE', U.km(race.track.length * race.laps).toFixed(1) + ' KM']);
      if (th.weather || th.wind || th.night || th.fog > 8) {
        info.push(['CONDITIONS', th.night ? 'DARK' : th.weather === 'snow' ? 'SNOW' : th.weather === 'rain' ? 'STORM' : th.wind ? 'GUSTS' : 'FOGGY']);
      }
      const rec = records[recordKey(race)];
      info.push([race.mode === 'race' ? 'LAP RECORD' : 'RECORD', rec ? U.fmtTime(rec) : '--']);
      info.forEach(([a, b], i) => {
        text(a, 268, 84 + i * 18, 8, '#9fb0ff');
        text(b, 436, 84 + i * 18, 8, '#ffe040', 'right');
      });
      text('CODE ' + race.track.code, 352, 210, 8, '#7fffb0', 'center');
      if (blinkOn(this.t)) text('PRESS ENTER TO RACE', W / 2, 244, 8, '#ffffff', 'center');
    },
  };

  const RaceScene = {
    acc: 0, vs: [{}, {}], paused: false, psel: 0,
    enter() { this.acc = 0; this.vs = [{}, {}]; this.paused = false; },
    pauseRows() {
      return [
        { label: 'CONTINUE', action: () => { this.paused = false; } },
        { label: 'RESTART RACE', action: () => { race = makeRace(); this.enter(); } },
        { label: 'QUIT TO MENU', action: () => { Sound.enginesOff(); go(MainMenu); } },
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
      const two = race.humans.length > 1;
      const inputs = race.humans.map((h, i) => Input.player(i, two));
      this.acc += Math.min(dt, 0.1);
      let first = true;
      while (this.acc >= K.STEP) {
        race.update(K.STEP, inputs);
        if (first) { inputs.forEach(i => { i.gearUp = false; i.gearDown = false; }); first = false; }
        this.acc -= K.STEP;
      }
      race.humans.forEach((h, i) => Sound.engine(i, true, Math.max(0.12, h.rpm), h.thr || 0, h.skid, h.rough, two ? (i ? 0.6 : -0.6) : 0));
      if (race.over) { Sound.enginesOff(); go(Results); }
    },
    draw(dt) {
      const opts = { dt: this.paused ? 0 : dt, units: settings.units };
      if (race.humans.length === 1) Render.view(g, { x: 0, y: 0, w: W, h: H }, race, race.humans[0], this.vs[0], opts);
      else {
        const hh = (H - 4) / 2;
        Render.view(g, { x: 0, y: 0, w: W, h: hh }, race, race.humans[0], this.vs[0], opts);
        Render.view(g, { x: 0, y: hh + 4, w: W, h: hh }, race, race.humans[1], this.vs[1], opts);
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

  const Results = {
    t: 0, list: [], lines: [], qualified: true, newRecord: false,
    enter() {
      this.t = 0;
      this.list = race.results();
      const humans = race.humans;
      this.newRecord = false;
      const key = recordKey(race);
      for (const h of humans) {
        const best = race.mode === 'race' ? h.bestLap : h.finished ? h.finishTime : 0;
        if (best && (!records[key] || best < records[key])) { records[key] = best; this.newRecord = true; }
      }
      U.save('lotus3.records', records);
      if (race.mode === 'race' && session.kind === 'champ') {
        this.list.forEach((c, i) => {
          const d = session.drivers.find(x => x.id === c.id);
          c.pts = i < POINTS.length ? POINTS[i] : 0;
          if (d) d.points += c.pts;
        });
        this.qualified = humans.some(h => h.place <= QUALIFY[session.diff]);
      } else if (race.mode === 'time') {
        this.qualified = humans.some(h => h.finished);
      } else this.qualified = true;
    },
    next() {
      if (session.kind === 'recs') { go(Recs); return; }
      if (session.kind === 'champ') { go(Standings); return; }
      if (!this.qualified) { GameEnd.set('GAME OVER', ['OUT OF TIME ON ' + race.track.theme.name, `REACHED STAGE ${session.idx + 1} OF ${session.courses.length}`]); go(GameEnd); return; }
      session.idx++;
      if (session.idx >= session.courses.length) {
        GameEnd.set('CHALLENGE COMPLETE', ['ALL STAGES CLEARED', 'LEVEL ' + DIFF_NAMES[session.diff], 'CONGRATULATIONS!']);
        go(GameEnd);
      } else go(PreRace);
    },
    update(dt) {
      this.t += dt;
      if (Input.menu().ok && this.t > 0.5) { Sound.fx.select(); this.next(); }
    },
    draw(dt) {
      drawAttract(dt, 0.7);
      if (race.mode === 'race') {
        panel(20, 6, 440, 288, `RESULTS - ${race.track.theme.name}`);
        text('POS', 32, 26, 8, '#9fb0ff'); text('DRIVER', 70, 26, 8, '#9fb0ff'); text('CAR', 200, 26, 8, '#9fb0ff');
        text('TIME', 340, 26, 8, '#9fb0ff', 'right');
        if (session.kind === 'champ') text('PTS', 446, 26, 8, '#9fb0ff', 'right');
        const winner = this.list[0];
        this.list.forEach((c, i) => {
          const y = 38 + i * 11.4;
          if (c.human) { g.fillStyle = 'rgba(255,40,160,0.4)'; g.fillRect(28, y - 2, 424, 10); }
          const col = c.human ? '#ffffff' : '#c0c8ff';
          text(String(i + 1).padStart(2, ' '), 32, y, 8, col);
          text(c.name, 70, y, 8, col);
          text(CARSPEC[c.model].short, 200, y, 8, col);
          let tm;
          if (!c.finished) {
            const laps = Math.max(1, Math.ceil((winner.travel - c.travel) / race.L));
            tm = winner.finished ? `+${laps} LAP${laps > 1 ? 'S' : ''}` : '--';
          } else tm = i === 0 ? U.fmtTime(c.finishTime) : '+' + U.fmtTime(c.finishTime - winner.finishTime);
          text(tm, 340, y, 8, col, 'right');
          if (session.kind === 'champ' && c.pts) text(String(c.pts), 446, y, 8, '#ffe040', 'right');
        });
      } else {
        panel(60, 40, 360, 220, `STAGE RESULT - ${race.track.theme.name}`);
        race.humans.forEach((h, i) => {
          const y = 76 + i * 60;
          text(h.name, 80, y, 8, '#ffe040');
          text(h.finished ? 'TIME ' + U.fmtTime(h.finishTime) : 'OUT OF TIME', 80, y + 16, 16, h.finished ? '#ffffff' : '#ff4040');
          text(h.finished ? `TIME LEFT ${Math.ceil(h.timeLeft)} SEC` : `${Math.round((h.travel / race.L) * 100)}% OF STAGE COMPLETED`, 80, y + 38, 8, '#9fb0ff');
        });
      }
      let msg = '';
      if (session.kind === 'champ') msg = this.qualified ? 'QUALIFIED!' : 'NOT QUALIFIED';
      else if (session.kind === 'time') msg = this.qualified ? 'STAGE CLEARED!' : 'GAME OVER';
      if (this.newRecord) msg += (msg ? '  ' : '') + 'NEW RECORD!';
      if (msg && blinkOn(this.t, 1.5)) text(msg, W / 2, race.mode === 'race' ? 270 : 214, 8, this.qualified ? '#7fffb0' : '#ff5050', 'center');
      if (this.t > 0.5) text('ENTER', W / 2, race.mode === 'race' ? 281 : 236, 8, '#ffffff', 'center');
    },
  };

  const Standings = {
    t: 0,
    enter() { this.t = 0; },
    update(dt) {
      this.t += dt;
      if (!(Input.menu().ok && this.t > 0.5)) return;
      Sound.fx.select();
      const sorted = session.drivers.slice().sort((a, b) => b.points - a.points);
      const last = session.idx >= session.courses.length - 1;
      if (!Results.qualified || last) {
        const lines = session.drivers.filter(d => d.human).map(d => `${d.name}: ${U.ordinal(sorted.indexOf(d) + 1)} WITH ${d.points} PTS`);
        if (!Results.qualified) GameEnd.set('GAME OVER', ['FAILED TO QUALIFY'].concat(lines));
        else {
          const champ = sorted[0];
          GameEnd.set(champ.human ? 'CHAMPION!' : 'CHAMPIONSHIP OVER', [`${champ.name} WINS THE ${DIFF_NAMES[session.diff]} TITLE`].concat(lines));
        }
        go(GameEnd);
      } else { session.idx++; go(PreRace); }
    },
    draw(dt) {
      drawAttract(dt, 0.7);
      panel(60, 6, 360, 288, `STANDINGS AFTER RACE ${session.idx + 1}`);
      const sorted = session.drivers.slice().sort((a, b) => b.points - a.points);
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

  const GameEnd = {
    t: 0, title: '', lines: [],
    set(title, lines) { this.title = title; this.lines = lines; },
    enter() { this.t = 0; },
    update(dt) {
      this.t += dt;
      if (Input.menu().ok && this.t > 1) { Sound.fx.select(); go(MainMenu); }
    },
    draw(dt) {
      drawAttract(dt, 0.5);
      text(this.title, W / 2, 80, 24, blinkOn(this.t, 2) ? '#ffe040' : '#ffffff', 'center');
      this.lines.forEach((l, i) => text(l, W / 2, 130 + i * 16, 8, '#ffffff', 'center'));
      if (this.t > 1) text('PRESS ENTER', W / 2, 250, 8, '#c0c8ff', 'center');
    },
  };

  // ------------------------------------------------------------ main loop
  let musicStarted = false;
  Input.onGesture(() => {
    Sound.init();
    if (!musicStarted) { musicStarted = true; Sound.playMusic(settings.music); }
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyF' && !(scene === Recs && Recs.editing)) {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (cv.requestFullscreen) cv.requestFullscreen().catch(() => {});
    }
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    Input.poll();
    scene.update(dt);
    g.imageSmoothingEnabled = false;
    scene.draw(dt);
    Input.endFrame();
    requestAnimationFrame(frame);
  }
  go(Title);
  requestAnimationFrame(frame);
})();
