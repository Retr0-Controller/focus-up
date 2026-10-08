/**
 * Shared test setup. Every test file runs this first.
 *
 * Tests never touch the network. The Supabase client is replaced with a stand-in, and screens are
 * tested against a mocked `@/lib/api`, so no real account or database is involved.
 */
// The real client needs project keys and native storage at import time.
import { useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(),
  },
}));

// Navigation: record where the app tries to go, and run focus effects like a normal effect.
// A test that needs the real router can call `jest.unmock('expo-router')`.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: () => void) =>
    jest.requireActual('react').useEffect(callback, [callback]),
  useLocalSearchParams: jest.fn(() => ({})),
}));

// The native date picker can't render in tests. A plain view stands in for it.
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  const react = jest.requireActual('react');
  return {
    __esModule: true,
    default: () => react.createElement(View, { testID: 'date-picker' }),
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});

// Every test starts from a clean slate: no leftover behavior from the test before it.
// Only the mocks owned by this file are reset. A blanket `jest.resetAllMocks()` would also wipe
// React Native's own built-in test mocks.
beforeEach(() => {
  jest.clearAllMocks();

  const { auth } = jest.mocked(supabase);
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
  auth.signOut.mockReset();
  // (A test that uses the real router, via jest.unmock('expo-router'), has no mock to reset.)
  if (jest.isMockFunction(useLocalSearchParams)) jest.mocked(useLocalSearchParams).mockReturnValue({});

  // Keep test output readable. Code logs a warning when something recoverable fails, which several
  // tests trigger on purpose. Tests that care can assert on `console.warn` themselves.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
