# Test Strategy (Playwright, v2)

## Strategy Purpose and Test Boundaries
Define MVP automated validation strategy for critical product behavior and release confidence.

## Platform Scope
- Browser automation scope for MVP: Chromium only.
- Non-Chromium full parity is deferred post-MVP.

## Test Levels and Coverage Model
- Primary: end-to-end user/admin journeys.
- Secondary: edge-case rule behavior for lock, steal, and scoring.
- Smoke checks for deployment verification.

## Environment and Data Strategy
- Tests run against hosted backend environments.
- Data store is MongoDB only.
- Live API-Football integration is admin-triggered only; test plans must control call volume.

## Authentication and Invite Flow Coverage
- Invite creation by admin.
- Invite redemption by invited user.
- Invite expiry behavior (30 days).
- Single-use invite token enforcement.
- Invite revocation behavior.
- Role-protected access checks.

## Gameplay Rules Validation Coverage
- Valid-day detection with `>=30` fixtures.
- Time-window validity in `Europe/London` timezone (DST-aware).
- Selection creation and pre-lock changes.
- Lock enforcement at 10 minutes before earliest valid kickoff.
- No-selection penalty application.
- Consecutive-team steal mechanics.
- Postponed/abandoned carry-forward by fixture ID.
- BTTS scoring outcomes and points.
- Tie-break ordering logic.

## Visibility and Lock-State Coverage
- Fixture list filter behavior.
- Always-visible picks with username highlight.
- `stealable` marker hidden after lock.

## Admin Ingest Coverage
- Admin-only access to ingest trigger.
- Fixture/result ingest persistence to MongoDB.
- Admin override behavior.
- Standings recalculation trigger after ingest/override.
- Failure behavior when recalculation fails (table unavailable state).

## Mobile and Distribution Coverage
- Responsive critical path checks.
- Build/deploy readiness checks for TestFlight distribution.

## Deferred/Excluded Coverage for MVP
### D-001 Fixture final-status mapping
- Status-to-settlement verification deferred until mapping is approved.
- Placeholder test cases must exist and be marked pending.

## Evidence, Reporting, and Exit Criteria
Evidence artifacts:
- Playwright reports
- Failure logs/screenshots/video (as configured)
- Defect summary

Exit criteria:
- Critical flows pass in Chromium lane.
- No unresolved blocker defects without approved waiver.
- Evidence satisfies release gates.

## CI Execution Policy (To Finalize)
- Run triggers (PR/merge/release candidate).
- Retry policy and flake handling thresholds.
- Artifact retention period.

## Revision History
- 2026-11-06: Initial Playwright strategy baseline created.
