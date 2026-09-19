import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CheckIn, Habit, StreakInfo } from '../types/models';
import { listHabits } from '../db/habitsRepo';
import { listCheckInsForHabit, setCheckIn } from '../db/checkInsRepo';
import { calculateStreak, isCompletedOn, toDateOnlyString } from '../utils/streak';
import { HabitCard } from '../components/HabitCard';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { SyncStatus } from '../sync/syncEngine';
import { PrimaryButton } from '../components/PrimaryButton';

interface Props {
  onAddHabit: () => void;
  onOpenHabit: (habitId: string) => void;
  syncStatus: SyncStatus;
  onPressSync: () => void;
  /** Bumped by the parent after a sync completes, to force a reload. */
  reloadToken: number;
}

interface HabitWithStreak {
  habit: Habit;
  checkIns: CheckIn[];
  streak: StreakInfo;
}

const today = () => toDateOnlyString(new Date());

export function HabitListScreen({ onAddHabit, onOpenHabit, syncStatus, onPressSync, reloadToken }: Props) {
  const [items, setItems] = useState<HabitWithStreak[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const habits = await listHabits();
    const withStreaks = await Promise.all(
      habits.map(async (habit) => {
        const checkIns = await listCheckInsForHabit(habit.id);
        return { habit, checkIns, streak: calculateStreak(checkIns) };
      })
    );
    setItems(withStreaks);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const handleToggleToday = useCallback(
    async (habitId: string) => {
      const entry = items.find((i) => i.habit.id === habitId);
      const already = entry ? isCompletedOn(entry.checkIns, today()) : false;
      await setCheckIn(habitId, today(), !already);
      await load();
    },
    [items, load]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Habits</Text>
        <SyncStatusBar status={syncStatus} onPressSync={onPressSync} />
      </View>

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No habits yet. Add your first one to start tracking.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.habit.id}
          renderItem={({ item }) => (
            <HabitCard
              habit={item.habit}
              streak={item.streak}
              checkedInToday={isCompletedOn(item.checkIns, today())}
              onToggleToday={() => handleToggleToday(item.habit.id)}
              onPress={() => onOpenHabit(item.habit.id)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      <PrimaryButton label="+ Add habit" onPress={onAddHabit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  list: {
    paddingBottom: 16,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 15,
  },
});
