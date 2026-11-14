import { describe, expect, it } from 'vitest';
import {
  deriveDayLock,
  deriveStealWindow,
  orderStandingsByTieBreak,
  qualifyKickoffValidity,
  qualifyValidDay,
  scoreBttsOutcome,
} from './index';

describe('shared package export surface (Phase B closeout)', () => {
  it('exports the shared rule engine entry points', () => {
    expect(typeof qualifyValidDay).toBe('function');
    expect(typeof qualifyKickoffValidity).toBe('function');
    expect(typeof deriveDayLock).toBe('function');
    expect(typeof deriveStealWindow).toBe('function');
    expect(typeof scoreBttsOutcome).toBe('function');
    expect(typeof orderStandingsByTieBreak).toBe('function');
  });
});
