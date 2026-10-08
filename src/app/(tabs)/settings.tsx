import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthlyAmountForm } from '@/components/monthly-amount-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMonthlyAmount } from '@/hooks/use-monthly-amount';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { session } = useSession();
  const amount = useMonthlyAmount(session?.user.id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">Settings</ThemedText>

          {amount.failed && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small">
                We couldn&apos;t load your settings just now. Check your connection and try again.
              </ThemedText>
              <Pressable accessibilityRole="button" onPress={amount.reload}>
                <ThemedText type="linkPrimary">Try again</ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {amount.loaded && !amount.failed && (
            <MonthlyAmountForm initialCents={amount.monthlyCents} onSave={amount.save} />
          )}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Account</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as {session?.user.email}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => supabase.auth.signOut()}
              style={styles.inlineLink}>
              <ThemedText type="linkPrimary">Sign out</ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
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
});
