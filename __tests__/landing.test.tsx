import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import LandingScreen from '@/app/index';

describe('Landing page', () => {
  it('welcomes people warmly, without judgment', async () => {
    await render(<LandingScreen />);

    expect(screen.getByText('Focus Up')).toBeOnTheScreen();
    expect(screen.getByText('Money, made lighter.')).toBeOnTheScreen();
    expect(screen.getByText('No guilt. No judgment.')).toBeOnTheScreen();
  });

  it('"Get started" opens sign-up', async () => {
    const user = userEvent.setup();
    await render(<LandingScreen />);

    await user.press(screen.getByRole('button', { name: 'Get started' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/sign-in', params: { mode: 'sign-up' } });
  });

  it('people with an account can go straight to sign-in', async () => {
    const user = userEvent.setup();
    await render(<LandingScreen />);

    await user.press(screen.getByRole('button', { name: 'I already have an account' }));

    expect(router.push).toHaveBeenCalledWith('/sign-in');
  });
});
