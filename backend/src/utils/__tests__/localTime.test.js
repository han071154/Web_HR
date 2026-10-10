import { describe, expect, it } from 'vitest';
import { lastDayOfMonth, localDate, localMinutesOfDay } from '../localTime.js';

// Múi giờ mặc định của công ty là Asia/Ho_Chi_Minh (UTC+7).
describe('localDate', () => {
  it('returns the Vietnamese date between 0h and 7h (still the previous day in UTC)', () => {
    expect(localDate(new Date('2026-10-09T17:00:00Z'))).toBe('2026-10-10');
    expect(localDate(new Date('2026-10-09T23:59:00Z'))).toBe('2026-10-10');
  });

  it('keeps late evening on the same Vietnamese date', () => {
    expect(localDate(new Date('2026-10-10T16:59:00Z'))).toBe('2026-10-10');
  });
});

describe('localMinutesOfDay', () => {
  it('converts UTC time to minutes since midnight in Vietnam', () => {
    expect(localMinutesOfDay(new Date('2026-10-12T01:20:00Z'))).toBe(8 * 60 + 20);
    expect(localMinutesOfDay(new Date('2026-10-11T17:05:00Z'))).toBe(5);
  });
});

describe('lastDayOfMonth', () => {
  it('handles 30/31-day months and leap years', () => {
    expect(lastDayOfMonth('2026-09')).toBe('2026-09-30');
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31');
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
  });
});
