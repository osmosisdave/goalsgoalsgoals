import { describe, expect, it } from 'vitest';
import { deriveStealWindow } from './steal-window';

describe('deriveStealWindow (REQ-014)', () => {
  it('uses default cutoff of 24 hours before day lock', () => {
    const result = deriveStealWindow({
      dayLockUtc: '2026-11-14T14:20:00Z',
      nowUtc: '2026-11-13T14:19:59Z',
    });

    expect(result).toEqual({
      stealCutoffUtc: '2026-11-13T14:20:00.000Z',
      isOpen: true,
      cutoffOffsetHoursUsed: 24,
    });
  });

  it('closes exactly after cutoff instant', () => {
    const result = deriveStealWindow({
      dayLockUtc: '2026-11-14T14:20:00Z',
      nowUtc: '2026-11-13T14:20:00.001Z',
    });

    expect(result).toEqual({
      stealCutoffUtc: '2026-11-13T14:20:00.000Z',
      isOpen: false,
      cutoffOffsetHoursUsed: 24,
    });
  });

  it('is still open exactly at cutoff instant (inclusive boundary)', () => {
    const result = deriveStealWindow({
      dayLockUtc: '2026-11-14T14:20:00Z',
      nowUtc: '2026-11-13T14:20:00.000Z',
    });

    expect(result).toEqual({
      stealCutoffUtc: '2026-11-13T14:20:00.000Z',
      isOpen: true,
      cutoffOffsetHoursUsed: 24,
    });
  });

  it('supports custom cutoff offset hours', () => {
    const result = deriveStealWindow({
      dayLockUtc: '2026-11-14T14:20:00Z',
      nowUtc: '2026-11-14T01:00:00Z',
      cutoffOffsetHours: 12,
    });

    expect(result).toEqual({
      stealCutoffUtc: '2026-11-14T02:20:00.000Z',
      isOpen: true,
      cutoffOffsetHoursUsed: 12,
    });
  });

  it('throws when dayLockUtc is invalid', () => {
    expect(() =>
      deriveStealWindow({
        dayLockUtc: 'bad-day-lock',
        nowUtc: '2026-11-13T14:20:00Z',
      }),
    ).toThrowError('dayLockUtc must be a valid UTC ISO timestamp.');
  });

  it('throws when nowUtc is invalid', () => {
    expect(() =>
      deriveStealWindow({
        dayLockUtc: '2026-11-14T14:20:00Z',
        nowUtc: 'bad-now',
      }),
    ).toThrowError('nowUtc must be a valid UTC ISO timestamp.');
  });
});