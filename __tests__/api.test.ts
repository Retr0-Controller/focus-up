import {
  addExpense,
  completeOnboarding,
  deleteExpense,
  getExpense,
  getProfile,
  listExpenses,
  listMerchantRules,
  listTypeRules,
  saveMerchantRule,
  saveTypeRule,
  setMonthlyAmount,
  updateExpense,
} from '@/lib/api';
import { fakeQuery, fakeTables } from '@/test-utils/fake-supabase';

/**
 * These check what the app actually asks the database for. The compiler already catches most wrong
 * column and table names, but not everything (a misspelled column in `.order()` slips through),
 * and it can't check the logic: which rows, in what order, and insert-or-update decisions.
 */

const databaseError = { message: 'boom', code: '500' };

describe('profile', () => {
  it('loads one profile by id', async () => {
    const profiles = fakeQuery({ data: { id: 'u1', onboarding_completed_at: null, monthly_amount_cents: 5 } });
    const queried = fakeTables({ profiles });

    const profile = await getProfile('u1');

    expect(queried).toEqual(['profiles']);
    expect(profiles.args('select')).toEqual(['id, onboarding_completed_at, monthly_amount_cents']);
    expect(profiles.args('eq')).toEqual(['id', 'u1']);
    expect(profiles.steps()).toContain('single');
    expect(profile.monthly_amount_cents).toBe(5);
  });

  it('throws when the profile cannot be loaded', async () => {
    fakeTables({ profiles: fakeQuery({ error: databaseError }) });
    await expect(getProfile('u1')).rejects.toBe(databaseError);
  });

  it('marks onboarding done with a timestamp, for that user only', async () => {
    const profiles = fakeQuery();
    fakeTables({ profiles });

    await completeOnboarding('u1');

    const [update] = profiles.args('update')! as [{ onboarding_completed_at: string }];
    expect(new Date(update.onboarding_completed_at).toString()).not.toBe('Invalid Date');
    expect(profiles.args('eq')).toEqual(['id', 'u1']);
  });

  it('saves the monthly amount in cents, for that user only', async () => {
    const profiles = fakeQuery();
    fakeTables({ profiles });

    await setMonthlyAmount('u1', 200000);

    expect(profiles.args('update')).toEqual([{ monthly_amount_cents: 200000 }]);
    expect(profiles.args('eq')).toEqual(['id', 'u1']);
  });

  it('throws when a profile update fails', async () => {
    fakeTables({ profiles: fakeQuery({ error: databaseError }) });
    await expect(setMonthlyAmount('u1', 1)).rejects.toBe(databaseError);
    await expect(completeOnboarding('u1')).rejects.toBe(databaseError);
  });
});

describe('listExpenses', () => {
  it('asks for exactly the month, newest first', async () => {
    const expenses = fakeQuery({ data: [] });
    fakeTables({ expenses });

    await listExpenses('2026-10-01', '2026-11-01');

    expect(expenses.args('gte')).toEqual(['spent_on', '2026-10-01']); // from the 1st, included
    expect(expenses.args('lt')).toEqual(['spent_on', '2026-11-01']); // up to the next month, excluded
    // Newest day first, and within a day the most recently added first.
    expect(expenses.all('order')).toEqual([
      ['spent_on', { ascending: false }],
      ['created_at', { ascending: false }],
    ]);
  });

  it('asks only for the columns the screens use', async () => {
    const expenses = fakeQuery({ data: [] });
    fakeTables({ expenses });

    await listExpenses('2026-10-01', '2026-11-01');

    expect(expenses.args('select')).toEqual(['id, amount_cents, merchant, spent_on, category_id, detail, category_source']);
  });

  it('keeps known category sources and drops anything unexpected', async () => {
    const row = { id: 'x', amount_cents: 1, merchant: 'm', spent_on: '2026-10-01', category_id: 2, detail: null };
    fakeTables({
      expenses: fakeQuery({
        data: [
          { ...row, id: 'a', category_source: 'user' },
          { ...row, id: 'b', category_source: 'rule' },
          { ...row, id: 'c', category_source: null },
          { ...row, id: 'd', category_source: 'robot' },
        ],
      }),
    });

    const result = await listExpenses('2026-10-01', '2026-11-01');

    expect(result.map((e) => e.category_source)).toEqual(['user', 'rule', null, null]);
  });

  it('throws when expenses cannot be loaded', async () => {
    fakeTables({ expenses: fakeQuery({ error: databaseError }) });
    await expect(listExpenses('2026-10-01', '2026-11-01')).rejects.toBe(databaseError);
  });
});

describe('addExpense', () => {
  const base = { amountCents: 1250, merchant: 'Test Cafe', spentOn: '2026-10-08', detail: null };

  it('maps the fields onto the table columns', async () => {
    const expenses = fakeQuery();
    fakeTables({ expenses });

    await addExpense({ ...base, categoryId: 2, source: 'rule', detail: 'lunch' });

    expect(expenses.args('insert')).toEqual([
      {
        amount_cents: 1250,
        merchant: 'Test Cafe',
        spent_on: '2026-10-08',
        category_id: 2,
        detail: 'lunch',
        category_source: 'rule',
      },
    ]);
  });

  it('never records a source for an expense that has no category', async () => {
    const expenses = fakeQuery();
    fakeTables({ expenses });

    await addExpense({ ...base, categoryId: null, source: 'user' });

    expect(expenses.args('insert')).toEqual([expect.objectContaining({ category_id: null, category_source: null })]);
  });

  it('does not send user_id; the database fills it in from the session', async () => {
    const expenses = fakeQuery();
    fakeTables({ expenses });

    await addExpense({ ...base, categoryId: 2, source: 'user' });

    expect(expenses.args('insert')![0]).not.toHaveProperty('user_id');
  });

  it('throws when the expense cannot be saved', async () => {
    fakeTables({ expenses: fakeQuery({ error: databaseError }) });
    await expect(addExpense({ ...base, categoryId: 2, source: 'user' })).rejects.toBe(databaseError);
  });
});

describe('getExpense', () => {
  const row = { id: 'e1', amount_cents: 1250, merchant: 'Cafe', spent_on: '2026-10-08', category_id: 2, detail: null };

  it('loads exactly one expense by id', async () => {
    const expenses = fakeQuery({ data: { ...row, category_source: 'rule' } });
    const queried = fakeTables({ expenses });

    const expense = await getExpense('e1');

    expect(queried).toEqual(['expenses']);
    expect(expenses.args('select')).toEqual(['id, amount_cents, merchant, spent_on, category_id, detail, category_source']);
    expect(expenses.args('eq')).toEqual(['id', 'e1']);
    expect(expenses.steps()).toContain('single');
    expect(expense).toEqual({ ...row, category_source: 'rule' });
  });

  it('drops an unexpected category source, like the list does', async () => {
    fakeTables({ expenses: fakeQuery({ data: { ...row, category_source: 'robot' } }) });
    expect((await getExpense('e1')).category_source).toBeNull();
  });

  it('throws when the expense cannot be loaded', async () => {
    fakeTables({ expenses: fakeQuery({ error: databaseError }) });
    await expect(getExpense('e1')).rejects.toBe(databaseError);
  });
});

describe('updateExpense', () => {
  const changes = { amountCents: 2000, merchant: "Trader Joe's", spentOn: '2026-10-07', detail: 'weekly shop' };

  it('changes only that one expense', async () => {
    const expenses = fakeQuery();
    const queried = fakeTables({ expenses });

    await updateExpense('e1', changes);

    expect(queried).toEqual(['expenses']); // the saved merchant rule is never touched
    expect(expenses.args('eq')).toEqual(['id', 'e1']);
  });

  it('maps the fields onto the table columns', async () => {
    const expenses = fakeQuery();
    fakeTables({ expenses });

    await updateExpense('e1', { ...changes, detail: null });

    expect(expenses.args('update')).toEqual([
      { amount_cents: 2000, merchant: "Trader Joe's", spent_on: '2026-10-07', detail: null },
    ]);
  });

  it('leaves the category and who chose it alone when no new umbrella was picked', async () => {
    const expenses = fakeQuery();
    fakeTables({ expenses });

    await updateExpense('e1', changes);

    const [payload] = expenses.args('update')! as [Record<string, unknown>];
    expect(payload).not.toHaveProperty('category_id');
    expect(payload).not.toHaveProperty('category_source');
  });

  it('records a newly picked umbrella as chosen by the user', async () => {
    const expenses = fakeQuery();
    fakeTables({ expenses });

    await updateExpense('e1', { ...changes, categoryId: 5 });

    expect(expenses.args('update')).toEqual([
      expect.objectContaining({ category_id: 5, category_source: 'user' }),
    ]);
  });

  it('throws when the changes cannot be saved', async () => {
    fakeTables({ expenses: fakeQuery({ error: databaseError }) });
    await expect(updateExpense('e1', changes)).rejects.toBe(databaseError);
  });
});

describe('deleteExpense', () => {
  it('deletes only that one expense', async () => {
    const expenses = fakeQuery();
    const queried = fakeTables({ expenses });

    await deleteExpense('e1');

    expect(queried).toEqual(['expenses']);
    expect(expenses.steps()).toEqual(['delete', 'eq']);
    expect(expenses.args('eq')).toEqual(['id', 'e1']);
  });

  it('throws when it cannot be deleted', async () => {
    fakeTables({ expenses: fakeQuery({ error: databaseError }) });
    await expect(deleteExpense('e1')).rejects.toBe(databaseError);
  });
});

describe('rules', () => {
  it('lists merchant rules and type rules', async () => {
    const merchantRules = fakeQuery({ data: [{ id: 'm1', merchant: 'Target', category_id: 4 }] });
    const typeRules = fakeQuery({ data: [{ id: 't1', spending_type: 'Coffee', category_id: 2 }] });
    fakeTables({ merchant_rules: merchantRules, type_rules: typeRules });

    expect(await listMerchantRules()).toEqual([{ id: 'm1', merchant: 'Target', category_id: 4 }]);
    expect(await listTypeRules()).toEqual([{ id: 't1', spending_type: 'Coffee', category_id: 2 }]);
    expect(merchantRules.args('select')).toEqual(['id, merchant, category_id']);
    expect(typeRules.args('select')).toEqual(['id, spending_type, category_id']);
  });

  describe('saveMerchantRule ("sort once, remember after")', () => {
    it('creates a rule for a merchant it has not seen', async () => {
      const rules = fakeQuery({ data: [{ id: 'm1', merchant: 'Target', category_id: 4 }] });
      fakeTables({ merchant_rules: rules });

      await saveMerchantRule("Trader Joe's", 2);

      expect(rules.args('insert')).toEqual([{ merchant: "Trader Joe's", category_id: 2 }]);
      expect(rules.steps()).not.toContain('update');
    });

    it('updates the existing rule instead of adding a duplicate, ignoring case and spacing', async () => {
      const rules = fakeQuery({ data: [{ id: 'm9', merchant: "  TRADER   JOE'S ", category_id: 4 }] });
      fakeTables({ merchant_rules: rules });

      await saveMerchantRule("trader joe's", 2);

      expect(rules.args('update')).toEqual([{ category_id: 2 }]);
      expect(rules.args('eq')).toEqual(['id', 'm9']);
      expect(rules.steps()).not.toContain('insert');
    });

    it('throws if the rule cannot be saved', async () => {
      // First query (listing) succeeds, the save fails.
      const listing = fakeQuery({ data: [] });
      const saving = fakeQuery({ error: databaseError });
      let call = 0;
      jest.mocked(jest.requireMock('@/lib/supabase').supabase.from).mockImplementation(() => (call++ === 0 ? listing : saving).builder);

      await expect(saveMerchantRule('Target', 4)).rejects.toBe(databaseError);
    });
  });

  describe('saveTypeRule', () => {
    it('creates a rule the first time', async () => {
      const rules = fakeQuery({ data: null }); // nothing found
      fakeTables({ type_rules: rules });

      await saveTypeRule('Coffee', 2);

      expect(rules.args('eq')).toEqual(['spending_type', 'Coffee']);
      expect(rules.args('insert')).toEqual([{ spending_type: 'Coffee', category_id: 2 }]);
      expect(rules.steps()).not.toContain('update');
    });

    it('replaces the earlier choice when the same type is placed again', async () => {
      const rules = fakeQuery({ data: { id: 't1' } }); // found
      fakeTables({ type_rules: rules });

      await saveTypeRule('Coffee', 4);

      expect(rules.args('update')).toEqual([{ category_id: 4 }]);
      expect(rules.all('eq')).toContainEqual(['id', 't1']);
      expect(rules.steps()).not.toContain('insert');
    });
  });
});
