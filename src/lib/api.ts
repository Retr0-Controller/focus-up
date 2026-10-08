/**
 * Every Supabase call the screens need lives here. Screens call these functions
 * and never import the Supabase client directly.
 */
import { normalizeName } from '@/lib/calc';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  onboarding_completed_at: string | null;
  monthly_amount_cents: number | null;
};

export type Expense = {
  id: string;
  amount_cents: number;
  merchant: string;
  /** "YYYY-MM-DD" */
  spent_on: string;
  /** Null means not sorted yet. */
  category_id: number | null;
  detail: string | null;
  category_source: 'user' | 'rule' | null;
};

export type MerchantRule = { id: string; merchant: string; category_id: number };
export type TypeRule = { id: string; spending_type: string; category_id: number };

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, onboarding_completed_at, monthly_amount_cents')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

/** Marks onboarding as done. Used for both "finished" and "skipped". */
export async function completeOnboarding(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

/** Saves "this type of spending belongs under this umbrella". Placing it again replaces the old choice. */
export async function saveTypeRule(spendingType: string, categoryId: number): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('type_rules')
    .select('id')
    .eq('spending_type', spendingType)
    .maybeSingle();
  if (findError) throw findError;

  const { error } = existing
    ? await supabase.from('type_rules').update({ category_id: categoryId }).eq('id', existing.id)
    : await supabase.from('type_rules').insert({ spending_type: spendingType, category_id: categoryId });
  if (error) throw error;
}

/** Sets the monthly amount that "left to spend" is measured against. */
export async function setMonthlyAmount(userId: string, cents: number): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ monthly_amount_cents: cents })
    .eq('id', userId);
  if (error) throw error;
}

const EXPENSE_COLUMNS = 'id, amount_cents, merchant, spent_on, category_id, detail, category_source';

type ExpenseRow = Omit<Expense, 'category_source'> & { category_source: string | null };

/** The database stores the source as text; only these two values are ever written. */
function toExpense(row: ExpenseRow): Expense {
  return {
    ...row,
    category_source: row.category_source === 'user' || row.category_source === 'rule' ? row.category_source : null,
  };
}

/** Expenses with a date in [start, nextStart), newest first. Dates are "YYYY-MM-DD". */
export async function listExpenses(start: string, nextStart: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_COLUMNS)
    .gte('spent_on', start)
    .lt('spent_on', nextStart)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toExpense);
}

export async function getExpense(expenseId: string): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').select(EXPENSE_COLUMNS).eq('id', expenseId).single();
  if (error) throw error;
  return toExpense(data);
}

export type NewExpense = {
  amountCents: number;
  merchant: string;
  spentOn: string;
  categoryId: number | null;
  detail: string | null;
  /** How the category was chosen. Ignored when there's no category. */
  source: 'user' | 'rule';
};

export async function addExpense(expense: NewExpense): Promise<void> {
  const { error } = await supabase.from('expenses').insert({
    amount_cents: expense.amountCents,
    merchant: expense.merchant,
    spent_on: expense.spentOn,
    category_id: expense.categoryId,
    detail: expense.detail,
    category_source: expense.categoryId === null ? null : expense.source,
  });
  if (error) throw error;
}

export type ExpenseChanges = {
  amountCents: number;
  merchant: string;
  spentOn: string;
  detail: string | null;
  /**
   * Set only when the user picked a different umbrella for this purchase. Leave it out to keep the
   * category (and whether a rule or the user chose it) exactly as it was. Editing never changes the
   * saved merchant rule.
   */
  categoryId?: number;
};

export async function updateExpense(expenseId: string, changes: ExpenseChanges): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      amount_cents: changes.amountCents,
      merchant: changes.merchant,
      spent_on: changes.spentOn,
      detail: changes.detail,
      ...(changes.categoryId === undefined
        ? {}
        : { category_id: changes.categoryId, category_source: 'user' }),
    })
    .eq('id', expenseId);
  if (error) throw error;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

export async function listMerchantRules(): Promise<MerchantRule[]> {
  const { data, error } = await supabase.from('merchant_rules').select('id, merchant, category_id');
  if (error) throw error;
  return data;
}

export async function listTypeRules(): Promise<TypeRule[]> {
  const { data, error } = await supabase.from('type_rules').select('id, spending_type, category_id');
  if (error) throw error;
  return data;
}

/** "Sort once, remember after": saves where this merchant belongs, replacing any earlier rule for it. */
export async function saveMerchantRule(merchant: string, categoryId: number): Promise<void> {
  const rules = await listMerchantRules();
  const existing = rules.find((rule) => normalizeName(rule.merchant) === normalizeName(merchant));

  const { error } = existing
    ? await supabase.from('merchant_rules').update({ category_id: categoryId }).eq('id', existing.id)
    : await supabase.from('merchant_rules').insert({ merchant, category_id: categoryId });
  if (error) throw error;
}
