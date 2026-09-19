import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Habit, StreakInfo } from '../types/models';
import { StreakBadge } from './StreakBadge';

interface Props {
  habit: Habit;
  streak: StreakInfo;
  checkedInToday: boolean;
  onToggleToday: () => void;
  onPress: () => void;
}

export function HabitCard({ habit, streak, checkedInToday, onToggleToday, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.colorDot, { backgroundColor: habit.colorTag }]} />
      <View style={styles.body}>
        <Text style={styles.name}>{habit.name}</Text>
        {habit.description ? <Text style={styles.description}>{habit.description}</Text> : null}
        <StreakBadge currentStreak={streak.currentStreak} longestStreak={streak.longestStreak} />
      </View>
      <Pressable
        style={[styles.checkButton, checkedInToday && styles.checkButtonDone]}
        onPress={onToggleToday}
        hitSlop={8}
      >
        <Text style={styles.checkButtonText}>{checkedInToday ? '✓' : ''}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 4,
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonDone: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
