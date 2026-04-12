# NEON DUEL 2v2

> Real-time 2D top-down multiplayer tactical shooter — no game engine, no frameworks, no pip packages.

Built with **vanilla HTML5 Canvas**, **JavaScript (ES2020)**, and **Python 3** (stdlib only).  
Supports **1v1** and **2v2** online matches with fog of war, character abilities, a SQLite stats database, and a live stats dashboard.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [How to Run](#how-to-run)
- [Gameplay](#gameplay)
- [Characters](#characters)
- [REST API & Stats](#rest-api--stats)
- [WebSocket Message Protocol](#websocket-message-protocol)
- [Script Load Order](#script-load-order)
- [File Ownership](#file-ownership)
- [Credits](#credits)

---

## Features

| Category | Details |
|---|---|
| **Multiplayer** | Real-time 2v2 and 1v1 via WebSocket over a single ngrok tunnel |
| **Lobby system** | Create / join rooms with a 6-character code, team pick, mode select |
| **Character select** | 3 unique agents — each with 3 active abilities |
| **Game modes** | 1v1 (first to 3 rounds) and 2v2 (first to 3 rounds) |
| **Fog of war** | Each team only sees the area around their own players |
| **Minimap** | Live overhead minimap per player |
| **Abilities** | Flash, Smoke, Heal, Barrier, Slow Field, Chain Bolt, Shield, Overcharge |
| **Tester mode** | Local offline 1v1 — no server needed, password protected |
| **Stats database** | SQLite — tracks kills, deaths, wins, losses per player across sessions |
| **Stats dashboard** | `stats.html` — leaderboard, match history, kill feed, player profiles |
| **REST API** | 4 JSON endpoints served by the same Python process |
| **Keybind editor** | Fully rebindable controls — keyboard + mouse supported |
| **Pause menu** | ESC to pause mid-game, keybind screen, quit to lobby |
| **Zero dependencies** | Python stdlib only — no `pip install` ever needed |

---

## Project Structure

```
neonduel_db/
├── index.html          ← All game screens (menu, lobby, char select, game)
├── stats.html          ← Stats dashboard (leaderboard, matches, kill feed)
├── css/
│   └── styles.css      ← All UI + game styles
├── js/
│   ├── characters.js   ← Character & ability definitions
│   ├── engine.js       ← Game physics, abilities, tester mode, state builder
│   ├── network.js      ← WebSocket client, lobby, char select, state sync
│   └── ui.js           ← Canvas rendering, HUD, fog of war, keybinds, pause
└── server/
    ├── server.py       ← Combined HTTP + WebSocket server with SQLite database
    └── neonduel.db     ← Auto-created SQLite database (stats persist between sessions)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game rendering | HTML5 Canvas 2D API |
| Game logic | Vanilla JavaScript (ES2020), no frameworks |
| UI & screens | HTML5 + CSS3 (Orbitron + Share Tech Mono via Google Fonts) |
| Backend | Python 3 — `asyncio`, `socket`, `sqlite3`, `struct`, `hashlib` |
| Networking | Raw WebSocket (RFC 6455) — hand-rolled, no library |
| Database | SQLite — 3 tables: `players`, `matches`, `kill_log` |
| Deployment | ngrok HTTP tunnel — single port, single terminal |

---

## How to Run

### Prerequisites

- Python 3.6 or later
- [ngrok](https://ngrok.com/download) — free account, one tunnel

### Step 1 — Start the server

```bash
cd neonduel_db/server
python3 server.py
```

You should see:

```
==========================================================
  NEON DUEL 2v2 — SERVER + DATABASE (port 8080)
==========================================================
  Database : .../server/neonduel.db

  API Endpoints:
    /api/leaderboard       top players by wins
    /api/matches           recent match history
    /api/kills             recent kill feed
    /api/player/NAME       player profile & stats

  STEP 1: ngrok http 8080
  STEP 2: Share https://XXXX.ngrok-free.app/index.html
==========================================================
[OK] Server running on port 8080. Ctrl+C to stop.
```

### Step 2 — Expose publicly

In a second terminal:

```bash
ngrok http 8080
```

Copy the `https://XXXX.ngrok-free.app` URL from the ngrok output.

### Step 3 — Share with players

| What | URL |
|---|---|
| Game | `https://XXXX.ngrok-free.app/index.html` |
| WebSocket (paste in game) | `wss://XXXX.ngrok-free.app` |
| Stats dashboard | `https://XXXX.ngrok-free.app/stats.html` |

All players paste the same `wss://` URL into the connection field on the menu screen.

### Tester Mode (no server needed)

Click **TESTER** on the main menu → enter the password → play a local 1v1 split-keyboard match to test mechanics offline.  
Player 1 uses `WASD / SPACE / Q E R`.  
Player 2 uses `ARROW KEYS / ENTER / U I O`.

---

## Gameplay

### Flow

```
Menu → Connect to server → Lobby → Pick team → Character select → Match → Round over → Next round / Match over
```

### Rounds & scoring

- First team to **3 round wins** takes the match.
- Each round ends when one team's players are all eliminated.
- A maximum of 7 rounds can be played.
- Scores and kills are persisted to the database at match end.

### Default controls (fully rebindable)

| Action | Player 1 | Player 2 (tester mode) |
|---|---|---|
| Move | `W A S D` | Arrow keys |
| Aim | Mouse cursor | Mouse cursor |
| Shoot | `Space` or `Mouse0` | `Enter` |
| Ability Q | `Q` | `U` |
| Ability E | `E` | `I` |
| Ability R | `R` | `O` |
| Pause | `Escape` | — |

Controls can be rebound in the **KEYBINDS** screen from the main menu or from the pause menu mid-match. Mouse buttons are also assignable.

---

## Characters

### Reyna — Duelist

> Aggressive fragger. High damage, self-sufficient.

| Stat | Value |
|---|---|
| HP | 100 |
| Speed | 3.6 |
| Ammo | 40 |

| Slot | Ability | Description | Cooldown |
|---|---|---|---|
| Q | Flash | Blinds all enemies in a cone | 10 s |
| E | Smoke | Deploys a smoke cloud at cursor | 12 s |
| R | Devour | Instantly heals HP | 14 s |

---

### Sage — Sentinel

> Support anchor. Heals allies, blocks routes, slows enemies.

| Stat | Value |
|---|---|
| HP | 120 |
| Speed | 2.8 |
| Ammo | 40 |

| Slot | Ability | Description | Cooldown |
|---|---|---|---|
| Q | Heal | Restores HP to self | 12 s |
| E | Barrier | Erects a solid wall at cursor | 16 s |
| R | Slow Field | Deploys a slowing zone at cursor | 14 s |

---

### Surge — Vanguard

> Electro-warrior. High HP, disruption toolkit.

| Stat | Value |
|---|---|
| HP | 125 |
| Speed | 3.0 |
| Ammo | 40 |

| Slot | Ability | Description | Cooldown |
|---|---|---|---|
| Q | Chain Bolt | Bouncing lightning projectile | 6 s |
| E | Tesla Shield | Blocks the next incoming projectile | 10 s |
| R | Overcharge | Speed + rapid-fire for 5 seconds | 18 s |

---

## REST API & Stats

The Python server exposes 4 JSON endpoints alongside the WebSocket and static file serving — all on port 8080, all without any extra library.

| Endpoint | Method | Description |
|---|---|---|
| `/api/leaderboard` | GET | Top 20 players sorted by wins then K/D ratio |
| `/api/matches` | GET | Last 20 completed matches with team names and scores |
| `/api/kills` | GET | Last 50 kills with killer, victim, characters, round |
| `/api/player/{NAME}` | GET | Full profile: stats + last 10 kills + last 10 matches |

### Database schema

**`players`** — one row per unique player name

| Column | Type | Description |
|---|---|---|
| `name` | TEXT PK | Player callsign (uppercase) |
| `wins` | INTEGER | Match wins |
| `losses` | INTEGER | Match losses |
| `kills` | INTEGER | Total kills |
| `deaths` | INTEGER | Total deaths |
| `matches` | INTEGER | Total matches played |
| `rounds_won` | INTEGER | Total rounds won |
| `created_at` | TEXT | First seen timestamp |

**`matches`** — one row per completed match

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment match ID |
| `winner_team` | TEXT | `A`, `B`, or `DRAW` |
| `team_a` / `team_b` | TEXT | Comma-separated player names |
| `score_a` / `score_b` | INTEGER | Round wins per team |
| `rounds` | INTEGER | Total rounds played |
| `mode` | TEXT | `1v1` or `2v2` |
| `played_at` | TEXT | Timestamp |

**`kill_log`** — one row per kill event

| Column | Type | Description |
|---|---|---|
| `match_id` | INTEGER FK | References `matches.id` |
| `round_num` | INTEGER | Round in which the kill happened |
| `killer` / `victim` | TEXT | Player names |
| `killer_char` / `victim_char` | TEXT | Character IDs |
| `ts` | TEXT | Timestamp |

### Stats dashboard

Open `stats.html` in a browser pointed at the running server.  
The dashboard auto-refreshes and shows:

- **Leaderboard** — ranked table with win %, K/D, rounds won
- **Match history** — recent games with team compositions and scores
- **Kill feed** — recent kills with character names and round numbers
- **Player profile** — click any player name to see their detailed stats

---

## WebSocket Message Protocol

All messages are JSON objects with a `_from` field (player ID) added automatically by the client. The server relays every message to all other clients in the same room.

| Message type | Direction | Purpose |
|---|---|---|
| `JOIN_ROOM` | Client → Server | Join or create a room |
| `ANNOUNCE` | Client → All | Broadcast new player joining |
| `LFULL` | Server → All | Full lobby state sync |
| `LUPDATE` | Client → All | Player data update (team, char) |
| `SET_MODE` | Host → All | Switch between 1v1 and 2v2 |
| `GO_SELECT` | Host → All | Move everyone to character select |
| `CHAR_PICK` | Client → All | Player picked a character |
| `GO_GAME` | Host → All | Game starting — includes initial state |
| `INPUT` | Client → Host | Keys + aim angle every 50 ms |
| `ABILITY` | Client → Host | Ability slot triggered |
| `SS` | Host → All | State snapshot (every 3 ticks) |
| `REND` | Host → All | Round ended — winner + score |
| `NR` | Host → All | Next round starting — new state |
| `KF` | Host → All | Kill feed event (also persisted to DB) |
| `FX` | Host → All | Effect log entry |

### Host vs client architecture

- The **room creator** is the authoritative host. They run `hostTick()` — the physics loop.
- All other clients run `clientTick()` — send inputs, receive state snapshots, and render locally.
- State sync happens every 3 game ticks via the `SS` message.
- Clients apply `mergeState()` to blend the received snapshot while preserving their own input keys and aim angle.

---

## Script Load Order

Scripts must load in this exact order (already correct in `index.html`):

```html
<script src="js/characters.js"></script>  <!-- data only, no deps -->
<script src="js/engine.js"></script>       <!-- needs CHARS -->
<script src="js/network.js"></script>      <!-- needs engine globals -->
<script src="js/ui.js"></script>           <!-- needs everything above -->
```

---

## File Ownership

| File | Owner | Responsibility |
|---|---|---|
| `server/server.py` | Aditya | Python backend — WebSocket relay, HTTP serving, SQLite DB |
| `js/network.js` | Shivam| WebSocket client, lobby, char select, state sync |
| `js/characters.js` | Shivam | Character definitions and ability data |
| `js/engine.js` | Shivam | Physics, movement, shooting, abilities, tester mode |
| `css/styles.css` |  Neeraj | All UI and game styles |
| `js/ui.js` | Neeraj | Canvas rendering, HUD, fog of war, pause menu, keybinds |
| `index.html` | Neeraj | HTML structure — all screens and game elements |
| `stats.html` | Aditya | Stats dashboard — REST API consumer + UI |

---

## Credits

50% of the core game logic — physics engine, ability system, networking architecture, fog of war, multiplayer state sync, and SQLite integration — was designed and implemented with the assistance of **Claude** by Anthropic ([claude.ai](https://claude.ai)).  
The remaining 50% was built and directed by the development team.
