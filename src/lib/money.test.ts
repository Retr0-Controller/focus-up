import { formatCents, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it('turns typed amounts into whole cents', () => {
    expect(parseAmountToCents('12.50')).toBe(1250);
    expect(parseAmountToCents('12.5')).toBe(1250);
    expect(parseAmountToCents('12')).toBe(1200);
    expect(parseAmountToCents('$1,200.99')).toBe(120099);
    expect(parseAmountToCents(' 7. ')).toBe(700);
    expect(parseAmountToCents('.99')).toBe(99);
    expect(parseAmountToCents('0.01')).toBe(1);
  });

  it('has no floating-point drift', () => {
    expect(parseAmountToCents('0.10')! + parseAmountToCents('0.20')!).toBe(30);
    expect(parseAmountToCents('19.99')! * 3).toBe(5997);
  });

  it.each(['', ' ', '.', '$', 'abc', '-5', '0', '0.00', '1.234', '12.5.1', '1e3', '12,5x'])(
    'rejects "%s"',
    (bad) => {
      expect(parseAmountToCents(bad)).toBeNull();
    },
  );

  it('accepts the largest amount the database holds and rejects one cent more', () => {
    expect(parseAmountToCents('21474836.47')).toBe(2147483647);
    expect(parseAmountToCents('21474836.48')).toBeNull();
    expect(parseAmountToCents('999999999999')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats dollars', () => {
    expect(formatCents(1250)).toBe('$12.50');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(120099)).toBe('$1,200.99');
    expect(formatCents(-500)).toBe('-$5.00');
  });
});
