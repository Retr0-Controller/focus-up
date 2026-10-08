import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { summarizeMonth } from '@/lib/calc';
import { getProfile, listExpenses, type Expense } from '@/lib/api';
import { monthRange } from '@/lib/dates';

/**
 * This month's expenses and the monthly amount, reloaded whenever the screen comes back into view
 * (for example, after the Add expense sheet closes).
 */
export function useMonthData(userId: string | undefined) {
  const [monthlyCents, setMonthlyCents] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { start, nextStart } = monthRange(new Date());
    try {
      const [profile, monthExpenses] = await Promise.all([
        getProfile(userId),
        listExpenses(start, nextStart),
      ]);
      setMonthlyCents(profile.monthly_amount_cents);
      setExpenses(monthExpenses);
      setFailed(false);
    } catch (error) {
      console.warn('Could not load this month', error);
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return {
    loaded,
    failed,
    expenses,
    setExpenses,
    monthlyCents,
    setMonthlyCents,
    summary: summarizeMonth(monthlyCents, expenses),
    reload,
  };
}
