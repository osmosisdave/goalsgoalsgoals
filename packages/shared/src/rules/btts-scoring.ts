import type { BttsScoringInput, BttsScoringResult } from '../domain';

// REQ-015: BTTS scoring model and point mapping.
export function scoreBttsOutcome(input: BttsScoringInput): BttsScoringResult {
  const { homeGoals, awayGoals } = input.score;
  const totalGoals = homeGoals + awayGoals;

  if (homeGoals > 0 && awayGoals > 0) {
    return {
      outcome: 'WIN_BTTS',
      points: 3,
      totalGoals,
    };
  }

  if (homeGoals === 0 && awayGoals === 0) {
    return {
      outcome: 'LOSS_ZERO_ZERO',
      points: -1,
      totalGoals,
    };
  }

  return {
    outcome: 'DRAW_GOAL_TO_NIL',
    points: 1,
    totalGoals,
  };
}
