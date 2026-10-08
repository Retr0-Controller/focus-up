import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeName, summarizeMonth } from './calc.ts';

describe('summarizeMonth', () => {
  const expenses = [{ amount_cents: 1250 }, { amount_cents: 500 }];

  it('subtracts spending from the monthly amount', () => {
    assert.deepEqual(summarizeMonth(200000, expenses), {
      monthlyCents: 200000,
      spentCents: 1750,
      leftCents: 198250,
    });
    assert.deepEqual(summarizeMonth(500, []), { monthlyCents: 500, spentCents: 0, leftCents: 500 });
  });

  it('has no "left" until a monthly amount is set', () => {
    assert.deepEqual(summarizeMonth(null, expenses), {
      monthlyCents: null,
      spentCents: 1750,
      leftCents: null,
    });
  });

  it('goes negative when spending passes the monthly amount', () => {
    assert.equal(summarizeMonth(1000, expenses).leftCents, -750);
  });
});

describe('normalizeName', () => {
  it('matches merchants regardless of case and spacing', () => {
    assert.equal(normalizeName("  Trader   Joe's "), normalizeName("trader joe's"));
    assert.notEqual(normalizeName('Target'), normalizeName('Targe'));
  });
});
