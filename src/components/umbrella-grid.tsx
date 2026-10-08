import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { UMBRELLAS } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type UmbrellaGridProps = {
  selectedId: number | null;
  onSelect: (umbrellaId: number) => void;
};

/** The nine umbrellas as big tappable buttons. The chosen one gets a check mark, not just a color. */
export function UmbrellaGrid({ selectedId, onSelect }: UmbrellaGridProps) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {UMBRELLAS.map((umbrella) => {
        const selected = selectedId === umbrella.id;
        return (
          <Pressable
            key={umbrella.id}
            accessibilityRole="button"
            accessibilityLabel={umbrella.name}
            accessibilityState={{ selected }}
            onPress={() => onSelect(umbrella.id)}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: selected ? theme.accent : 'transparent',
              },
            ]}>
            <ThemedText>{umbrella.emoji}</ThemedText>
            <ThemedText type={selected ? 'smallBold' : 'small'} style={styles.optionText}>
              {selected ? `✓ ${umbrella.name}` : umbrella.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 2,
  },
  optionText: {
    flex: 1,
  },
});
