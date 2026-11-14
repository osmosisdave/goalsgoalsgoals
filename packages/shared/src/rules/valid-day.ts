import type { 
    ValidDayQualificationInput,
    ValidDayQualificationResult,
} from '../domain/index.js';

const DEFAULT_VALID_DAY_THRESHOLD = 30;

// REQ-005: A day is valid when it has >= threshold valid fixtures.  This means users are required to pick a game if this method returns true for a given day.  
// If it returns false, users are not required to pick a game for that day.
export function qualifyValidDay(input: ValidDayQualificationInput): ValidDayQualificationResult {
    const thresholdUsed = input.threshold ?? DEFAULT_VALID_DAY_THRESHOLD;
    const validFixtureCount = input.fixtures.length;

    return {
        isValidDay: validFixtureCount >= thresholdUsed,
        validFixtureCount,
        thresholdUsed,
    };
}