import { U } from '../core/util.js';
import { Input } from '../core/input.js';
import { Sound } from '../audio/sound.js';
import { game } from './state.js';
import { SLIDER, rowSet, rowStep, rowAct } from './ui.js';

// Menus on a touch screen, laid out like mech.grails.de: a page of plain HTML over the game instead of rows on the
// canvas, landscape like the game and turned with it on a phone held upright, so the phone never has to turn
// between menus and races. A nav bar with the way back (it presses Esc), the title and, where the scene has
// instructions, a HELP button that shows them over the page. Below it, two columns sized to fit without scrolling:
// the settings on the left, and on the right what they are for (the car, the course), with the go buttons pinned
// under it, the first one green. A page with nothing on the right is one column in the middle, its buttons below.
// A scene with a menu has page(), built from its rows (game/ui.js):
//   { title, over, help, cards: [{ head, ico, side, pic, lines, bars, rows, note }], go: [rows], foot }
// side: 'right' puts a card in the right column; help: [[button, style, text]] (TOUCH_DRIVE); over: the page lets
// the race show through (the pause menu). pic: { w, h, key, draw(ctx), fill } is drawn again when its key changes
// (fill: as wide as the card, smoothed; otherwise pixel art at 1.25x); lines: [[text, colour, big]]; bars:
// [[label, 0..1]]. An option or slider row is ◂ LABEL VALUE ▸, a row with a field is a text box, an action row is a
// button.
// Touch.update hands the scene's page over every frame. A card is built again only when its parts change; its rows
// are matched by label, so rows come and go around the others and a field keeps the keyboard meanwhile.
let page = null, stage = null, over = false, title = null, helpBtn = null, cols = null, left = null, right = null;
let foot = null, helpBox = null, helpOn = false, cards = [], footer = null;

function el(tag, cls, parent, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (parent) parent.appendChild(e);
  return e;
}
// Text and colour, written only when they change (this runs every frame).
function put(e, txt, col) {
  if (e.txt !== txt) { e.txt = txt; e.textContent = txt; }
  if (col && e.col !== col) { e.col = col; e.style.color = col; }
}
const tidy = label => label.replace(/^< | >$/g, '');
const kind = r => (r.field ? 'f' : r.slider != null ? 's' : r.opts ? 'o' : r.action ? 'a' : 'v');
const side = c => (c.side === 'right' ? 'right' : 'left');
const shape = c => [c.head, c.ico, !!c.pic, !!c.lines, !!c.bars, !!c.rows, c.note != null].join('|');

// A tap does its thing, then the page catches up at once (the next tap may come before the next frame).
function tap(b, fn) { b.addEventListener('click', e => { fn(e); sync(); }); }
function sync() { if (page) render(game.scene.page ? game.scene.page() : null); }
function back() { Input.virtual('Escape', true); Input.virtual('Escape', false); }

// ◂ LABEL VALUE ▸: the arrows step the value; the middle steps an option on, or sets a slider to where it is tapped.
function option(ref) {
  const o = el('div', 'opt');
  const prev = el('button', 'step', o, '◂'), main = el('button', 'main', o), next = el('button', 'step', o, '▸');
  el('span', 'k', main, tidy(ref.row.label));
  const v = el('span', 'v', main);
  prev.setAttribute('aria-label', 'Previous'); next.setAttribute('aria-label', 'Next');
  tap(prev, () => rowStep(ref.row, -1));
  tap(next, () => rowStep(ref.row, 1));
  if (ref.row.slider == null) {
    tap(main, () => rowStep(ref.row, 1));
    return { node: o, show: r => put(v, r.opts[r.val] || '') };
  }
  v.className = 'v notches';
  const marks = Array.from({ length: ref.row.slider }, () => el('i', '', v));
  tap(main, e => { // turned a quarter clockwise with the stage, the slider runs down the screen
    const b = v.getBoundingClientRect(), f = b.height > b.width ? (e.clientY - b.top) / b.height : (e.clientX - b.left) / b.width;
    if (f > -0.1) rowSet(ref.row, Math.round(U.clamp(f, 0, 1) * ref.row.slider));
  });
  let shown = -1;
  return { node: o, show: r => {
    if (r.val === shown) return;
    shown = r.val;
    marks.forEach((m, k) => { m.style.background = k < r.val ? SLIDER(k) : ''; });
  } };
}
// LABEL [text]: what is typed is cleaned up as it comes (a word still being composed is left alone) and kept once
// the keyboard closes. Its keys stop here: they aren't game input, and F isn't fullscreen.
function field(ref) {
  const o = el('label', 'opt field'), m = el('span', 'main', o);
  el('span', 'k', m, tidy(ref.row.label));
  const inp = el('input', 'v', m), f = () => ref.row.field;
  Object.assign(inp, { type: 'text', autocomplete: 'off', spellcheck: false });
  for (const [k, v] of [['autocapitalize', 'characters'], ['autocorrect', 'off'], ['enterkeyhint', 'done']]) inp.setAttribute(k, v);
  const clean = () => { const v = f().clean(inp.value); if (v !== inp.value) inp.value = v; };
  inp.addEventListener('input', e => { if (!e.isComposing) clean(); });
  inp.addEventListener('compositionend', clean);
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') inp.value = f().value;
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); inp.blur(); }
  });
  inp.addEventListener('change', () => { clean(); f().apply(inp.value); Sound.fx.select(); sync(); });
  inp.addEventListener('blur', () => { if (window.scrollTo) window.scrollTo(0, 0); }); // iOS may have moved the page for the keyboard
  return { node: o, show: r => {
    if (inp.placeholder !== r.field.hint) inp.placeholder = r.field.hint;
    if (document.activeElement !== inp && inp.value !== r.field.value) inp.value = r.field.value;
  } };
}
function row(r0) {
  const ref = { row: r0 }, k = kind(r0);
  let made;
  if (k === 'f') made = field(ref);
  else if (k === 'o' || k === 's') made = option(ref);
  else if (k === 'a') { const b = el('button', 'act', null, tidy(r0.label)); tap(b, () => rowAct(ref.row)); made = { node: b, show: () => {} }; }
  else {
    const o = el('div', 'opt'), m = el('div', 'main', o);
    el('span', 'k', m, tidy(r0.label));
    const v = el('span', 'v', m);
    made = { node: o, show: r => put(v, r.value || '') };
  }
  return { node: made.node, show: r => { ref.row = r; made.show(r); } };
}
// A card's rows, matched by kind and label: new ones go in where they belong and gone ones go, and the rest stay
// where they are (rows come and go but never trade places).
function rows(body) {
  const box = el('div', 'rows', body);
  let have = new Map();
  return c => {
    const next = new Map();
    let after = null;
    for (let i = c.rows.length - 1; i >= 0; i--) {
      const r = c.rows[i], key = kind(r) + r.label;
      let h = have.get(key);
      if (!h) { h = row(r); box.insertBefore(h.node, after); }
      h.show(r);
      next.set(key, h);
      after = h.node;
    }
    for (const [key, h] of have) if (!next.has(key)) h.node.remove();
    have = next;
  };
}

function pic(body) {
  const cv = el('canvas', '', el('div', 'pic', body));
  let key = null;
  return c => {
    const p = c.pic;
    if (p.key === key) return;
    key = p.key;
    const s = p.fill ? 2 : 1;
    cv.width = p.w * s; cv.height = p.h * s;
    cv.className = p.fill ? 'fill' : '';
    if (!p.fill) cv.style.width = p.w * 1.25 + 'px';
    const x = cv.getContext('2d');
    x.setTransform(s, 0, 0, s, 0, 0);
    x.imageSmoothingEnabled = !!p.fill;
    p.draw(x);
  };
}
function lines(body) {
  const box = el('div', 'lines', body);
  let ns = [];
  return c => {
    if (ns.length !== c.lines.length) { box.replaceChildren(); ns = c.lines.map(l => el('div', l[2] ? 'big' : '', box)); }
    c.lines.forEach(([t, col], i) => put(ns[i], t, col));
  };
}
function bars(body) {
  const box = el('div', 'bars', body);
  let ns = [];
  return c => {
    if (ns.length !== c.bars.length) {
      box.replaceChildren();
      ns = c.bars.map(() => { const b = el('div', 'bar', box); return [el('span', '', b), el('i', '', el('span', '', b))]; });
    }
    c.bars.forEach(([k, v], i) => {
      const w = Math.round(U.clamp(v, 0, 1) * 100) + '%', fill = ns[i][1];
      put(ns[i][0], k);
      if (fill.w !== w) { fill.w = w; fill.style.width = w; }
    });
  };
}
function card(c) {
  const node = el('div', 'card'), parts = [];
  if (c.head) { const h = el('div', 'head', node); if (c.ico) el('span', 'ico', h, c.ico); el('span', '', h, c.head); }
  const body = el('div', 'body', node);
  if (c.pic) parts.push(pic(body));
  if (c.lines) parts.push(lines(body));
  if (c.bars) parts.push(bars(body));
  if (c.rows) parts.push(rows(body));
  if (c.note != null) { const n = el('div', 'note', body); parts.push(c2 => put(n, c2.note)); }
  return { node, shape: shape(c), side: side(c), show: c2 => parts.forEach(f => f(c2)) };
}
function buttons(spec) {
  const sh = spec.go.map(r => r.label).join('|') + '|' + (spec.foot || '');
  if (footer && footer.shape === sh) { footer.refs.forEach((ref, i) => { ref.row = spec.go[i]; }); return; }
  foot.replaceChildren();
  const refs = spec.go.map((r, i) => {
    const ref = { row: r };
    tap(el('button', i ? 'alt' : 'go', foot, tidy(r.label)), () => rowAct(ref.row));
    return ref;
  });
  if (spec.foot) el('div', 'sub', foot, spec.foot);
  footer = { shape: sh, refs };
}
// The instructions, over the page until GOT IT or back.
function help(on, list) {
  helpOn = on;
  helpBox.replaceChildren();
  helpBox.className = on ? 'helpbox on' : 'helpbox';
  if (!on) return;
  const c = el('div', 'card', helpBox), h = el('div', 'head', c);
  el('span', 'ico', h, '📋'); el('span', '', h, 'HOW TO DRIVE');
  const tips = el('div', 'help', el('div', 'body', c));
  for (const [chip, style, txt] of list) { const t = el('div', 'tip', tips); el('span', 'chip ' + style, t, chip); el('span', '', t, txt); }
  tap(el('button', 'go', helpBox, 'GOT IT'), () => help(false));
}
// The page's frame: nav bar, the two columns and the buttons, and the instructions over them. A new title is a new
// page, scrolled to the top.
function frame(spec) {
  if (page) page.remove();
  over = !!spec.over; title = spec.title; cards = []; footer = null; helpOn = false;
  page = el('div', 'page' + (over ? ' over' : ''), stage);
  const nav = el('div', 'nav', page), b = el('button', 'back', nav, '◂');
  b.setAttribute('aria-label', 'Back');
  tap(b, () => (helpOn ? help(false) : back()));
  el('div', 'title', nav, spec.title);
  helpBtn = el('button', 'helps', nav, '? HELP');
  tap(helpBtn, () => help(!helpOn, game.scene.page().help));
  cols = el('div', 'cols', page);
  left = el('div', 'side left', cols); right = el('div', 'side right', cols); foot = el('div', 'foot', cols);
  helpBox = el('div', 'helpbox', page);
}
function render(spec) {
  if (!spec) { if (page) page.remove(); page = null; return; }
  if (!page || !!spec.over !== over || spec.title !== title) frame(spec);
  const tops = [left.scrollTop, right.scrollTop]; // where the columns were scrolled to, kept as cards come and go
  let from = spec.cards.findIndex((c, i) => !cards[i] || cards[i].side !== side(c)); // cards from here on are new
  if (from < 0) from = spec.cards.length;
  cards.splice(from).forEach(c => c.node.remove());
  spec.cards.forEach((c, i) => {
    const old = cards[i];
    if (!old || old.shape !== shape(c)) {
      cards[i] = card(c);
      if (old) old.node.replaceWith(cards[i].node); else (side(c) === 'right' ? right : left).appendChild(cards[i].node);
    }
    cards[i].show(c);
  });
  if (left.scrollTop !== tops[0]) left.scrollTop = tops[0];
  if (right.scrollTop !== tops[1]) right.scrollTop = tops[1];
  const cc = spec.cards.some(c => side(c) === 'right') ? 'cols' : 'cols one'; // nothing on the right: one column
  if (cols.className !== cc) cols.className = cc;
  const hc = spec.help ? 'helps' : 'helps none';
  if (helpBtn.className !== hc) helpBtn.className = hc;
  if (helpOn && !spec.help) help(false);
  buttons(spec);
}

export const Page = {
  // Shows the current scene's page in the stage element, if it has one and show is set, or takes the page away.
  // Returns whether a page is up.
  update(show, stageEl) {
    stage = stageEl;
    render(show && game.scene.page ? game.scene.page() : null);
    return !!page;
  },
  // Whether a page hides the whole canvas (one that isn't over the race), so the game needn't draw it.
  covers() { return !!page && !over; },
};
