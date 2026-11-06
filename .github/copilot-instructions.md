# AI Instructions — Goals Goals Goals (v2 Greenfield)

## Project State
This repository has been reset for a **new v2 implementation**.

- Treat old architecture and old contracts as deprecated.
- Build from `docs/v2` specifications first.
- Prioritize readability, small changes, and learning-oriented implementation.

## Source of Truth
Use these docs as primary references before coding:

- `docs/v2/discovery-decisions.md`
- `docs/v2/mvp-requirements.md`
- `docs/v2/release-gates.md`
- `docs/v2/test-strategy-playwright.md`
- `docs/v2/traceability-matrix.md`
- `docs/v2/technical-implementation.md`

If code conflicts with docs, docs win unless the user explicitly changes a decision.

---

## Response Style (Hands-On Build Mode)

- Keep implementation steps **small and readable**.
- Prefer incremental PR-sized changes over large drops.
- Explain intent briefly before major edits.
- When asked, include short “why” notes to help the user learn the codebase.
- Avoid speculative features and avoid broad refactors without approval.
- Respect planning mode: if user says `plan only`, provide plan without code.
- Wait for explicit `implement`/`go ahead` before substantial multi-file work.

---

## v2 Architecture (Target)

### Monorepo Layout
- `apps/api` — Fastify + TypeScript backend API.
- `apps/web` — React + Vite + TypeScript frontend.
- `apps/mobile` — Capacitor iOS wrapper for TestFlight distribution.
- `packages/shared` — shared schemas/types and pure rule engine.

### Core Stack
- Backend: Node.js 22 LTS, Fastify, Zod.
- Frontend: React + Vite.
- Data: MongoDB only (Atlas/local).
- Auth: JWT with `admin` and `user` roles.
- E2E: Playwright (Chromium lane for MVP).

---

## Security and Dependency Rules

- Always use exact dependency versions (no `^`, `~`, `*`).
- Always use `--ignore-scripts` with package install commands.
- No new dependency without explicit reason and user approval.
- Keep secrets out of repo; rely on env vars and safe defaults.

### Secrets and API Key Policy (Mandatory)
- Never hardcode API keys, tokens, or credentials in source code, tests, scripts, or docs.
- Never commit `.env` files or secret-bearing config files.
- Use environment variables only for external API credentials (including API-Football).
- Commit only redacted examples such as `.env.example` with placeholder values.
- If a secret is accidentally detected in working files, stop and remove it before any further change.
- Treat secret handling as a release blocker until resolved.

### Banned Packages
Never install:

- `axios@1.14.1`
- `plain-crypto-js@4.2.1`

If found, remove immediately before further install steps.

---

## Domain Rules to Enforce in Code

Implement and preserve decisions from `docs/v2/discovery-decisions.md`, including:

- Valid day qualification (`>= 30` valid fixtures).
- Time windows in `Europe/London` (DST-aware).
- Selection lock timing and repick limits.
- Steal eligibility and cutoff behavior.
- BTTS scoring model and tie-break order.
- Invite-only onboarding (30-day, single-use, revocable).
- Admin-only manual API-Football ingest.

Do not silently change domain behavior.

---

## Deferred Decision Handling

`D-001` fixture final-status mapping is deferred.

- Build extension points/interfaces for status mapping.
- Do not hardcode speculative status behavior as final.
- Mark affected logic clearly and keep traceability updated.

---

## Implementation Discipline

For each change:

1. Link the change to at least one `REQ` in `traceability-matrix`.
2. Keep functions small and names explicit.
3. Prefer pure functions for rules in `packages/shared`.
4. Add/update tests close to changed behavior.
5. Keep commits scoped to one concern where possible.

Avoid giant files and avoid “god modules.”

---

## Build Order Guidance

When starting from empty scaffold:

1. Monorepo/tooling foundation.
2. Shared rule engine + unit tests.
3. API auth/invite + core domain routes.
4. Web UI flows (user then admin).
5. Playwright Chromium MVP suite.
6. TestFlight packaging readiness.

---

## Notes for AI Assistance

- Optimize for maintainability and readability over cleverness.
- Prefer explicit code over abstractions that hide core domain rules.
- If scope grows, propose a smaller first slice.
- If uncertainty remains, ask one focused question rather than guessing.
