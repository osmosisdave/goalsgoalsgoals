export type Role = 'user' | 'admin';

export type UserId = string;
export type FixtureId = string;

/**
 * Canonical key for a valid day, e.g. "2026-11-11" in Europe/London day context.
 */
export type ValidDayKey = string; 

/**
 * UTC ISO-8601 timestamp string, e.g. "2026-11-11T19:30:00Z".
 */
export type UtcIsoDateTime = string;

export type FixtureTeams = {
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
};

export type FixtureCandidate = {
    fixtureId: FixtureId;
    kickoffUtc: UtcIsoDateTime;
    competitionId: string;
    teams: FixtureTeams; 
};

export type SelectionRecord = {
    userId: UserId;
    validDay: ValidDayKey;
    fixtureId: FixtureId;
    selectedAtUtc: UtcIsoDateTime;
};

export type FixtureScore = {
    homeGoals: number;
    awayGoals: number;
};

/**
 * D-001 extension point: do not hardcode final status mapping yet.
 */
export interface FinalStatusPolicy {
  isScorableFinalStatus(providerStatus: string): boolean;
}