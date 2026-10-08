import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** A friendly placeholder until bills exist. */
export default function CalendarScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="subtitle">Calendar</ThemedText>
        <ThemedView style={styles.centerContent}>
          <ThemedText style={styles.emoji} accessibilityElementsHidden>
            📅
          </ThemedText>
          <ThemedText type="smallBold" style={styles.centered}>
            Your bills will live here
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            Soon you&apos;ll be able to add bills and see what&apos;s due, all in one place. There&apos;s nothing
            to set up yet.
          </ThemedText>
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
    paddingTop: Spacing.three,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  emoji: {
    fontSize: 56,
    lineHeight: 72,
  },
  centered: {
    textAlign: 'center',
  },
});
