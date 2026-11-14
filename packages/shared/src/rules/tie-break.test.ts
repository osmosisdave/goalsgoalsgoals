import { describe, expect, it } from 'vitest';
import type { TieBreakRow } from '../domain/index.js';
import { orderStandingsByTieBreak } from './tie-break.js';

function row(
  userId: string,
  pointsTotal: number,
  goalsTotal: number,
  winsTotal: number,
): TieBreakRow {
  return { userId, pointsTotal, goalsTotal, winsTotal };
}

describe('orderStandingsByTieBreak (REQ-016)', () => {
  it('orders by points total descending first', () => {
    const result = orderStandingsByTieBreak({
      rows: [
        row('u2', 8, 10, 3),
        row('u1', 10, 1, 0),
        row('u3', 9, 99, 9),
      ],
    });

    expect(result.orderedRows.map((r) => r.userId)).toEqual(['u1', 'u3', 'u2']);
  });

  it('uses goals total as second tie-break when points are equal', () => {
    const result = orderStandingsByTieBreak({
      rows: [
        row('u1', 10, 5, 1),
        row('u2', 10, 7, 0),
        row('u3', 9, 20, 5),
      ],
    });

    expect(result.orderedRows.map((r) => r.userId)).toEqual(['u2', 'u1', 'u3']);
  });

  it('uses wins total as third tie-break when points and goals are equal', () => {
    const result = orderStandingsByTieBreak({
      rows: [
        row('u1', 10, 7, 2),
        row('u2', 10, 7, 4),
        row('u3', 10, 7, 1),
      ],
    });

    expect(result.orderedRows.map((r) => r.userId)).toEqual(['u2', 'u1', 'u3']);
  });

  it('does not mutate input rows array', () => {
    const inputRows = [row('u1', 5, 2, 1), row('u2', 6, 1, 1)];
    const originalOrder = inputRows.map((r) => r.userId);

    orderStandingsByTieBreak({ rows: inputRows });

    expect(inputRows.map((r) => r.userId)).toEqual(originalOrder);
  });

  it('returns empty array when no rows are provided', () => {
    const result = orderStandingsByTieBreak({ rows: [] });
    expect(result.orderedRows).toEqual([]);
  });
});