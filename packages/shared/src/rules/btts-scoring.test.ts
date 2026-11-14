import { describe, expect, it } from 'vitest';
import { scoreBttsOutcome } from './btts-scoring.js';

describe('scoreBttsOutcome (REQ-015)', () => {
  it('returns WIN_BTTS and 3 points when both teams score', () => {
    const result = scoreBttsOutcome({
      score: { homeGoals: 2, awayGoals: 1 },
    });

    expect(result).toEqual({
      outcome: 'WIN_BTTS',
      points: 3,
      totalGoals: 3,
    });
  });

  it('returns WIN_BTTS and 3 points for 1-1', () => {
    const result = scoreBttsOutcome({
      score: { homeGoals: 1, awayGoals: 1 },
    });

    expect(result).toEqual({
      outcome: 'WIN_BTTS',
      points: 3,
      totalGoals: 2,
    });
  });

  it('returns DRAW_GOAL_TO_NIL and 1 point for 1-0', () => {
    const result = scoreBttsOutcome({
      score: { homeGoals: 1, awayGoals: 0 },
    });

    expect(result).toEqual({
      outcome: 'DRAW_GOAL_TO_NIL',
      points: 1,
      totalGoals: 1,
    });
  });

  it('returns DRAW_GOAL_TO_NIL and 1 point for 0-2', () => {
    const result = scoreBttsOutcome({
      score: { homeGoals: 0, awayGoals: 2 },
    });

    expect(result).toEqual({
      outcome: 'DRAW_GOAL_TO_NIL',
      points: 1,
      totalGoals: 2,
    });
  });

  it('returns LOSS_ZERO_ZERO and -1 point for 0-0', () => {
    const result = scoreBttsOutcome({
      score: { homeGoals: 0, awayGoals: 0 },
    });

    expect(result).toEqual({
      outcome: 'LOSS_ZERO_ZERO',
      points: -1,
      totalGoals: 0,
    });
  });
});