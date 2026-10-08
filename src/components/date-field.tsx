import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DateFieldProps = {
  value: Date;
  onChange: (date: Date) => void;
};

/** Pick a day, never one in the future. iOS shows a compact picker, Android opens a calendar dialog. */
export function DateField({ value, onChange }: DateFieldProps) {
  const theme = useTheme();
  const today = new Date();

  function handleChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) onChange(date);
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText>Date</ThemedText>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          maximumDate={today}
          onChange={handleChange}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose date"
      onPress={() =>
        DateTimePickerAndroid.open({
          value,
          mode: 'date',
          maximumDate: today,
          onChange: handleChange,
        })
      }
      style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText>Date</ThemedText>
      <ThemedText>
        {value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
