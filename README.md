# Lotus III Remake

A web remake of the 1992 Amiga/ST racer *Lotus III: The Ultimate Challenge*, written in plain JavaScript and HTML5 canvas. It has no dependencies and no build step.

It is a fan project. Every graphic, sound and piece of music is generated in code, and no assets from the original game are used.

## Play

Open `index.html` in a browser. Double-clicking the file is enough, because the game uses classic scripts rather than ES modules, so it also runs from `file://`.

If you prefer to serve it, any static server works:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

The pixel font loads from Google Fonts. Without a connection the game falls back to a monospace font.

## Features

- **Split-screen two-player mode**, the series' signature feature, plus full-screen single player.
- **Three cars:** Esprit Turbo SE (balanced), Elan SE (quick and grippy) and M200 concept (fastest but loose), each with automatic or manual 5-speed gears.
- **Twelve sceneries:** Forest, Night, Fog, Snow, Desert, Motorway, Marsh, Storm, Mountains, Roadworks, Windy and Future.
  - **Weather and lighting:** rain with lightning, snowfall, wind gusts that push the car, blowing leaves, dense fog, and night driving with headlights and lit lamps.
  - **Road hazards:** cones you can knock flying, barriers, lane closures, logs, rocks, puddles that splash and slide you, ice, rolling tumbleweeds, jump ramps and boost pads. Steep crests launch the car into the air.
- **Game modes:**
  - **Championship:** six races on Easy, Medium or Hard against 19 rivals, starting from the back of the grid. You must finish in the qualifying places (top 10, 6 or 3) to go on, and points go to the top 10.
  - **Time Challenge:** five point-to-point stages per level against the clock. Each checkpoint extends your time.
  - **R.E.C.S. (Racing Environment Construction Set):** design a course with sliders for curves, sharpness, hills, steepness, scatter, obstacles, length and scenery. Every course has a 10-letter code, and typing *any* word as a code builds a course from it.
- **Original chiptune soundtrack** with three tracks. You pick the "radio station" in the menu or press **M** while racing.
- **Lap and stage records** are saved in the browser.

## Controls

| Action      | 1 player                  | 2 players: P1 | 2 players: P2      |
|-------------|---------------------------|---------------|--------------------|
| Accelerate  | ↑ or W                    | W             | ↑                  |
| Brake       | ↓ or S                    | S             | ↓                  |
| Steer       | ← → or A D                | A D           | ← →                |
| Gear up     | E, Shift or .             | E             | . or Right Shift   |
| Gear down   | Q, Ctrl or ,              | Q             | , or Right Ctrl    |

Other keys: **Esc** or **P** pauses, **M** changes the music, **F** toggles fullscreen, and **Enter** confirms in menus.

**Gamepads** use the standard mapping: the left stick or d-pad steers, A or RT accelerates, B or LT brakes, RB/Y shifts up, LB/X shifts down, and Start pauses. In two-player mode, pad 1 drives player 1 and pad 2 drives player 2.

## Code layout

| File            | Purpose |
|-----------------|---------|
| `js/util.js`    | Constants (`K`) and helpers (`U`): math, seeded RNG, colours, storage |
| `js/input.js`   | Keyboard and gamepad input |
| `js/audio.js`   | Web Audio engine synth, sound effects, music sequencer and songs |
| `js/art.js`     | Procedural pixel art: scenery, hazards, cars and parallax layers |
| `js/themes.js`  | The 12 scenery definitions |
| `js/track.js`   | R.E.C.S. course generator and course-code encoding |
| `js/race.js`    | Race simulation: driving physics, gearbox, AI, collisions, laps, checkpoints |
| `js/render.js`  | Segment-based pseudo-3D renderer, weather effects and HUD |
| `js/main.js`    | Menus, game flow, championship and time-challenge sessions, main loop |
