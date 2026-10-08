import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UmbrellaGrid } from '@/components/umbrella-grid';
import { SPENDING_TYPES } from '@/constants/categories';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { saveTypeRule } from '@/lib/api';

// Step 0 is the welcome card, steps 1..N are the spending types, and the last step is "all set".
const FIRST_TYPE_STEP = 1;
const DONE_STEP = SPENDING_TYPES.length + 1;

export default function OnboardingScreen() {
  const { finishOnboarding } = useSession();
  const [step, setStep] = useState(0);
  // Spending type name -> umbrella id, so going back can show what was picked.
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const spendingType = SPENDING_TYPES[step - FIRST_TYPE_STEP];

  async function finish() {
    setFinishing(true);
    await finishOnboarding();
  }

  function choose(umbrellaId: number) {
    if (!spendingType) return;
    setChoices((current) => ({ ...current, [spendingType.name]: umbrellaId }));
    setStep((current) => current + 1);
    // Save in the background so moving on never waits for the network.
    saveTypeRule(spendingType.name, umbrellaId).catch((error) => {
      console.warn('Could not save type rule', error);
      setSaveFailed(true);
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          {step > 0 && step < DONE_STEP ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep((current) => current - 1)}
              style={styles.topButton}>
              <ThemedText type="linkPrimary">Back</ThemedText>
            </Pressable>
          ) : (
            <View />
          )}
          {step < DONE_STEP && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip setup for now"
              onPress={finish}
              disabled={finishing}
              style={styles.topButton}>
              <ThemedText type="linkPrimary">Skip for now</ThemedText>
            </Pressable>
          )}
        </View>

        {step === 0 && <WelcomeStep onContinue={() => setStep(FIRST_TYPE_STEP)} />}

        {spendingType && (
          <TypeStep
            key={spendingType.name}
            emoji={spendingType.emoji}
            name={spendingType.name}
            position={step}
            total={SPENDING_TYPES.length}
            selectedId={choices[spendingType.name]}
            onChoose={choose}
            onSkipThisOne={() => setStep((current) => current + 1)}
          />
        )}

        {step === DONE_STEP && (
          <DoneStep saveFailed={saveFailed} finishing={finishing} onFinish={finish} />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <ThemedView style={styles.centerContent}>
        <ThemedText style={styles.bigEmoji} accessibilityElementsHidden>
          👋
        </ThemedText>
        <ThemedText type="subtitle" style={styles.centered}>
          Let&apos;s set up a few shortcuts
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          We&apos;ll show you some common kinds of spending. Tell us where each one fits for you, and
          we&apos;ll suggest it later. It takes about a minute, and you can skip any part.
        </ThemedText>
      </ThemedView>
      <PrimaryButton title="Sounds good" onPress={onContinue} />
    </>
  );
}

type TypeStepProps = {
  emoji: string;
  name: string;
  position: number;
  total: number;
  selectedId: number | undefined;
  onChoose: (umbrellaId: number) => void;
  onSkipThisOne: () => void;
};

function TypeStep({
  emoji,
  name,
  position,
  total,
  selectedId,
  onChoose,
  onSkipThisOne,
}: TypeStepProps) {
  const theme = useTheme();

  return (
    <>
      <ScrollView contentContainerStyle={styles.typeContent} showsVerticalScrollIndicator={false}>
        <View style={styles.progressBlock}>
          <ThemedText type="small" themeColor="textSecondary">
            {position} of {total}
          </ThemedText>
          <View
            accessibilityElementsHidden
            style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.accent, width: `${(position / total) * 100}%` },
              ]}
            />
          </View>
        </View>

        <ThemedView style={styles.typeHeader}>
          <ThemedText style={styles.bigEmoji} accessibilityElementsHidden>
            {emoji}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.centered}>
            Where does {name.toLowerCase()} fit for you?
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            There&apos;s no wrong answer, and you can change it later.
          </ThemedText>
        </ThemedView>

        <UmbrellaGrid selectedId={selectedId ?? null} onSelect={onChoose} />

        <Pressable accessibilityRole="button" onPress={onSkipThisOne} style={styles.skipOne}>
          <ThemedText type="linkPrimary">Not sure, skip this one</ThemedText>
        </Pressable>
      </ScrollView>
    </>
  );
}

function DoneStep({
  saveFailed,
  finishing,
  onFinish,
}: {
  saveFailed: boolean;
  finishing: boolean;
  onFinish: () => void;
}) {
  return (
    <>
      <ThemedView style={styles.centerContent}>
        <ThemedText style={styles.bigEmoji} accessibilityElementsHidden>
          🎉
        </ThemedText>
        <ThemedText type="subtitle" style={styles.centered}>
          You&apos;re all set
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          We&apos;ll use these as shortcuts when you add spending. You can change any of them
          whenever you like.
        </ThemedText>
        {saveFailed && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            A couple of choices didn&apos;t save. No worries, you can set them again later.
          </ThemedText>
        )}
      </ThemedView>
      <PrimaryButton title="Take me in" loading={finishing} onPress={onFinish} />
    </>
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
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  topButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  bigEmoji: {
    fontSize: 56,
    lineHeight: 72,
  },
  typeContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.three,
  },
  progressBlock: {
    gap: Spacing.one,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  typeHeader: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  skipOne: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
