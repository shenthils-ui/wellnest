import { describe, it, expect } from 'vitest';
import {
  isValidDate, weekdayOf, parseExpectedDays, isExpectedOn, dateRange, addDays, clampInt,
} from './helpers.js';

// Mirrors backend/test/helpers.test.js exactly. The two helpers.js files are
// independent implementations (server vs on-device) that must behave
// identically — this pair of test files is what actually catches drift
// between them, which is the single biggest regression risk in this repo.

describe('isValidDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDate('2026-06-28')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true);
  });
  it('rejects malformed or impossible dates', () => {
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('isExpectedOn', () => {
  const daily = { active: 1, expected_days: null };
  const mwf = { active: 1, expected_days: '1,3,5' };
  it('every-day activity matches any day', () => {
    expect(isExpectedOn(daily, '2026-06-28')).toBe(true);
  });
  it('scheduled activity only matches its weekdays', () => {
    expect(isExpectedOn(mwf, '2026-06-29')).toBe(true); // Monday
    expect(isExpectedOn(mwf, '2026-06-30')).toBe(false); // Tuesday
  });
  it('retired activity never expected', () => {
    expect(isExpectedOn({ active: 0, expected_days: null }, '2026-06-28')).toBe(false);
  });
});

describe('dateRange / addDays', () => {
  it('range is inclusive and crosses month boundaries', () => {
    expect(dateRange('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
  });
  it('addDays crosses year boundaries', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('clampInt', () => {
  it('clamps and rounds', () => {
    expect(clampInt(15, 1, 10)).toBe(10);
    expect(clampInt(4.6, 1, 10)).toBe(5);
    expect(clampInt('abc', 1, 10)).toBeNull();
  });
});

describe('weekdayOf / parseExpectedDays', () => {
  it('matches real-world weekdays', () => {
    expect(weekdayOf('2026-06-28')).toBe(0); // Sunday
  });
  it('parses/filters a weekday CSV', () => {
    expect(parseExpectedDays('1,9,-1,3')).toEqual([1, 3]);
    expect(parseExpectedDays(null)).toBeNull();
  });
});
