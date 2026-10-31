import { describe, expect, it } from 'vitest';
import { earlyLeaveMinutes, lateMinutes, yesterday } from '../shiftTiming.js';

// HR-035: số phút trễ / về sớm theo giờ Việt Nam (APP_TIMEZONE mặc định Asia/Ho_Chi_Minh).
describe('shiftTiming', () => {
  it('counts late minutes only beyond the threshold', () => {
    expect(lateMinutes('2026-10-12T01:20:00Z', '08:00:00')).toBe(20);
    expect(lateMinutes('2026-10-12T01:10:00Z', '08:00:00')).toBe(0);
    expect(lateMinutes('2026-10-12T00:50:00Z', '08:00:00')).toBe(0);
  });

  it('counts early-leave minutes only beyond the threshold', () => {
    expect(earlyLeaveMinutes('2026-10-12T09:00:00Z', '17:00:00')).toBe(60);
    expect(earlyLeaveMinutes('2026-10-12T09:50:00Z', '17:00:00')).toBe(0);
    expect(earlyLeaveMinutes('2026-10-12T11:00:00Z', '17:00:00')).toBe(0);
  });

  it('returns 0 without a shift or a time', () => {
    expect(lateMinutes('2026-10-12T03:00:00Z', null)).toBe(0);
    expect(earlyLeaveMinutes(null, '17:00:00')).toBe(0);
  });

  it('computes yesterday in the company timezone', () => {
    // 00:30 ngày 01/11 giờ Việt Nam (vẫn là 31/10 theo UTC) → hôm qua là 31/10.
    expect(yesterday(new Date('2026-10-31T17:30:00Z'))).toBe('2026-10-31');
    expect(yesterday(new Date('2026-11-01T05:00:00Z'))).toBe('2026-10-31');
  });
});
