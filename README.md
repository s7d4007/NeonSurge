# NEON SURGE

> Pilot a glowing orb through an electrified grid, collecting crystals and dodging homing drones, barriers, and missiles. Chain pickups for combo multipliers, grab shields and power-ups, and survive as long as you can. Every level hits harder. Simple to pick up, brutal to master.

---

## Features

* **Infinite levels** — difficulty scales with every level cleared
* **Real-time score** — smooth animated score counter with combo multiplier system
* **5-drone cap** — at most 5 drones on screen at once; oldest is evicted when a new one spawns
* **Power-ups** — Shield (absorbs one hit), Clock (slows all drones for 5 seconds), Bonus (+200 points)
* **Death reason** — the game over screen tells you exactly what killed you
* **Leaderboard** — Daily, Weekly, and All Time boards with gold, silver, and bronze medals
* **Username system** — callsign prompt on first visit, persisted across sessions
* **Keyboard shortcuts** — `P` to pause, `R` to resume, `ESC` to restart
* **Fully responsive** — fills the screen on desktop, adapts to mobile portrait layout
* **Touch support** — drag to move on any touchscreen device
* **Scanline overlay** — CRT-style aesthetic on top of the canvas

---

## Gameplay

| Control            | Action              |
| ------------------ | ------------------- |
| Mouse / Touch drag | Move the player orb |
| WASD / Arrow keys  | Move the player orb |
| `P`              | Pause               |
| `R`              | Resume              |
| `ESC`            | Restart             |

### Objects

| Icon               | Name            | Description                                               |
| ------------------ | --------------- | --------------------------------------------------------- |
| Red circle         | Drone           | Homing enemy — tracks and chases you                     |
| Orange arrow       | Missile         | Fires directly at you — unlocks at Level 4               |
| Red strip          | Barrier         | Falling hazard with warning stripes — unlocks at Level 2 |
| Cyan shield        | Shield power-up | Absorbs your next hit                                     |
| Green clock        | Slow power-up   | Freezes drones at 8% speed for 5 seconds                  |
| Orange `+`circle | Bonus power-up  | Instantly adds +200 points                                |
| Spinning gem       | Crystal         | Collect to score points and build combos                  |

---

## Tech Stack

| Layer                 | Technology                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| **Language**    | Vanilla JavaScript (ES2020+)                                                   |
| **Rendering**   | HTML5 Canvas 2D API                                                            |
| **Styling**     | Pure CSS3 (Flexbox, CSS Variables, transitions)                                |
| **Font**        | [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)— Google Fonts |
| **Persistence** | `localStorage`(scores, username, high score)                                 |
| **Build tool**  | None — zero dependencies, single `.html`file                                |
| **Runtime**     | Any modern browser (Chrome, Firefox, Safari, Edge)                             |

---

## Project Structure

```
neon-surge.html      # Entire game — markup, styles, and logic in one file
README.md            # This file
```

The entire game ships as a **single self-contained HTML file** with no build step, no bundler, no framework, and no external runtime dependencies. Open it in a browser and it runs.

---

## Architecture Overview

```
┌─ HTML Structure ──────────────────────────────┐
│  #nav            Navigation bar + tab router  │
│  #game-area      Canvas + scanline overlay    │
│  #lb-panel       Leaderboard panel (HTML)     │
│  #um             Username modal               │
└───────────────────────────────────────────────┘

┌─ Game Loop (requestAnimationFrame) ───────────┐
│  update()        Physics, collisions, spawns  │
│  drawGame()      Canvas render pass           │
│  drawMenu()      Menu screen                  │
│  drawPause()     Pause overlay                │
│  drawGameOver()  Game over screen             │
└───────────────────────────────────────────────┘

┌─ Persistence (localStorage) ──────────────────┐
│  neonSurgeUser   Player callsign              │
│  neonSurgeHS     All-time high score          │
│  neonSurgeLB     Leaderboard entries (JSON)   │
└───────────────────────────────────────────────┘
```

---

## Getting Started

No installation required.

```bash
# Option 1 — just open it
open NeonSurge.html

# Option 2 — serve locally
npx serve .
# then visit http://localhost:3000/NeonSurge.html
```
