import { render, screen, userEvent } from '@testing-library/react-native';

import OnboardingScreen from '@/app/onboarding';
import { SPENDING_TYPES } from '@/constants/categories';
import { useSession } from '@/hooks/use-session';
import * as api from '@/lib/api';

jest.mock('@/lib/api');
jest.mock('@/hooks/use-session');
const mockedApi = jest.mocked(api);
const finishOnboarding = jest.fn();

const FOOD = 2;

beforeEach(() => {
  finishOnboarding.mockResolvedValue(undefined);
  jest.mocked(useSession).mockReturnValue({
    session: null,
    isLoading: false,
    onboardingDone: false,
    finishOnboarding,
  });
  mockedApi.saveTypeRule.mockResolvedValue();
});

async function startTypes(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByRole('button', { name: 'Sounds good' }));
}

describe('Onboarding', () => {
  it('starts with a friendly welcome that says it is skippable', async () => {
    await render(<OnboardingScreen />);

    expect(screen.getByText("Let's set up a few shortcuts")).toBeOnTheScreen();
    expect(screen.getByText(/you can skip any part/)).toBeOnTheScreen();
  });

  it('asks about one spending type at a time, with a progress count', async () => {
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await startTypes(user);

    expect(screen.getByText('Where does eating out fit for you?')).toBeOnTheScreen();
    expect(screen.getByText('1 of 8')).toBeOnTheScreen();
    expect(screen.getByText("There's no wrong answer, and you can change it later.")).toBeOnTheScreen();
  });

  it('saves each choice as a type rule and moves to the next type', async () => {
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await startTypes(user);

    await user.press(screen.getByRole('button', { name: 'Food' }));

    expect(mockedApi.saveTypeRule).toHaveBeenCalledWith('Eating out', FOOD);
    expect(screen.getByText('Where does coffee fit for you?')).toBeOnTheScreen();
    expect(screen.getByText('2 of 8')).toBeOnTheScreen();
  });

  it('goes back and shows the earlier choice with a check mark', async () => {
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await startTypes(user);
    await user.press(screen.getByRole('button', { name: 'Food' }));

    await user.press(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Where does eating out fit for you?')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Food', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('✓ Food')).toBeOnTheScreen();
  });

  it('skips a single type without saving anything for it', async () => {
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await startTypes(user);

    await user.press(screen.getByRole('button', { name: 'Not sure, skip this one' }));

    expect(mockedApi.saveTypeRule).not.toHaveBeenCalled();
    expect(screen.getByText('Where does coffee fit for you?')).toBeOnTheScreen();
  });

  it('can be skipped entirely at any point, and counts as done', async () => {
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await startTypes(user);

    await user.press(screen.getByRole('button', { name: 'Skip setup for now' }));

    expect(finishOnboarding).toHaveBeenCalledTimes(1);
  });

  it('finishes after the last type, saving every choice', async () => {
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await startTypes(user);

    for (let i = 0; i < SPENDING_TYPES.length; i++) {
      await user.press(screen.getByRole('button', { name: 'Food' }));
    }

    expect(mockedApi.saveTypeRule).toHaveBeenCalledTimes(SPENDING_TYPES.length);
    expect(screen.getByText("You're all set")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Skip setup for now' })).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Take me in' }));
    expect(finishOnboarding).toHaveBeenCalledTimes(1);
  });

  it('reassures instead of blocking when a choice could not be saved', async () => {
    mockedApi.saveTypeRule.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await startTypes(user);

    for (let i = 0; i < SPENDING_TYPES.length; i++) {
      await user.press(screen.getByRole('button', { name: 'Food' }));
    }

    expect(
      await screen.findByText("A couple of choices didn't save. No worries, you can set them again later."),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Take me in' })).toBeOnTheScreen();
  });
});
