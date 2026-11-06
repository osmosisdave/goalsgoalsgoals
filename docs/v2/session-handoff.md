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
- Phase: Pre-implementation complete (planning and reset done)
- Last completed step: Repository cleanup completed (legacy prototype files removed), v2 planning docs finalized, technical implementation baseline approved, copilot instructions aligned, and secrets policy/release-gate checks added.
- Next intended step: Begin Phase A scaffold (monorepo foundation) in small readable increments: workspace/package setup -> apps/api -> apps/web -> packages/shared -> apps/mobile shell.
- Blockers: None for scaffolding. Known deferred item remains for implementation detail: D-001 fixture final-status mapping.
- Deferred items: D-001 fixture final-status mapping

## Session Start Prompt (copy/paste)
Use docs in `docs/v2` as the source of truth. Resume from `Current Status` in `docs/v2/session-handoff.md`. Follow small, readable, incremental implementation steps. Do not change domain rules unless explicitly asked. Keep MongoDB-only, admin-only manual API ingest, invite-only auth, Chromium Playwright MVP lane, and TestFlight MVP gate. Enforce no-committed-secrets policy.

## Session End Checklist
- Update `Current Status` in this file.
- Update [traceability-matrix.md](traceability-matrix.md) for new/changed REQ/TST/GATE links.
- Update [release-gates.md](release-gates.md) evidence status if applicable.
- Record any decision changes in [discovery-decisions.md](discovery-decisions.md).
