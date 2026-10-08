import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const PROMISES = [
  { emoji: '✏️', text: 'Log a purchase in a few taps' },
  { emoji: '🧠', text: 'Sort it once and we remember' },
  { emoji: '🤝', text: 'No guilt. No judgment.' },
] as const;

export default function LandingScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText style={styles.logo} accessibilityElementsHidden>
            🌱
          </ThemedText>
          <ThemedText type="title" style={styles.centered}>
            Focus Up
          </ThemedText>
          <ThemedText type="subtitle" style={[styles.centered, styles.tagline]}>
            Money, made lighter.
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            Focus Up keeps track of things so you don&apos;t have to remember.
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.promises}>
          {PROMISES.map((promise) => (
            <ThemedView key={promise.text} type="backgroundElement" style={styles.promiseRow}>
              <ThemedText accessibilityElementsHidden>{promise.emoji}</ThemedText>
              <ThemedText style={styles.promiseText}>{promise.text}</ThemedText>
            </ThemedView>
          ))}
        </ThemedView>

        <ThemedView style={styles.actions}>
          <PrimaryButton
            title="Get started"
            onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'sign-up' } })}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sign-in')}
            style={styles.signInLink}>
            <ThemedText type="linkPrimary">I already have an account</ThemedText>
          </Pressable>
        </ThemedView>
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
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  logo: {
    fontSize: 64,
    lineHeight: 80,
  },
  centered: {
    textAlign: 'center',
  },
  tagline: {
    marginTop: Spacing.one,
  },
  promises: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  promiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  promiseText: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  signInLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
