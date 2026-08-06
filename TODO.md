# TODO

## 🔴 High — Code Duplication

- [x] **Gameweek logic × 3** — `buildQualifyingDates()` and `getCurrentAndPrevGWDates()` helpers exist but
  `GET /api/football/gameweeks` and `GET /api/gameweek/current` still contain full inline copies of the same
  algorithm. Refactor both endpoints to call the shared helpers instead.

- [ ] **Auth token extraction × 15** — every protected route manually extracts and verifies the Bearer token.
  Replace with two Express middleware functions (`requireAuth`, `requireAdmin`) that attach the decoded
  payload to `res.locals` and short-circuit with 401/403 automatically.

- [ ] **`mongoClient.db('goalsgoalsgoals')` × 20** — hardcoded in every route. Promote to a module-level
  `let db: Db | null = null;` variable assigned inside `connectMongo()`, the same way `usersCollection`
  is already handled.

## 🟡 Medium — Security / Reliability

- [ ] **Dynamic `require()` in sync routes** — `POST /api/admin/sync-leagues` and `POST /api/admin/sync-fixtures`
  use `require('../dist/fixture-fetcher')` at runtime instead of a top-level import. Replace with
  `import { FixtureFetcher } from './fixture-fetcher';` at the top of `server.ts`.

- [ ] **`GET /api/matches/history` is unauthenticated** — returns any user's full match history with no token
  required. Add auth middleware (at minimum check a valid JWT is present).

- [ ] **`GET /api/admin/users` is a duplicate of `GET /api/users`** — identical query and response shape.
  Delete one or delegate one to the other's handler.

## 🟢 Low — Minor Tidying

- [ ] **Dead `writeUsers()` function** — no route calls it anymore. Remove it.

- [ ] **Season year computation × 4** — `month >= 7 ? year : year - 1` repeated throughout `server.ts`.
  Extract to a single `function currentSeasonYear(): number` helper.

- [ ] **Verbose login logging** — `[LOGIN]` logs expose whether a username exists vs password failure.
  Condense to a single success/failure line to avoid leaking enumerable usernames in shared log viewers.
