import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SyncStatus } from '../sync/syncEngine';

interface Props {
  status: SyncStatus;
  onPressSync: () => void;
}

const LABELS: Record<SyncStatus, string> = {
  idle: 'Not synced yet',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline — changes saved locally',
  error: 'Sync error',
};

const COLORS: Record<SyncStatus, string> = {
  idle: '#9CA3AF',
  syncing: '#3B82F6',
  synced: '#22C55E',
  offline: '#F59E0B',
  error: '#EF4444',
};

export function SyncStatusBar({ status, onPressSync }: Props) {
  return (
    <Pressable style={styles.container} onPress={onPressSync}>
      <View style={[styles.dot, { backgroundColor: COLORS[status] }]} />
      <Text style={styles.label}>{LABELS[status]}</Text>
      {status === 'syncing' ? <ActivityIndicator size="small" style={styles.spinner} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
  },
  spinner: {
    marginLeft: 8,
  },
});
