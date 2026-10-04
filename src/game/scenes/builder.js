import { U } from '../../core/util.js';
import { Input } from '../../core/input.js';
import { Sound } from '../../audio/sound.js';
import { THEMES } from '../../world/themes.js';
import { Track } from '../../world/track.js';
import { g, W, text } from '../screen.js';
import { custom, saveAll, go } from '../state.js';
import { panel, rowsDraw, rowsNav, drawMap, drawProfile, blinkOn, TOUCH_HELP, TOUCH_TYPE } from '../ui.js';
import { drawAttract } from '../attract.js';
import { startSession } from '../session.js';

// Course builder: sliders, scenery, race type, course codes and a live course preview.
export const Builder = {
  sel: 0, editing: false, buf: '', pv: null, track: null, t: 0,
  enter() { this.editing = false; this.refresh(); },
  refresh() {
    this.track = Track.build(custom.params, custom.type === 1 ? { checkpoints: 4, scale: 1.8 } : {});
    this.pv = Track.preview(this.track);
    saveAll();
  },
  rows() {
    const p = custom.params, r = [];
    const set = k => v => { p[k] = v; this.refresh(); };
    r.push({ label: 'SCENERY', opts: THEMES.map(t => t.name), val: p.scenery, set: set('scenery') });
    for (const [k, lab] of [['curves', 'CURVES'], ['sharp', 'SHARPNESS'], ['hills', 'HILLS'], ['steep', 'STEEPNESS'],
      ['scatter', 'SCATTER'], ['obst', 'OBSTACLES'], ['length', 'LENGTH']]) {
      r.push({ label: lab, slider: 15, val: p[k], set: set(k) });
    }
    r.push({ label: 'RACE TYPE', opts: ['RACE (20 CARS)', 'TIME TRIAL'], val: custom.type, set: v => { custom.type = v; this.refresh(); } });
    if (custom.type === 0) r.push({ label: 'LAPS', opts: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], val: custom.laps - 1, set: v => { custom.laps = v + 1; } });
    r.push({ label: 'ENTER CODE', value: this.editing ? this.buf + (blinkOn(this.t, 3) ? '_' : ' ') : '', action: () => { this.editing = true; this.buf = ''; } });
    r.push({ label: 'RANDOMISE', action: () => { custom.params = Track.random(); this.refresh(); } });
    r.push({ label: 'RACE! >', action: () => startSession('custom') });
    r.push({ label: '< BACK', action: () => go('MainMenu') });
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
        if (this.buf) { custom.params = Track.decode(this.buf); this.refresh(); Sound.fx.select(); }
      } else if (Input.pressed('Escape')) { this.editing = false; Sound.fx.back(); }
      return;
    }
    const rows = this.rows();
    this.sel = Math.min(this.sel, rows.length - 1);
    const m = rowsNav(rows, this);
    if (m.back && !this.editing) { Sound.fx.back(); go('MainMenu'); }
  },
  draw(dt) {
    drawAttract(dt, 0.6);
    text('COURSE BUILDER', W / 2, 8, 16, '#ffe040', 'center');
    text('DESIGN YOUR OWN TRACK', W / 2, 27, 8, '#9fb0ff', 'center');
    const rows = this.rows();
    panel(10, 40, 252, 236, 'COURSE DESIGN');
    rowsDraw(rows, this.sel, 16, 62, 240, 14, 196);
    panel(270, 40, 200, 236, 'COURSE PREVIEW');
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(280, 62, 180, 118);
    drawMap(this.pv, 280, 62, 180, 118, '#ffe040');
    text('ELEVATION', 280, 186, 8, '#9fb0ff');
    drawProfile(this.pv, 280, 196, 180, 26);
    text('COURSE CODE', 370, 230, 8, '#9fb0ff', 'center');
    text(this.track.code, 370, 244, 16, '#7fffb0', 'center');
    const km = U.km(this.track.length).toFixed(1);
    text(`${THEMES[custom.params.scenery].name}  ${km} KM`, 370, 262, 8, '#ffffff', 'center');
    const touch = Input.touch();
    const help = this.editing ? (touch ? TOUCH_TYPE : 'TYPE ANY WORD - IT BECOMES A COURSE!  ENTER TO BUILD') : touch ? TOUCH_HELP : 'LEFT/RIGHT ADJUST   ENTER SELECT';
    text(help, W / 2, 284, 8, '#c0c8ff', 'center');
  },
};
