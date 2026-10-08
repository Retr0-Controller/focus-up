import { render, screen, userEvent } from '@testing-library/react-native';

import { MonthlyAmountForm } from '@/components/monthly-amount-form';

describe('MonthlyAmountForm', () => {
  it('asks the first-time question when no amount is set, and the plain label afterwards', async () => {
    const { rerender } = await render(<MonthlyAmountForm initialCents={null} onSave={jest.fn()} />);
    expect(screen.getByText('How much would you like to spend each month?')).toBeOnTheScreen();

    await rerender(<MonthlyAmountForm initialCents={200000} onSave={jest.fn()} />);
    expect(screen.getByText('Monthly amount')).toBeOnTheScreen();
  });

  it('keeps the "Saved" note when the saved amount arrives back as a new value', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { rerender } = await render(<MonthlyAmountForm initialCents={200000} onSave={onSave} />);

    await user.clear(screen.getByPlaceholderText('e.g. 2000'));
    await user.type(screen.getByPlaceholderText('e.g. 2000'), '2500');
    await user.press(screen.getByRole('button', { name: 'Save' }));
    await rerender(<MonthlyAmountForm initialCents={250000} onSave={onSave} />); // the parent now knows the new value

    expect(screen.getByText('✓ Saved')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('e.g. 2000')).toHaveDisplayValue('2500');
  });

  it('follows the amount if it was changed somewhere else', async () => {
    const { rerender } = await render(<MonthlyAmountForm initialCents={null} onSave={jest.fn()} />);
    expect(screen.getByPlaceholderText('e.g. 2000')).toHaveDisplayValue('');

    await rerender(<MonthlyAmountForm initialCents={150000} onSave={jest.fn()} />);

    expect(screen.getByPlaceholderText('e.g. 2000')).toHaveDisplayValue('1500');
  });
});
