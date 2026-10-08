import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SessionProvider, useSession } from '@/hooks/use-session';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/api');
const mockedApi = jest.mocked(api);

type AuthListener = (event: string, session: unknown) => void;

/** Captures the listener the provider registers, so a test can pretend someone signed in or out. */
function captureAuthListener() {
  let listener: AuthListener = () => {};
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: AuthListener) => {
    listener = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }) as never);
  return (event: string, session: unknown) => act(async () => listener(event, session));
}

const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;
const signedIn = { user: { id: 'user-1', email: 'me@example.com' } };

function profile(done: boolean) {
  return {
    id: 'user-1',
    onboarding_completed_at: done ? '2026-10-01T00:00:00Z' : null,
    monthly_amount_cents: null,
  };
}

describe('useSession', () => {
  it('is loading until the saved session has been checked', async () => {
    captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it('a signed-out visitor is not loading and has not done onboarding', async () => {
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });

    await fire('INITIAL_SESSION', null);

    expect(result.current).toMatchObject({ session: null, isLoading: false, onboardingDone: false });
    expect(mockedApi.getProfile).not.toHaveBeenCalled();
  });

  it('sends a returning user who finished onboarding straight to the app', async () => {
    mockedApi.getProfile.mockResolvedValue(profile(true));
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });

    await fire('INITIAL_SESSION', signedIn);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.onboardingDone).toBe(true);
  });

  it('sends a new user to onboarding', async () => {
    mockedApi.getProfile.mockResolvedValue(profile(false));
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });

    await fire('INITIAL_SESSION', signedIn);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.onboardingDone).toBe(false);
  });

  it('stays "loading" while the profile loads, so the wrong screen never flashes after sign-in', async () => {
    let resolveProfile: (value: ReturnType<typeof profile>) => void = () => {};
    mockedApi.getProfile.mockReturnValue(new Promise((resolve) => (resolveProfile = resolve)));
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });
    await fire('INITIAL_SESSION', null);
    expect(result.current.isLoading).toBe(false);

    await fire('SIGNED_IN', signedIn);

    expect(result.current.session).not.toBeNull();
    expect(result.current.isLoading).toBe(true); // not yet safe to pick a screen

    await act(async () => resolveProfile(profile(true)));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.onboardingDone).toBe(true);
  });

  it("doesn't trap anyone in onboarding when the profile can't be loaded", async () => {
    mockedApi.getProfile.mockRejectedValue(new Error('offline'));
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });

    await fire('INITIAL_SESSION', signedIn);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.onboardingDone).toBe(true);
  });

  it('finishing onboarding saves it and lets the user in', async () => {
    mockedApi.getProfile.mockResolvedValue(profile(false));
    mockedApi.completeOnboarding.mockResolvedValue();
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });
    await fire('INITIAL_SESSION', signedIn);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.finishOnboarding());

    expect(mockedApi.completeOnboarding).toHaveBeenCalledWith('user-1');
    expect(result.current.onboardingDone).toBe(true);
  });

  it('lets the user in even if saving "done" fails', async () => {
    mockedApi.getProfile.mockResolvedValue(profile(false));
    mockedApi.completeOnboarding.mockRejectedValue(new Error('offline'));
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });
    await fire('INITIAL_SESSION', signedIn);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.finishOnboarding());

    expect(result.current.onboardingDone).toBe(true);
  });

  it('forgets everything on sign-out', async () => {
    mockedApi.getProfile.mockResolvedValue(profile(true));
    const fire = captureAuthListener();
    const { result } = await renderHook(() => useSession(), { wrapper });
    await fire('INITIAL_SESSION', signedIn);
    await waitFor(() => expect(result.current.onboardingDone).toBe(true));

    await fire('SIGNED_OUT', null);

    expect(result.current).toMatchObject({ session: null, onboardingDone: false });
  });
});
