import axios, { AxiosError } from 'axios';
import { MongoClient, Db, Collection } from 'mongodb';
import { Fixture, FixtureResponse, League } from './types/api-football.types';
import apiRateLimiter from './api-rate-limiter';

// Leagues to fetch
const LEAGUES: League[] = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 61, name: 'Ligue 1', country: 'France' },
];

interface FetchOptions {
  leagueId?: number;
  season: number;
  from?: string;
  to?: string;
}

interface SyncResult {
  success: boolean;
  summary: {
    totalFixtures: number;
    newFixtures: number;
    updatedFixtures: number;
    leaguesSynced: number;
    apiCallsUsed: number;
    duration: number;
  };
  details: string[];
  error?: string;
}

export class FixtureFetcher {
  private mongoClient: MongoClient;
  private db: Db;
  private fixturesCollection: Collection<Fixture>;
  private rateLimiter: typeof apiRateLimiter;
  private apiKey: string;
  private apiHost: string;

  constructor(
    mongoClient: MongoClient,
    rateLimiter: typeof apiRateLimiter,
    apiKey: string,
    apiHost: string = 'v3.football.api-sports.io'
  ) {
    this.mongoClient = mongoClient;
    this.db = mongoClient.db();
    this.fixturesCollection = this.db.collection<Fixture>('fixtures');
    this.rateLimiter = rateLimiter;
    this.apiKey = apiKey;
    this.apiHost = apiHost;
  }

  async fetchFixtures(options: FetchOptions): Promise<Fixture[]> {
    const { leagueId, season, from, to } = options;

    // Check rate limiter
    const canMake = await this.rateLimiter.canMakeCall();
    if (!canMake) {
      const status = await this.rateLimiter.getStatus();
      throw new Error(
        `Rate limit exceeded. ${status.count}/${status.softLimit} calls used. ` +
        `Next available: ${status.oldestCallExpiry || 'soon'}`
      );
    }

    // Build query parameters
    const params: Record<string, string> = {
      season: season.toString(),
    };
    if (leagueId) params.league = leagueId.toString();
    if (from) params.from = from;
    if (to) params.to = to;

    console.log(`Fetching fixtures for league ${leagueId}, season ${season}...`);

    try {
      const response = await axios.get<FixtureResponse>(
        `https://${this.apiHost}/fixtures`,
        {
          headers: {
            'x-rapidapi-key': this.apiKey,
            'x-rapidapi-host': this.apiHost,
          },
          params,
          timeout: 15000,
        }
      );

      // Record the API call
      await this.rateLimiter.recordCall(
        '/fixtures',
        'system',
        { league: leagueId, season, from, to, results: response.data.results }
      );

      console.log(`✓ Fetched ${response.data.results} fixtures`);
      return response.data.response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 429) {
          throw new Error('API rate limit exceeded (429)');
        }
        throw new Error(
          `API request failed: ${axiosError.response?.status} - ${axiosError.message}`
        );
      }
      throw error;
    }
  }

  async saveFixtures(fixtures: Fixture[]): Promise<{ newCount: number; updatedCount: number }> {
    if (fixtures.length === 0) {
      return { newCount: 0, updatedCount: 0 };
    }

    // Use bulk operations for efficiency
    const bulkOps = fixtures.map(fixture => ({
      replaceOne: {
        filter: { 'fixture.id': fixture.fixture.id },
        replacement: fixture,
        upsert: true,
      },
    }));

    const result = await this.fixturesCollection.bulkWrite(bulkOps, {
      ordered: false,
    });

    return {
      newCount: result.upsertedCount,
      updatedCount: result.modifiedCount,
    };
  }

  async syncFixtures(season: number, dateRangeDays: number = 20): Promise<SyncResult> {
    const startTime = Date.now();
    const details: string[] = [];
    let totalFixtures = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let apiCallsUsed = 0;
    let leaguesSynced = 0;

    // Calculate date range
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - dateRangeDays);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() + dateRangeDays);

    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];

    console.log(`Starting sync for ${LEAGUES.length} leagues`);
    console.log(`Date range: ${from} to ${to}`);

    for (const league of LEAGUES) {
      try {
        console.log(`Processing ${league.name}...`);
        
        const fixtures = await this.fetchFixtures({
          leagueId: league.id,
          season,
          from,
          to,
        });

        apiCallsUsed++;

        if (fixtures.length > 0) {
          const { newCount, updatedCount } = await this.saveFixtures(fixtures);
          totalFixtures += fixtures.length;
          totalNew += newCount;
          totalUpdated += updatedCount;
          leaguesSynced++;

          details.push(
            `${league.name}: ${fixtures.length} fixtures (${newCount} new, ${updatedCount} updated)`
          );
        } else {
          details.push(`${league.name}: No fixtures found`);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`Error processing ${league.name}:`, error);
        details.push(`${league.name}: Error - ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      summary: {
        totalFixtures,
        newFixtures: totalNew,
        updatedFixtures: totalUpdated,
        leaguesSynced,
        apiCallsUsed,
        duration,
      },
      details,
    };
  }
}
