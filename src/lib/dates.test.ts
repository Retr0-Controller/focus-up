import { formatShortDate, fromDateString, monthRange, toDateString } from './dates';

describe('dates', () => {
  it('round-trips a calendar day without time zone shifts', () => {
    expect(toDateString(new Date(2026, 9, 8))).toBe('2026-10-08');
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateString(fromDateString('2026-03-31'))).toBe('2026-03-31');
  });

  it('finds the month range, including the year rollover', () => {
    expect(monthRange(new Date(2026, 9, 8))).toEqual({ start: '2026-10-01', nextStart: '2026-11-01' });
    expect(monthRange(new Date(2026, 11, 31))).toEqual({ start: '2026-12-01', nextStart: '2027-01-01' });
    expect(monthRange(new Date(2026, 0, 1))).toEqual({ start: '2026-01-01', nextStart: '2026-02-01' });
  });

  it('formats a short date', () => {
    expect(formatShortDate('2026-10-08')).toBe('Oct 8');
  });
});
