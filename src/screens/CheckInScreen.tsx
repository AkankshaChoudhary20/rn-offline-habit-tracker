import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckIn, Habit, StreakInfo } from '../types/models';
import { getHabit } from '../db/habitsRepo';
import { listCheckInsForHabit, setCheckIn } from '../db/checkInsRepo';
import { calculateStreak, isCompletedOn, toDateOnlyString } from '../utils/streak';
import { PrimaryButton } from '../components/PrimaryButton';
import { StreakBadge } from '../components/StreakBadge';

interface Props {
  habitId: string;
  onBack: () => void;
  onEdit: (habitId: string) => void;
}

const today = () => toDateOnlyString(new Date());

export function CheckInScreen({ habitId, onBack, onEdit }: Props) {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [note, setNote] = useState('');
  const [streak, setStreak] = useState<StreakInfo>({ currentStreak: 0, longestStreak: 0, lastCompletedDate: null });

  const load = useCallback(async () => {
    const h = await getHabit(habitId);
    const c = await listCheckInsForHabit(habitId);
    setHabit(h);
    setCheckIns(c);
    setStreak(calculateStreak(c));
    const todayEntry = c.find((entry) => entry.date === today());
    setNote(todayEntry?.note ?? '');
  }, [habitId]);

  useEffect(() => {
    load();
  }, [load]);

  const completedToday = isCompletedOn(checkIns, today());

  const handleToggle = async () => {
    await setCheckIn(habitId, today(), !completedToday, note);
    await load();
  };

  const handleSaveNote = async (text: string) => {
    setNote(text);
    await setCheckIn(habitId, today(), completedToday, text);
  };

  if (!habit) return null;

  const history = [...checkIns].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);

  return (
    <View style={styles.container}>
      <Text style={styles.back} onPress={onBack}>
        ← Back
      </Text>
      <View style={styles.headerRow}>
        <View style={[styles.colorDot, { backgroundColor: habit.colorTag }]} />
        <Text style={styles.title}>{habit.name}</Text>
      </View>
      {habit.description ? <Text style={styles.description}>{habit.description}</Text> : null}

      <StreakBadge currentStreak={streak.currentStreak} longestStreak={streak.longestStreak} />

      <View style={styles.todayCard}>
        <Text style={styles.todayLabel}>Today · {today()}</Text>
        <PrimaryButton label={completedToday ? 'Marked done ✓' : 'Mark as done'} onPress={handleToggle} />
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note (optional)"
          value={note}
          onChangeText={handleSaveNote}
          multiline
        />
      </View>

      <Text style={styles.historyTitle}>History</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text style={styles.historyDate}>{item.date}</Text>
            <Text style={item.completed ? styles.historyDone : styles.historyMissed}>
              {item.completed ? 'Done' : 'Skipped'}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyHistory}>No check-ins recorded yet.</Text>}
      />

      <PrimaryButton label="Edit habit" onPress={() => onEdit(habitId)} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  back: {
    color: '#4F46E5',
    fontSize: 15,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  description: {
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 8,
  },
  todayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  todayLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 44,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyDate: {
    color: '#374151',
  },
  historyDone: {
    color: '#22C55E',
    fontWeight: '600',
  },
  historyMissed: {
    color: '#9CA3AF',
  },
  emptyHistory: {
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
