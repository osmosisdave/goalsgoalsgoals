import type { StealWindowInput, StealWindowResult } from '../domain';

const DEFAULT_CUTOFF_OFFSET_HOURS = 24;

function parseRequiredUtcDate(value: string, fieldName: 'dayLockUtc' | 'nowUtc'): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`${fieldName} must be a valid UTC ISO timestamp.`);
  }

  return date;
}

// REQ-014: Steal window closes at (day lock - 1 day).
export function deriveStealWindow(input: StealWindowInput): StealWindowResult {
  const cutoffOffsetHoursUsed = input.cutoffOffsetHours ?? DEFAULT_CUTOFF_OFFSET_HOURS;

  const dayLockDate = parseRequiredUtcDate(input.dayLockUtc, 'dayLockUtc');
  const nowDate = parseRequiredUtcDate(input.nowUtc, 'nowUtc');

  const stealCutoffDate = new Date(dayLockDate.getTime() - (cutoffOffsetHoursUsed * 60 * 60 * 1000));

  return {
    stealCutoffUtc: stealCutoffDate.toISOString(),
    isOpen: nowDate.getTime() <= stealCutoffDate.getTime(),
    cutoffOffsetHoursUsed,
  };
}
