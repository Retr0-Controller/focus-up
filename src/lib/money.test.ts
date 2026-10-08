import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCents, parseAmountToCents } from './money.ts';

describe('parseAmountToCents', () => {
  it('turns typed amounts into whole cents', () => {
    assert.equal(parseAmountToCents('12.50'), 1250);
    assert.equal(parseAmountToCents('12.5'), 1250);
    assert.equal(parseAmountToCents('12'), 1200);
    assert.equal(parseAmountToCents('$1,200.99'), 120099);
    assert.equal(parseAmountToCents(' 7. '), 700);
    assert.equal(parseAmountToCents('.99'), 99);
    assert.equal(parseAmountToCents('0.01'), 1);
  });

  it('has no floating-point drift', () => {
    assert.equal(parseAmountToCents('0.10')! + parseAmountToCents('0.20')!, 30);
    assert.equal(parseAmountToCents('19.99')! * 3, 5997);
  });

  it('rejects anything that is not a usable amount', () => {
    for (const bad of ['', ' ', '.', '$', 'abc', '-5', '0', '0.00', '1.234', '12.5.1', '1e3', '12,5x']) {
      assert.equal(parseAmountToCents(bad), null, `should reject "${bad}"`);
    }
  });

  it('accepts the largest amount the database holds and rejects one cent more', () => {
    assert.equal(parseAmountToCents('21474836.47'), 2147483647);
    assert.equal(parseAmountToCents('21474836.48'), null);
    assert.equal(parseAmountToCents('999999999999'), null);
  });
});

describe('formatCents', () => {
  it('formats dollars', () => {
    assert.equal(formatCents(1250), '$12.50');
    assert.equal(formatCents(0), '$0.00');
    assert.equal(formatCents(120099), '$1,200.99');
    assert.equal(formatCents(-500), '-$5.00');
  });
});
