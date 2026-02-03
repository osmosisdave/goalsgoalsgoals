/**
 * API Rate Limiter Service
 * 
 * Tracks API calls to external football API and enforces weekly limits.
 * Free tier: 100 calls/week max, soft limit at 75 calls/week
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { MongoClient, Collection } from 'mongodb';

const API_CALLS_FILE = path.join(__dirname, '..', 'api-calls.json');

// Configuration
const WEEKLY_HARD_LIMIT = 100;  // Absolute maximum
const WEEKLY_SOFT_LIMIT = 75;   // When to start blocking new calls
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface ApiCall {
  endpoint: string;
  timestamp: string;
  user: string;
  metadata?: Record<string, any>;
}

interface ApiCallsData {
  _id?: string;
  calls: ApiCall[];
  weeklyCount: number;
  lastReset: string;
}

interface RateLimiterStatus {
  count: number;
  remaining: number;
  softLimit: number;
  hardLimit: number;
  isBlocked: boolean;
  isNearLimit: boolean;
  weekStarting: number;
  oldestCallExpiry: string | null;
  recentCalls: Array<{
    endpoint: string;
    timestamp: string;
    user: string;
  }>;
}

interface Analytics {
  totalCalls: number;
  byEndpoint: Record<string, number>;
  byDay: Record<string, number>;
  byUser: Record<string, number>;
  weekPeriod: {
    start: string;
    end: string;
  };
}

class ApiRateLimiter {
  private data: ApiCallsData | null = null;
  private mongoCollection: Collection<ApiCallsData> | null = null;

  /**
   * Initialize the rate limiter with optional MongoDB support
   */
  async initialize(mongoClient: MongoClient | null = null): Promise<void> {
    if (mongoClient) {
      try {
        const db = mongoClient.db();
        this.mongoCollection = db.collection<ApiCallsData>('api_calls');
        console.log('API Rate Limiter: Using MongoDB storage');
      } catch (e) {
        console.error('API Rate Limiter: MongoDB init failed, falling back to file storage');
        this.mongoCollection = null;
      }
    }

    if (!this.mongoCollection) {
      await this.ensureFile();
      console.log('API Rate Limiter: Using file storage');
    }

    // Clean up old data on initialization
    await this.cleanupOldCalls();
  }

  /**
   * Ensure the API calls file exists
   */
  private async ensureFile(): Promise<void> {
    const exists = await fs.pathExists(API_CALLS_FILE);
    if (!exists) {
      const initial: ApiCallsData = {
        calls: [],
        weeklyCount: 0,
        lastReset: new Date().toISOString()
      };
      await fs.writeJson(API_CALLS_FILE, initial, { spaces: 2 });
    }
  }

  /**
   * Read all API call records
   */
  private async readCalls(): Promise<ApiCallsData> {
    if (this.mongoCollection) {
      try {
        const doc = await this.mongoCollection.findOne({ _id: 'tracker' });
        return doc || { calls: [], weeklyCount: 0, lastReset: new Date().toISOString() };
      } catch (e) {
        console.error('Error reading from MongoDB:', e);
        throw e;
      }
    }

    await this.ensureFile();
    return await fs.readJson(API_CALLS_FILE);
  }

  /**
   * Write API call records
   */
  private async writeCalls(data: ApiCallsData): Promise<void> {
    if (this.mongoCollection) {
      try {
        await this.mongoCollection.replaceOne(
          { _id: 'tracker' },
          { _id: 'tracker', ...data } as any,
          { upsert: true }
        );
        return;
      } catch (e) {
        console.error('Error writing to MongoDB:', e);
        throw e;
      }
    }

    await fs.writeJson(API_CALLS_FILE, data, { spaces: 2 });
  }

  /**
   * Remove calls older than 7 days
   */
  async cleanupOldCalls(): Promise<number> {
    const data = await this.readCalls();
    const weekAgo = Date.now() - WEEK_IN_MS;
    
    const activeCalls = data.calls.filter(call => {
      const callTime = new Date(call.timestamp).getTime();
      return callTime > weekAgo;
    });

    data.calls = activeCalls;
    data.weeklyCount = activeCalls.length;
    
    await this.writeCalls(data);
    
    return data.weeklyCount;
  }

  /**
   * Get current week's call count and status
   */
  async getStatus(): Promise<RateLimiterStatus> {
    await this.cleanupOldCalls();
    const data = await this.readCalls();
    
    const weekAgo = Date.now() - WEEK_IN_MS;
    const callsThisWeek = data.calls.filter(call => {
      const callTime = new Date(call.timestamp).getTime();
      return callTime > weekAgo;
    });

    const count = callsThisWeek.length;
    const remaining = Math.max(0, WEEKLY_SOFT_LIMIT - count);
    const isBlocked = count >= WEEKLY_SOFT_LIMIT;
    const isNearLimit = count >= WEEKLY_SOFT_LIMIT * 0.9; // 90% of soft limit

    // Calculate when the oldest call will expire
    let oldestCallExpiry: string | null = null;
    if (callsThisWeek.length > 0) {
      const oldestCall = callsThisWeek.reduce((oldest, call) => {
        return new Date(call.timestamp) < new Date(oldest.timestamp) ? call : oldest;
      });
      oldestCallExpiry = new Date(new Date(oldestCall.timestamp).getTime() + WEEK_IN_MS).toISOString();
    }

    return {
      count,
      remaining,
      softLimit: WEEKLY_SOFT_LIMIT,
      hardLimit: WEEKLY_HARD_LIMIT,
      isBlocked,
      isNearLimit,
      weekStarting: weekAgo,
      oldestCallExpiry,
      recentCalls: callsThisWeek.slice(-10).map(call => ({
        endpoint: call.endpoint,
        timestamp: call.timestamp,
        user: call.user || 'system'
      }))
    };
  }

  /**
   * Check if an API call can be made
   */
  async canMakeCall(): Promise<boolean> {
    const status = await this.getStatus();
    return !status.isBlocked;
  }

  /**
   * Record a new API call
   */
  async recordCall(endpoint: string, user: string = 'system', metadata: Record<string, any> = {}): Promise<ApiCall> {
    const data = await this.readCalls();
    
    const call: ApiCall = {
      endpoint,
      timestamp: new Date().toISOString(),
      user,
      metadata
    };

    data.calls.push(call);
    data.weeklyCount = data.calls.length;
    
    await this.writeCalls(data);
    
    console.log(`API Call recorded: ${endpoint} (Total this week: ${data.weeklyCount}/${WEEKLY_SOFT_LIMIT})`);
    
    return call;
  }

  /**
   * Middleware to check rate limits before making external API calls
   */
  async checkLimit(req: any, res: any, next: any): Promise<void> {
    try {
      const canProceed = await this.canMakeCall();
      
      if (!canProceed) {
        const status = await this.getStatus();
        return res.status(429).json({
          error: 'API rate limit reached',
          message: `You have reached the weekly limit of ${WEEKLY_SOFT_LIMIT} API calls. The limit will reset when the oldest call expires.`,
          status: {
            count: status.count,
            limit: status.softLimit,
            oldestCallExpiry: status.oldestCallExpiry
          }
        });
      }
      
      // Store limiter in request for later use
      req.apiLimiter = this;
      next();
    } catch (error) {
      console.error('Error in rate limit check:', error);
      // In case of error, allow the request but log it
      next();
    }
  }

  /**
   * Reset all call tracking (for testing/admin purposes)
   */
  async reset(): Promise<ApiCallsData> {
    const data: ApiCallsData = {
      calls: [],
      weeklyCount: 0,
      lastReset: new Date().toISOString()
    };
    await this.writeCalls(data);
    console.log('API call tracking reset');
    return data;
  }

  /**
   * Get detailed analytics
   */
  async getAnalytics(): Promise<Analytics> {
    await this.cleanupOldCalls();
    const data = await this.readCalls();
    const weekAgo = Date.now() - WEEK_IN_MS;
    
    const callsThisWeek = data.calls.filter(call => {
      const callTime = new Date(call.timestamp).getTime();
      return callTime > weekAgo;
    });

    // Group by endpoint
    const byEndpoint: Record<string, number> = {};
    callsThisWeek.forEach(call => {
      if (!byEndpoint[call.endpoint]) {
        byEndpoint[call.endpoint] = 0;
      }
      byEndpoint[call.endpoint]++;
    });

    // Group by day
    const byDay: Record<string, number> = {};
    callsThisWeek.forEach(call => {
      const day = new Date(call.timestamp).toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = 0;
      }
      byDay[day]++;
    });

    // Group by user
    const byUser: Record<string, number> = {};
    callsThisWeek.forEach(call => {
      const user = call.user || 'system';
      if (!byUser[user]) {
        byUser[user] = 0;
      }
      byUser[user]++;
    });

    return {
      totalCalls: callsThisWeek.length,
      byEndpoint,
      byDay,
      byUser,
      weekPeriod: {
        start: new Date(weekAgo).toISOString(),
        end: new Date().toISOString()
      }
    };
  }
}

// Create singleton instance
const rateLimiter = new ApiRateLimiter();

export default rateLimiter;
