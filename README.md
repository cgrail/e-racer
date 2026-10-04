# Electro Car Racer

A tribute to the pseudo-3D racing games of the 80s and 90s, with split-screen duels, online races, chiptune radio stations and roads that roll over the horizon. It is written in plain JavaScript (ES modules) and HTML5 canvas and built with Vite. The game in the browser has no runtime dependencies; the optional online race server runs on Node with Express and `ws`.

Every graphic, sound and piece of music is generated in code.

## Play

```sh
npm install
npm run dev       # dev server with hot reload, open the printed URL
npm run build     # production build into dist/
npm run preview   # serve the production build
npm start         # build, then run the race server: game and online races on http://localhost:8090
```

`dist/` is a static site with relative paths, so you can host it from any folder. Everything but online races works that way.

Online races need the race server (`server/server.js`), which serves the built game and runs the races on a WebSocket at `/ws`. Players open the server's address, and the game starts online: the title screen leads straight to the online menu. Wherever the server doesn't answer (a static host, `npm run dev` on its own), the game falls back to the local modes. To work on online play with hot reload, run `npm run server` next to `npm run dev`: Vite passes `/ws` through to the server on port 8090. The server's settings are environment variables (`PORT`, `HOST`, `TRUST_PROXY`, `ALLOWED_ORIGINS`, `MAX_CLIENTS`, `MAX_CONNS_PER_IP`), described at the top of `server/server.js`.

### Deploying next to mech-vs-mech

`install.sh` puts the game and its race server on the Ubuntu box that [mech-vs-mech](https://github.com/cgrail/mech-vs-mech)'s `install.sh` already set up in Let's Encrypt mode. That script owns the OS hardening, firewall, Node.js and Caddy; this one only deploys the game, the same way calvo sits on that box:

```sh
git clone <this repo's URL> electro-car-racer && cd electro-car-racer
sudo DOMAIN=racer.example.com ./install.sh   # first run; later runs: sudo ./install.sh
```

It builds the game into `/opt/electro-car-racer`, runs the server as the unprivileged user `ecr` in a sandboxed systemd unit (`electro-car-racer`) on `127.0.0.1:8090`, and adds the Caddy site `/etc/caddy/apps/electro-car-racer.caddy`, which serves `https://$DOMAIN` with a Let's Encrypt certificate. Point a plain, un-proxied A/AAAA record for the domain at the box. A systemd timer runs `update.sh` every 5 minutes and deploys whatever lands on `origin/main`; `sudo ./update.sh --force` rebuilds now. Server settings live in `/etc/default/electro-car-racer`.

The pixel font loads from Google Fonts. Without a connection the game falls back to a monospace font.

## Features

- **Split-screen two-player mode**, plus full-screen single player.
- **Eight electric cars** in today's EV body styles: Pixel Hatch, Ridge Compact SUV, Granite SUV, Beach Van, Aero Sportback, Wave Sedan, Flux GT and Blitz Roadster. The small and tall ones pull away and corner best; the low, fast ones have the top speed but slide more. They are electric: a single-speed motor with instant torque, and the HUD meter shows the kilowatts you draw, turning cyan and negative when braking recovers energy.
- **Twelve sceneries:** Forest, Night, Fog, Snow, Desert, Motorway, Marsh, Storm, Mountains, Roadworks, Windy and Future.
  - **Weather and lighting:** rain with lightning, snowfall, wind gusts that push the car, blowing leaves, dense fog, and night driving with headlights and lit lamps.
  - **Road hazards:** cones you can knock flying, barriers, lane closures, logs, rocks, puddles that splash and slide you, ice, rolling tumbleweeds, jump ramps and boost pads. Steep crests launch the car into the air.
- **Game modes:**
  - **Championship:** six races on Easy, Medium or Hard against 19 rivals, starting from the back of the grid. You must finish in the qualifying places (top 10, 6 or 3) to go on, and points go to the top 10.
  - **Rubber-band rivals:** in races the pack stays close. Rivals far ahead of you ease off, and rivals far behind push harder, more on Easy than on Hard.
  - **Active rivals:** rivals change lanes, take the inside of bends, draft and overtake each other, and some defend against you. They collect energy cells and fire electro shocks too, more of them on Hard.
  - **Hard hunts you down:** on Hard, once you are in the top three, the aggressive rivals behind you take turns to come after you, faster than your car can go. They save their electro shocks for you, fire as they close in and drive on past, so a lead is never safe.
  - **Time Challenge:** five point-to-point stages per level against the clock. Each checkpoint extends your time.
  - **Course Builder:** design a course with sliders for curves, sharpness, hills, steepness, scatter, obstacles, length and scenery. Every course has a 10-letter code, and typing *any* word as a code builds a course from it.
  - **Online Race:** race other players over the internet on one shared 20-car grid, one player per browser. If nobody is racing, you start a session at your level; races then run back to back, each on a new course. Between races come the results, with championship points for the top ten, and the session's points table of the players. Anyone can join while a race is running: they take over the last rival on the road and race on from there. A player who leaves hands the car back to a rival. When the game comes from the race server, online is the only mode: after the title, **START RACE** (or **JOIN RACE**) is the first row, with your name and car below it, and the level when you are about to start a session. If the server can't be reached, or stops answering, you play the local game instead.
- **Your name on the number plate:** set **NAME** on the online menu, or **P1 NAME** (and **P2 NAME**) in the local one, up to six letters and digits. It is shown on your car's plate, in the results, and to the other players online.
- **Limited energy:** in every race your battery drains with the power you draw, and braking recovers a little. Drive through the glowing energy cells on the road to recharge them; they come back every lap, and in two-player mode each player has their own. Rivals have batteries too and go for cells when they run low; a cell a rival drives over is used up for everyone until it comes back a few seconds later. If your battery runs empty, you are put behind the last car with a partial recharge. Time challenge stages run on an unlimited battery.
- **Power-ups:** in every race, glowing power orbs on the road charge your super power, and you can hold up to three charges. They are a catch-up help: in the top three, orbs show faded and do nothing, and the further back you are, the more charges an orb gives (up to three) and the longer a charge runs (three to six seconds). A charge gives extra acceleration past top speed: barriers fly aside, puddles and ice can't touch you, and rivals get shoved out of the way.
- **Electro shocks:** blue shock pickups lie on the road in every race. You can hold one: fire it to zap the nearest car ahead of you, rival or other player, which is held to 75% of its top speed for three seconds unless its super power is running. Rivals collect them too, and a pickup a rival takes is gone for everyone until it comes back a few seconds later.
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

Other keys: **Esc** or **P** pauses, **M** changes the music, **F** toggles fullscreen, and **Enter** confirms in menus. To set a name, select its row, type it and press **Enter** (**Esc** cancels). An online race doesn't stop when you pause, and the pause menu lets you leave it.

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
| `server/`      | Online race server: static files, WebSocket lobby, and the session that runs the races and drives the rivals |

`npm run check` syntax-checks every module. `npm run smoke` runs the game headlessly in Node against stubbed browser APIs: it builds, races and renders every scenery, drives the menus through a championship, a two-player time challenge and a course-builder race, and plays an online session against the real server code.
