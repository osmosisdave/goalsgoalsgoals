import type { KickoffValidityInput, KickoffValidityResult } from '../domain';

const LONDON_TIMEZONE = 'Europe/London';
const TUESDAY = 'Tue';
const SATURDAY = 'Sat';

const TUESDAY_START_SECONDS = 19 * 60 * 60; // 19:00:00
const TUESDAY_END_SECONDS = 20 * 60 * 60; // 20:00:00 inclusive
const SATURDAY_EXACT_SECONDS = 15 * 60 * 60; // 15:00:00

const LONDON_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TIMEZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function toLondonParts(date: Date): {
  weekday: string;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = LONDON_DATE_PARTS_FORMATTER.formatToParts(date);

  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  const second = parts.find((part) => part.type === 'second')?.value;

  if (weekday === undefined || hour === undefined || minute === undefined || second === undefined) {
    throw new Error('Unable to derive Europe/London date parts from kickoff timestamp.');
  }

  return {
    weekday,
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function secondsSinceMidnight(hour: number, minute: number, second: number): number {
  return hour * 60 * 60 + minute * 60 + second;
}

// REQ-006: Valid kickoff windows in Europe/London timezone (DST-aware).
export function qualifyKickoffValidity(input: KickoffValidityInput): KickoffValidityResult {
  const kickoffDate = new Date(input.kickoffUtc);

  if (Number.isNaN(kickoffDate.getTime())) {
    return {
      isValid: false,
      reason: 'INVALID_TIMESTAMP',
    };
  }

  const londonParts = toLondonParts(kickoffDate);
  const kickoffSeconds = secondsSinceMidnight(
    londonParts.hour,
    londonParts.minute,
    londonParts.second,
  );

  if (
    londonParts.weekday === TUESDAY
    && kickoffSeconds >= TUESDAY_START_SECONDS
    && kickoffSeconds <= TUESDAY_END_SECONDS
  ) {
    return {
      isValid: true,
      reason: 'TUESDAY_WINDOW',
    };
  }

  if (londonParts.weekday === SATURDAY && kickoffSeconds === SATURDAY_EXACT_SECONDS) {
    return {
      isValid: true,
      reason: 'SATURDAY_1500',
    };
  }

  return {
    isValid: false,
    reason: 'OUTSIDE_ALLOWED_WINDOWS',
  };
}
