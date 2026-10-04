# Electro Car Racer

A browser racing game in the style of the 80s/90s pseudo-3D racers: split-screen two-player, championship, time challenge and a course builder. It's plain JavaScript (ES modules) on an HTML5 canvas, built with Vite, with no runtime dependencies. Every graphic, sound and song is generated in code, so there are no asset files.

The repo folder is still called `lotus-remake`, because the project began as a Lotus III tribute. The game no longer references Lotus anywhere, and nothing new should either: no Lotus names, cars, "R.E.C.S." or "Ultimate Challenge".

## Running and checking

- `npm run dev` starts the dev server, `npm run build` builds into `dist/` (relative `base`, so it can be hosted anywhere), and `npm run preview` serves the build. ES modules don't load from `file://`, so opening `index.html` directly no longer works.
- After every change, run these from the repo root:
  - `npm run check` syntax-checks every module under `src/`.
  - `npm run smoke` is a headless run in Node with stubbed DOM, canvas and storage (`scripts/smoke.js`). It builds, races and renders every scenery and every car frame, then drives the real key handlers through title → menu → championship → 2P time challenge → course-builder race, asserting the active scene via `window.__ecr`. It catches import, runtime and flow errors, not visual ones. Extend it when you add a scene or flow.
  - `npm run build` confirms that Vite bundles cleanly.
- The user does all in-browser testing, so never launch a browser or headless Chrome. After each change, list the manual checks to run instead.
- `window.__ecr` (in `main.js`) exposes the current scene name, the current race, the scene table and the settings. Keep it, because the smoke test depends on it.

## Architecture

ES modules under `src/`, with `src/main.js` as the entry point. Folders are listed in dependency order: a module may import from its own folder or from folders above it, never from below, and there are no circular imports.

| Folder | Files | Role |
|---|---|---|
| `core/` | `util.js` (`K`, `U`), `input.js` (`Input`) | Constants (resolution, segment length, camera, speeds, physics step) and helpers: math, seeded RNG `U.rng`, FNV hash, colours, time formatting, `localStorage`. Keyboard (by `KeyboardEvent.code`) and gamepads: `Input.player(idx, two)` returns driving input, `Input.menu()` returns edge-triggered navigation |
| `audio/` | `sound.js` (`Sound`) | Web Audio: per-player engine synth, `Sound.fx.*` effects, chiptune sequencer. The context starts on the first user gesture |
| `art/` | `draw.js` (canvas helpers `make`, `flip`, `R`/`P`/`C`/`E` primitives), `scenery.js` (sprite painters), `sprites.js` (`DEF` table, pre-rendering, `get`), `cars.js`, `backgrounds.js`, `index.js` (`Art` facade) | Procedural pixel art into cached offscreen canvases. Other folders use only the `Art` facade |
| `world/` | `themes.js` (`THEMES`, `THEME_INDEX`), `track.js` (`Track`) | The 12 sceneries; the course generator (`Track.build(params, opts)`) and the 10-letter course codes |
| `race/` | `specs.js` (cars, gear tables, colours), `race.js` (`Race`: setup, update loop, laps/checkpoints, ranking), `driving.js`, `ai.js`, `contact.js`, `energy.js` | Simulation of one race or stage. `driving`/`ai`/`contact`/`energy` export plain functions that use `this` and are mixed into `Race.prototype`, so write them as methods |
| `render/` | `view.js` (one viewport), `road.js`, `sky.js`, `effects.js`, `hud.js`, `text.js`, `index.js` (`Render` facade) | Segment-based pseudo-3D renderer for a full or split-screen viewport |
| `game/` | `screen.js` (canvas `g`, `W`, `H`, `text`), `state.js`, `ui.js` (menu widgets), `attract.js` (demo race behind menus), `session.js`, `scenes/*.js` | Game flow. `state.js` holds the saved `settings`/`custom`/`records`, the live `game` object (`scene`, `session`, `race`), the `scenes` registry and `go(name)` |
| `main.js` | entry | Registers the scenes, audio start-up, fullscreen key, the main loop and the `window.__ecr` debug handle |

- **Scenes** are plain objects with `enter()`, `update(dt)` and `draw(dt)`, one per file in `game/scenes/`. They switch with `go('Name')` and reach other scenes only through `scenes.Name`, never through imports. A new scene must be registered in `main.js`.
- **Keep every file under 300 lines.** When one grows past that, split it along a real seam: a new folder member, or a mixin for `Race`.

### Core model

- **Track:** an array of segments, each `K.SEG_LEN` long, with a `curve` value (about ±7 at most), world `y` for hills, roadside `sprites` and road hazards `obs`. Everything about a course is derived deterministically from its params plus seed, via `U.rng(U.hash(code))`. Use the seeded `rnd`, never `Math.random`, inside `Track.build`, or course codes stop reproducing the same course.
- **Car position:** `travel` is the distance from the start line (negative on the grid, and it keeps growing over laps). `z` is `travel` wrapped onto the track. `x` is lateral position in road half-widths: `±1` is the road edge, and `|x| > 1` is off-road.
- **Simulation:** `RaceScene` runs `race.update(K.STEP, inputs)` on a fixed 1/120 s step. Gear-shift inputs are cleared after the first sub-step, so one key press shifts once.
- **Humans vs AI:** humans run `driveHuman` (full physics). AI and finished humans (`autopilot`) run `driveAI`, which follows a target speed, avoids slower cars and `avoid` hazards, and applies a mild catch-up based on the leading human's distance. Hazard effects (`fx`: `soft`, `crash`, `splash`, `ice`, `boost`, `jump`) mostly apply to humans only.
- **Car sprite frame:** `c.frame` ranges from -2 to 2 (0 straight, ±1 slight, ±2 full lock), and `Art.car` draws a 3/4 view showing the flank on the side the car turns towards. Car geometry for the flank lives in `PROFILE` in `art/cars.js`, next to each model's rear-view drawing; keep the two in sync.
- **Sprites:** an `Art.DEF` entry gives pixel size `w,h`, world width `ww`, hit-box fraction `hit`, variant count `v`, optional `fx` and `avoid`, and a `draw(g, w, h, rnd, o, v)` painter. Sprites are rendered once and cached.
- **Limited energy** (`settings.energy`, race mode only, humans only) lives in `race/energy.js`. `placeCells` adds `cell` obstacles (`fx: 'energy'`) when the race is set up, using its own seeded RNG, so `Track.build` and course codes are unaffected. Each car keeps the cells it took this lap in `c.taken`, which is cleared on each new lap; the renderer hides a cell only for the car whose view it is drawing. `c.energy` is `null` when the option is off, and every energy code path checks for that.
- **Modes:** `Race` takes `mode: 'race'` (laps, a grid of 20 cars) or `'time'` (one point-to-point stage with checkpoints that extend `timeLeft`, plus slow traffic). Sessions in `game/session.js` chain races: `champ`, `time` or `custom` (from the course builder).

## Rules for changes

- **Everything stays procedural:** no image, audio or font files beyond the Google-hosted pixel font, which falls back to monospace.
- **Internal resolution is 480×300** (`K.W`, `K.H`), upscaled with nearest-neighbour. Menu layouts use absolute pixel coordinates at that size, and the pixel font is 8px per character at size 8, so check that text widths fit.
- **Split screen:** `Render.view` gets a viewport; `h < 200` means split mode, which uses a smaller sprite scale and draw distance. Anything new that's drawn in a view has to work at both sizes.
- **Two players share one race:** the per-player state lives on the car object and in `RaceScene.vs[i]`. Don't add global state for "the player".
- **Saved data:** `localStorage` keys are `ecr.settings`, `ecr.custom` (course-builder state) and `ecr.records` (keyed by course code + `R`/`T`). If you change the shape of stored data, make sure old values still load.
- **Course codes:** the 8 params (0–15, letters A–P) plus a 2-letter seed. Any other word is hashed into params. Changing generation in `Track.build` changes every existing code's course, so do it only on purpose.
- **Keep `README.md` in sync** when adding player-visible features, controls or options.

## Workflow

- The backlog is `todo.md`, worked through with the `/todo` skill: one item per commit, with done items ticked `[x]` and kept.
- Commit messages use an imperative subject of about 60 characters with no scope prefix. Add a body only when the reason isn't obvious.
