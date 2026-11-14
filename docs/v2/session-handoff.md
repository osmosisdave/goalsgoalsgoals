# v2 Session Handoff

## Purpose
Use this file to resume work reliably in a future session.

## Source of Truth
Always read these first:
- [discovery-decisions.md](discovery-decisions.md)
- [mvp-requirements.md](mvp-requirements.md)
- [release-gates.md](release-gates.md)
- [test-strategy-playwright.md](test-strategy-playwright.md)
- [traceability-matrix.md](traceability-matrix.md)
- [technical-implementation.md](technical-implementation.md)
- [security-secrets-policy.md](security-secrets-policy.md)

## Current Status (update each session)
- Phase: Phase B substantially complete (`packages/shared` rule set implemented)
- Last completed step: Implemented and tested shared rules for REQ-006 kickoff validity (Europe/London DST-aware), REQ-008 day lock timing, REQ-014 steal cutoff window, REQ-015 BTTS scoring, and REQ-016 tie-break ordering; all shared tests passing. Added TODO note in tie-break logic for future deterministic alphabetical fallback when all comparators are equal.
- Runtime setup note: local API runs only when `MONGODB_URI` and `MONGODB_DB_NAME` are present in the process environment, and the repo does not auto-load `.env` files. For local dev, use a repo-root `./.env.local` and export it into the shell before `pnpm --filter @ggg/api start`.
- Local MongoDB note: use a fresh local MongoDB container (`docker run -d --name ggg-mongo -p 27017:27017 mongo:7`) and keep v1 data isolated; do not point the v2 API at the old server by default.
- Port conflict note: if `listen EADDRINUSE` occurs on `0.0.0.0:3000`, stop the stale API process or change `PORT` in `.env.local` before restarting.
- Next intended step: Finish Phase B closeout (confirm shared export surface, document any remaining rule TODOs), then begin Phase C with auth + invite lifecycle (REQ-001/REQ-002) in `apps/api`.
- Blockers: None currently. Known deferred item remains for implementation detail: D-001 fixture final-status mapping.
- Deferred items: D-001 fixture final-status mapping

## Session Start Prompt (copy/paste)
Use docs in `docs/v2` as the source of truth and resume from `Current Status` in `docs/v2/session-handoff.md`. Complete any remaining Phase B closeout tasks in `packages/shared` with small, readable, test-first increments, then begin Phase C auth/invite lifecycle in `apps/api` (REQ-001/REQ-002). Keep `D-001` as interface/extension point only (no final status mapping hardcode). Do not change domain rules unless explicitly asked. Keep MongoDB-only, admin-only manual API ingest, invite-only auth, Chromium Playwright MVP lane, TestFlight MVP gate, exact dependency versions, and no-committed-secrets policy.

## Session End Checklist
- Update `Current Status` in this file.
- Update [traceability-matrix.md](traceability-matrix.md) for new/changed REQ/TST/GATE links.
- Update [release-gates.md](release-gates.md) evidence status if applicable.
- Record any decision changes in [discovery-decisions.md](discovery-decisions.md).

## Local Startup Command (copy/paste)
```bash
cd /Users/dave/repos/goalsgoalsgoals
set -a
source .env.local
set +a
pnpm --filter @ggg/api start
```

## Local Mongo Startup (copy/paste)
```bash
docker run -d --name ggg-mongo -p 27017:27017 mongo:7
```

## If port 3000 is already in use
```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill <PID>
```
