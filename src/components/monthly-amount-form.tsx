import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { parseAmountToCents } from '@/lib/money';

type MonthlyAmountFormProps = {
  /** The current monthly amount in cents, or null if it hasn't been set yet. */
  initialCents: number | null;
  /** Saves the new amount. Throw to show the "didn't save" message. */
  onSave: (cents: number) => Promise<void>;
};

/** Where the monthly amount is set (first time, on Home) and changed (later, in Settings). */
export function MonthlyAmountForm({ initialCents, onSave }: MonthlyAmountFormProps) {
  const [text, setText] = useState(initialCents === null ? '' : String(initialCents / 100));

  // Follow the saved amount if it changes elsewhere (for example, set on Home while this tab was open).
  // This is React's recommended way to reset state when a prop changes: compare, then update during render.
  const [seenCents, setSeenCents] = useState(initialCents);
  if (initialCents !== seenCents) {
    setSeenCents(initialCents);
    setText(initialCents === null ? '' : String(initialCents / 100));
  }

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaved(false);
    const cents = parseAmountToCents(text);
    if (cents === null) {
      setError("That amount doesn't look quite right. Try something like 2000.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(cents);
      setSaved(true);
    } catch (e) {
      console.warn('Could not save monthly amount', e);
      setError("That didn't save just now. Check your connection and try again.");
    }
    setSaving(false);
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
        onChangeText={(value) => {
          setText(value);
          setSaved(false);
        }}
        keyboardType="decimal-pad"
        accessibilityLabel="Monthly amount"
      />
      {error && (
        <ThemedText type="small" accessibilityRole="alert">
          {error}
        </ThemedText>
      )}
      {saved && <ThemedText type="small">✓ Saved</ThemedText>}
      <PrimaryButton title="Save" loading={saving} onPress={handleSave} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
