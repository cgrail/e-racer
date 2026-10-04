import { U } from './util.js';

// Keyboard + gamepad input. Uses KeyboardEvent.code so bindings are layout independent.
export const Input = (() => {
  const down = new Set();
  const pressed = new Set();
  const typed = [];
  let pads = [], padPrev = [], padNow = [];
  const gestureHandlers = [];
  let auto = false; // touch controls: the car accelerates by itself unless braking

  const P1 = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], power: ['Space'], shock: ['KeyE'] };
  const P2 = {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    power: ['Enter', 'NumpadEnter', 'Numpad0'], shock: ['Period', 'ShiftRight', 'Numpad1'],
  };
  const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);

  function gesture() { gestureHandlers.forEach(fn => fn()); }

  window.addEventListener('keydown', e => {
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    if (e.key.length === 1) typed.push(e.key);
    else if (e.key === 'Backspace') typed.push('\b');
    if (BLOCK.has(e.code)) e.preventDefault();
    gesture();
  });
  window.addEventListener('keyup', e => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
  window.addEventListener('pointerdown', gesture);

  const any = codes => codes.some(c => down.has(c));
  const anyPressed = codes => codes.some(c => pressed.has(c));

  function poll() {
    const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(p => p && p.connected) : [];
    padPrev = padNow;
    padNow = list.map(p => p.buttons.map(b => b.pressed));
    pads = list;
  }
  const padBtn = (i, b) => !!(padNow[i] && padNow[i][b]);
  const padHit = (i, b) => padBtn(i, b) && !(padPrev[i] && padPrev[i][b]);
  const padVal = (i, b) => (pads[i] && pads[i].buttons[b] ? pads[i].buttons[b].value : 0);

  // Driving controls for player idx. In one-player mode both key sets drive player 1.
  function player(idx, twoPlayers) {
    const maps = twoPlayers ? [idx === 0 ? P1 : P2] : [P1, P2];
    let up = false, dn = false, l = false, r = false, pw = false, sh = false;
    for (const m of maps) {
      up = up || any(m.up); dn = dn || any(m.down); l = l || any(m.left); r = r || any(m.right);
      pw = pw || anyPressed(m.power); sh = sh || anyPressed(m.shock);
    }
    let throttle = up || (auto && idx === 0 && !dn) ? 1 : 0, brake = dn ? 1 : 0, steer = (r ? 1 : 0) - (l ? 1 : 0), analog = false;
    const p = twoPlayers ? idx : 0;
    if (pads[p]) {
      const ax = pads[p].axes[0] || 0;
      if (Math.abs(ax) > 0.15) { steer = U.clamp((ax - Math.sign(ax) * 0.15) / 0.85, -1, 1); analog = true; }
      if (padBtn(p, 14)) steer = -1;
      if (padBtn(p, 15)) steer = 1;
      throttle = Math.max(throttle, padBtn(p, 0) ? 1 : 0, padVal(p, 7), padBtn(p, 12) ? 1 : 0);
      brake = Math.max(brake, padBtn(p, 1) ? 1 : 0, padVal(p, 6), padBtn(p, 13) ? 1 : 0);
      pw = pw || padHit(p, 2) || padHit(p, 5);
      sh = sh || padHit(p, 3) || padHit(p, 4);
    }
    return { throttle, brake, steer, analog, power: pw, shock: sh };
  }

  // Edge-triggered menu navigation from any keyboard set or pad.
  function menu() {
    const m = {
      up: anyPressed(['ArrowUp', 'KeyW']), down: anyPressed(['ArrowDown', 'KeyS']),
      left: anyPressed(['ArrowLeft', 'KeyA']), right: anyPressed(['ArrowRight', 'KeyD']),
      ok: anyPressed(['Enter', 'Space', 'NumpadEnter']), back: anyPressed(['Escape', 'Backspace']),
      pause: anyPressed(['Escape', 'KeyP']),
    };
    for (let i = 0; i < pads.length; i++) {
      m.up = m.up || padHit(i, 12); m.down = m.down || padHit(i, 13);
      m.left = m.left || padHit(i, 14); m.right = m.right || padHit(i, 15);
      m.ok = m.ok || padHit(i, 0) || padHit(i, 9); m.back = m.back || padHit(i, 1);
      m.pause = m.pause || padHit(i, 9);
    }
    return m;
  }

  function endFrame() { pressed.clear(); typed.length = 0; }

  // On-screen buttons (game/touch.js) hold and release key codes like a keyboard would.
  function virtual(code, on) {
    if (on && !down.has(code)) pressed.add(code);
    if (on) down.add(code); else down.delete(code);
  }

  return {
    poll, player, menu, endFrame, virtual,
    setAuto: v => { auto = v; },
    type: s => typed.push(...s),
    pressed: code => pressed.has(code),
    typed: () => typed.slice(),
    onGesture: fn => gestureHandlers.push(fn),
  };
})();
