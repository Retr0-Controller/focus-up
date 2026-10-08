import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { completeOnboarding, getProfile } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  /** True until the saved session, and the profile that goes with it, have been loaded. */
  isLoading: boolean;
  /** Whether the signed-in user has finished or skipped onboarding. */
  onboardingDone: boolean;
  /** Marks onboarding as done, whether the user finished it or skipped it. */
  finishOnboarding: () => Promise<void>;
};

const SessionContext = createContext<SessionState>({
  session: null,
  isLoading: true,
  onboardingDone: false,
  finishOnboarding: async () => {},
});

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Remember which user the onboarding status belongs to, so a stale answer is never used.
  const [onboarding, setOnboarding] = useState<{ userId: string; done: boolean } | null>(null);

  useEffect(() => {
    // Fires once with the persisted session (INITIAL_SESSION), then on every sign-in/out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    getProfile(userId)
      .then((profile) => {
        if (!cancelled) setOnboarding({ userId, done: profile.onboarding_completed_at !== null });
      })
      .catch((error) => {
        // If the profile can't be loaded (for example, offline), don't trap the user in onboarding.
        console.warn('Could not load profile', error);
        if (!cancelled) setOnboarding({ userId, done: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const finishOnboarding = useCallback(async () => {
    if (!userId) return;
    try {
      await completeOnboarding(userId);
    } catch (error) {
      // Still let them in. Worst case, onboarding is offered again next time.
      console.warn('Could not save onboarding status', error);
    }
    setOnboarding({ userId, done: true });
  }, [userId]);

  const profileReady = !userId || onboarding?.userId === userId;
  const onboardingDone = !!userId && onboarding?.userId === userId && onboarding.done;

  const value = useMemo(
    () => ({
      session,
      isLoading: !sessionLoaded || !profileReady,
      onboardingDone,
      finishOnboarding,
    }),
    [session, sessionLoaded, profileReady, onboardingDone, finishOnboarding],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
