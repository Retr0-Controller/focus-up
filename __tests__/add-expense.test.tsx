import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import AddExpenseScreen from '@/app/add-expense';
import * as api from '@/lib/api';
import { toDateString } from '@/lib/dates';

jest.mock('@/lib/api');
const mockedApi = jest.mocked(api);

const FOOD = 2;
const SHOPPING = 4;

beforeEach(() => {
  mockedApi.listMerchantRules.mockResolvedValue([]);
  mockedApi.listTypeRules.mockResolvedValue([]);
  mockedApi.addExpense.mockResolvedValue();
  mockedApi.saveMerchantRule.mockResolvedValue();
});

async function fillIn(user: ReturnType<typeof userEvent.setup>, amount: string, merchant: string) {
  if (amount) await user.type(screen.getByPlaceholderText('Amount (e.g. 12.50)'), amount);
  if (merchant) await user.type(screen.getByPlaceholderText("Where? (e.g. Trader Joe's)"), merchant);
}

describe('Add expense', () => {
  describe('checking what was typed', () => {
    it('asks for a usable amount, kindly, and saves nothing', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, 'abc', 'Target');
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText("That amount doesn't look quite right. Try something like 12.50.")).toBeOnTheScreen();
      expect(mockedApi.addExpense).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('asks for where it was spent', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '12.50', '   ');
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('Add where it was spent, even a short name works.')).toBeOnTheScreen();
      expect(mockedApi.addExpense).not.toHaveBeenCalled();
    });
  });

  describe('a merchant seen for the first time', () => {
    it('saves the expense sorted under the picked umbrella, then remembers the merchant', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '12.50', "  Trader   Joe's ");
      await user.press(screen.getByRole('button', { name: 'Food' }));
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(mockedApi.addExpense).toHaveBeenCalledWith({
        amountCents: 1250,
        merchant: "Trader Joe's", // extra spaces tidied
        spentOn: toDateString(new Date()),
        categoryId: FOOD,
        detail: null,
        source: 'user',
      });
      expect(mockedApi.saveMerchantRule).toHaveBeenCalledWith("Trader Joe's", FOOD);
      expect(router.back).toHaveBeenCalled();
    });

    it('lets you skip sorting: saved as not sorted yet, and no rule is made', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '5', 'Corner Shop');
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(mockedApi.addExpense).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 500, categoryId: null }),
      );
      expect(mockedApi.saveMerchantRule).not.toHaveBeenCalled();
      expect(router.back).toHaveBeenCalled();
    });

    it('offers the onboarding types as shortcuts, and a shortcut picks its umbrella', async () => {
      mockedApi.listTypeRules.mockResolvedValue([
        { id: 't1', spending_type: 'Coffee', category_id: FOOD },
      ]);
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      const shortcut = await screen.findByRole('button', { name: 'Coffee, Food' });
      await fillIn(user, '4', 'Blue Bottle');
      await user.press(shortcut);
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(mockedApi.addExpense).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: FOOD, source: 'user' }),
      );
    });

    it('still saves the expense if remembering the merchant fails', async () => {
      mockedApi.saveMerchantRule.mockRejectedValue(new Error('offline'));
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '9', 'Bookshop');
      await user.press(screen.getByRole('button', { name: 'Shopping' }));
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(mockedApi.addExpense).toHaveBeenCalled();
      expect(router.back).toHaveBeenCalled();
    });
  });

  describe('a merchant that is already remembered', () => {
    beforeEach(() => {
      mockedApi.listMerchantRules.mockResolvedValue([
        { id: 'r1', merchant: "Trader Joe's", category_id: FOOD },
      ]);
    });

    it('sorts it automatically, whatever the capitalisation, without making a new rule', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '30', "trader joe's");
      expect(await screen.findByText('🍽️ Sorted as Food')).toBeOnTheScreen();
      expect(screen.getByText('We remembered this from before.')).toBeOnTheScreen();

      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(mockedApi.addExpense).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: FOOD, source: 'rule' }),
      );
      expect(mockedApi.saveMerchantRule).not.toHaveBeenCalled();
    });

    it('can sort just this one purchase differently, leaving the saved rule alone', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '30', "Trader Joe's");
      await user.press(await screen.findByRole('button', { name: 'Sort this one differently' }));
      await user.press(screen.getByRole('button', { name: 'Shopping' }));
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(mockedApi.addExpense).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: SHOPPING, source: 'user' }),
      );
      expect(mockedApi.saveMerchantRule).not.toHaveBeenCalled();
    });
  });

  describe('when something goes wrong', () => {
    it('explains calmly, keeps the form, and does not close', async () => {
      mockedApi.addExpense.mockRejectedValue(new Error('network'));
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '12.50', 'Target');
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(
        await screen.findByText("That didn't save just now. Check your connection and try again."),
      ).toBeOnTheScreen();
      expect(router.back).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText('Amount (e.g. 12.50)')).toHaveDisplayValue('12.50');
    });

    it('still works as a plain form if the saved rules cannot load', async () => {
      mockedApi.listMerchantRules.mockRejectedValue(new Error('offline'));
      mockedApi.listTypeRules.mockRejectedValue(new Error('offline'));
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);

      await fillIn(user, '3', 'Kiosk');
      await user.press(screen.getByRole('button', { name: 'Save' }));

      expect(mockedApi.addExpense).toHaveBeenCalled();
    });
  });

  it('closes without saving', async () => {
    const user = userEvent.setup();
    await render(<AddExpenseScreen />);

    await user.press(screen.getByRole('button', { name: 'Close without saving' }));

    expect(router.back).toHaveBeenCalled();
    expect(mockedApi.addExpense).not.toHaveBeenCalled();
  });
});
