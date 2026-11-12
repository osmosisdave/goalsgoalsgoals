import type { DayLockInput, DayLockResult } from '../domain';

const DEFAULT_LOCK_OFFSET_MINUTES = 10;

function toUtcDate(value: string): Date | null {
  const strictUtcIsoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

  if (!strictUtcIsoPattern.test(value)) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// REQ-008: Lock is 10 minutes before earliest valid kickoff on a valid day.
export function deriveDayLock(input: DayLockInput): DayLockResult {
  const lockOffsetMinutesUsed = input.lockOffsetMinutes ?? DEFAULT_LOCK_OFFSET_MINUTES;

  const kickoffDates = input.validFixtures
    .map((fixture) => toUtcDate(fixture.kickoffUtc))
    .filter((date): date is Date => date !== null);

  if (kickoffDates.length === 0) {
    return {
      hasLock: false,
      lockAtUtc: null,
      earliestValidKickoffUtc: null,
      lockOffsetMinutesUsed,
    };
  }

  const earliestKickoffDate = kickoffDates.reduce((earliest, current) => {
    if (current.getTime() < earliest.getTime()) {
      return current;
    }

    return earliest;
  });

  const lockAtDate = new Date(earliestKickoffDate.getTime() - (lockOffsetMinutesUsed * 60 * 1000));

  return {
    hasLock: true,
    lockAtUtc: lockAtDate.toISOString(),
    earliestValidKickoffUtc: earliestKickoffDate.toISOString(),
    lockOffsetMinutesUsed,
  };
}
