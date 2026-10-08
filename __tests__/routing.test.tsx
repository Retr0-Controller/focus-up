import { Slot, usePathname } from 'expo-router';
import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { useSession } from '@/hooks/use-session';
import * as api from '@/lib/api';
import { captureAuthListener } from '@/test-utils/auth';
import { makeSession } from '@/test-utils/fixtures';

// These tests use the real router and the real root layout, so the shared router fake is switched off.
jest.unmock('expo-router');
jest.mock('@/lib/api');
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
const mockedApi = jest.mocked(api);

/**
 * Simple stand-ins for the real screens. Each shows its own name, so a test can see where it landed.
 * (Screens are tested on their own elsewhere; this file is about who is allowed to see which one.)
 */
function Landing() {
  return <Text>Landing page</Text>;
}
function SignIn() {
  return <Text>Sign in page</Text>;
}
const onboardingOpened = jest.fn();
function Onboarding() {
  const { finishOnboarding } = useSession();
  useEffect(() => onboardingOpened(), []);
  return (
    <Pressable accessibilityRole="button" onPress={finishOnboarding}>
      <Text>Onboarding page, tap to finish</Text>
    </Pressable>
  );
}
function Home() {
  return <Text>Home page</Text>;
}
function AddExpense() {
  return <Text>Add expense page</Text>;
}

/**
 * Shows the current path on screen so tests can read it. (The router's own `toHavePathname` helper
 * doesn't work with this version of Testing Library, so this uses the public `usePathname` hook.)
 */
function PathProbe() {
  return <Text testID="pathname">{usePathname()}</Text>;
}
function LayoutWithProbe() {
  return (
    <>
      <RootLayout />
      <PathProbe />
    </>
  );
}

/** Waits for the router to settle on `path`. */
async function expectPathname(path: string) {
  await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(`^${path}$`.replace(/[\^$]/g, '')));
  expect(screen.getByTestId('pathname').props.children).toBe(path);
}

const routes = {
  _layout: LayoutWithProbe,
  index: Landing,
  'sign-in': SignIn,
  onboarding: Onboarding,
  // Like the real app, Home lives in a `(tabs)` group that has its own layout, which is what the guard protects.
  '(tabs)/_layout': Slot,
  '(tabs)/home': Home,
  'add-expense': AddExpense,
};

type Who = 'signed-out' | 'new-user' | 'returning-user';

/** Starts the app at `initialUrl` as the given kind of visitor, and waits for the auth check to finish. */
async function openAs(who: Who, initialUrl = '/') {
  const fire = captureAuthListener();
  mockedApi.getProfile.mockResolvedValue({
    id: 'user-1',
    onboarding_completed_at: who === 'returning-user' ? '2026-10-01T00:00:00Z' : null,
    monthly_amount_cents: null,
  });
  mockedApi.completeOnboarding.mockResolvedValue();

  await renderRouter(routes, { initialUrl });
  await fire('INITIAL_SESSION', who === 'signed-out' ? null : makeSession());
  return fire;
}

describe('who sees which screen', () => {
  it('a signed-out visitor sees the landing page', async () => {
    await openAs('signed-out');

    await expectPathname('/');
    expect(screen.getByText('Landing page')).toBeOnTheScreen();
  });

  it('a new user goes to onboarding', async () => {
    await openAs('new-user');

    await expectPathname('/onboarding');
    expect(screen.getByText('Onboarding page, tap to finish')).toBeOnTheScreen();
  });

  it('a returning user goes straight to Home', async () => {
    await openAs('returning-user');

    await expectPathname('/home');
    expect(screen.getByText('Home page')).toBeOnTheScreen();
  });
});

describe('pages people should not be able to reach', () => {
  it.each(['/home', '/add-expense', '/onboarding'])('signed out, %s leads back to the landing page', async (url) => {
    await openAs('signed-out', url);

    await expectPathname('/');
    expect(screen.getByText('Landing page')).toBeOnTheScreen();
  });

  it.each(['/home', '/add-expense'])('a new user cannot skip onboarding by opening %s', async (url) => {
    await openAs('new-user', url);

    await expectPathname('/onboarding');
  });

  it.each(['/', '/sign-in', '/onboarding'])(
    'a returning user who opens %s ends up on Home, not on a sign-up screen',
    async (url) => {
      await openAs('returning-user', url);

      await expectPathname('/home');
    },
  );

  it('a returning user can open the Add expense sheet', async () => {
    await openAs('returning-user', '/add-expense');

    await expectPathname('/add-expense');
  });
});

describe('moving between states', () => {
  it('finishing onboarding takes a new user to Home', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await openAs('new-user');

    await user.press(screen.getByRole('button', { name: 'Onboarding page, tap to finish' }));

    expect(mockedApi.completeOnboarding).toHaveBeenCalledWith('user-1');
    await expectPathname('/home');
  });

  it('signing out sends a returning user back to the landing page', async () => {
    const fire = await openAs('returning-user');
    await expectPathname('/home');

    await fire('SIGNED_OUT', null);

    await expectPathname('/');
    expect(screen.getByText('Landing page')).toBeOnTheScreen();
  });

  it('signing in from the landing page takes a returning user to Home without passing through onboarding', async () => {
    mockedApi.getProfile.mockResolvedValue({
      id: 'user-1',
      onboarding_completed_at: '2026-10-01T00:00:00Z',
      monthly_amount_cents: null,
    });
    const fire = captureAuthListener();
    await renderRouter(routes);
    await fire('INITIAL_SESSION', null);
    await expectPathname('/');

    await fire('SIGNED_IN', makeSession());

    await expectPathname('/home');
    expect(onboardingOpened).not.toHaveBeenCalled();
  });
});

describe('the splash screen', () => {
  it('stays up until the saved session has been checked, then goes away', async () => {
    const fire = captureAuthListener();
    mockedApi.getProfile.mockResolvedValue({
      id: 'user-1',
      onboarding_completed_at: '2026-10-01T00:00:00Z',
      monthly_amount_cents: null,
    });

    await renderRouter(routes);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled(); // still working out who this is

    await fire('INITIAL_SESSION', makeSession());

    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });
});
