# Traceability Matrix (v2)

## Matrix Purpose and Usage
Map discovery decisions to MVP requirements, tests, and release gates to ensure complete coverage.

## Identifier Scheme and Conventions
- Decision IDs: `DEC-###`
- Requirement IDs: `REQ-###`
- Test IDs: `TST-###`
- Release gate IDs: `GATE-#`
- Deferred IDs: `D-###`

## Decision-to-Requirement-to-Test-to-Gate Matrix

| Decision ID | Requirement ID | Summary | Test IDs | Gate IDs | Status |
|---|---|---|---|---|---|
| DEC-001 | REQ-001 | Invite-only onboarding with 30-day single-use revocable invites | TST-001, TST-002, TST-003, TST-004 | GATE-3, GATE-7 | Planned |
| DEC-002 | REQ-002 | Roles are `user` and `admin`; admin super-role | TST-005, TST-006 | GATE-3, GATE-6 | Planned |
| DEC-003 | REQ-003 | MongoDB-only persistence | TST-007 | GATE-2, GATE-6 | Planned |
| DEC-004 | REQ-004 | Admin-only manual API-Football ingest | TST-008, TST-009 | GATE-6, GATE-7 | Planned |
| DEC-005 | REQ-005 | Valid day requires `>=30` valid fixtures | TST-010 | GATE-4 | Planned |
| DEC-006 | REQ-006 | Valid kickoff windows in `Europe/London` | TST-011, TST-012 | GATE-4 | Planned |
| DEC-007 | REQ-007 | One selection per user per valid day | TST-013 | GATE-4 | Planned |
| DEC-008 | REQ-008 | Lock is 10 minutes before earliest valid kickoff | TST-014 | GATE-4, GATE-5 | Planned |
| DEC-009 | REQ-009 | Pre-lock repick allowed; post-lock blocked | TST-015, TST-016 | GATE-4 | Planned |
| DEC-010 | REQ-010 | No selection by lock gives `-1` | TST-017 | GATE-4 | Planned |
| DEC-011 | REQ-011 | Postponed/abandoned selected fixture carried by fixture ID | TST-018 | GATE-4, GATE-6 | Planned |
| DEC-012 | REQ-012 | Consecutive-team second-day selection is stealable | TST-019 | GATE-4 | Planned |
| DEC-013 | REQ-013 | Steal is FCFS and immediate ownership transfer | TST-020 | GATE-4 | Planned |
| DEC-014 | REQ-014 | Steal window closes at `(day lock - 1 day)` | TST-021 | GATE-4, GATE-5 | Planned |
| DEC-015 | REQ-015 | BTTS scoring with points `3/1/-1` | TST-022, TST-023 | GATE-4 | Planned |
| DEC-016 | REQ-016 | Tie-break order: points > goals total > wins total | TST-024 | GATE-4 | Planned |
| DEC-017 | REQ-017 | Other users’ picks visible always with username labels | TST-025 | GATE-5 | Planned |
| DEC-018 | REQ-018 | `stealable` marker hidden after lock | TST-026 | GATE-5 | Planned |
| DEC-019 | REQ-019 | Recalculate standings on result updates and admin overrides | TST-027 | GATE-6 | Planned |
| DEC-020 | REQ-020 | Recalc failure shows unavailable table state | TST-028 | GATE-6, GATE-7 | Planned |
| DEC-021 | REQ-021 | MVP Playwright scope is Chromium-only | TST-029 | GATE-7 | Planned |
| DEC-022 | REQ-022 | MVP must be deployable to TestFlight | TST-030 | GATE-8 | Planned |
| DEC-023 | REQ-023 | Hosted backend runtime is required | TST-031 | GATE-2, GATE-8 | Planned |

## Requirement-to-Test Index (Template)
- TST-001 …
- TST-002 …
- TST-003 …
- Continue until full case inventory is defined.

## Requirement-to-Release-Gate Index (Template)
- REQ-001 -> GATE-3, GATE-7
- REQ-002 -> GATE-3, GATE-6
- Continue for all requirements.

## Deferred and Risk Traceability
| Deferred ID | Affected Decisions/Requirements | Risk | Owner | Revisit Trigger | Status |
|---|---|---|---|---|---|
| D-001 | DEC-019, REQ-019 | Incorrect settlement if final-status mapping is wrong | Product + Engineering | API integration milestone | Deferred |

## Ownership and Update Cadence
- Product owns decision and requirement updates.
- Engineering owns technical feasibility and gate evidence alignment.
- QA owns test mapping completeness.
- Update cadence: at every scope or rule change.

## Signoff and Audit Trail
- Signoff requires Product, Engineering, QA.
- Every revision logs changed IDs and impact.

## Revision History
- 2026-11-06: Initial traceability baseline created.
