// Web Audio: synthesized electric motors, sound effects and an original chiptune soundtrack.
export const Sound = (() => {
  let ctx = null, sfx, mus, noise;
  const engines = [];
  let song = null, songIdx = -1, timer = null, step = 0, nextT = 0, wanted = -1;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(comp);
    mus = ctx.createGain(); mus.gain.value = 0.32; mus.connect(comp);
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (wanted >= 0) playMusic(wanted);
  }

  // ---------------------------------------------------------------- electric motors
  // Per player, a sports-EV "drive sound": a deep synth drone (two detuned saws through a resonant low-pass,
  // with a sub octave) that rises steadily with road speed and swells and brightens under power, a motor
  // whine above it, plus wind, tyre squeal and off-road rumble. Near top speed, where the pitch stops rising,
  // the drone softens and a jet layer takes over whose tone keeps moving.
  function makeEngine() {
    const osc = (type, to) => { const o = ctx.createOscillator(); o.type = type; o.connect(to); o.start(); return o; };
    const gain = (v, to) => { const n = ctx.createGain(); n.gain.value = v; if (to) n.connect(to); return n; };
    const filt = (type, freq, q, to) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = q; if (to) n.connect(to); return n; };
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const dest = p || sfx;
    if (p) p.connect(sfx);
    const g = gain(0, dest);
    const f = filt('lowpass', 400, 5, g);                       // the drone's voice: opens up under power
    const gd = gain(0.5, f), gs = gain(0.6, g), gw = gain(0, g);
    const d1 = osc('sawtooth', gd), d2 = osc('sawtooth', gd), sub = osc('sine', gs), wh = osc('sine', gw);
    const lfo = osc('sine', gain(4, d2.detune)); lfo.frequency.value = 0.7; // slow chorus between the saws
    const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true; ns.start();
    const wg = gain(0, dest), sg = gain(0, dest), rg = gain(0, dest);
    const wf = filt('bandpass', 600, 0.6, wg), sf = filt('bandpass', 2400, 1.4, sg), rf = filt('lowpass', 240, 1, rg);
    ns.connect(wf); ns.connect(sf); ns.connect(rf);
    // jet layer, faded in near top speed: a noise roar through a flanger (a feedback delay whose time drifts on two
    // slow LFOs, so the comb keeps sweeping like a passing jet) and a narrow turbine whistle that spools with power
    const jg = gain(0, dest), jf = filt('lowpass', 1200, 0.7), dl = ctx.createDelay(0.05);
    dl.delayTime.value = 0.004;
    dl.connect(gain(0.55, dl)); dl.connect(jg); jf.connect(jg); jf.connect(dl);
    const tg = gain(0, dest), tf = filt('bandpass', 2400, 22, tg);
    ns.connect(jf); ns.connect(tf);
    for (const [rate, dt, cents] of [[0.13, 0.0022, 140], [0.37, 0.0009, 60]]) {
      const l = osc('sine', gain(dt, dl.delayTime)); l.frequency.value = rate;
      l.connect(gain(cents, tf.detune));
    }
    return { d1, d2, sub, wh, lfo, f, g, gd, gw, wf, wg, sg, rg, jf, jg, tf, tg, p };
  }

  // speed: share of the car's top speed (above 1 under super power); load: power drawn, -1..1 (negative is regen)
  function engine(i, on, speed, load, skid, rough, pan) {
    if (!ctx) return;
    while (engines.length <= i) engines.push(makeEngine());
    const e = engines[i], t = ctx.currentTime, sp = Math.max(0, speed), drive = Math.max(0, load), regen = Math.max(0, -load);
    const set = (param, v, tc = 0.05) => param.setTargetAtTime(v, t, tc);
    const fr = 42 + 260 * Math.pow(sp, 0.85);
    const j = Math.min(1, Math.max(0, (sp - 0.6) / 0.4)), jet = j * j * (3 - 2 * j); // drone hands over to the jet
    set(e.d1.frequency, fr, 0.04); set(e.d2.frequency, fr * 1.007, 0.04); set(e.sub.frequency, fr / 2, 0.04);
    set(e.wh.frequency, fr * 6.1, 0.04); // motor whine, well above the drone
    set(e.lfo.frequency, 0.7 + sp * 3);
    set(e.f.frequency, fr * (2.2 + drive * 4) + 180);
    set(e.f.Q, 3 + drive * 5 * (1 - 0.6 * jet));
    set(e.gd.gain, 0.35 + drive * 0.65);
    set(e.gw.gain, (0.05 + sp * 0.08) * (1 - 0.7 * jet) + regen * 0.12);
    set(e.g.gain, on ? (0.05 + sp * 0.03 + drive * 0.07 + regen * 0.02) * (1 - 0.5 * jet) : 0, 0.08);
    set(e.jf.frequency, 700 + sp * 1800 + drive * 600, 0.3);
    set(e.jg.gain, on ? jet * (0.06 + drive * 0.06) : 0, 0.25);
    set(e.tf.frequency, 1500 + sp * 1300 + drive * 700, 0.6); // slow time constant: the turbine spools up and down
    set(e.tg.gain, on ? jet * (0.5 + drive * 0.5) : 0, 0.3);
    set(e.wf.frequency, 400 + sp * 900, 0.1);
    set(e.wg.gain, on ? sp * sp * 0.05 : 0, 0.1);
    set(e.sg.gain, on ? skid * 0.09 : 0, 0.04);
    set(e.rg.gain, on ? rough * 0.35 : 0);
    if (e.p) set(e.p.pan, pan, 0.1);
  }
  function enginesOff() { for (let i = 0; i < engines.length; i++) engine(i, false, 0, 0, 0, 0, 0); }

  // ---------------------------------------------------------------- effects
  function env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, dur, type = 'square', vol = 0.15, when = 0, to = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, vol, dur);
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, vol, type, freq, when = 0, q = 1) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, vol, dur);
    s.connect(f); f.connect(g); g.connect(sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  const fx = {
    beep: () => tone(660, 0.25, 'square', 0.16),
    go: () => tone(1320, 0.6, 'square', 0.18),
    crash: () => { hiss(0.7, 0.6, 'lowpass', 1100); tone(150, 0.45, 'sawtooth', 0.22, 0, 40); hiss(0.25, 0.3, 'highpass', 3500, 0.02); },
    bump: () => { hiss(0.15, 0.35, 'lowpass', 600); tone(90, 0.12, 'sine', 0.3, 0, 50); },
    cone: () => { tone(700, 0.08, 'square', 0.08, 0, 300); hiss(0.1, 0.2, 'bandpass', 1500); },
    splash: () => hiss(0.5, 0.3, 'highpass', 1500),
    jump: () => tone(200, 0.3, 'triangle', 0.14, 0, 500),
    land: () => { hiss(0.2, 0.4, 'lowpass', 400); tone(70, 0.15, 'sine', 0.35, 0, 40); },
    boost: () => tone(300, 0.5, 'sawtooth', 0.1, 0, 1400),
    checkpoint: () => [784, 988, 1319].forEach((f, i) => tone(f, 0.16, 'square', 0.13, i * 0.1)),
    lap: () => [880, 1175].forEach((f, i) => tone(f, 0.18, 'square', 0.13, i * 0.12)),
    finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'square', 0.13, i * 0.13)),
    thunder: () => { hiss(2.6, 0.55, 'lowpass', 160); hiss(0.9, 0.3, 'lowpass', 500, 0.05); },
    tick: () => tone(1000, 0.04, 'square', 0.07),
    select: () => { tone(660, 0.07, 'square', 0.09); tone(990, 0.1, 'square', 0.09, 0.06); },
    back: () => tone(440, 0.09, 'square', 0.09, 0, 300),
    timeout: () => tone(400, 0.9, 'sawtooth', 0.16, 0, 80),
    warn: () => tone(1500, 0.06, 'square', 0.07),
    powerup: () => [660, 880, 1320, 1760].forEach((f, i) => tone(f, 0.1, 'triangle', 0.12, i * 0.05)),
    superboost: () => { tone(160, 0.9, 'sawtooth', 0.14, 0, 1600); hiss(0.8, 0.25, 'bandpass', 2400, 0, 3); },
    zap: () => { tone(1900, 0.3, 'sawtooth', 0.09, 0, 180); hiss(0.35, 0.3, 'bandpass', 3200, 0, 3); tone(2400, 0.08, 'square', 0.05, 0.12, 900); },
    charge: () => { tone(520, 0.18, 'triangle', 0.14, 0, 1560); tone(1040, 0.12, 'square', 0.06, 0.08, 2080); },
  };

  // ---------------------------------------------------------------- music
  const NOTE = { c: 0, 'c#': 1, d: 2, 'd#': 3, e: 4, f: 5, 'f#': 6, g: 7, 'g#': 8, a: 9, 'a#': 10, b: 11 };
  const midi = n => { const m = /^([a-g]#?)(\d)$/.exec(n); return 12 * (+m[2] + 1) + NOTE[m[1]]; };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // All melodies are original compositions for this game.
  const SONGS = [
    {
      name: 'TURBO DRIVE', bpm: 150, chords: 'Am F C G Am F G E',
      lead: 'e5:2 a5:2 e5:2 c5:2 a4:4 c5:2 e5:2  f5:4 e5:2 c5:2 a4:4 c5:4  g5:2 e5:2 c5:2 e5:2 g5:4 c6:4  b5:4 a5:2 g5:2 d5:4 r:4 ' +
        'a5:2 c6:2 b5:2 a5:2 e5:4 a5:4  c6:4 a5:2 f5:2 c5:4 f5:4  d6:2 b5:2 g5:2 d5:2 g5:2 a5:2 b5:4  g#5:4 b5:4 e6:6 r:2',
      bass: [0, null, 12, null, 0, 0, 12, null, 0, null, 12, null, 0, 7, 12, null],
      kick: 'x---x---x---x-x-', snare: '----x-------x---', hat: '-x-x-x-x-x-x-x-x',
    },
    {
      name: 'NEON HIGHWAY', bpm: 126, chords: 'D Bm G A D Bm G A',
      lead: 'f#5:6 e5:2 d5:4 a4:4  b4:4 d5:2 f#5:2 e5:6 d5:2  d5:4 b4:4 g4:2 b4:2 d5:4  c#5:6 e5:2 a5:8 ' +
        'a5:4 f#5:2 a5:2 b5:4 a5:4  f#5:4 d5:2 f#5:2 b5:8  g5:2 f#5:2 e5:2 d5:2 b4:4 d5:4  e5:4 c#5:4 a4:8',
      bass: [0, null, 0, 12, null, 0, 12, null, 0, null, 0, 12, null, 0, 12, 7],
      kick: 'x-------x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-',
    },
    {
      name: 'FINAL LAP', bpm: 168, chords: 'Em C D B Em C D B',
      lead: 'e5:2 e5:1 r:1 b4:2 e5:2 g5:2 f#5:2 e5:2 d5:2  e5:2 e5:1 r:1 c5:2 e5:2 g5:4 a5:4  f#5:2 f#5:1 r:1 d5:2 f#5:2 a5:2 g5:2 f#5:2 e5:2  d#5:4 f#5:4 b5:4 a5:2 f#5:2 ' +
        'g5:2 b5:2 e6:4 d6:2 b5:2 g5:4  e6:2 d6:2 c6:2 b5:2 a5:4 g5:4  f#5:2 a5:2 d6:4 c6:2 a5:2 f#5:4  d#5:2 f#5:2 a5:2 b5:2 d#6:8',
      bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 0, 12, 0],
      kick: 'x--x--x-x--x--x-', snare: '----x-------x--x', hat: 'xxxxxxxxxxxxxxxx',
    },
    { // late-Amiga title-screen style: galloping octave bass, brassy saw lead, a chorus that lifts
      name: 'HIGH VOLTAGE', bpm: 140, wave: 'sawtooth', chords: 'Am Am F G Am Am F E F G Em Am F G E E',
      lead: 'a4:4 c5:2 e5:2 a5:6 g5:2  e5:2 a5:2 c6:4 b5:2 a5:2 g5:4  a5:6 f5:2 c5:4 f5:4  g5:6 d5:2 b4:4 d5:2 g5:2 ' +
        'a5:2 g5:2 e5:2 c5:2 e5:4 a5:4  c6:4 b5:2 a5:2 e6:8  d6:2 c6:2 a5:4 f5:4 a5:4  g#5:6 e5:2 b5:8 ' +
        'c6:6 a5:2 f5:4 c6:4  d6:6 b5:2 g5:4 d6:4  e6:4 d6:2 b5:2 g5:4 b5:4  c6:2 b5:2 a5:4 e5:4 a5:4 ' +
        'a5:2 c6:2 f6:4 e6:2 c6:2 a5:4  b5:2 d6:2 g6:4 f6:2 d6:2 b5:4  g#5:4 b5:4 e6:4 d6:2 b5:2  g#5:8 e5:4 r:4',
      bass: [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 7, 12],
      kick: 'x-----x-x-x-----', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-xx',
    },
  ];
  function compile(s) {
    const ch = s.chords.split(' ').map(c => {
      const m = /^([A-G]#?)(m?)$/.exec(c);
      return { root: NOTE[m[1].toLowerCase()], minor: !!m[2] };
    });
    const steps = ch.length * 16, lead = new Array(steps).fill(null);
    let pos = 0;
    for (const tok of s.lead.trim().split(/\s+/)) {
      const [n, d] = tok.split(':');
      if (n !== 'r' && pos < steps) lead[pos] = { m: midi(n), d: +d };
      pos += +d;
    }
    return Object.assign({}, s, { ch, steps, leadEv: lead });
  }
  const COMPILED = SONGS.map(compile);

  function voice(type, freq, t, dur, vol, cutoff, vib) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5; lg.gain.value = freq * 0.012;
      l.connect(lg); lg.connect(o.frequency); l.start(t + 0.12); l.stop(t + dur + 0.1);
    }
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, t + Math.min(dur, 0.15));
    g.gain.setValueAtTime(vol * 0.6, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(f); f.connect(g); g.connect(mus);
    o.start(t); o.stop(t + dur + 0.1);
  }
  function drum(kind, t) {
    if (kind === 'k') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.2);
      return;
    }
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    const dur = kind === 's' ? 0.14 : 0.035;
    f.type = 'highpass'; f.frequency.value = kind === 's' ? 1200 : 7000;
    g.gain.setValueAtTime(kind === 's' ? 0.5 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(mus);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
    if (kind === 's') voice('triangle', 190, t, 0.06, 0.25, 2000);
  }
  function playStep(i, t) {
    const S = song, sp = 60 / S.bpm / 4, n = i % 16;
    const c = S.ch[Math.floor(i / 16) % S.ch.length];
    const b = S.bass[n];
    if (b !== null) {
      let root = 36 + c.root; if (c.root >= 7) root -= 12;
      voice('square', hz(root + b), t, sp * 1.5, 0.16, 700);
    }
    const tones = [0, c.minor ? 3 : 4, 7, 12, 7, c.minor ? 3 : 4];
    voice('square', hz(60 + c.root + tones[n % tones.length]), t, sp * 0.7, 0.035, 2400);
    const L = S.leadEv[i % S.steps];
    if (L) voice(S.wave || 'square', hz(L.m), t, sp * L.d * 0.92, S.wave ? 0.06 : 0.075, S.wave ? 2600 : 3200, L.d >= 4);
    if (S.kick[n] === 'x') drum('k', t);
    if (S.snare[n] === 'x') drum('s', t);
    if (S.hat[n] === 'x') drum('h', t);
  }
  function schedule() {
    if (!song) return;
    while (nextT < ctx.currentTime + 0.15) {
      playStep(step, nextT);
      nextT += 60 / song.bpm / 4;
      step = (step + 1) % song.steps;
    }
  }
  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null; song = null;
  }
  function playMusic(i) {
    wanted = i;
    if (!ctx) return;
    if (i === songIdx && song) return;
    stopMusic();
    songIdx = i;
    if (i < 0 || i >= COMPILED.length) { songIdx = -1; return; }
    song = COMPILED[i]; step = 0; nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }

  return { init, engine, enginesOff, fx, playMusic, stopMusic, songs: SONGS.map(s => s.name) };
})();
