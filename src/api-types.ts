/**
 * Shared API response types for all backend endpoints.
 * Import with `import type { ... } from './api-types'` — type imports are erased
 * at compile time so the compiled JS files remain plain scripts (no ES module
 * runtime imports, no HTML changes needed).
 */

// ----- Shared error shape -----

export interface ApiError {
  error: string;
  message?: string;
}

// ----- POST /api/login -----

export interface LoginResponse {
  token: string;
}

// ----- GET /api/me -----

export interface MeResponse {
  /** Matches the JWT `sub` claim — always the username. */
  username: string;
  role: string;
}

// ----- GET /api/users  |  GET /api/admin/users -----

export interface UserRecord {
  username: string;
  role: string;
  league: string | null;
}

// ----- POST /api/users -----

export interface CreateUserResponse {
  username: string;
  role: string;
}

// ----- PUT /api/users/:username/league -----

export interface UpdateLeagueResponse {
  username: string;
  league: string | null;
}

// ----- GET /api/leagues → string[]  (no wrapper object) -----

// ----- POST /api/leagues -----

export interface CreateLeagueResponse {
  name: string;
}

// ----- DELETE /api/leagues/:name -----

export interface DeleteLeagueResponse {
  name: string;
}

// ----- GET /api/rate-limit/status -----

export interface RateLimitRecentCall {
  endpoint: string;
  timestamp: string;
  user: string;
}

export interface RateLimitStatus {
  count: number;
  remaining: number;
  softLimit: number;
  hardLimit: number;
  isBlocked: boolean;
  isNearLimit: boolean;
  weekStarting: number;
  oldestCallExpiry: string | null;
  recentCalls: RateLimitRecentCall[];
}

// ----- GET /api/rate-limit/analytics -----

export interface RateLimitAnalytics {
  totalCalls: number;
  byEndpoint: Record<string, number>;
  byDay: Record<string, number>;
  byUser: Record<string, number>;
  weekPeriod: {
    start: string;
    end: string;
  };
}

// ----- POST /api/rate-limit/reset -----

export interface RateLimitResetResponse {
  message: string;
}

// ----- Fixture sub-types (shared by fixtures + match selection endpoints) -----

export interface FixtureStatus {
  short: string;
  long: string;
  elapsed: number | null;
}

export interface FixtureVenue {
  name: string | null;
  city: string | null;
}

export interface FixtureInfo {
  id: number;
  date: string;
  status: FixtureStatus;
  venue: FixtureVenue;
}

export interface LeagueInfo {
  id: number;
  name: string;
  round: string;
  season?: number;
}

export interface TeamInfo {
  id: number;
  name: string;
  winner: boolean | null;
}

export interface GoalsInfo {
  home: number | null;
  away: number | null;
}

export interface Fixture {
  fixture: FixtureInfo;
  league: LeagueInfo;
  teams: { home: TeamInfo; away: TeamInfo };
  goals: GoalsInfo;
}

// ----- GET /api/football/fixtures -----

export interface FixturesDbResponse {
  get: string;
  parameters: Record<string, string>;
  errors: unknown[];
  results: number;
  response: Fixture[];
}

// ----- GET /api/football/gameweeks -----

export interface Gameweek {
  number: number;
  label: string;     // e.g. "GW1 (Sat 12 Apr)"
  date: string;      // ISO date string "YYYY-MM-DD" (UK local date)
  isLocked: boolean; // true if selection is not yet open
  unlocksAt: string | null; // ISO UTC datetime when selection opens (null for GW1)
  fixtures: Fixture[];
}

export interface GameweeksResponse {
  gameweeks: Gameweek[];
}

// ----- GET /api/matches/selections -----

export interface SelectionRecord {
  fixtureId: number;
  username: string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
  leagueId?: number;
  leagueName?: string;
  round?: string;
  season?: number;
  status?: string;
}

export interface SelectionsResponse {
  success: boolean;
  selections: SelectionRecord[];
}

// ----- GET /api/gameweek/current -----

export interface CurrentGameweekInfo {
  number: number;
  label: string;
  date: string;
}

export interface PlayerSelection {
  username: string;
  selection: SelectionRecord | null;
}

export interface CurrentGameweekResponse {
  gameweek: CurrentGameweekInfo | null;
  players: PlayerSelection[];
}

// ----- POST /api/matches/:fixtureId/select -----

export interface SelectMatchResponse {
  success: boolean;
  message: string;
  replaced: boolean;
  selection?: {
    fixtureId: number;
    username: string;
    homeTeam: string;
    awayTeam: string;
  };
}

// ----- DELETE /api/matches/:fixtureId/select -----

export interface UnselectMatchResponse {
  success: boolean;
  message: string;
}

// ----- GET /api/matches/stealable -----

export interface StealableResponse {
  stealableFixtureIds: number[];
}

// ----- POST /api/matches/:fixtureId/steal -----

export interface StealMatchResponse {
  success: boolean;
  message: string;
  selection?: {
    fixtureId: number;
    username: string;
    homeTeam: string;
    awayTeam: string;
  };
}

// ----- POST /api/matches/archive-finished -----

export interface ArchiveFinishedResponse {
  success: boolean;
  archived: number;
  message: string;
}

// ----- GET /api/matches/history -----

export interface MatchHistoryEntry extends SelectionRecord {
  archivedAt: string;
  finalScore: { home: number; away: number };
  matchStatus: string;
}

export interface MatchHistoryResponse {
  success: boolean;
  count: number;
  history: MatchHistoryEntry[];
}

// ----- GET /api/standings -----

export interface StandingEntry {
  username: string;
  league?: string | null;
  PL?: number;
  GGG?: number;
  G0?: number;
  Z0?: number;
  GF?: number;
  points?: number;
  ppg?: number;
  form?: string[];
}

export interface AppStandingsResponse {
  success: boolean;
  standings: StandingEntry[];
}

// ----- POST /api/admin/sync-leagues -----

export interface SyncSummary {
  total: number;
  new: number;
  updated: number;
  duration: number;
}

export interface SyncLeaguesResponse {
  success: boolean;
  summary: SyncSummary;
}

// ----- POST /api/admin/sync-fixtures -----

export interface SyncFixturesResponse {
  success: boolean;
  summary: SyncSummary;
}

// ----- POST /api/football/fixtures  |  POST /api/football/standings (mock, rate-limited) -----

export interface RateLimitedMockResponse {
  message: string;
  data: unknown;
  rateLimitStatus: RateLimitStatus;
}

export interface RateLimitExceededResponse {
  error: string;
  message: string;
  status: Pick<RateLimitStatus, 'count' | 'softLimit' | 'oldestCallExpiry'>;
}
