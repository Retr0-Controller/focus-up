import { act } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

type AuthListener = (event: string, session: unknown) => void;

/**
 * Captures the listener the app registers for sign-in changes, and returns a function that fires it.
 * Use it to pretend someone signed in or out: `await fire('SIGNED_IN', makeSession())`.
 * Call this before rendering, because the app registers its listener when it first renders.
 */
export function captureAuthListener() {
  let listener: AuthListener = () => {};
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(((callback: AuthListener) => {
    listener = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }) as never);
  return (event: string, session: unknown) => act(async () => listener(event, session));
}
