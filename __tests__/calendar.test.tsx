import { render, screen } from '@testing-library/react-native';

import CalendarScreen from '@/app/(tabs)/calendar';

describe('Calendar (until bills exist)', () => {
  it('is a friendly placeholder that asks nothing of the user', async () => {
    await render(<CalendarScreen />);

    expect(screen.getByText('Calendar')).toBeOnTheScreen();
    expect(screen.getByText('Your bills will live here')).toBeOnTheScreen();
    expect(screen.getByText(/There's nothing\s+to set up yet\./)).toBeOnTheScreen();
  });
});
