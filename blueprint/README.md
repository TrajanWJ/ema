# EMA Blueprint Planner — Bootstrap v0.2-preview

Live read-only web dashboard for the `ema-genesis/` graph. Opens in a browser, shows current canon + GAC queue + research layer + schematic. Reads files on every request so edits show up immediately on refresh.

**Zero dependencies.** Single file, plain Node.js stdlib. No `npm install`, no build step.

## Run

```bash
node /home/trajan/Projects/ema/blueprint/server.js
```

Then open <http://localhost:7777> in your browser.

Auto-refresh is set to 60s. Refresh manually at any time to re-read `ema-genesis/` from disk.

## Why this exists

The point of EMA's Blueprint Planner (per `canon/specs/BLUEPRINT-PLANNER.md`) is that the tool itself is the medium for iterating on EMA's design — open the view, see the current state, edit the schematic from inside the tool. Not through chat.

Bootstrap v0.1 was the markdown folder operated manually. Bootstrap v0.2-preview is this server — a read-only view over the same folder. Bootstrap v0.2 (next iteration) adds POST handlers for answering GAC cards, adding intents, and locking canon decisions without ever touching the files by hand.

## What it shows

- **Stats bar**: canon decision count, GAC answered/open, research node count, extractions written, clones on disk
- **Schematic**: full `SCHEMATIC-v0.md` architecture diagram (expandable)
- **Canon decisions**: all locked decisions from `canon/decisions/`
- **Open GAC queue**: unanswered gaps + assumptions + clarifications
- **Answered GAC queue**: resolved cards with their resolution flag
- **Research layer**: count by category (9 categories)
- **Next action hints**: what to work on next based on current state

## Routes

- `GET /` — dashboard
- `GET /node/<relative-path>` — single-file view of any markdown node in `ema-genesis/`
- `GET /health` — JSON liveness check

## Customize port

```bash
EMA_BLUEPRINT_PORT=8080 node /home/trajan/Projects/ema/blueprint/server.js
```

## Kill

```bash
pkill -f "blueprint/server.js"
```

## Next iteration (v0.2 real)

- POST `/gac/:id/answer` — answer a GAC card from the browser, server writes resolution to the markdown file + flips status: answered
- POST `/intent/new` — add a new intent
- POST `/decision/new` — create a new canon decision node (DEC-NNN)
- WebSocket refresh on file change (chokidar watcher) instead of meta refresh
- Intent graph view (SVG rendered from wikilinks)

## Files

- `server.js` — the entire server (~600 lines, zero deps)
- `README.md` — this file

## Non-goals for v0.2-preview

- No authentication (localhost only, bound to 127.0.0.1)
- No write operations (read-only by design — safer for first iteration)
- No JS on the client (server-rendered HTML + meta refresh)
- No dependency on `ema-genesis/_clones/` being populated (gracefully handles empty clones)
