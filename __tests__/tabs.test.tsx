import { userEvent } from '@testing-library/react-native';
import { router, Stack, usePathname } from 'expo-router';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import AddTabPlaceholder from '@/app/(tabs)/add';
import TabLayout from '@/app/(tabs)/_layout';

// These tests use the real router and the real tab bar, so the shared router fake is switched off.
jest.unmock('expo-router');

/** Stand-ins for the screens. The tab bar and the Add tab's behavior are what's being tested. */
const page = (name: string) =>
  function Page() {
    return <Text>{name} page</Text>;
  };

function PathProbe() {
  return <Text testID="pathname">{usePathname()}</Text>;
}
function RootWithProbe() {
  return (
    <>
      {/* A real Stack, like the app's root layout: the Add sheet is pushed on top of the tabs. */}
      <Stack screenOptions={{ headerShown: false }} />
      <PathProbe />
    </>
  );
}

const routes = {
  _layout: RootWithProbe,
  '(tabs)/_layout': TabLayout,
  '(tabs)/home': page('Home'),
  '(tabs)/add': AddTabPlaceholder,
  '(tabs)/calendar': page('Calendar'),
  '(tabs)/settings': page('Settings'),
  'add-expense': page('Add expense'),
};

async function expectPathname(path: string) {
  await waitFor(() => expect(screen.getByTestId('pathname').props.children).toBe(path));
}

/** The tab bar's button for a tab, found by its label. */
function tab(label: string) {
  return screen.getByRole('button', { name: new RegExp(`^${label}`) });
}

async function open(initialUrl = '/home') {
  await renderRouter(routes, { initialUrl });
  await expectPathname(initialUrl);
}

describe('the tab bar', () => {
  it('has Home, Add, Calendar, and Settings, in that order', async () => {
    await open();

    const labels = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel as string | undefined)
      .filter((label): label is string => Boolean(label));
    expect(labels).toHaveLength(4);
    expect(labels[0]).toMatch(/^Home/);
    expect(labels[1]).toMatch(/^Add expense/);
    expect(labels[2]).toMatch(/^Calendar/);
    expect(labels[3]).toMatch(/^Settings/);
  });

  it('starts on Home', async () => {
    await open();

    expect(screen.getByText('Home page')).toBeOnTheScreen();
  });

  it('switches between Home, Calendar, and Settings', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.press(tab('Calendar'));
    await expectPathname('/calendar');
    expect(screen.getByText('Calendar page')).toBeOnTheScreen();

    await user.press(tab('Settings'));
    await expectPathname('/settings');
    expect(screen.getByText('Settings page')).toBeOnTheScreen();

    await user.press(tab('Home'));
    await expectPathname('/home');
  });

  it('Add opens the Add expense sheet, without switching to an empty Add page', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open('/settings');

    await user.press(tab('Add expense'));

    await expectPathname('/add-expense');
    expect(screen.getByText('Add expense page')).toBeOnTheScreen();
  });

  it.each(['/home', '/calendar', '/settings'])('Add works from %s, and closing the sheet returns there', async (start) => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open(start);

    await user.press(tab('Add expense'));
    await expectPathname('/add-expense');

    // If the Add tab had switched to its own empty page first, going back would land on it.
    await act(async () => router.back());
    await expectPathname(start);
  });
});
