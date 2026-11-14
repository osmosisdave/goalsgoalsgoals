import { describe, expect, it } from 'vitest';
import type { FixtureCandidate } from '../domain/index.js';
import { qualifyValidDay } from './valid-day.js';

function fixture(id: string): FixtureCandidate {
  return {
    fixtureId: id,
    kickoffUtc: '2026-11-11T19:30:00Z',
    competitionId: 'comp-1',
    teams: {
      homeTeamId: `h-${id}`,
      awayTeamId: `a-${id}`,
      homeTeamName: `Home ${id}`,
      awayTeamName: `Away ${id}`,
    },
  };
}

function fixtures(count: number): FixtureCandidate[] {
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, i) => fixture(String(i + 1)));
}

describe('qualifyValidDay', () => {
    it('is valid when fixture count is equal to default threshold (30)', () => {
        const result = qualifyValidDay({ fixtures: fixtures(30) });
        expect(result.isValidDay).toBe(true);
        expect(result.validFixtureCount).toBe(30);
        expect(result.thresholdUsed).toBe(30);
    });

    it('is valid when fixture count is greater than default threshold (30)', () => {
        const result = qualifyValidDay({ fixtures: fixtures(31) });
        expect(result.isValidDay).toBe(true);
        expect(result.validFixtureCount).toBe(31);
        expect(result.thresholdUsed).toBe(30);
    });

    it('is invalid when fixture count is less than default threshold (30)', () => {
        const result = qualifyValidDay({ fixtures: fixtures(29) });
        expect(result.isValidDay).toBe(false);
        expect(result.validFixtureCount).toBe(29);
        expect(result.thresholdUsed).toBe(30);
    });

    it('is valid when fixture count is equal to custom threshold', () => {
        const result = qualifyValidDay({ fixtures: fixtures(5), threshold: 5 });
        expect(result.isValidDay).toBe(true);
        expect(result.validFixtureCount).toBe(5);
        expect(result.thresholdUsed).toBe(5);
    });

    it('is invalid when fixture count is less than custom threshold', () => {
        const result = qualifyValidDay({ fixtures: fixtures(4), threshold: 5 });
        expect(result.isValidDay).toBe(false);
        expect(result.validFixtureCount).toBe(4);
        expect(result.thresholdUsed).toBe(5);
    });

    it('is valid when fixture count is greater than custom threshold', () => {
        const result = qualifyValidDay({ fixtures: fixtures(6), threshold: 5 });
        expect(result.isValidDay).toBe(true);
        expect(result.validFixtureCount).toBe(6);
        expect(result.thresholdUsed).toBe(5);
    });

    it('is invalid when fixture count is zero and threshold is zero', () => {
        const result = qualifyValidDay({ fixtures: fixtures(0), threshold: 0 });
      expect(result.isValidDay).toBe(true);
        expect(result.validFixtureCount).toBe(0);
        expect(result.thresholdUsed).toBe(0);
    });

    it('is invalid when fixture list is empty and threshold is default (30)', () => {
      const result = qualifyValidDay({ fixtures: fixtures(0) });
        expect(result.isValidDay).toBe(false);
        expect(result.validFixtureCount).toBe(0);
        expect(result.thresholdUsed).toBe(30);
    });
});