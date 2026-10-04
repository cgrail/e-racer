---
name: todo
description: Work the next item(s) off todo.md in this repo — one item at a time, verified headlessly, one commit per finished item. Use when asked to "work on the todos", "do the next todo", "keep going through todo.md", or when handed a todo item by name.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

## The list

!`cat todo.md`

`todo.md` at the repo root is the backlog. `[ ]` is open, `[x]` is done — done items stay in the file as a record, they are not deleted.

Arguments, if any, name which item(s) to take (a number, a keyword, "all"). With no arguments: take the **topmost `[ ]` item** and keep going down the list until the context/usage limit stops you. If a later item is a prerequisite for an earlier one (e.g. a build step that a refactor should build on), do it first and say so in its commit body.

## One item = one commit

Do **not** batch items. For each item, in order:

1. **Read the item as a bug report, not a spec.** Most entries are one line of the user's shorthand ("when the car moves left or right it doesn't look good"). Find the actual code before deciding what the fix is — the described symptom is usually a small piece of a shared code path.
2. **Locate it.** [CLAUDE.md](../../../CLAUDE.md) has the folder-by-folder map of `src/`. A change usually touches more than one layer: simulation in `src/race/` (driving, AI, contact, energy and power are mixins on `Race.prototype`), drawing in `src/art/` and `src/render/`, menus and flow in `src/game/` (one file per scene, switched with `go('Name')`). Follow a feature through every layer it touches — option in the main menu → `settings` → `makeRace` → `Race` → HUD/pre-race info.
3. **Implement.** Match the surrounding code's idiom: terse, `U`/`K` helpers, `this`-style mixin methods, procedural canvas art drawn once and cached.
4. **Check the constraints in CLAUDE.md** that the change touches. The ones that bite most often:
   - every file stays under 300 lines — split along a real seam (new module, new mixin) rather than letting one grow;
   - everything stays procedural — no image/audio/font assets;
   - the internal screen is 480×300 at 8 px per character — check that new text fits, and that anything drawn in a view works in split screen (`h < 200`) too;
   - two players share one race — per-player state lives on the car object (`c.taken`, `c.energy`, …), never in globals; PvP stays symmetric;
   - `Track.build` must stay deterministic from the course code — extra per-race objects (cells, orbs) are placed at race setup with their own seeded RNG;
   - mixin modules export only functions (every export lands on `Race.prototype`); shared constants go in `race/specs.js`;
   - scenes never import each other — `go('Name')` / `scenes.Name`; new scenes are registered in `src/main.js`;
   - `window.__ecr` stays exposed in `src/main.js` (the smoke test drives the game through it);
   - stored data (`ecr.*` keys) keeps loading after a shape change — new settings get a default in `DEFAULTS`.
5. **Verify what can be verified from here.**
   ```bash
   npm run check   # syntax-checks every module under src/
   npm run smoke   # headless Node run: every scenery raced + rendered, energy, power, rubber band, menu flows
   npm run build   # Vite bundles cleanly
   ```
   When the item adds a flow, option or mechanic, **extend `scripts/smoke.js`** with a check that would fail without it. **Never** launch Chrome or a headless browser — the user does all in-browser testing; how it *looks* and *feels* is theirs to judge.
6. **Docs, only if something significant changed.** A new subsystem, a changed invariant, a rule a future edit could break → the matching section of [CLAUDE.md](../../../CLAUDE.md). A player-visible feature, control or option → [README.md](../../../README.md). A bug fix that changes no rule → neither.
7. **Tick the item** in `todo.md`: `[ ]` → `[x]`. If the work revealed a follow-up the user should decide on, append it as a new `[ ]` line rather than doing it silently.
8. **Commit everything for that item together** — code, smoke-test additions, `todo.md`, docs. Message style is the repo's: imperative subject, no scope prefix, ~60 chars ("Add limited-energy option with collectable energy cells"). Body only when the *why* isn't obvious from the subject. Do not push.

## Reporting

After each commit, tell the user in two or three lines: what the item turned out to be, what changed, and **what to verify manually** (the in-browser checks you could not run — how it looks, sounds and plays, single and split screen). Then start the next item without asking — stop only when the list is empty, an item genuinely needs a decision only the user can make, or you run out of room.
