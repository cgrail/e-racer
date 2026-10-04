// Web Audio: synthesized engines, sound effects and an original chiptune soundtrack.
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

  // ---------------------------------------------------------------- engines
  function makeEngine() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const dest = p || sfx;
    if (p) p.connect(sfx);
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(dest);
    const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true;
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2400; sf.Q.value = 1.4;
    const sg = ctx.createGain(); sg.gain.value = 0;
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 240;
    const rg = ctx.createGain(); rg.gain.value = 0;
    ns.connect(sf); sf.connect(sg); sg.connect(dest);
    ns.connect(rf); rf.connect(rg); rg.connect(dest);
    o1.start(); o2.start(); ns.start();
    return { o1, o2, f, g, sg, rg, p };
  }

  function engine(i, on, rpm, thr, skid, rough, pan) {
    if (!ctx) return;
    while (engines.length <= i) engines.push(makeEngine());
    const e = engines[i], t = ctx.currentTime;
    const fr = 32 + rpm * 150;
    e.o1.frequency.setTargetAtTime(fr, t, 0.025);
    e.o2.frequency.setTargetAtTime(fr * 0.5 + 0.7, t, 0.025);
    e.f.frequency.setTargetAtTime(250 + rpm * 700 + thr * 900, t, 0.04);
    e.g.gain.setTargetAtTime(on ? 0.06 + thr * 0.06 : 0, t, 0.05);
    e.sg.gain.setTargetAtTime(on ? skid * 0.09 : 0, t, 0.04);
    e.rg.gain.setTargetAtTime(on ? rough * 0.35 : 0, t, 0.05);
    if (e.p) e.p.pan.setTargetAtTime(pan, t, 0.1);
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
    gear: () => hiss(0.05, 0.12, 'bandpass', 900, 0, 2),
    checkpoint: () => [784, 988, 1319].forEach((f, i) => tone(f, 0.16, 'square', 0.13, i * 0.1)),
    lap: () => [880, 1175].forEach((f, i) => tone(f, 0.18, 'square', 0.13, i * 0.12)),
    finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'square', 0.13, i * 0.13)),
    thunder: () => { hiss(2.6, 0.55, 'lowpass', 160); hiss(0.9, 0.3, 'lowpass', 500, 0.05); },
    tick: () => tone(1000, 0.04, 'square', 0.07),
    select: () => { tone(660, 0.07, 'square', 0.09); tone(990, 0.1, 'square', 0.09, 0.06); },
    back: () => tone(440, 0.09, 'square', 0.09, 0, 300),
    timeout: () => tone(400, 0.9, 'sawtooth', 0.16, 0, 80),
    warn: () => tone(1500, 0.06, 'square', 0.07),
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
    if (L) voice('square', hz(L.m), t, sp * L.d * 0.92, 0.075, 3200, L.d >= 4);
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
