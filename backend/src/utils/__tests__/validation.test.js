import { describe, expect, it } from 'vitest';
import { dateSchema, isRealDate, moneySchema, monthSchema, timeSchema } from '../validation.js';

// Tuần 7 – edge case: ngày/giờ/tháng không tồn tại và số tiền vượt cột NUMERIC(14, 2) phải bị chặn bằng
// lỗi 400 ở API thay vì để PostgreSQL trả lỗi 500 (BUG-28, BUG-29).
describe('validation schemas', () => {
  it('accepts real calendar dates, including 29/02 of a leap year', () => {
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(dateSchema.safeParse('2026-10-12').success).toBe(true);
  });

  it('rejects dates that do not exist', () => {
    for (const value of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-04-31', '2026-00-10']) {
      expect(dateSchema.safeParse(value).success).toBe(false);
    }
  });

  it('only accepts months 01–12', () => {
    expect(monthSchema.safeParse('2026-12').success).toBe(true);
    expect(monthSchema.safeParse('2026-13').success).toBe(false);
    expect(monthSchema.safeParse('2026-00').success).toBe(false);
  });

  it('only accepts real clock times', () => {
    expect(timeSchema.safeParse('23:59').success).toBe(true);
    expect(timeSchema.safeParse('08:00:00').success).toBe(true);
    expect(timeSchema.safeParse('24:00').success).toBe(false);
    expect(timeSchema.safeParse('25:61').success).toBe(false);
  });

  it('caps money at the NUMERIC(14, 2) column limit', () => {
    expect(moneySchema.safeParse(999999999999.99).success).toBe(true);
    expect(moneySchema.safeParse(1e13).success).toBe(false);
    expect(moneySchema.safeParse(-1).success).toBe(false);
  });
});
