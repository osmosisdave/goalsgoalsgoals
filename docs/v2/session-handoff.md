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
- Phase: Phase B in progress (domain core started in `packages/shared`)
- Last completed step: Shared domain contracts added (`types.ts`, `rule-types.ts`), export barrels wired, `vitest` configured in `@ggg/shared`, first rule implemented (`qualifyValidDay` for REQ-005), and deterministic unit tests added and passing (8/8).
- Next intended step: Continue Phase B with REQ-006 kickoff validity logic (Europe/London Tuesday 19:00-20:00 inclusive and Saturday 15:00 exact) using test-first approach; then proceed to REQ-008 lock timing, REQ-014 steal window, REQ-015 BTTS scoring, and REQ-016 tie-break ordering.
- Blockers: None currently. Known deferred item remains for implementation detail: D-001 fixture final-status mapping.
- Deferred items: D-001 fixture final-status mapping

## Session Start Prompt (copy/paste)
Use docs in `docs/v2` as the source of truth and resume from `Current Status` in `docs/v2/session-handoff.md`. Continue Phase B in `packages/shared` with small, readable, test-first increments. Next implement REQ-006 kickoff validity in Europe/London time (DST-aware), then REQ-008 lock timing, REQ-014 steal cutoff window, REQ-015 BTTS scoring, and REQ-016 tie-break ordering. Keep `D-001` as interface/extension point only (no final status mapping hardcode). Do not change domain rules unless explicitly asked. Keep MongoDB-only, admin-only manual API ingest, invite-only auth, Chromium Playwright MVP lane, TestFlight MVP gate, exact dependency versions, and no-committed-secrets policy.

## Session End Checklist
- Update `Current Status` in this file.
- Update [traceability-matrix.md](traceability-matrix.md) for new/changed REQ/TST/GATE links.
- Update [release-gates.md](release-gates.md) evidence status if applicable.
- Record any decision changes in [discovery-decisions.md](discovery-decisions.md).
