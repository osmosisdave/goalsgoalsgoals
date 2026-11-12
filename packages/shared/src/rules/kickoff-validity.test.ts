import { describe, expect, it } from 'vitest';
import { qualifyKickoffValidity } from './kickoff-validity';

describe('qualifyKickoffValidity (REQ-006)', () => {
  it('accepts Tuesday 19:00:00 Europe/London (winter / GMT)', () => {
    const result = qualifyKickoffValidity({ kickoffUtc: '2026-11-10T19:00:00Z' });
    expect(result).toEqual({ isValid: true, reason: 'TUESDAY_WINDOW' });
  });

  it('accepts Tuesday 20:00:00 Europe/London inclusive upper bound (winter / GMT)', () => {
    const result = qualifyKickoffValidity({ kickoffUtc: '2026-11-10T20:00:00Z' });
    expect(result).toEqual({ isValid: true, reason: 'TUESDAY_WINDOW' });
  });

  it('rejects Tuesday 20:00:01 Europe/London', () => {
    const result = qualifyKickoffValidity({ kickoffUtc: '2026-11-10T20:00:01Z' });
    expect(result).toEqual({ isValid: false, reason: 'OUTSIDE_ALLOWED_WINDOWS' });
  });

  it('accepts Saturday 15:00:00 Europe/London exact only (winter / GMT)', () => {
    const result = qualifyKickoffValidity({ kickoffUtc: '2026-11-14T15:00:00Z' });
    expect(result).toEqual({ isValid: true, reason: 'SATURDAY_1500' });
  });

  it('rejects Saturday 15:00:01 Europe/London', () => {
    const result = qualifyKickoffValidity({ kickoffUtc: '2026-11-14T15:00:01Z' });
    expect(result).toEqual({ isValid: false, reason: 'OUTSIDE_ALLOWED_WINDOWS' });
  });

  it('is DST-aware for Tuesday window in summer (BST: UTC+1)', () => {
    // 19:30 Europe/London in July => 18:30 UTC
    const result = qualifyKickoffValidity({ kickoffUtc: '2026-07-07T18:30:00Z' });
    expect(result).toEqual({ isValid: true, reason: 'TUESDAY_WINDOW' });
  });

  it('is DST-aware for Saturday 15:00 in summer (BST: UTC+1)', () => {
    // 15:00 Europe/London in July => 14:00 UTC
    const result = qualifyKickoffValidity({ kickoffUtc: '2026-07-11T14:00:00Z' });
    expect(result).toEqual({ isValid: true, reason: 'SATURDAY_1500' });
  });

  it('rejects invalid timestamp', () => {
    const result = qualifyKickoffValidity({ kickoffUtc: 'not-a-date' });
    expect(result).toEqual({ isValid: false, reason: 'INVALID_TIMESTAMP' });
  });
});