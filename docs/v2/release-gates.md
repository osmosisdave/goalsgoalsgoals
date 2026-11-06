# Release Gates (v2)

## Gate Model Overview
All gates must pass unless explicitly waived by release authority.

- Gate status values: `Not Started`, `In Progress`, `Pass`, `Fail`, `Waived`.
- Evidence is mandatory for each passed gate.

## Gate 1: Scope and Requirement Lock
Pass criteria:
- `discovery-decisions` and `mvp-requirements` approved.
- In-scope/out-of-scope finalized.
- Deferred items list documented.

Evidence:
- Approved document revisions.
- Decision signoff record.

## Gate 2: Architecture and API Readiness
Pass criteria:
- v2 API boundaries and data contracts defined.
- MongoDB-only data model approved.
- Hosted backend runtime strategy approved.

Evidence:
- Architecture/API summary.
- Data model specification.

## Gate 3: Access Control and Invite Workflow Readiness
Pass criteria:
- Invite-only onboarding rules validated:
  - 30-day expiry
  - single-use token
  - revocation support
- Role enforcement validated for `admin` and `user`.
- Admin-only endpoint protections validated.

Evidence:
- Access matrix.
- Test results for authz paths.

## Gate 4: Gameplay Rule Conformance
Pass criteria:
- Valid-day threshold and kickoff-time logic verified.
- Selection lock and repick behavior verified.
- Steal mechanics verified.
- No-selection penalty verified.
- BTTS outcome model and points verified.
- Ranking tie-break logic verified.

Evidence:
- Rule conformance test report.

## Gate 5: Visibility and Lock Behavior
Pass criteria:
- Other users’ picks visible at all times.
- Username highlighting for picked fixtures verified.
- `stealable` indicator hidden after lock.

Evidence:
- UI verification report.

## Gate 6: External Ingest and Operations
Pass criteria:
- Admin-only manual ingest from API-Football validated.
- Ingest writes persist correctly to MongoDB.
- Admin result override flow validated.
- Standings recalc triggered by ingest and overrides.

Evidence:
- Ingest operation runbook check.
- Operational test logs.

## Gate 7: Test Evidence Completion
Pass criteria:
- Playwright suite executed in Chromium lane.
- Critical flows pass at agreed quality threshold.
- Critical defects resolved or explicitly waived.

Evidence:
- Playwright run reports.
- Defect triage summary.

## Gate 8: Distribution and Environment Readiness
Pass criteria:
- MVP build is deployable via TestFlight.
- Mobile access and key flows verified.
- Production environment and secrets are configured.

Evidence:
- TestFlight deployment proof.
- Environment readiness checklist.

## Deferred Item Exception Handling
- D-001 fixture final-status mapping may be temporarily excepted only if:
  1. Explicitly listed in go/no-go decision.
  2. Risk accepted by release authority.
  3. Closure plan has owner and date.

## Quantitative Thresholds (To Finalize)
- Standings load performance threshold.
- Maximum tolerated flaky test rate.
- Minimum required Playwright pass percentage.

## Final Go/No-Go Decision
Required approvers:
- Product owner
- Engineering owner
- QA owner

Decision record must include:
- Gate summary and evidence links
- Active waivers
- Residual risk statement
- Launch decision

## Waiver Policy
- Waivers require named owner and expiry date.
- Waivers cannot bypass security-critical admin access controls.

## Revision History
- 2026-11-06: Initial release gate baseline created.
