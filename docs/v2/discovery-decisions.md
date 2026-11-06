# Discovery Decisions (v2)

## Purpose and Scope of Discovery Decisions
This document is the authoritative record of product and delivery decisions for the v2 greenfield rewrite.

## Decision Context and Constraints
- Greenfield rewrite; do not inherit old code contracts by default.
- API redesign is allowed in v2.
- MongoDB-only persistence.
- Hosted backend runtime is required.
- External football data source is API-Football v3 (live API).
- Only admin can trigger live ingest.
- MVP automated UI testing scope is Chromium only.
- MVP must be deployable to TestFlight (App Store release not required).

## Finalized Product and Platform Decisions
- Core problem: users select football fixtures under rules; standings are generated from results.
- Roles: `user`, `admin`.
- Primary outcomes:
  1. Admin-triggered fixture/result ingest from API-Football stored in DB.
  2. League table calculated from stored results.
  3. Users can make valid selections and see outcomes.

## Authentication and Access Model Decisions
- Invite-only onboarding.
- Admin sends invite to email.
- Invite expiry: 30 days.
- Invite token: single-use.
- Admin can revoke invites before use.
- Admin is super-role with all permissions.

## Data and Integration Decisions
- Database target: MongoDB only.
- Ingest mode: manual admin trigger only (no scheduler for MVP).
- Competition mapping to API-Football league IDs is fixed configuration.

## Gameplay Rules Baseline (Locked Inputs)
### Valid day and valid fixture rules
- A day is valid when it has `>= 30` valid fixtures.
- Valid fixture kickoff times use timezone `Europe/London` (DST-aware).
- Tuesday window is inclusive: `19:00:00` through `20:00:00`.
- Saturday valid kickoff must equal exactly `15:00:00`.

### Selection and lock rules
- One selection per user per valid day.
- Users can change selection until lock.
- Lock time is 10 minutes before earliest valid kickoff on that valid day.
- After lock, selections cannot be changed.
- Only latest selection is stored (no edit history).
- No selection on a valid day gives `-1` points.

### Postponement and carry-forward rules
- Postponed/abandoned selected fixture is carried by fixture ID.
- User cannot replace that carried selection for the same valid day.
- Standings update when carried fixture is finally resolved.

### Steal rules
- If a user picks the same team on two consecutive valid days, the second-day fixture is stealable.
- Steal transfers fixture ownership immediately.
- Fixture claims are first-come-first-served; only one user can own a fixture on a valid day.
- Steals can happen only before `day lock - 1 day`.
- Original user must repick another fixture.
- If original user does not repick, apply no-selection penalty (`-1`).

### Scoring and ranking rules
- Outcome model is BTTS-based:
  - Win: both teams score at least one goal.
  - Draw: goal to nil either way.
  - Loss: `0-0`.
- Points: `win = 3`, `draw = 1`, `loss = -1`.
- Tie-break order: `points total` > `goals total` > `wins total`.
- `goals total` = sum of goals in all selected fixtures by that user for the season.

## Visibility and Lock Behavior Decisions
- Valid-day fixtures are shown in a filterable list.
- Other users’ picks are visible at all times and highlighted with username.
- `stealable` flag is visible before lock and hidden after lock.

## Competitions Included at Launch
- English League tiers 1–5
- Scottish League tiers 1–4
- FA Cup (First Round onwards)
- League Cup
- EFL Trophy
- Scottish Cup (First Round onwards)
- Scottish League Cup
- Scottish Challenge Cup
- Champions League
- Europa League
- Europa Conference League

## Recalculation and Failure Behavior
- League table recalculates when results update.
- League table recalculates after admin result override/edit.
- If recalculation fails, table is unavailable (no stale fallback).

## Testing and Distribution Decisions
- Playwright required for automated testing.
- Chromium-only browser automation for MVP.
- TestFlight deployability is required for MVP.

## Deferred / Open Decisions
### Deferred Item D-001: Fixture final-status mapping
- Description: Exact API-Football status codes that define final/scorable fixtures are not finalized.
- Reason deferred: Requires integration-level confirmation of real status values.
- Owner: Product + Engineering.
- Revisit trigger: During API-Football integration before settlement implementation.
- Closure criteria:
  1. Status mapping table approved (`provider status -> internal settlement state`).
  2. Edge-case handling approved (abandoned/interrupted/AET/PEN/awarded/void).
  3. Automated tests added for mapped status families.

## Decision Change Control
- Any change to a locked rule must be logged with date, rationale, and downstream impact.
- Impacted documents (`mvp-requirements`, `release-gates`, `test-strategy`, `traceability-matrix`) must be updated in the same change.

## Revision History
- 2026-11-06: Initial v2 discovery baseline created.
