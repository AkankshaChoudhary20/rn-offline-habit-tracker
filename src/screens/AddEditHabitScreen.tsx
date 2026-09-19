import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createHabit, deleteHabit, getHabit, updateHabit } from '../db/habitsRepo';
import { PrimaryButton } from '../components/PrimaryButton';

interface Props {
  habitId: string | null; // null = creating a new habit
  onDone: () => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLOR_OPTIONS = ['#4F46E5', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

export function AddEditHabitScreen({ habitId, onDone }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [colorTag, setColorTag] = useState(COLOR_OPTIONS[0]);
  const [loaded, setLoaded] = useState(habitId === null);

  useEffect(() => {
    if (!habitId) return;
    getHabit(habitId).then((habit) => {
      if (habit) {
        setName(habit.name);
        setDescription(habit.description);
        setScheduleDays(habit.scheduleDays);
        setColorTag(habit.colorTag);
      }
      setLoaded(true);
    });
  }, [habitId]);

  const toggleDay = (day: number) => {
    setScheduleDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (habitId) {
      await updateHabit(habitId, { name: name.trim(), description, scheduleDays, colorTag });
    } else {
      await createHabit({ name: name.trim(), description, scheduleDays, colorTag });
    }
    onDone();
  };

  const handleDelete = async () => {
    if (!habitId) return;
    await deleteHabit(habitId);
    onDone();
  };

  if (!loaded) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{habitId ? 'Edit habit' : 'New habit'}</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Drink water" />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional details"
        multiline
      />

      <Text style={styles.label}>Repeat on</Text>
      <View style={styles.dayRow}>
        {DAY_LABELS.map((label, index) => (
          <Text
            key={label}
            onPress={() => toggleDay(index)}
            style={[styles.dayChip, scheduleDays.includes(index) && styles.dayChipActive]}
          >
            {label}
          </Text>
        ))}
      </View>
      <Text style={styles.hint}>No days selected means "every day".</Text>

      <Text style={styles.label}>Color</Text>
      <View style={styles.colorRow}>
        {COLOR_OPTIONS.map((color) => (
          <Text
            key={color}
            onPress={() => setColorTag(color)}
            style={[styles.colorSwatch, { backgroundColor: color }, colorTag === color && styles.colorSwatchActive]}
          >
            {colorTag === color ? '✓' : ''}
          </Text>
        ))}
      </View>

      <PrimaryButton label="Save" onPress={handleSave} />
      <PrimaryButton label="Cancel" onPress={onDone} variant="secondary" />
      {habitId ? <PrimaryButton label="Delete habit" onPress={handleDelete} variant="danger" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#374151',
    overflow: 'hidden',
  },
  dayChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#FFFFFF',
    overflow: 'hidden',
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: '#111827',
  },
});
