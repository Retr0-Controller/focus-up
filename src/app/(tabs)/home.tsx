import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { umbrellaById } from '@/constants/categories';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMonthData } from '@/hooks/use-month-data';
import { useSession } from '@/hooks/use-session';
import { setMonthlyAmount, type Expense } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import { formatCents, parseAmountToCents } from '@/lib/money';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const month = useMonthData(userId);
  const [editingAmount, setEditingAmount] = useState(false);

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  const showAmountForm = month.loaded && (month.monthlyCents === null || editingAmount);
  const leftCents = month.summary.leftCents ?? 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
              initialCents={month.monthlyCents}
              onCancel={month.monthlyCents === null ? undefined : () => setEditingAmount(false)}
              onSave={async (cents) => {
                if (!userId) return;
                await setMonthlyAmount(userId, cents);
                month.setMonthlyCents(cents);
                setEditingAmount(false);
              }}
            />
          )}

          {month.loaded && month.monthlyCents !== null && !editingAmount && (
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
                onPress={() => setEditingAmount(true)}
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

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as {session?.user.email}
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()}>
              <ThemedText type="linkPrimary">Sign out</ThemedText>
            </Pressable>
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

function MonthlyAmountForm({
  initialCents,
  onSave,
  onCancel,
}: {
  initialCents: number | null;
  onSave: (cents: number) => Promise<void>;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initialCents === null ? '' : String(initialCents / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const cents = parseAmountToCents(text);
    if (cents === null) {
      setError("That amount doesn't look quite right. Try something like 2000.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(cents);
    } catch (e) {
      console.warn('Could not save monthly amount', e);
      setError("That didn't save just now. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">
        {initialCents === null ? 'How much would you like to spend each month?' : 'Monthly amount'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        We&apos;ll show what&apos;s left as you add expenses. You can change it anytime.
      </ThemedText>
      <TextField
        placeholder="e.g. 2000"
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        accessibilityLabel="Monthly amount"
      />
      {error && (
        <ThemedText type="small" accessibilityRole="alert">
          {error}
        </ThemedText>
      )}
      <PrimaryButton title="Save" loading={saving} onPress={handleSave} />
      {onCancel && (
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.inlineLink}>
          <ThemedText type="linkPrimary">Cancel</ThemedText>
        </Pressable>
      )}
    </ThemedView>
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
    paddingBottom: BottomTabInset + Spacing.four,
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
  footer: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.four,
  },
});
