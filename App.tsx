import React, { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { HabitListScreen } from './src/screens/HabitListScreen';
import { AddEditHabitScreen } from './src/screens/AddEditHabitScreen';
import { CheckInScreen } from './src/screens/CheckInScreen';
import { habitsLocalStore } from './src/db/habitsRepo';
import { checkInsLocalStore } from './src/db/checkInsRepo';
import { runSync, SyncStatus } from './src/sync/syncEngine';
import { MockRemoteApi } from './src/sync/remoteApi';
import { Habit, CheckIn } from './src/types/models';

/**
 * Deliberately simple, state-based screen switcher instead of a navigation
 * library — the app only has three screens and none of them need deep
 * linking, nested stacks, or gesture-driven transitions, so a navigation
 * library would add setup and dependency weight without buying anything.
 */
type Route = { name: 'list' } | { name: 'addEdit'; habitId: string | null } | { name: 'checkIn'; habitId: string };

// Stand-in "remote" — see src/sync/remoteApi.ts for why this is a mock and
// what a real backend would need to implement to replace it.
const habitsRemote = new MockRemoteApi<Habit>({ latencyMs: 300 });
const checkInsRemote = new MockRemoteApi<CheckIn>({ latencyMs: 300 });

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'list' });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);

  const handleSync = useCallback(async () => {
    setSyncStatus('syncing');
    const [habitsResult, checkInsResult] = await Promise.all([
      runSync(habitsLocalStore, habitsRemote),
      runSync(checkInsLocalStore, checkInsRemote),
    ]);
    const failed = habitsResult.status === 'offline' || checkInsResult.status === 'offline';
    setSyncStatus(failed ? 'offline' : 'synced');
    setReloadToken((t) => t + 1);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {route.name === 'list' && (
        <HabitListScreen
          onAddHabit={() => setRoute({ name: 'addEdit', habitId: null })}
          onOpenHabit={(habitId) => setRoute({ name: 'checkIn', habitId })}
          syncStatus={syncStatus}
          onPressSync={handleSync}
          reloadToken={reloadToken}
        />
      )}
      {route.name === 'addEdit' && (
        <AddEditHabitScreen habitId={route.habitId} onDone={() => setRoute({ name: 'list' })} />
      )}
      {route.name === 'checkIn' && (
        <CheckInScreen
          habitId={route.habitId}
          onBack={() => setRoute({ name: 'list' })}
          onEdit={(habitId) => setRoute({ name: 'addEdit', habitId })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
