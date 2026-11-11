import type {
  FixtureCandidate,
  FixtureScore,
  UtcIsoDateTime,
  UserId,
} from './types';

/**
 * REQ-005: A day is valid when it has >= threshold valid fixtures.
 */
export type ValidDayQualificationInput = {
  fixtures: FixtureCandidate[];
  threshold?: number; // default expected by implementation: 30
};

export type ValidDayQualificationResult = {
  isValidDay: boolean;
  validFixtureCount: number;
  thresholdUsed: number;
};

/**
 * REQ-006: Kickoff validity windows in Europe/London.
 * Tuesday: 19:00:00 to 20:00:00 inclusive
 * Saturday: exactly 15:00:00
 */
export type KickoffValidityInput = {
  kickoffUtc: UtcIsoDateTime;
};

export type KickoffValidityReason =
  | 'TUESDAY_WINDOW'
  | 'SATURDAY_1500'
  | 'OUTSIDE_ALLOWED_WINDOWS'
  | 'INVALID_TIMESTAMP';

export type KickoffValidityResult = {
  isValid: boolean;
  reason: KickoffValidityReason;
};

/**
 * REQ-008: Lock is 10 minutes before earliest valid kickoff on a valid day.
 */
export type DayLockInput = {
  validFixtures: FixtureCandidate[];
  lockOffsetMinutes?: number; // default expected by implementation: 10
};

export type DayLockResult = {
  hasLock: boolean;
  lockAtUtc: UtcIsoDateTime | null;
  earliestValidKickoffUtc: UtcIsoDateTime | null;
  lockOffsetMinutesUsed: number;
};

/**
 * REQ-014: Steal window closes at (day lock - 1 day).
 */
export type StealWindowInput = {
  dayLockUtc: UtcIsoDateTime;
  nowUtc: UtcIsoDateTime;
  cutoffOffsetHours?: number; // default expected by implementation: 24
};

export type StealWindowResult = {
  stealCutoffUtc: UtcIsoDateTime;
  isOpen: boolean;
  cutoffOffsetHoursUsed: number;
};

/**
 * REQ-015: BTTS scoring model.
 * Win (BTTS): 3
 * Draw (goal to nil): 1
 * Loss (0-0): -1
 */
export type BttsScoringInput = {
  score: FixtureScore;
};

export type BttsOutcome = 'WIN_BTTS' | 'DRAW_GOAL_TO_NIL' | 'LOSS_ZERO_ZERO';

export type BttsScoringResult = {
  outcome: BttsOutcome;
  points: 3 | 1 | -1;
  totalGoals: number;
};

/**
 * REQ-016: Tie-break order
 * points total > goals total > wins total
 */
export type TieBreakRow = {
  userId: UserId;
  pointsTotal: number;
  goalsTotal: number;
  winsTotal: number;
};

export type TieBreakInput = {
  rows: TieBreakRow[];
};

export type TieBreakResult = {
  orderedRows: TieBreakRow[];
};