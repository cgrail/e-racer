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

Online races need the race server (`server/server.js`), which serves the built game and runs the races on a WebSocket at `/ws`. Players open the server's address, and the game starts online: the title screen leads straight to the online menu. Wherever the server doesn't answer (a static host, `npm run dev` on its own), the game falls back to the local modes. To work on online play with hot reload, run `npm run server` next to `npm run dev`: Vite passes `/ws` through to the server on port 8090. The server's settings are environment variables (`PORT`, `HOST`, `TRUST_PROXY`, `ALLOWED_ORIGINS`, `MAX_CLIENTS`, `MAX_CONNS_PER_IP`, `UPDATE_FILE`), described at the top of `server/server.js`.

### Deploying next to mech-vs-mech

`install.sh` puts the game and its race server on the Ubuntu box that [mech-vs-mech](https://github.com/cgrail/mech-vs-mech)'s `install.sh` already set up in Let's Encrypt mode. That script owns the OS hardening, firewall, Node.js and Caddy; this one only deploys the game, the same way calvo sits on that box:

```sh
git clone <this repo's URL> electro-car-racer && cd electro-car-racer
sudo DOMAIN=racer.example.com ./install.sh   # first run; later runs: sudo ./install.sh
```

It builds the game into `/opt/electro-car-racer`, runs the server as the unprivileged user `ecr` in a sandboxed systemd unit (`electro-car-racer`) on `127.0.0.1:8090`, and adds the Caddy site `/etc/caddy/apps/electro-car-racer.caddy`, which serves `https://$DOMAIN` with a Let's Encrypt certificate. Point a plain, un-proxied A/AAAA record for the domain at the box. A systemd timer runs `update.sh` every 5 minutes and deploys whatever lands on `origin/main`; `sudo ./update.sh --force` rebuilds now. Server settings live in `/etc/default/electro-car-racer`.

To have a merge go live at once instead of on the next 5-minute tick, set the repository variable `DEPLOY_URL` to `https://$DOMAIN/update` (**Settings > Secrets and variables > Actions > Variables**). The Deploy workflow (`.github/workflows/deploy.yml`) then calls it on every push to `main`. `GET /update` takes no parameters and reads nothing; it writes `/run/electro-car-racer/update`, which a systemd path unit (`electro-car-racer-update.path`) watches to run `update.sh`, and that only ever deploys what is on `origin/main`. Calls are at least 10 seconds apart (a sooner one waits), and the server itself stays sandboxed and can't deploy anything. `journalctl -u electro-car-racer-update -f` shows the deploys.

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
  - **Active rivals:** rivals change lanes, take the inside of bends, draft and overtake each other, and some defend against you. They collect energy cells, and each rival uses either flashes (more of them on Hard) or boosts.
  - **Hard hunts you down:** on Hard, once you are in the top three, the aggressive rivals behind you take turns to come after you, faster than your car can go. They save their flashes for you, fire as they close in and drive on past, so a lead is never safe.
  - **Time Challenge:** five point-to-point stages per level against the clock. Each checkpoint extends your time.
  - **Course Builder:** design a course with sliders for curves, sharpness, hills, steepness, scatter, obstacles, length and scenery. Every course has a 10-letter code, and typing *any* word as a code builds a course from it.
  - **Online Race:** race other players over the internet on one shared 20-car grid, one player per browser. If nobody is racing, you start a session at your level; races then run back to back, each on a new course. Between races come the results, with championship points for the top ten, and the session's points table of the players. Anyone can join while a race is running: they take over the last rival on the road and race on from there. A player who leaves hands the car back to a rival. When the game comes from the race server, online is the only mode: after the title, **START RACE** (or **JOIN RACE**) is the first row, with your name and car below it, and the level when you are about to start a session. If the server can't be reached, or stops answering, you play the local game instead.
- **Your name on the number plate:** the first time you start, the game asks for your name, up to six letters and digits (**Esc** skips it, and it asks again next time). A phone asks first thing, on a plain upright page: type your name and tap **START**, or **SKIP**. Change it later with **NAME** on the online menu, or **P1 NAME** (and **P2 NAME**) in the local one. It is shown on your car's plate, in the results, and to the other players online.
- **Limited energy:** in every race your battery drains with the power you draw, and braking recovers a little. Drive through the glowing energy cells on the road to recharge it. Cells show up where they are needed: the further back you are, the more of them there are. In the lead there are none until your battery is nearly empty (LOW ENERGY); then a single cell shows up a good way ahead, worth eight seconds at full power. Miss it and you run flat, so staying in front is hard work. Just behind the leader you get just enough to keep going flat out if you take most of them (about nine in ten); in last place there are about five times as many as you need. Cells you take come back every lap, and in two-player mode each player has their own. Rivals have batteries too and go for cells when they run low; a cell a rival drives over is gone for a while, up to six seconds near the front and less the further back you are, so the pack ahead never leaves you short. The leader's single cell is always there for it. If your battery runs empty, you are put behind the last car with a partial recharge. Time challenge stages run on an unlimited battery.
- **Boost and flash:** in every race, pink boost orbs and blue flash pickups lie on the road, and you can hold one of the two at a time. While you hold one, neither kind shows on your road; once you fire it, they are back. One key fires whatever you hold. Every place can collect them.
  - **Boost** gives super power: extra acceleration past top speed, barriers fly aside, puddles and ice can't touch you, and rivals get shoved out of the way. It is a catch-up help: the further back you are when you fire it, the longer it runs, from one and a half seconds in the lead to three and a half in last place. It never takes you to the front, though: once it has brought you up to 6th place it ends and you slow back to your top speed, and fired in the top six it ends as you gain a place.
  - **Flash** zaps the nearest car ahead of you, rival or other player, which is held to 75% of its top speed for three seconds unless its super power is running. With no car in range you keep it. Rivals collect flashes too, and a pickup a rival takes is gone for a while, like a cell.
  - **Rivals boost too:** the rivals that don't use flashes collect boosts (an orb a rival takes stays on the road for you) and save them for you. Once you are in the top three, a rival that has one fires it when it is the car right behind you and comes past at its car's boost speed, with flames at its tail; its boost ends once it is by.
- **Original chiptune soundtrack** with four tracks, including the Amiga title-screen style HIGH VOLTAGE. You pick the "radio station" in the menu or press **M** while racing.
- **Lap and stage records** are saved in the browser.

## Controls

| Action      | 1 player                  | 2 players: P1 | 2 players: P2      |
|-------------|---------------------------|---------------|--------------------|
| Accelerate  | ↑ or W                    | W             | ↑                  |
| Brake       | ↓ or S                    | S             | ↓                  |
| Steer       | ← → or A D                | A D           | ← →                |
| Boost/flash | Space, Enter, E or .      | Space or E    | Enter, Numpad 0, . or Right Shift |

Other keys: **Esc** or **P** pauses, **M** changes the music, **F** toggles fullscreen, and **Enter** confirms in menus. To set a name, select its row, type it and press **Enter** (**Esc** cancels). An online race doesn't stop when you pause, and the pause menu lets you leave it.

**Gamepads** use the standard mapping: the left stick or d-pad steers, A or RT accelerates, B or LT brakes, X, Y, RB or LB fires the boost or flash you hold, and Start pauses. In two-player mode, pad 1 drives player 1 and pad 2 drives player 2.

**Phones and tablets** start with touch controls on (a key press hides them again, a touch brings them back), and the game fills the screen in landscape from the start. Held upright, the game turns sideways to use the phone's full height, so turn the phone (this works with rotation lock on too). The page doesn't zoom, and only the menus scroll. Where the browser allows it (Android, iPad), your first tap also goes fullscreen. An iPhone browser can't, so the title screen says how: **Share > Add to Home Screen**, and the game started from its home screen icon runs without the browser bars. While racing, the car **accelerates by itself**: put a finger down anywhere and drag it left or right to steer, and use the coloured buttons halfway up the left edge, under your left thumb, to **BRAKE** (red) and to fire what you hold: the fire button says **BOOST** (pink) or **FLASH** (blue), and stays blank while you hold neither. To have them under your right thumb instead, set **BUTTONS** to **RIGHT** in the menu or the pause menu (it is only there on touch). The pause button sits top right. The menus (online and local, the course builder and the pause menu) are pages made for fingers: a bar at the top with **◂** to go back and **? HELP** for how to drive, your name and the options on the left with the race server (or the race setup) under them, your car on the right, and the green button (**START RACE**, **START GAME**, **RACE!**) in the middle at the bottom, all on one screen. Change a setting with its **◂** and **▸** buttons or tap it to step it on, tap a course builder slider where you want it, and tap your name or the course code to type it. The menus are landscape like the race, so the phone stays the same way round from the title to the finish (only the first page asking your name stands upright). On the other screens, tap anywhere to go on, and use **BACK** top left. One player per device; split screen needs a keyboard or two pads.

## Code layout

| Folder         | Purpose |
|----------------|---------|
| `src/core/`    | Constants, helpers (math, seeded RNG, colours, storage), keyboard, gamepad and virtual (touch) input |
| `src/audio/`   | Web Audio electric motor synth, sound effects, music sequencer and songs |
| `src/art/`     | Procedural pixel art: scenery and hazard sprites, cars, parallax backgrounds |
| `src/world/`   | The 12 scenery definitions, course generator and course codes |
| `src/race/`    | Race simulation: car specs, electric drive physics, AI, collisions, laps, checkpoints |
| `src/render/`  | Segment-based pseudo-3D renderer, sky, road, effects, weather and HUD |
| `src/game/`    | Game state, menus and widgets, sessions, touch controls and menu pages, the attract-mode demo, one file per scene |
| `src/main.js`  | Entry point and main loop |
| `server/`      | Online race server: static files, WebSocket lobby, the session that runs the races and drives the rivals, and the deploy hook |

`npm run check` syntax-checks every module. `npm run smoke` runs the game headlessly in Node against stubbed browser APIs: it builds, races and renders every scenery, drives the menus through a championship, a two-player time challenge and a course-builder race, plays an online session against the real server code, taps through the touch menu pages, and calls the deploy hook.
