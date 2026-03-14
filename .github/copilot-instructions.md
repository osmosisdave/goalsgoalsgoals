# AI Instructions — Goals Goals Goals

## Project Overview
Goals Goals Goals is a football league management web app. It shows fixtures, standings, and match selections across 6 major leagues, with user authentication and admin tools. The project is production-deployed on Render but also runs locally.

**Priorities:** reliability, minimal regressions, simple UI, clear API contracts.

---

## Architecture

| Layer | Location | Language | Runs On |
|---|---|---|---|
| Frontend | `/` (root HTML + `/assets/`) | HTML, CSS, TypeScript (preferred) / JS | Python HTTP server (port 8000) |
| Frontend TS source | `/src/` | TypeScript → compiled to root | Build via `npm run build` |
| Backend | `/server/src/` | TypeScript → Express | Node.js (port 4000) |
| Data | `/server/` | JSON files or MongoDB | File or Atlas |

**Key entry points:**
- Backend server: `server/src/server.ts` (compiles to `server/dist/server.js`)
- Frontend config: `assets/js/config.js` — controls API origin and mock mode
- Start both servers: `./start.sh` (use `--mongodb` flag for MongoDB)
- Stop servers: `./stop.sh`

---

## Tech Stack

- **Frontend:** HTML5, CSS3, TypeScript (preferred for all new logic), plain JS only for config/env files that cannot be compiled
- **Backend:** Node.js, Express, TypeScript
- **Auth:** JWT (`jsonwebtoken`), password hashing (`bcryptjs`)
- **Database:** MongoDB (Atlas or local) **or** JSON files (`users.json`, `leagues.json`)
- **External API:** API-Football v3 (free tier — 100 calls/week hard limit)
- **Rate Limiter:** Custom rolling-window tracker (`server/src/api-rate-limiter.ts`)
- **Build:** `tsc` (both frontend and backend have separate `tsconfig.json` files)

---

## Running & Building

```bash
# Start both servers (file storage)
./start.sh

# Start with MongoDB
./start.sh --mongodb

# Build backend only
cd server && npm run build

# Build frontend TS only
npm run build   # from root

# View logs
tail -f logs/backend.log
tail -f logs/frontend.log
```

---

## Coding Rules

- **Match existing style** — indentation, naming, and patterns already in the file.
- **Keep changes minimal and focused** — don't refactor unrelated code.
- **TypeScript first (frontend and backend)** — new frontend logic goes in `src/` as `.ts` files and is compiled to the root. Edit `.ts` source files only, never compiled `.js` output in `dist/` or root.
- **Migrate JS to TS opportunistically** — when touching an existing `assets/js/` file for another reason, consider moving the logic to `src/` as TypeScript if the change is non-trivial. Don't migrate files you aren't already editing.
- **Type API responses** — define interfaces for any data fetched from the backend. Avoid `any`.
- **No new dependencies** without a clear reason and explicit approval.
- **Don't rename** public API endpoints, JSON fields, JWT payload keys, or HTML element IDs without checking every caller first.
- **Both storage modes must work** — changes to data access must support both JSON-file and MongoDB paths.
- **Guard all env vars** — always provide a safe fallback (e.g. `process.env.X || 'default'`).
- **Comments:** explain *why*, not *what*. Don't add comments that just restate the code.

---

## Domain Rules

- **API rate limit:** soft limit 75, hard limit 100 calls per rolling 7-day window. Never bypass or silently skip rate limit checks.
- **User roles:** `admin` and `user`. Admin-only routes must always verify the `role` in the JWT payload.
- **Auth flow:** JWT stored client-side; backend validates on each protected request. Tokens are checked in `server/src/server.ts`.
- **Mock API mode:** controlled by `window.GGG_USE_MOCK_API` in `assets/js/config.js`. Do not hardcode mock behaviour outside of that flag.
- **Leagues:** 6 supported leagues defined by `DEFAULT_LEAGUE_IDS` in `server/src/fixture-fetcher.ts`. Don't hardcode league IDs elsewhere.

---

## File Layout Reference

```
src/                         ← Frontend TypeScript source (preferred for all new logic)
assets/js/config.js          ← API origin + mock flag — keep as JS (not compiled)
assets/js/auth.js            ← Frontend auth helpers (migrate to src/ when editing)
server/src/server.ts         ← All Express routes and middleware (~1250 lines)
server/src/api-rate-limiter.ts ← Rate limiter logic
server/src/fixture-fetcher.ts  ← External API-Football calls
server/src/types/            ← Shared TypeScript types
server/.env                  ← JWT_SECRET, MONGODB_URI, INIT_ADMIN_PASS (not committed)
server/users.json            ← User store (file mode)
server/leagues.json          ← League/fixture store (file mode)
server/api-calls.json        ← Rate limiter call log (file mode)
```

---

## What To Avoid

- Large refactors or file reorganisations without explicit approval.
- Changing the auth mechanism or JWT secret handling.
- Removing the dual storage (file + MongoDB) capability.
- Placeholder or stub implementations left in production paths.
- Touching `logs/`, `dist/`, or compiled output files directly.
- Breaking the `./start.sh` / `./stop.sh` workflow.

---

## When Making Changes

1. Read the relevant source file(s) before editing.
2. Check if the change affects both file-storage and MongoDB code paths.
3. If an API endpoint changes, update both the backend route and any frontend caller.
4. After backend changes: run `cd server && npm run build` to verify TypeScript compiles.
5. After any frontend changes (new or edited `src/` files): run `npm run build` from the root.
6. New frontend logic should be written in `src/` as TypeScript, not added to `assets/js/` as plain JS.
7. Note any assumptions or follow-up steps clearly.
