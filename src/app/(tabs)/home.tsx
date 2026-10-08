import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthlyAmountForm } from '@/components/monthly-amount-form';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { umbrellaById } from '@/constants/categories';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMonthData } from '@/hooks/use-month-data';
import { useSession } from '@/hooks/use-session';
import { setMonthlyAmount, type Expense } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';

export default function HomeScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const month = useMonthData(userId);

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  const showAmountForm = month.loaded && month.monthlyCents === null;
  const leftCents = month.summary.leftCents ?? 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">{monthName}</ThemedText>

          {month.failed && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small">
                We couldn&apos;t load your numbers just now. Check your connection and try again.
              </ThemedText>
              <Pressable accessibilityRole="button" onPress={month.reload}>
                <ThemedText type="linkPrimary">Try again</ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {showAmountForm && (
            <MonthlyAmountForm
              initialCents={null}
              onSave={async (cents) => {
                if (!userId) return;
                await setMonthlyAmount(userId, cents);
                month.setMonthlyCents(cents);
              }}
            />
          )}

          {month.loaded && month.monthlyCents !== null && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                Left to spend
              </ThemedText>
              <ThemedText type="title" accessibilityRole="header">
                {formatCents(Math.max(leftCents, 0))}
              </ThemedText>
              {leftCents < 0 && (
                <ThemedText>
                  That&apos;s {formatCents(-leftCents)} past your monthly amount. It happens, and you
                  can adjust it whenever you like.
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {formatCents(month.summary.spentCents)} spent of {formatCents(month.monthlyCents)}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/settings')}
                style={styles.inlineLink}>
                <ThemedText type="linkPrimary">Change monthly amount</ThemedText>
              </Pressable>
            </ThemedView>
          )}

          <PrimaryButton title="Add expense" onPress={() => router.push('/add-expense')} />

          <ThemedText type="smallBold">This month</ThemedText>
          {month.loaded && month.expenses.length === 0 && (
            <ThemedText themeColor="textSecondary">
              Nothing logged yet this month. Add your first one whenever you&apos;re ready.
            </ThemedText>
          )}
          <View style={styles.list}>
            {month.expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                onPress={() => router.push({ pathname: '/add-expense', params: { id: expense.id } })}
              />
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>

    </ThemedView>
  );
}

function ExpenseRow({ expense, onPress }: { expense: Expense; onPress: () => void }) {
  const umbrella = umbrellaById(expense.category_id);
  const where = umbrella ? `${umbrella.emoji} ${umbrella.name}` : 'Not sorted yet';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expense.merchant}, ${formatCents(expense.amount_cents)}, ${where}. Tap to edit.`}
      onPress={onPress}>
      <ThemedView type="backgroundElement" style={styles.row}>
        <View style={styles.rowText}>
          <ThemedText>{expense.merchant}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatShortDate(expense.spent_on)} · {where}
          </ThemedText>
          {expense.detail ? (
            <ThemedText type="small" themeColor="textSecondary">
              {expense.detail}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="smallBold">{formatCents(expense.amount_cents)}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  content: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  inlineLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
