import { U } from '../core/util.js';
import { settings, saveAll } from './state.js';

// On a phone, a new player's name is asked on a plain page of its own, upright and over everything (NameEntry on
// touch): typing on the canvas, turned sideways under the keyboard, was awkward. START keeps the name once there is
// one, SKIP goes on without it; either removes the page and calls done(named). Typing here isn't game input, so
// its keys stop at the form. Returns false where there is no page to show (the headless smoke test).
export function askName(done) {
  if (typeof document === 'undefined' || !document.body) return false;
  const f = document.createElement('form');
  f.className = 'ask';
  f.innerHTML = `<div class="logo">ELECTRO CAR RACER</div><div class="hi">WELCOME, NEW RACER!</div>
    <label for="ask-name">WHAT SHOULD WE CALL YOU?</label>
    <input id="ask-name" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" autocorrect="off"
      spellcheck="false" enterkeyhint="go">
    <div class="note">UP TO 6 LETTERS AND DIGITS. IT GOES ON YOUR NUMBER PLATE AND IN THE RESULTS.</div>
    <button type="submit" class="go">START</button><button type="button" class="skip">SKIP</button>`;
  document.body.appendChild(f);
  const input = f.querySelector('input');
  input.value = settings.names[0];
  const clean = () => { const v = U.plateName(input.value); if (v !== input.value) input.value = v; };
  input.addEventListener('input', e => { if (!e.isComposing) clean(); }); // a word still being composed is left alone
  input.addEventListener('compositionend', clean);
  f.addEventListener('keydown', e => e.stopPropagation());
  const close = name => {
    if (name) { settings.names[0] = name; saveAll(); }
    input.blur(); f.remove();
    if (window.scrollTo) window.scrollTo(0, 0); // iOS may have moved the page for the keyboard
    done(!!name);
  };
  f.addEventListener('submit', e => {
    e.preventDefault();
    const name = U.plateName(input.value);
    if (name) close(name); else input.focus();
  });
  f.querySelector('.skip').addEventListener('click', () => close(''));
  return true;
}
