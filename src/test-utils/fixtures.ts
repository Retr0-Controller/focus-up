import type { Expense } from '@/lib/api';

/** An expense with sensible defaults. Override only what the test cares about. */
export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    amount_cents: 1250,
    merchant: 'Test Cafe',
    spent_on: '2026-10-08',
    category_id: 2, // Food
    detail: null,
    category_source: 'user',
    ...overrides,
  };
}

/** The bit of a signed-in session that screens read. */
export function makeSession(overrides: { id?: string; email?: string } = {}) {
  return { user: { id: overrides.id ?? 'user-1', email: overrides.email ?? 'me@example.com' } };
}
