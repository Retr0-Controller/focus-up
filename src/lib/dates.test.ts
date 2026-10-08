import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatShortDate, fromDateString, monthRange, toDateString } from './dates.ts';

describe('dates', () => {
  it('round-trips a calendar day without time zone shifts', () => {
    assert.equal(toDateString(new Date(2026, 9, 8)), '2026-10-08');
    assert.equal(toDateString(new Date(2026, 0, 5)), '2026-01-05');
    assert.equal(toDateString(fromDateString('2026-03-31')), '2026-03-31');
  });

  it('finds the month range, including the year rollover', () => {
    assert.deepEqual(monthRange(new Date(2026, 9, 8)), { start: '2026-10-01', nextStart: '2026-11-01' });
    assert.deepEqual(monthRange(new Date(2026, 11, 31)), { start: '2026-12-01', nextStart: '2027-01-01' });
    assert.deepEqual(monthRange(new Date(2026, 0, 1)), { start: '2026-01-01', nextStart: '2026-02-01' });
  });

  it('formats a short date', () => {
    assert.equal(formatShortDate('2026-10-08'), 'Oct 8');
  });
});
