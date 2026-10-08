import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AddExpenseScreen from '@/app/add-expense';
import * as api from '@/lib/api';
import { toDateString } from '@/lib/dates';
import { makeExpense } from '@/test-utils/fixtures';

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

describe('Editing an expense', () => {
  const expense = makeExpense({
    id: 'e1',
    amount_cents: 1250,
    merchant: "Trader Joe's",
    spent_on: '2026-10-07',
    category_id: FOOD,
    category_source: 'rule',
    detail: 'weekly shop',
  });

  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'e1' });
    mockedApi.getExpense.mockResolvedValue(expense);
    mockedApi.updateExpense.mockResolvedValue();
    mockedApi.deleteExpense.mockResolvedValue();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  /** The buttons of the confirmation dialog that was shown. */
  function dialogButtons() {
    const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0];
    return buttons!;
  }

  it('opens with the current details filled in', async () => {
    await render(<AddExpenseScreen />);

    expect(await screen.findByText('Edit expense')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Amount (e.g. 12.50)')).toHaveDisplayValue('12.50');
    expect(screen.getByPlaceholderText("Where? (e.g. Trader Joe's)")).toHaveDisplayValue("Trader Joe's");
    expect(screen.getByPlaceholderText('Add a detail (optional)')).toHaveDisplayValue('weekly shop');
    expect(screen.getByRole('button', { name: 'Food', selected: true })).toBeOnTheScreen();
    expect(mockedApi.getExpense).toHaveBeenCalledWith('e1');
  });

  it('does not load the remembered rules, because editing never changes them', async () => {
    await render(<AddExpenseScreen />);
    await screen.findByText('Edit expense');

    expect(mockedApi.listMerchantRules).not.toHaveBeenCalled();
    expect(mockedApi.listTypeRules).not.toHaveBeenCalled();
  });

  it('saves changed details without touching the category', async () => {
    const user = userEvent.setup();
    await render(<AddExpenseScreen />);
    const amount = await screen.findByPlaceholderText('Amount (e.g. 12.50)');

    await user.clear(amount);
    await user.type(amount, '20');
    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockedApi.updateExpense).toHaveBeenCalledTimes(1);
    const [id, changes] = mockedApi.updateExpense.mock.calls[0];
    expect(id).toBe('e1');
    expect(changes).toEqual({ amountCents: 2000, merchant: "Trader Joe's", spentOn: '2026-10-07', detail: 'weekly shop' });
    expect(changes).not.toHaveProperty('categoryId'); // stays "sorted by a rule"
    expect(router.back).toHaveBeenCalled();
  });

  it('sorts just this purchase under a different umbrella, never changing the saved rule', async () => {
    const user = userEvent.setup();
    await render(<AddExpenseScreen />);
    await screen.findByText('Edit expense');

    await user.press(screen.getByRole('button', { name: 'Health' }));
    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockedApi.updateExpense).toHaveBeenCalledWith('e1', expect.objectContaining({ categoryId: 5 }));
    expect(mockedApi.saveMerchantRule).not.toHaveBeenCalled();
    expect(mockedApi.addExpense).not.toHaveBeenCalled();
  });

  it('can sort an expense that was left unsorted', async () => {
    mockedApi.getExpense.mockResolvedValue({ ...expense, category_id: null, category_source: null });
    const user = userEvent.setup();
    await render(<AddExpenseScreen />);
    await screen.findByText('Edit expense');

    await user.press(screen.getByRole('button', { name: 'Shopping' }));
    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockedApi.updateExpense).toHaveBeenCalledWith('e1', expect.objectContaining({ categoryId: SHOPPING }));
  });

  it('checks what was typed, like adding does', async () => {
    const user = userEvent.setup();
    await render(<AddExpenseScreen />);
    const amount = await screen.findByPlaceholderText('Amount (e.g. 12.50)');

    await user.clear(amount);
    await user.type(amount, 'lots');
    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText("That amount doesn't look quite right. Try something like 12.50.")).toBeOnTheScreen();
    expect(mockedApi.updateExpense).not.toHaveBeenCalled();
  });

  it('explains calmly and stays open when saving fails', async () => {
    mockedApi.updateExpense.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    await render(<AddExpenseScreen />);
    await screen.findByText('Edit expense');

    await user.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText("That didn't save just now. Check your connection and try again."),
    ).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('explains calmly when the expense cannot be opened', async () => {
    mockedApi.getExpense.mockRejectedValue(new Error('offline'));
    await render(<AddExpenseScreen />);

    expect(
      await screen.findByText("We couldn't open that expense just now. Close this and try again."),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeOnTheScreen();
  });

  describe('deleting', () => {
    it('asks first, in plain words, and keeps the expense if you change your mind', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);
      await user.press(await screen.findByRole('button', { name: 'Delete this expense' }));

      expect(Alert.alert).toHaveBeenCalledWith('Delete this expense?', "This can't be undone.", expect.any(Array));
      expect(dialogButtons().map((b) => b.text)).toEqual(['Keep it', 'Delete']);
      expect(mockedApi.deleteExpense).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('deletes that expense once confirmed, and closes', async () => {
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);
      await user.press(await screen.findByRole('button', { name: 'Delete this expense' }));

      await act(async () => dialogButtons().find((b) => b.text === 'Delete')!.onPress!());

      expect(mockedApi.deleteExpense).toHaveBeenCalledWith('e1');
      expect(router.back).toHaveBeenCalled();
    });

    it('explains calmly and stays open when deleting fails', async () => {
      mockedApi.deleteExpense.mockRejectedValue(new Error('offline'));
      const user = userEvent.setup();
      await render(<AddExpenseScreen />);
      await user.press(await screen.findByRole('button', { name: 'Delete this expense' }));

      await act(async () => dialogButtons().find((b) => b.text === 'Delete')!.onPress!());

      expect(
        await screen.findByText("That didn't delete just now. Check your connection and try again."),
      ).toBeOnTheScreen();
      expect(router.back).not.toHaveBeenCalled();
    });
  });

  it('offers no delete when adding a new expense', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await render(<AddExpenseScreen />);

    expect(screen.getByText('Add expense')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete this expense' })).not.toBeOnTheScreen();
  });
});
