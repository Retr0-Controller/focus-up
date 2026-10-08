/** Money is stored as whole cents. $12.50 is 1250. These helpers convert to and from text. */

/** Largest amount the database can hold (a 4-byte integer of cents). */
const MAX_CENTS = 2_147_483_647;

const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Turns what someone typed ("12.5", "$1,200", "7.") into whole cents.
 * Returns null when it isn't a usable amount. Works on the text, not floats, so there's no rounding drift.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  const match = /^(\d+)?(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match || (match[1] === undefined && !match[2])) return null;

  const dollars = Number(match[1] ?? '0');
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  const total = dollars * 100 + cents;

  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_CENTS) return null;
  return total;
}

/** 1250 -> "$12.50". Negative values keep their sign: -500 -> "-$5.00". */
export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}
