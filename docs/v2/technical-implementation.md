# Technical Implementation Plan (v2)

## 1) Chosen Implementation Stack

### Monorepo and Tooling
- Monorepo layout with `pnpm` workspaces.
- TypeScript across all services.
- ESLint + Prettier for consistency.
- GitHub Actions for CI.

### Backend API
- Runtime: Node.js 22 LTS.
- Framework: `Fastify` with typed route schemas.
- Validation: `zod` (request/response and domain rule validation).
- Database: MongoDB Atlas only (no file mode).
- Auth: JWT-based role model (`user`, `admin`) with server-side role enforcement.
- API client: API-Football v3 service wrapper, callable only from admin routes.

### Frontend Web
- Framework: React + Vite + TypeScript.
- UI: responsive-first component system.
- State: lightweight route-local state + query cache for API data.
- Mobile browser support is mandatory for MVP.

### iOS Test Distribution
- Packaging: Capacitor iOS wrapper around web build.
- Distribution: TestFlight required for MVP gate.
- App Store submission: out of scope for MVP.

### Testing
- Unit tests: Vitest.
- API/service tests: Vitest + integration layer.
- E2E: Playwright Chromium lane for MVP.
- Rule-conformance suite for lock/steal/scoring/tie-break logic.

## 2) System Architecture (MVP)

- `apps/api`: REST API, auth, invite workflow, admin ingest, standings recalculation.
- `apps/web`: user/admin UI (selection, standings, admin ops).
- `apps/mobile`: Capacitor project for TestFlight packaging.
- `packages/shared`: shared types, schema contracts, and pure rule engine.

## 3) Data Model Baseline (MongoDB)

Core collections:
- `users`
- `invites`
- `fixtures`
- `selections`
- `standings`
- `ingest_runs`
- `audit_logs`
- `config_competitions`

Notes:
- Competition mapping is fixed config (one-time setup).
- Fixture identity is provider `fixtureId` for carry-forward and settlement.
- Standings are recalculated on result updates and admin overrides.

## 4) API Shape Baseline

- Versioned API namespace: `/api/v2`.
- Admin-only routes for:
  - ingest trigger
  - result override
  - recalc trigger
  - invite send/revoke
- User routes for:
  - auth/session
  - fixture list by valid day
  - select/repick
  - standings read

## 5) Build Sequence (How Work Begins)

### Phase A — Foundation (start here)
1. Create monorepo structure and package scripts.
2. Add lint/test/build CI pipeline.
3. Add shared schemas/types package and ID conventions.

### Phase B — Domain Core
4. Implement pure rule engine in shared package:
   - valid day qualification
   - lock-time logic
   - steal eligibility
   - scoring and tie-break computation
5. Add deterministic unit tests for each rule.

### Phase C — Backend MVP Core
6. Implement auth + invite lifecycle (30-day, single-use, revocable).
7. Implement fixtures/selections/standings endpoints.
8. Implement admin-only API-Football ingest and override workflows.

### Phase D — Frontend MVP
9. Build responsive user flow:
   - login/invite completion
   - valid-day fixture selection list
   - always-visible picks with username highlighting
   - standings
10. Build admin flow:
   - invite management
   - ingest trigger
   - override + recalc actions

### Phase E — Verification and Distribution
11. Implement Playwright Chromium MVP suite.
12. Package iOS build via Capacitor and publish to TestFlight.
13. Run release gates and signoff.

## 6) Gate-Aligned Definition of Done

A phase is complete only when:
- mapped requirements pass planned tests,
- traceability rows are updated,
- release gate evidence is attached,
- deferred item impacts are documented.

## 7) Deferred Item Handling

- `D-001` fixture final-status mapping remains deferred.
- Implementation can proceed with placeholder mapping interfaces, but settlement completion is blocked until `D-001` closure criteria are met.

## 8) Immediate Next Actions

1. Approve this technical plan.
2. Scaffold monorepo foundation (`apps/api`, `apps/web`, `apps/mobile`, `packages/shared`).
3. Implement rule engine first before API/UI routes.

## Revision History
- 2026-11-06: Initial technical implementation baseline.
