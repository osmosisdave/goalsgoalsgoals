import type { TieBreakInput, TieBreakResult } from '../domain/index.js';

// REQ-016: Tie-break order is points total > goals total > wins total.
export function orderStandingsByTieBreak(input: TieBreakInput): TieBreakResult {
  const orderedRows = [...input.rows].sort((a, b) => {
    if (b.pointsTotal !== a.pointsTotal) {
      return b.pointsTotal - a.pointsTotal;
    }

    if (b.goalsTotal !== a.goalsTotal) {
      return b.goalsTotal - a.goalsTotal;
    }

    if (b.winsTotal !== a.winsTotal) {
      return b.winsTotal - a.winsTotal;
    }
// TODO we will want to add a fall back here to order by userId or something else to ensure a stable sort, but for now we will just return 0 to keep the original order of the input array.
    return 0;
  });

  return { orderedRows };
}