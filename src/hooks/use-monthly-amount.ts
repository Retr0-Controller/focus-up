import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getProfile, setMonthlyAmount } from '@/lib/api';

/** The monthly amount, reloaded whenever the screen comes into view, with a way to change it. */
export function useMonthlyAmount(userId: string | undefined) {
  const [monthlyCents, setMonthlyCents] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const profile = await getProfile(userId);
      setMonthlyCents(profile.monthly_amount_cents);
      setFailed(false);
    } catch (error) {
      console.warn('Could not load monthly amount', error);
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

  const save = useCallback(
    async (cents: number) => {
      if (!userId) return;
      await setMonthlyAmount(userId, cents);
      setMonthlyCents(cents);
    },
    [userId],
  );

  return { loaded, failed, monthlyCents, save, reload };
}
