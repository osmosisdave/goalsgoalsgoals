import axios, { AxiosError } from 'axios';
import { MongoClient, Db, Collection } from 'mongodb';
import { Fixture, FixtureResponse, League } from './types/api-football.types';
import apiRateLimiter from './api-rate-limiter';

// Default leagues to sync - UK and European competitions
export const DEFAULT_LEAGUE_IDS = [
  // English League tiers 1-5
  39,  // Premier League
  40,  // Championship
  41,  // League One
  42,  // League Two
  43,  // National League
  
  // Scottish League tiers 1-4
  179, // Premiership
  180, // Championship
  183, // League One
  184, // League Two
  
  // English Cup Competitions
  45,  // FA Cup
  48,  // League Cup (EFL Cup/Carabao Cup)
  46,  // EFL Trophy
  
  // Scottish Cup Competitions
  181, // Scottish FA Cup
  185, // Scottish League Cup
  182, // Scottish Challenge Cup
  
  // European Competitions
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  848, // UEFA Europa Conference League
];

// Fallback leagues if database query fails
const DEFAULT_LEAGUES: League[] = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 40, name: 'Championship', country: 'England' },
  { id: 41, name: 'League One', country: 'England' },
  { id: 42, name: 'League Two', country: 'England' },
  { id: 43, name: 'National League', country: 'England' },
];

interface LeaguesResponse {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  response: Array<{
    league: {
      id: number;
      name: string;
      type: string;
      logo: string;
    };
    country: {
      name: string;
      code: string | null;
      flag: string | null;
    };
    seasons: Array<{
      year: number;
      start: string;
      end: string;
      current: boolean;
    }>;
  }>;
}

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
  private leaguesCollection: Collection<League>;
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
    this.db = mongoClient.db('goalsgoalsgoals');
    this.fixturesCollection = this.db.collection<Fixture>('fixtures');
    this.leaguesCollection = this.db.collection<League>('leagues');
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
    console.log(`API URL: https://${this.apiHost}/fixtures`);
    console.log(`Params:`, JSON.stringify(params));

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

      console.log(`✓ API Response: ${response.data.results} fixtures returned`);
      console.log(`✓ Response data length: ${response.data.response?.length || 0}`);
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

  async fetchAvailableLeagues(): Promise<League[]> {
    const canMake = await this.rateLimiter.canMakeCall();
    if (!canMake) {
      const status = await this.rateLimiter.getStatus();
      throw new Error(
        `Rate limit exceeded. ${status.count}/${status.softLimit} calls used. ` +
        `Next available: ${status.oldestCallExpiry || 'soon'}`
      );
    }

    try {
      const response = await axios.get<LeaguesResponse>(
        `https://${this.apiHost}/leagues`,
        {
          headers: {
            'x-rapidapi-key': this.apiKey,
            'x-rapidapi-host': this.apiHost,
          },
          timeout: 15000,
        }
      );

      await this.rateLimiter.recordCall(
        '/leagues',
        'system',
        { results: response.data.results }
      );

      return response.data.response.map(item => ({
        id: item.league.id,
        name: item.league.name,
        country: item.country?.name || 'Unknown',
        logo: item.league.logo,
        flag: item.country?.flag || '',
      }));
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

  async saveLeagues(leagues: League[]): Promise<{ newCount: number; updatedCount: number }> {
    if (leagues.length === 0) {
      return { newCount: 0, updatedCount: 0 };
    }

    // Use bulk operations for efficiency
    const bulkOps = leagues.map(league => ({
      replaceOne: {
        filter: { id: league.id },
        replacement: league,
        upsert: true,
      },
    }));

    const result = await this.leaguesCollection.bulkWrite(bulkOps, {
      ordered: false,
    });

    return {
      newCount: result.upsertedCount,
      updatedCount: result.modifiedCount,
    };
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

  async syncFixturesForLeagues(
    leagueIds: number[],
    season: number,
    dateRangeDays?: number
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const details: string[] = [];
    let totalFixtures = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let apiCallsUsed = 0;
    let leaguesSynced = 0;

    // Calculate date range if specified
    let from: string | undefined;
    let to: string | undefined;
    
    if (dateRangeDays !== undefined) {
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - dateRangeDays);
      const toDate = new Date(today);
      toDate.setDate(today.getDate() + dateRangeDays);

      from = fromDate.toISOString().split('T')[0];
      to = toDate.toISOString().split('T')[0];
    }

    // Get league details from MongoDB
    const leagues = await this.leaguesCollection
      .find({ id: { $in: leagueIds } })
      .toArray();

    if (leagues.length === 0) {
      console.warn('No leagues found for provided IDs');
      return {
        success: false,
        summary: {
          totalFixtures: 0,
          newFixtures: 0,
          updatedFixtures: 0,
          leaguesSynced: 0,
          apiCallsUsed: 0,
          duration: Date.now() - startTime,
        },
        details: ['No leagues found'],
        error: 'No leagues found for provided IDs',
      };
    }

    console.log(`Starting sync for ${leagues.length} leagues`);
    if (from && to) {
      console.log(`Date range: ${from} to ${to}`);
    } else {
      console.log('Fetching all fixtures for season (no date range filter)');
    }

    for (const league of leagues) {
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

    let leagues: League[] = [];
    try {
      leagues = await this.fetchAvailableLeagues();
      console.log(`Loaded ${leagues.length} leagues/competitions from API`);
      
      // Persist leagues to MongoDB
      const { newCount, updatedCount } = await this.saveLeagues(leagues);
      console.log(`Saved leagues: ${newCount} new, ${updatedCount} updated`);
    } catch (error) {
      console.error('Failed to fetch leagues from API, using defaults');
      leagues = DEFAULT_LEAGUES;
    }

    console.log(`Starting sync for ${leagues.length} leagues`);
    console.log(`Date range: ${from} to ${to}`);

    for (const league of leagues) {
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
