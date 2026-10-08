import { render, screen, userEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeScreen from '@/app/(tabs)/home';
import { useSession } from '@/hooks/use-session';
import * as api from '@/lib/api';
import { makeExpense, makeSession } from '@/test-utils/fixtures';

jest.mock('@/lib/api');
jest.mock('@/hooks/use-session');
const mockedApi = jest.mocked(api);

/** Sets up the data the screen loads: the monthly amount and this month's expenses. */
function givenMonth(monthlyCents: number | null, expenses: api.Expense[] = []) {
  mockedApi.getProfile.mockResolvedValue({
    id: 'user-1',
    onboarding_completed_at: '2026-10-01T00:00:00Z',
    monthly_amount_cents: monthlyCents,
  });
  mockedApi.listExpenses.mockResolvedValue(expenses);
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

describe('Home: left to spend', () => {
  it('asks for a monthly amount first, and saves it in cents', async () => {
    givenMonth(null);
    const user = userEvent.setup();
    await render(<HomeScreen />);

    expect(await screen.findByText('How much would you like to spend each month?')).toBeOnTheScreen();
    await user.type(screen.getByPlaceholderText('e.g. 2000'), '2000');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(mockedApi.setMonthlyAmount).toHaveBeenCalledWith('user-1', 200000);
    expect(await screen.findByText('$2,000.00')).toBeOnTheScreen();
    expect(screen.getByText('$0.00 spent of $2,000.00')).toBeOnTheScreen();
  });

  it('does not save an amount that makes no sense', async () => {
    givenMonth(null);
    const user = userEvent.setup();
    await render(<HomeScreen />);

    await user.type(await screen.findByPlaceholderText('e.g. 2000'), 'lots');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText("That amount doesn't look quite right. Try something like 2000.")).toBeOnTheScreen();
    expect(mockedApi.setMonthlyAmount).not.toHaveBeenCalled();
  });

  it('shows the monthly amount minus what was spent', async () => {
    givenMonth(200000, [
      makeExpense({ id: 'a', amount_cents: 1250 }),
      makeExpense({ id: 'b', amount_cents: 500 }),
    ]);
    await render(<HomeScreen />);

    expect(await screen.findByText('$1,982.50')).toBeOnTheScreen();
    expect(screen.getByText('$17.50 spent of $2,000.00')).toBeOnTheScreen();
  });

  it('is gentle when spending goes past the monthly amount, and never shows a negative', async () => {
    givenMonth(1000, [makeExpense({ amount_cents: 1750 })]);
    await render(<HomeScreen />);

    expect(await screen.findByText('$0.00')).toBeOnTheScreen();
    expect(
      screen.getByText(/\$7\.50 past your monthly amount\. It happens, and you can adjust it whenever you like\./),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/-\$/)).not.toBeOnTheScreen();
  });

  it('links to Settings to change the monthly amount', async () => {
    givenMonth(200000);
    const user = userEvent.setup();
    await render(<HomeScreen />);

    await user.press(await screen.findByRole('button', { name: 'Change monthly amount' }));

    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});

describe('Home: the list', () => {
  it('invites the first expense without pressure', async () => {
    givenMonth(200000, []);
    await render(<HomeScreen />);

    expect(
      await screen.findByText("Nothing logged yet this month. Add your first one whenever you're ready."),
    ).toBeOnTheScreen();
  });

  it('shows each expense with its date, umbrella, amount, and detail', async () => {
    givenMonth(200000, [
      makeExpense({ id: 'a', merchant: "Trader Joe's", amount_cents: 3050, category_id: 2, detail: 'weekly shop' }),
      makeExpense({ id: 'b', merchant: 'Corner Shop', amount_cents: 500, category_id: null, category_source: null }),
    ]);
    await render(<HomeScreen />);

    const sorted = await screen.findByRole('button', { name: /Trader Joe's/ });
    expect(within(sorted).getByText('$30.50')).toBeOnTheScreen();
    expect(within(sorted).getByText('Oct 8 · 🍽️ Food')).toBeOnTheScreen();
    expect(within(sorted).getByText('weekly shop')).toBeOnTheScreen();

    const unsorted = screen.getByRole('button', { name: /Corner Shop/ });
    expect(within(unsorted).getByText('Oct 8 · Not sorted yet')).toBeOnTheScreen();
  });

  it('opens an expense for editing when tapped', async () => {
    givenMonth(200000, [makeExpense({ id: 'e1', merchant: "Trader Joe's" })]);
    const user = userEvent.setup();
    await render(<HomeScreen />);

    await user.press(await screen.findByRole('button', { name: /Trader Joe's/ }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/add-expense', params: { id: 'e1' } });
  });

  it('tells screen readers that tapping an expense edits it', async () => {
    givenMonth(200000, [makeExpense({ merchant: "Trader Joe's" })]);
    await render(<HomeScreen />);

    expect(await screen.findByRole('button', { name: /Tap to edit\.$/ })).toBeOnTheScreen();
  });
});

describe('Home: other', () => {
  it('opens the Add expense sheet', async () => {
    givenMonth(200000);
    const user = userEvent.setup();
    await render(<HomeScreen />);

    await user.press(await screen.findByRole('button', { name: 'Add expense' }));

    expect(router.push).toHaveBeenCalledWith('/add-expense');
  });

  it('explains calmly when the numbers cannot load, and can try again', async () => {
    mockedApi.getProfile.mockRejectedValueOnce(new Error('offline'));
    mockedApi.listExpenses.mockResolvedValue([]);
    const user = userEvent.setup();
    await render(<HomeScreen />);

    expect(
      await screen.findByText("We couldn't load your numbers just now. Check your connection and try again."),
    ).toBeOnTheScreen();

    mockedApi.getProfile.mockResolvedValue({
      id: 'user-1',
      onboarding_completed_at: '2026-10-01T00:00:00Z',
      monthly_amount_cents: 50000,
    });
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('$500.00')).toBeOnTheScreen();
  });
});
