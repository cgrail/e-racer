# Electro Car Racer

A tribute to the pseudo-3D racing games of the 80s and 90s, with split-screen duels, chiptune radio stations and roads that roll over the horizon. It is written in plain JavaScript (ES modules) and HTML5 canvas, built with Vite, and has no runtime dependencies.

Every graphic, sound and piece of music is generated in code.

## Play

```sh
npm install
npm run dev       # dev server with hot reload, open the printed URL
npm run build     # production build into dist/
npm run preview   # serve the production build
```

`dist/` is a static site with relative paths, so you can host it from any folder.

The pixel font loads from Google Fonts. Without a connection the game falls back to a monospace font.

## Features

- **Split-screen two-player mode**, plus full-screen single player.
- **Three cars:** Volt GT (balanced), Spark Roadster (quick and grippy) and Ion Concept (fastest but loose). They are electric: a single-speed motor with instant torque, and the HUD meter shows the kilowatts you draw, turning cyan and negative when braking recovers energy.
- **Twelve sceneries:** Forest, Night, Fog, Snow, Desert, Motorway, Marsh, Storm, Mountains, Roadworks, Windy and Future.
  - **Weather and lighting:** rain with lightning, snowfall, wind gusts that push the car, blowing leaves, dense fog, and night driving with headlights and lit lamps.
  - **Road hazards:** cones you can knock flying, barriers, lane closures, logs, rocks, puddles that splash and slide you, ice, rolling tumbleweeds, jump ramps and boost pads. Steep crests launch the car into the air.
- **Game modes:**
  - **Championship:** six races on Easy, Medium or Hard against 19 rivals, starting from the back of the grid. You must finish in the qualifying places (top 10, 6 or 3) to go on, and points go to the top 10.
  - **Rubber-band rivals:** in races the pack stays close. Rivals far ahead of you ease off, and rivals far behind push harder, more on Easy than on Hard.
  - **Time Challenge:** five point-to-point stages per level against the clock. Each checkpoint extends your time.
  - **Course Builder:** design a course with sliders for curves, sharpness, hills, steepness, scatter, obstacles, length and scenery. Every course has a 10-letter code, and typing *any* word as a code builds a course from it.
- **Limited energy (option):** in races your battery drains with the power you draw, and braking recovers a little. Drive through the glowing energy cells on the road to recharge them; they come back every lap, and in two-player mode each player has their own. If your battery runs empty, you are put behind the last car with a partial recharge. Set **ENERGY** to *Limited* in the main menu.
- **Power-ups (option):** glowing power orbs on the road charge your super power, and you can hold up to two charges. Fire one for three seconds of extra acceleration past top speed: barriers fly aside, puddles and ice can't touch you, and rivals get shoved out of the way. Blue electro-shock pickups give you one shock to hold: fire it to zap the nearest car ahead of you, rival or other player, which is held to 75% of its top speed for three seconds unless its super power is running. Set **POWER-UPS** to *On* in the main menu.
- **Original chiptune soundtrack** with four tracks, including the Amiga title-screen style HIGH VOLTAGE. You pick the "radio station" in the menu or press **M** while racing.
- **Lap and stage records** are saved in the browser.

## Controls

| Action      | 1 player                  | 2 players: P1 | 2 players: P2      |
|-------------|---------------------------|---------------|--------------------|
| Accelerate  | ↑ or W                    | W             | ↑                  |
| Brake       | ↓ or S                    | S             | ↓                  |
| Steer       | ← → or A D                | A D           | ← →                |
| Super power | Space or Enter            | Space         | Enter or Numpad 0  |
| Shock       | E, Right Shift or .       | E             | . or Right Shift   |

Other keys: **Esc** or **P** pauses, **M** changes the music, **F** toggles fullscreen, and **Enter** confirms in menus.

**Gamepads** use the standard mapping: the left stick or d-pad steers, A or RT accelerates, B or LT brakes, X or RB fires super power, Y or LB fires a shock, and Start pauses. In two-player mode, pad 1 drives player 1 and pad 2 drives player 2.

## Code layout

| Folder         | Purpose |
|----------------|---------|
| `src/core/`    | Constants, helpers (math, seeded RNG, colours, storage), keyboard and gamepad input |
| `src/audio/`   | Web Audio electric motor synth, sound effects, music sequencer and songs |
| `src/art/`     | Procedural pixel art: scenery and hazard sprites, cars, parallax backgrounds |
| `src/world/`   | The 12 scenery definitions, course generator and course codes |
| `src/race/`    | Race simulation: car specs, electric drive physics, AI, collisions, laps, checkpoints |
| `src/render/`  | Segment-based pseudo-3D renderer, sky, road, effects, weather and HUD |
| `src/game/`    | Game state, menus and widgets, sessions, the attract-mode demo, one file per scene |
| `src/main.js`  | Entry point and main loop |

`npm run check` syntax-checks every module. `npm run smoke` runs the game headlessly in Node against stubbed browser APIs: it builds, races and renders every scenery, and drives the menus through a championship, a two-player time challenge and a course-builder race.
