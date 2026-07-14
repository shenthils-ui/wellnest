const {
  isValidDate, weekdayOf, parseExpectedDays, isExpectedOn, dateRange, addDays, clampInt,
} = require('../helpers');

describe('isValidDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDate('2026-06-28')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // leap day
  });
  it('rejects malformed or impossible dates', () => {
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2023-02-29')).toBe(false); // not a leap year
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('weekdayOf', () => {
  it('matches the real-world weekday (2026-06-28 is a Sunday)', () => {
    expect(weekdayOf('2026-06-28')).toBe(0);
    expect(weekdayOf('2026-06-29')).toBe(1); // Monday
  });
});

describe('parseExpectedDays', () => {
  it('parses a CSV of weekday numbers', () => {
    expect(parseExpectedDays('1,3,5,0')).toEqual([1, 3, 5, 0]);
  });
  it('treats empty/null as "every day"', () => {
    expect(parseExpectedDays(null)).toBeNull();
    expect(parseExpectedDays('')).toBeNull();
    expect(parseExpectedDays(undefined)).toBeNull();
  });
  it('drops out-of-range or garbage values', () => {
    expect(parseExpectedDays('1,9,-1,3')).toEqual([1, 3]);
  });
});

describe('isExpectedOn', () => {
  const daily = { active: 1, expected_days: null };
  const mwf = { active: 1, expected_days: '1,3,5' }; // Mon/Wed/Fri
  it('an every-day activity is expected any day', () => {
    expect(isExpectedOn(daily, '2026-06-28')).toBe(true);
    expect(isExpectedOn(daily, '2026-06-29')).toBe(true);
  });
  it('a scheduled activity only matches its weekdays', () => {
    expect(isExpectedOn(mwf, '2026-06-29')).toBe(true); // Monday
    expect(isExpectedOn(mwf, '2026-06-30')).toBe(false); // Tuesday
  });
  it('an inactive (retired) activity is never expected', () => {
    expect(isExpectedOn({ active: 0, expected_days: null }, '2026-06-28')).toBe(false);
  });
});

describe('dateRange', () => {
  it('is inclusive of both endpoints', () => {
    expect(dateRange('2026-06-01', '2026-06-03')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });
  it('a single-day range returns exactly that day', () => {
    expect(dateRange('2026-06-01', '2026-06-01')).toEqual(['2026-06-01']);
  });
  it('crosses a month boundary correctly', () => {
    const r = dateRange('2026-01-30', '2026-02-02');
    expect(r).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
  });
});

describe('addDays', () => {
  it('adds and subtracts across month/year boundaries', () => {
    expect(addDays('2026-06-28', 3)).toBe('2026-07-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('clampInt', () => {
  it('clamps into range', () => {
    expect(clampInt(15, 1, 10)).toBe(10);
    expect(clampInt(-3, 1, 10)).toBe(1);
    expect(clampInt(5, 1, 10)).toBe(5);
  });
  it('rounds fractional input', () => {
    expect(clampInt(4.6, 1, 10)).toBe(5);
  });
  it('returns null for non-numeric input (caller treats this as invalid)', () => {
    expect(clampInt('abc', 1, 10)).toBeNull();
  });
});
