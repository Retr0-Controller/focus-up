import { render, screen, userEvent } from '@testing-library/react-native';

import SettingsScreen from '@/app/(tabs)/settings';
import { useSession } from '@/hooks/use-session';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { makeSession } from '@/test-utils/fixtures';

jest.mock('@/lib/api');
jest.mock('@/hooks/use-session');
const mockedApi = jest.mocked(api);

function givenMonthlyAmount(cents: number | null) {
  mockedApi.getProfile.mockResolvedValue({
    id: 'user-1',
    onboarding_completed_at: '2026-10-01T00:00:00Z',
    monthly_amount_cents: cents,
  });
}

beforeEach(() => {
  jest.mocked(useSession).mockReturnValue({
    session: makeSession() as never,
    isLoading: false,
    onboardingDone: true,
    finishOnboarding: jest.fn(),
  });
  mockedApi.setMonthlyAmount.mockResolvedValue();
});

describe('Settings: monthly amount', () => {
  it('shows the current monthly amount', async () => {
    givenMonthlyAmount(200000);
    await render(<SettingsScreen />);

    expect(await screen.findByPlaceholderText('e.g. 2000')).toHaveDisplayValue('2000');
    expect(screen.getByText('Monthly amount')).toBeOnTheScreen();
  });

  it('saves a changed amount in cents, for this user, and says so', async () => {
    givenMonthlyAmount(200000);
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    const box = await screen.findByPlaceholderText('e.g. 2000');

    await user.clear(box);
    await user.type(box, '2500.50');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(mockedApi.setMonthlyAmount).toHaveBeenCalledWith('user-1', 250050);
    expect(await screen.findByText('✓ Saved')).toBeOnTheScreen();
  });

  it('hides the "Saved" note again as soon as you start changing it', async () => {
    givenMonthlyAmount(200000);
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    await user.press(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('✓ Saved')).toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('e.g. 2000'), '1');

    expect(screen.queryByText('✓ Saved')).not.toBeOnTheScreen();
  });

  it('does not save an amount that makes no sense', async () => {
    givenMonthlyAmount(200000);
    const user = userEvent.setup();
    await render(<SettingsScreen />);
    const box = await screen.findByPlaceholderText('e.g. 2000');

    await user.clear(box);
    await user.type(box, 'lots');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText("That amount doesn't look quite right. Try something like 2000.")).toBeOnTheScreen();
    expect(mockedApi.setMonthlyAmount).not.toHaveBeenCalled();
    expect(screen.queryByText('✓ Saved')).not.toBeOnTheScreen();
  });

  it('explains calmly when saving fails', async () => {
    givenMonthlyAmount(200000);
    mockedApi.setMonthlyAmount.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText("That didn't save just now. Check your connection and try again.")).toBeOnTheScreen();
    expect(screen.queryByText('✓ Saved')).not.toBeOnTheScreen();
  });

  it('explains calmly when settings cannot load, and can try again', async () => {
    mockedApi.getProfile.mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    expect(
      await screen.findByText("We couldn't load your settings just now. Check your connection and try again."),
    ).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText('e.g. 2000')).not.toBeOnTheScreen(); // no form with a wrong value

    givenMonthlyAmount(50000);
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByPlaceholderText('e.g. 2000')).toHaveDisplayValue('500');
  });
});

describe('Settings: account', () => {
  it('shows who is signed in, and signs out', async () => {
    givenMonthlyAmount(200000);
    const user = userEvent.setup();
    await render(<SettingsScreen />);

    expect(await screen.findByText('Signed in as me@example.com')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Sign out' }));

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
