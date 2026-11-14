import { describe, expect, it } from 'vitest';
import type { FixtureCandidate } from '../domain/index.js';
import { deriveDayLock } from './day-lock.js';

function fixture(fixtureId: string, kickoffUtc: string): FixtureCandidate {
  return {
    fixtureId,
    kickoffUtc,
    competitionId: 'comp-1',
    teams: {
      homeTeamId: `h-${fixtureId}`,
      awayTeamId: `a-${fixtureId}`,
      homeTeamName: `Home ${fixtureId}`,
      awayTeamName: `Away ${fixtureId}`,
    },
  };
}

describe('deriveDayLock (REQ-008)', () => {
  it('returns lock 10 minutes before earliest valid kickoff (default)', () => {
    const result = deriveDayLock({
      validFixtures: [
        fixture('2', '2026-11-10T19:15:00Z'),
        fixture('1', '2026-11-10T19:45:00Z'),
      ],
    });

    expect(result).toEqual({
      hasLock: true,
      earliestValidKickoffUtc: '2026-11-10T19:15:00.000Z',
      lockAtUtc: '2026-11-10T19:05:00.000Z',
      lockOffsetMinutesUsed: 10,
    });
  });

  it('supports custom lock offset minutes', () => {
    const result = deriveDayLock({
      validFixtures: [fixture('1', '2026-11-14T14:30:00Z')],
      lockOffsetMinutes: 5,
    });

    expect(result).toEqual({
      hasLock: true,
      earliestValidKickoffUtc: '2026-11-14T14:30:00.000Z',
      lockAtUtc: '2026-11-14T14:25:00.000Z',
      lockOffsetMinutesUsed: 5,
    });
  });

  it('returns no lock when fixture list is empty', () => {
    const result = deriveDayLock({ validFixtures: [] });

    expect(result).toEqual({
      hasLock: false,
      earliestValidKickoffUtc: null,
      lockAtUtc: null,
      lockOffsetMinutesUsed: 10,
    });
  });

  it('ignores invalid kickoff timestamps when valid timestamps exist', () => {
    const result = deriveDayLock({
      validFixtures: [
        fixture('bad', 'not-a-date'),
        fixture('ok', '2026-11-14T14:30:00Z'),
      ],
    });

    expect(result).toEqual({
      hasLock: true,
      earliestValidKickoffUtc: '2026-11-14T14:30:00.000Z',
      lockAtUtc: '2026-11-14T14:20:00.000Z',
      lockOffsetMinutesUsed: 10,
    });
  });

  it('returns no lock when all kickoff timestamps are invalid', () => {
    const result = deriveDayLock({
      validFixtures: [fixture('1', 'bad-1'), fixture('2', 'bad-2')],
    });

    expect(result).toEqual({
      hasLock: false,
      earliestValidKickoffUtc: null,
      lockAtUtc: null,
      lockOffsetMinutesUsed: 10,
    });
  });
});