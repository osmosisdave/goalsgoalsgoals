import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fsExtra from 'fs-extra';
import { ApiRateLimiter } from '../src/api-rate-limiter';

// Auto-mock fs-extra so no real filesystem is touched during tests.
// Implementations are configured per-test in beforeEach.
vi.mock('fs-extra', () => ({
  pathExists: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

interface FakeCall {
  endpoint: string;
  timestamp: string;
  user: string;
}

interface FakeStore {
  calls: FakeCall[];
  weeklyCount: number;
  lastReset: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function recentCall(overrides: Partial<FakeCall> = {}): FakeCall {
  return { endpoint: '/api/test', timestamp: new Date().toISOString(), user: 'system', ...overrides };
}

function oldCall(daysAgo: number, overrides: Partial<FakeCall> = {}): FakeCall {
  return recentCall({ timestamp: new Date(Date.now() - daysAgo * DAY_MS).toISOString(), ...overrides });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ApiRateLimiter', () => {
  let store: FakeStore;

  beforeEach(() => {
    // Reset in-memory store before each test
    store = { calls: [], weeklyCount: 0, lastReset: new Date().toISOString() };

    // Wire the fs-extra mocks to the in-memory store
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fsExtra.pathExists).mockResolvedValue(true as any);
    vi.mocked(fsExtra.readJson).mockImplementation(() =>
      Promise.resolve(JSON.parse(JSON.stringify(store)))
    );
    vi.mocked(fsExtra.writeJson).mockImplementation(async (_path: unknown, data: FakeStore) => {
      store = JSON.parse(JSON.stringify(data));
    });
  });

  afterEach(() => vi.clearAllMocks());

  // Convenience: build a fresh, initialised limiter against the current store
  async function makeLimiter(): Promise<ApiRateLimiter> {
    const l = new ApiRateLimiter();
    await l.initialize(null);
    return l;
  }

  // ── canMakeCall ─────────────────────────────────────────────────────────────

  it('canMakeCall returns true when no calls have been made', async () => {
    const l = await makeLimiter();
    expect(await l.canMakeCall()).toBe(true);
  });

  it('canMakeCall returns true when below the soft limit', async () => {
    store.calls = Array.from({ length: 74 }, () => recentCall());
    store.weeklyCount = 74;
    const l = await makeLimiter();
    expect(await l.canMakeCall()).toBe(true);
  });

  it('canMakeCall returns false when at the soft limit (75)', async () => {
    store.calls = Array.from({ length: 75 }, () => recentCall());
    store.weeklyCount = 75;
    const l = await makeLimiter();
    expect(await l.canMakeCall()).toBe(false);
  });

  it('canMakeCall returns false above the soft limit', async () => {
    store.calls = Array.from({ length: 80 }, () => recentCall());
    store.weeklyCount = 80;
    const l = await makeLimiter();
    expect(await l.canMakeCall()).toBe(false);
  });

  // ── getStatus ───────────────────────────────────────────────────────────────

  it('getStatus returns correct count and remaining values', async () => {
    store.calls = Array.from({ length: 10 }, () => recentCall());
    store.weeklyCount = 10;
    const l = await makeLimiter();
    const status = await l.getStatus();
    expect(status.count).toBe(10);
    expect(status.remaining).toBe(65); // 75 - 10
    expect(status.softLimit).toBe(75);
    expect(status.hardLimit).toBe(100);
  });

  it('getStatus excludes calls older than 7 days', async () => {
    // Two old calls and one recent — only the recent one should count
    store.calls = [oldCall(8), oldCall(10), recentCall()];
    store.weeklyCount = 3;
    const l = await makeLimiter(); // initialize calls cleanupOldCalls
    const status = await l.getStatus();
    expect(status.count).toBe(1);
  });

  it('getStatus marks isBlocked when at the soft limit', async () => {
    store.calls = Array.from({ length: 75 }, () => recentCall());
    store.weeklyCount = 75;
    const l = await makeLimiter();
    const status = await l.getStatus();
    expect(status.isBlocked).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it('getStatus marks isNearLimit at or above 90% of soft limit', async () => {
    // 90% of 75 = 67.5 → 68 calls should trigger isNearLimit
    store.calls = Array.from({ length: 68 }, () => recentCall());
    store.weeklyCount = 68;
    const l = await makeLimiter();
    const status = await l.getStatus();
    expect(status.isNearLimit).toBe(true);
    expect(status.isBlocked).toBe(false);
  });

  it('getStatus does not mark isNearLimit below 90% of soft limit', async () => {
    store.calls = Array.from({ length: 67 }, () => recentCall());
    store.weeklyCount = 67;
    const l = await makeLimiter();
    const status = await l.getStatus();
    expect(status.isNearLimit).toBe(false);
  });

  it('getStatus reports the oldest call expiry date', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * DAY_MS).toISOString();
    store.calls = [recentCall({ timestamp: fourDaysAgo }), recentCall()];
    store.weeklyCount = 2;
    const l = await makeLimiter();
    const status = await l.getStatus();
    expect(status.oldestCallExpiry).not.toBeNull();
    // The expiry should be 7 days after the oldest call
    const expiry = new Date(status.oldestCallExpiry!).getTime();
    const expectedExpiry = new Date(fourDaysAgo).getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiry - expectedExpiry)).toBeLessThan(1000); // within 1 second
  });

  // ── recordCall ──────────────────────────────────────────────────────────────

  it('recordCall adds a new entry visible in getStatus', async () => {
    const l = await makeLimiter();
    await l.recordCall('/api/fixtures', 'admin');
    const status = await l.getStatus();
    expect(status.count).toBe(1);
    expect(status.recentCalls[0].endpoint).toBe('/api/fixtures');
    expect(status.recentCalls[0].user).toBe('admin');
  });

  it('recordCall increments count on each call', async () => {
    const l = await makeLimiter();
    await l.recordCall('/api/standings', 'user1');
    await l.recordCall('/api/standings', 'user1');
    const status = await l.getStatus();
    expect(status.count).toBe(2);
  });

  // ── reset ────────────────────────────────────────────────────────────────────

  it('reset clears all call records', async () => {
    store.calls = Array.from({ length: 50 }, () => recentCall());
    store.weeklyCount = 50;
    const l = await makeLimiter();
    await l.reset();
    const status = await l.getStatus();
    expect(status.count).toBe(0);
  });

  it('canMakeCall returns true again after a reset', async () => {
    store.calls = Array.from({ length: 75 }, () => recentCall());
    store.weeklyCount = 75;
    const l = await makeLimiter();
    expect(await l.canMakeCall()).toBe(false);
    await l.reset();
    expect(await l.canMakeCall()).toBe(true);
  });

  // ── cleanupOldCalls ─────────────────────────────────────────────────────────

  it('cleanupOldCalls returns the count of remaining recent calls', async () => {
    store.calls = [oldCall(8), oldCall(9), recentCall(), recentCall()];
    store.weeklyCount = 4;
    const l = await makeLimiter(); // first cleanup happens in initialize
    const remaining = await l.cleanupOldCalls();
    expect(remaining).toBe(2);
  });

  it('cleanupOldCalls removes calls at exactly the 7-day boundary', async () => {
    // A call made exactly 7 days + 1 ms ago should be removed
    const justExpired = new Date(Date.now() - (7 * DAY_MS + 1)).toISOString();
    store.calls = [recentCall({ timestamp: justExpired }), recentCall()];
    store.weeklyCount = 2;
    const l = await makeLimiter();
    const remaining = await l.cleanupOldCalls();
    expect(remaining).toBe(1);
  });

  // ── getAnalytics ─────────────────────────────────────────────────────────────

  it('getAnalytics groups calls by endpoint', async () => {
    store.calls = [
      recentCall({ endpoint: '/api/fixtures' }),
      recentCall({ endpoint: '/api/fixtures' }),
      recentCall({ endpoint: '/api/standings' }),
    ];
    store.weeklyCount = 3;
    const l = await makeLimiter();
    const analytics = await l.getAnalytics();
    expect(analytics.totalCalls).toBe(3);
    expect(analytics.byEndpoint['/api/fixtures']).toBe(2);
    expect(analytics.byEndpoint['/api/standings']).toBe(1);
  });

  it('getAnalytics groups calls by user', async () => {
    store.calls = [
      recentCall({ user: 'admin' }),
      recentCall({ user: 'admin' }),
      recentCall({ user: 'user1' }),
    ];
    store.weeklyCount = 3;
    const l = await makeLimiter();
    const analytics = await l.getAnalytics();
    expect(analytics.byUser['admin']).toBe(2);
    expect(analytics.byUser['user1']).toBe(1);
  });

  it('getAnalytics excludes calls older than 7 days from totals', async () => {
    store.calls = [oldCall(8), recentCall(), recentCall()];
    store.weeklyCount = 3;
    const l = await makeLimiter();
    const analytics = await l.getAnalytics();
    expect(analytics.totalCalls).toBe(2);
  });

  it('getAnalytics returns a weekPeriod with start and end dates', async () => {
    const l = await makeLimiter();
    const analytics = await l.getAnalytics();
    expect(analytics.weekPeriod.start).toBeTruthy();
    expect(analytics.weekPeriod.end).toBeTruthy();
    expect(new Date(analytics.weekPeriod.start).getTime()).toBeLessThan(
      new Date(analytics.weekPeriod.end).getTime()
    );
  });
});
