# MVP Requirements (v2)

## MVP Objective and Success Criteria
Deliver an invite-only football selection product where users pick valid fixtures, standings are recalculated from live fixture outcomes, and admins operate data ingest and correction workflows safely.

Success criteria:
1. Admin can ingest live fixture/result data from API-Football into MongoDB.
2. Users can select one valid fixture per valid day and repick pre-lock.
3. Standings compute correctly from locked rules and update on result changes.
4. MVP is tested with Playwright (Chromium lane) and deployable to TestFlight.

## In-Scope MVP Capabilities
- Invite-only user onboarding.
- Authenticated user fixture selection.
- Valid-day fixture filtering and selection lock handling.
- Steal flow based on consecutive-team rule.
- BTTS-based scoring and standings.
- Admin operations for ingest, overrides, recalculation, and user/admin controls.
- Live competition filtering via fixed league ID mapping.

## Out-of-Scope / Deferred for Post-MVP
- App Store distribution.
- Non-Chromium full browser E2E parity.
- Dynamic in-app competition mapping management UI.
- Automated scheduled ingest.
- Advanced historical snapshot fallback for failed recalculation.

## User Access and Onboarding Requirements
- Only invited users can register.
- Invite link expires after 30 days.
- Invite token is single-use.
- Admin can revoke unused invite.
- Roles are `user` and `admin`.
- `admin` has all permissions.

## Core Gameplay Requirements (Normative Rules)
### Valid day and fixture
- A day is valid if it has at least 30 valid fixtures.
- Valid fixture kickoff rules in `Europe/London` timezone:
  - Tuesday between 19:00:00 and 20:00:00 inclusive.
  - Saturday exactly 15:00:00.

### Selection lifecycle
- User can hold one selected fixture per valid day.
- User can change selection until day lock.
- Day lock is 10 minutes before earliest valid kickoff on that day.
- After lock, selection changes are blocked.
- Only latest selection is stored.

### No selection rule
- If user has no selection by lock on a valid day, apply `-1` points.

### Postponement carry-forward
- Selected postponed/abandoned fixture is tracked by fixture ID until resolved.
- User cannot replace carried selection for that valid day.

### Steal rule
- Picking the same team on two consecutive valid days makes second-day selection stealable.
- Steal ownership transfer is immediate and FCFS.
- Steals allowed only until `(day lock - 1 day)`.
- Original user must repick; no repick by lock results in `-1`.

### Scoring and ranking
- Win (BTTS): both teams score, points `3`.
- Draw (goal to nil): one side scores, points `1`.
- Loss (0-0): points `-1`.
- Ranking tie-break: points total > goals total > wins total.
- Goals total = total goals in all selected fixtures for the season.

## Picks Visibility and Lock Requirements
- Fixture list is filterable.
- Other users’ picks are visible at all times and labeled by username.
- `stealable` marker is hidden after day lock.

## Backend and Data Requirements
- Backend is publicly hosted over HTTPS.
- MongoDB is the only persistence store.
- API contracts are v2-defined and may differ from legacy.
- All protected routes enforce role-based access server-side.

## External Data Ingest Requirements
- Live API-Football calls are admin-triggered only.
- Ingest writes fixture/result updates to MongoDB.
- Admin can override fixture results.
- Any result update or admin override triggers standings recalculation.

## Client/Test Platform Requirements
- MVP E2E automation is Chromium-only with Playwright.
- MVP release requires successful TestFlight deployability.
- Mobile usage must be supported (responsive behavior required).

## Non-Functional MVP Requirements
- Reliability: core user/admin paths must complete without critical defects.
- Security: role checks enforced for admin-only operations.
- Observability: ingest and admin actions must be auditable.
- Performance: standings load must meet launch threshold (to be set in release gates).

## Deferred Requirements
### D-001 Fixture final-status mapping
- Final/scorable API-Football statuses are deferred pending integration validation.
- Settlement implementation cannot be marked complete until D-001 is closed.

## Acceptance Criteria Framework
- Each requirement must map to:
  1. At least one automated or manual verification step.
  2. A release gate checkpoint.
  3. Traceability matrix entry.

## Release Readiness Dependencies
- Approved release gate evidence.
- Approved Playwright evidence for Chromium lane.
- Successful TestFlight deployability evidence.
- Deferred item D-001 tracked with explicit exception until closure.

## Revision History
- 2026-11-06: Initial MVP requirements baseline created.
