import { normalizeName, summarizeMonth } from './calc';

describe('summarizeMonth', () => {
  const expenses = [{ amount_cents: 1250 }, { amount_cents: 500 }];

  it('subtracts spending from the monthly amount', () => {
    expect(summarizeMonth(200000, expenses)).toEqual({
      monthlyCents: 200000,
      spentCents: 1750,
      leftCents: 198250,
    });
    expect(summarizeMonth(500, [])).toEqual({ monthlyCents: 500, spentCents: 0, leftCents: 500 });
  });

  it('has no "left" until a monthly amount is set', () => {
    expect(summarizeMonth(null, expenses)).toEqual({
      monthlyCents: null,
      spentCents: 1750,
      leftCents: null,
    });
  });

  it('goes negative when spending passes the monthly amount', () => {
    expect(summarizeMonth(1000, expenses).leftCents).toBe(-750);
  });
});

describe('normalizeName', () => {
  it('matches merchants regardless of case and spacing', () => {
    expect(normalizeName("  Trader   Joe's ")).toBe(normalizeName("trader joe's"));
    expect(normalizeName('Target')).not.toBe(normalizeName('Targe'));
  });
});
