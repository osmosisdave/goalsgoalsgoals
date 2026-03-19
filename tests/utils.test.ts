import { describe, it, expect } from 'vitest';
import { parseJwtUsername, fmtDate } from '../src/utils';

// Build a minimal JWT with a known payload (no real signing needed for these tests)
function makeJwt(payload: object): string {
  const encoded = btoa(JSON.stringify(payload));
  return `header.${encoded}.signature`;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseJwtUsername
// ─────────────────────────────────────────────────────────────────────────────
describe('parseJwtUsername', () => {
  it('extracts sub from a valid JWT payload', () => {
    expect(parseJwtUsername(makeJwt({ sub: 'alice', role: 'user' }))).toBe('alice');
  });

  it('falls back to the username field when sub is absent', () => {
    expect(parseJwtUsername(makeJwt({ username: 'bob' }))).toBe('bob');
  });

  it('prefers sub over username when both are present', () => {
    expect(parseJwtUsername(makeJwt({ sub: 'primary', username: 'fallback' }))).toBe('primary');
  });

  it('returns null when neither sub nor username is present', () => {
    expect(parseJwtUsername(makeJwt({ role: 'admin' }))).toBeNull();
  });

  it('returns null for a token with fewer than two dot-separated parts', () => {
    expect(parseJwtUsername('notavalidtoken')).toBeNull();
  });

  it('returns null when the payload segment is not valid base64-JSON', () => {
    expect(parseJwtUsername('header.!!!invalid!!!.sig')).toBeNull();
  });

  it('handles URL-safe base64 characters in the payload', () => {
    // Manually build a token whose payload uses - and _ (URL-safe base64 chars)
    const payload = JSON.stringify({ sub: 'carol' });
    // btoa gives standard base64; replace + with - and / with _ to simulate URL-safe
    const urlSafe = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(parseJwtUsername(`header.${urlSafe}.sig`)).toBe('carol');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fmtDate
// ─────────────────────────────────────────────────────────────────────────────
describe('fmtDate', () => {
  it('returns "Today, HH:MM" for a timestamp matching today', () => {
    const now = new Date().toISOString();
    expect(fmtDate(now)).toMatch(/^Today, \d{2}:\d{2}$/);
  });

  it('returns "Tomorrow, HH:MM" for a timestamp matching tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(fmtDate(tomorrow.toISOString())).toMatch(/^Tomorrow, \d{2}:\d{2}$/);
  });

  it('does not label a past date as "Today"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(fmtDate(yesterday.toISOString())).not.toMatch(/^Today/);
  });

  it('does not label a date two days out as "Today" or "Tomorrow"', () => {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const result = fmtDate(dayAfterTomorrow.toISOString());
    expect(result).not.toMatch(/^Today/);
    expect(result).not.toMatch(/^Tomorrow/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for any valid ISO date', () => {
    expect(fmtDate('2020-06-15T14:30:00.000Z').length).toBeGreaterThan(0);
  });
});
