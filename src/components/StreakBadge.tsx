import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  currentStreak: number;
  longestStreak: number;
}

export function StreakBadge({ currentStreak, longestStreak }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.fire}>{currentStreak > 0 ? '🔥' : '·'}</Text>
      <Text style={styles.text}>
        {currentStreak} day{currentStreak === 1 ? '' : 's'}
        {longestStreak > currentStreak ? ` · best ${longestStreak}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fire: {
    fontSize: 14,
  },
  text: {
    fontSize: 13,
    color: '#6B7280',
  },
});
