export type MonthSummary = {
  /** The monthly amount the user set, or null if they haven't set one yet. */
  monthlyCents: number | null;
  spentCents: number;
  /** monthlyCents minus spentCents. Negative means spending went past the monthly amount. */
  leftCents: number | null;
};

/**
 * "Left to spend" for a month: the monthly amount minus what was spent.
 * Unpaid bills will be subtracted here too once bills exist.
 */
export function summarizeMonth(
  monthlyCents: number | null,
  expenses: { amount_cents: number }[],
): MonthSummary {
  const spentCents = expenses.reduce((sum, expense) => sum + expense.amount_cents, 0);
  return {
    monthlyCents,
    spentCents,
    leftCents: monthlyCents === null ? null : monthlyCents - spentCents,
  };
}

/** Treats a name as the same merchant regardless of case and extra spaces. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
