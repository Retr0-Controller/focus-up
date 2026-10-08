import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UmbrellaGrid } from '@/components/umbrella-grid';
import { spendingTypeEmoji, umbrellaById } from '@/constants/categories';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addExpense,
  deleteExpense,
  getExpense,
  listMerchantRules,
  listTypeRules,
  saveMerchantRule,
  updateExpense,
  type MerchantRule,
  type TypeRule,
} from '@/lib/api';
import { normalizeName } from '@/lib/calc';
import { fromDateString, toDateString } from '@/lib/dates';
import { parseAmountToCents } from '@/lib/money';

const SAVE_FAILED = "That didn't save just now. Check your connection and try again.";

/**
 * Adds an expense, or edits one when opened with an `id`. Editing changes only that purchase:
 * it never creates or changes the saved merchant rule.
 */
export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const theme = useTheme();

  const [amountText, setAmountText] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [detail, setDetail] = useState('');
  // The umbrella the user picked in this session. Null means "no change" (or "use the remembered one").
  const [picked, setPicked] = useState<number | null>(null);
  const [changingRule, setChangingRule] = useState(false);

  // Editing only: the expense being edited, and whether it has loaded.
  const [originalCategoryId, setOriginalCategoryId] = useState<number | null>(null);
  const [loadingExpense, setLoadingExpense] = useState(isEdit);
  const [loadFailed, setLoadFailed] = useState(false);

  const [merchantRules, setMerchantRules] = useState<MerchantRule[]>([]);
  const [typeRules, setTypeRules] = useState<TypeRule[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      getExpense(id)
        .then((expense) => {
          setAmountText((expense.amount_cents / 100).toFixed(2));
          setMerchant(expense.merchant);
          setDate(fromDateString(expense.spent_on));
          setDetail(expense.detail ?? '');
          setOriginalCategoryId(expense.category_id);
        })
        .catch((e) => {
          console.warn('Could not load expense', e);
          setLoadFailed(true);
        })
        .finally(() => setLoadingExpense(false));
      return;
    }
    // Rules are only a convenience, so if they can't load the form still works unsorted.
    listMerchantRules().then(setMerchantRules).catch((e) => console.warn('merchant rules', e));
    listTypeRules().then(setTypeRules).catch((e) => console.warn('type rules', e));
  }, [id]);

  const cleanMerchant = merchant.trim().replace(/\s+/g, ' ');
  const rule = useMemo(
    () =>
      !isEdit && cleanMerchant
        ? merchantRules.find((r) => normalizeName(r.merchant) === normalizeName(cleanMerchant))
        : undefined,
    [isEdit, cleanMerchant, merchantRules],
  );
  const ruleUmbrella = umbrellaById(rule?.category_id ?? null);
  const showGrid = isEdit || !rule || changingRule;
  const selectedCategoryId = isEdit ? (picked ?? originalCategoryId) : (picked ?? rule?.category_id ?? null);

  /** Checks what was typed. Returns the cleaned values, or sets an error and returns null. */
  function readForm() {
    const amountCents = parseAmountToCents(amountText);
    if (amountCents === null) {
      setError("That amount doesn't look quite right. Try something like 12.50.");
      return null;
    }
    if (!cleanMerchant) {
      setError('Add where it was spent, even a short name works.');
      return null;
    }
    return { amountCents, merchant: cleanMerchant, spentOn: toDateString(date), detail: detail.trim() || null };
  }

  async function handleSave() {
    setError(null);
    const form = readForm();
    if (!form) return;

    setSaving(true);
    try {
      if (id) {
        await updateExpense(id, { ...form, ...(picked === null ? {} : { categoryId: picked }) });
      } else {
        await addExpense({
          ...form,
          categoryId: selectedCategoryId,
          source: picked !== null ? 'user' : 'rule',
        });
      }
    } catch (e) {
      console.warn('Could not save expense', e);
      setError(SAVE_FAILED);
      setSaving(false);
      return;
    }

    // Sort once, remember after: a brand-new merchant that got sorted becomes a saved rule.
    // A merchant that already has a rule keeps it, so a one-off re-sort stays one-off.
    if (!isEdit && !rule && picked !== null) {
      try {
        await saveMerchantRule(cleanMerchant, picked);
      } catch (e) {
        console.warn('Could not save merchant rule', e);
      }
    }
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete this expense?', "This can't be undone.", [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    if (!id) return;
    setError(null);
    try {
      await deleteExpense(id);
    } catch (e) {
      console.warn('Could not delete expense', e);
      setError("That didn't delete just now. Check your connection and try again.");
      return;
    }
    router.back();
  }

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close without saving"
      onPress={() => router.back()}
      style={styles.closeButton}>
      <ThemedText type="linkPrimary">Close</ThemedText>
    </Pressable>
  );

  if (isEdit && (loadingExpense || loadFailed)) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            <ThemedText type="subtitle">Edit expense</ThemedText>
            {closeButton}
          </View>
          <ThemedText themeColor="textSecondary">
            {loadFailed
              ? "We couldn't open that expense just now. Close this and try again."
              : 'Loading…'}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <ThemedText type="subtitle">{isEdit ? 'Edit expense' : 'Add expense'}</ThemedText>
          {closeButton}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <TextField
              placeholder="Amount (e.g. 12.50)"
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              autoFocus={!isEdit}
              accessibilityLabel="Amount"
              style={styles.amountInput}
            />
            <TextField
              placeholder="Where? (e.g. Trader Joe's)"
              value={merchant}
              onChangeText={(text) => {
                setMerchant(text);
                setChangingRule(false);
              }}
              autoCapitalize="words"
              accessibilityLabel="Where it was spent"
            />
            <DateField value={date} onChange={setDate} />

            {rule && ruleUmbrella && !changingRule && picked === null && (
              <ThemedView type="backgroundElement" style={styles.rememberedCard}>
                <ThemedText>
                  {ruleUmbrella.emoji} Sorted as {ruleUmbrella.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  We remembered this from before.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setChangingRule(true)}
                  style={styles.inlineLink}>
                  <ThemedText type="linkPrimary">Sort this one differently</ThemedText>
                </Pressable>
              </ThemedView>
            )}

            {showGrid && (
              <View style={styles.sortSection}>
                <ThemedText type="smallBold">
                  {isEdit
                    ? 'Where does this belong?'
                    : rule
                      ? 'Just for this purchase'
                      : 'Where does this belong?'}
                </ThemedText>
                {isEdit ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    This changes only this purchase. Your saved rule for the merchant stays the same.
                  </ThemedText>
                ) : (
                  !rule && (
                    <ThemedText type="small" themeColor="textSecondary">
                      Pick once and we&apos;ll remember it for next time. Or skip it for now.
                    </ThemedText>
                  )
                )}

                {!isEdit && !rule && typeRules.length > 0 && (
                  <View style={styles.shortcuts}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Your shortcuts
                    </ThemedText>
                    <View style={styles.chipRow}>
                      {typeRules.map((typeRule) => {
                        const umbrella = umbrellaById(typeRule.category_id);
                        const selected = picked === typeRule.category_id;
                        return (
                          <Pressable
                            key={typeRule.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${typeRule.spending_type}, ${umbrella?.name ?? ''}`}
                            onPress={() => setPicked(typeRule.category_id)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: theme.backgroundElement,
                                borderColor: selected ? theme.accent : 'transparent',
                              },
                            ]}>
                            <ThemedText type="small">
                              {spendingTypeEmoji(typeRule.spending_type)} {typeRule.spending_type}
                              {umbrella ? ` → ${umbrella.name}` : ''}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                <UmbrellaGrid selectedId={selectedCategoryId} onSelect={setPicked} />
              </View>
            )}

            <TextField
              placeholder="Add a detail (optional)"
              value={detail}
              onChangeText={setDetail}
              accessibilityLabel="Detail, optional"
            />

            {error && (
              <ThemedText type="small" accessibilityRole="alert">
                {error}
              </ThemedText>
            )}

            <PrimaryButton
              title={isEdit ? 'Save changes' : 'Save'}
              loading={saving}
              onPress={handleSave}
            />

            {isEdit && (
              <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteLink}>
                <ThemedText type="linkPrimary">Delete this expense</ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
  closeButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  content: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  amountInput: {
    fontSize: 24,
    fontWeight: 600,
    minHeight: 64,
  },
  rememberedCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  inlineLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  sortSection: {
    gap: Spacing.two,
  },
  shortcuts: {
    gap: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.four,
    borderWidth: 2,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
