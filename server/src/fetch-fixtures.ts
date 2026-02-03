import axios, { AxiosError } from 'axios';
import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';
import { Fixture, FixtureResponse, League } from './types/api-football.types';
import apiRateLimiter from './api-rate-limiter';

// Load environment variables
dotenv.config();

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';

// Leagues to fetch
const LEAGUES: League[] = [
  { id: 39, name: 'Premier League', country: 'England', logo: '', flag: '' },
  { id: 140, name: 'La Liga', country: 'Spain', logo: '', flag: '' },
  { id: 78, name: 'Bundesliga', country: 'Germany', logo: '', flag: '' },
  { id: 135, name: 'Serie A', country: 'Italy', logo: '', flag: '' },
  { id: 61, name: 'Ligue 1', country: 'France', logo: '', flag: '' },
];

interface FetchOptions {
  leagueId?: number;
  season: number;
  from?: string;  // Format: YYYY-MM-DD
  to?: string;    // Format: YYYY-MM-DD
}

class FixtureFetcher {
  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private fixturesCollection: Collection<Fixture> | null = null;
  private rateLimiter: typeof apiRateLimiter | null = null;

  async initialize(): Promise<void> {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    if (!API_KEY) {
      throw new Error('API_FOOTBALL_KEY not found in environment variables');
    }

    // Connect to MongoDB
    this.mongoClient = new MongoClient(MONGODB_URI);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db();
    this.fixturesCollection = this.db.collection<Fixture>('fixtures');
    console.log('✅ Connected to MongoDB');

    // Initialize rate limiter
    this.rateLimiter = apiRateLimiter;
    await this.rateLimiter.initialize(this.mongoClient);
    console.log('✅ Rate limiter initialized');
  }

  async fetchFixtures(options: FetchOptions): Promise<Fixture[]> {
    const { leagueId, season, from, to } = options;

    if (!this.rateLimiter) {
      throw new Error('Rate limiter not initialized');
    }

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

    console.log(`🔄 Fetching fixtures for league ${leagueId}, season ${season}...`);

    try {
      const response = await axios.get<FixtureResponse>(
        `https://${API_HOST}/fixtures`,
        {
          headers: {
            'x-rapidapi-key': API_KEY!,
            'x-rapidapi-host': API_HOST,
          },
          params,
          timeout: 10000,
        }
      );

      // Record the API call
      await this.rateLimiter.recordCall(
        '/fixtures',
        'system',
        { league: leagueId, season, from, to, results: response.data.results }
      );

      console.log(`✅ Fetched ${response.data.results} fixtures`);
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

  async saveFixtures(fixtures: Fixture[]): Promise<void> {
    if (!this.fixturesCollection) {
      throw new Error('Fixtures collection not initialized');
    }

    if (fixtures.length === 0) {
      console.log('⚠️  No fixtures to save');
      return;
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

    console.log(
      `💾 Saved ${result.upsertedCount} new, updated ${result.modifiedCount} existing fixtures`
    );
  }

  async fetchAndSaveForLeague(
    leagueId: number,
    leagueName: string,
    season: number,
    dateRange?: { from: string; to: string }
  ): Promise<void> {
    try {
      console.log(`\n📊 Processing ${leagueName} (ID: ${leagueId})`);
      
      const fixtures = await this.fetchFixtures({
        leagueId,
        season,
        from: dateRange?.from,
        to: dateRange?.to,
      });

      await this.saveFixtures(fixtures);
    } catch (error) {
      console.error(`❌ Error processing ${leagueName}:`, error);
      throw error;
    }
  }

  async fetchAllLeagues(season: number, dateRange?: { from: string; to: string }): Promise<void> {
    console.log(`\n🚀 Starting fetch for ${LEAGUES.length} leagues\n`);

    for (const league of LEAGUES) {
      try {
        await this.fetchAndSaveForLeague(league.id, league.name, season, dateRange);
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to process ${league.name}, continuing...`);
        // Continue with next league
      }
    }

    console.log('\n✅ All leagues processed');
  }

  async close(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Main execution
async function main() {
  const fetcher = new FixtureFetcher();

  try {
    await fetcher.initialize();

    // Example: Fetch current season with date range
    const season = 2025;
    const today = new Date();
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);
    const tenDaysFromNow = new Date(today);
    tenDaysFromNow.setDate(today.getDate() + 10);

    const dateRange = {
      from: tenDaysAgo.toISOString().split('T')[0],
      to: tenDaysFromNow.toISOString().split('T')[0],
    };

    console.log(`Date range: ${dateRange.from} to ${dateRange.to}`);

    // Fetch for all leagues
    await fetcher.fetchAllLeagues(season, dateRange);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await fetcher.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { FixtureFetcher };