# WebSmallGame Project Memory Archive

## Current Snapshot

This project is a small static browser game named `WebSmallGame`.
It is a neon/cyberpunk Snake game built with p5.js and plain JavaScript.

There is no Git repository, no package manager metadata, and no local build step in the current folder.
The app can be run by opening `index.html` in a browser. It loads p5.js from the jsDelivr CDN.

## Files

- `index.html`
  - Minimal HTML shell.
  - Sets `lang="zh-CN"`.
  - Loads `styles.css`, p5.js CDN, `snakeLogic.js`, then `sketch.js`.

- `styles.css`
  - Full-window dark neon visual treatment.
  - Adds radial glow backgrounds, scanlines, subtle grid overlays, fixed full-screen canvas styling, and a centered `noscript` warning.

- `snakeLogic.js`
  - Game-state and rule engine.
  - Uses a UMD-style wrapper: attaches `SnakeLogic` to `globalThis/window` and also supports `module.exports`.
  - Owns grid rules, movement, collision, scoring, food placement, mode configuration, walls, portals, and step timing.

- `sketch.js`
  - p5.js presentation and interaction layer.
  - Owns canvas setup, responsive layout, rendering, visual effects, audio effects, vibration, keyboard input, pointer/touch input, pause/reset/mode flow, and feedback intensity.

## Runtime

- Entry point: `index.html`
- Framework/library: p5.js `1.9.4` via CDN
- Grid size: `24 x 24`
- Touch controls appear on narrow screens or touch-capable devices.
- No server is required for the current app.

## Game Modes

- `Classic`
  - Standard Snake loop.
  - Constant movement interval.

- `Neon Rush`
  - Speed increases every 3 food pickups.
  - Combo scoring is active when food is collected quickly enough.
  - Score per food starts at 10 and increases by 5 per combo level after the first.

- `Circuit Maze`
  - Adds fixed electric wall obstacles.
  - Wall count is currently 22.
  - Crashing into a wall has special electric feedback.

- `Portal Drift`
  - Adds two linked portals.
  - Entering one portal exits through the other.
  - Portals relocate every 5 food pickups.

## Controls

- Mode select: press `1` through `4`, or click/tap a mode card.
- Movement: arrow keys or `WASD`.
- Pause/resume: `Space` or `P`.
- Reset: `R` or `Enter`.
- Return to mode select: `M`.
- Toggle sound effects: `V`.
- Toggle visual feedback mode: `F`.
- On touch devices: on-screen directional buttons are rendered below the board.

## State Model

The active game object created by `SnakeLogic.createGame()` contains:

- `cols`, `rows`
- `modeId`
- `snake`
- `direction`, `pendingDirection`, `directionQueue`
- `food`
- `score`
- `status`
- `tick`
- `speedLevel`
- `combo`
- `walls`
- `portals`
- `foodsEaten`
- `lastEatTick`
- `lastEvent`
- `random`

The renderer reacts to `lastEvent` after each tick. Events include:

- `eat`
- `teleport`
- `crash`

## Rendering And Feedback

The visual identity is high-contrast neon punk:

- Acid green snake
- Pink food
- Cyan/pink grid frame
- Animated backdrop lines
- Scanline overlay from CSS
- Shock rings, particles, glitch slices, banners, hit stop, screen shake, and full-screen flashes

Audio is generated with the Web Audio API after user interaction unlocks audio.
The app also uses `navigator.vibrate` where available.

Feedback mode can be:

- `full`
  - Full visual effects, hit stop, shake, vibration, and higher audio presence.

- `reduced`
  - Fewer particles, no full-screen impact events, reduced shake/hit stop behavior, lower audio gain, and vibration cancellation when switching into this mode.

## Important Implementation Notes

- `snakeLogic.js` is intentionally independent from p5.js and can be tested in Node because it exports with `module.exports`.
- Direction changes are queued, capped at 4 inputs, and reverse-direction moves are rejected.
- Collision allows moving into the previous tail cell when the snake is not growing.
- Food placement avoids the snake, walls, and portals.
- Maze walls and portals avoid the protected start area.
- Portal teleport is evaluated before collision and food checks use the teleported destination.
- The game can reach `status: "won"` if no empty food cell remains.

## Useful Future Work

- Add a small automated test file for `snakeLogic.js`.
- Add local vendoring or fallback for p5.js if offline play matters.
- Add persistent high scores with `localStorage`.
- Add a visible controls/help overlay for first-time players.
- Add a deterministic seeded random option for reproducible tests.
