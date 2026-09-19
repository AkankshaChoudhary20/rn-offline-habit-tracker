/**
 * Sync orchestration: pulls remote state, merges it with local state using
 * last-write-wins (see conflictResolution.ts), pushes anything locally dirty,
 * and reports what happened so the UI can show "Synced" / "Offline" / error.
 *
 * This module is deliberately storage-agnostic — it's handed a small
 * `LocalStore` interface rather than importing the SQLite layer directly, so
 * it can also run in tests against an in-memory store.
 */

import { Syncable } from '../types/models';
import { mergeRecordSets, ResolutionResult } from './conflictResolution';
import { RemoteApi } from './remoteApi';

export interface LocalStore<T extends Syncable> {
  getAll(): Promise<T[]>;
  /** Replace local rows with the merged result of a sync pass. */
  replaceAll(records: T[]): Promise<void>;
  /** Local records with unsynced edits (dirty === true). */
  getDirty(): Promise<T[]>;
  /** Clear the dirty flag once a record is confirmed pushed. */
  markSynced(ids: string[], remoteUpdatedAt: string): Promise<void>;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncResult<T extends Syncable> {
  status: SyncStatus;
  pushed: number;
  pulled: number;
  conflicts: ResolutionResult<T>[];
  error?: string;
}

/**
 * Runs one full sync pass for a single record type (e.g. all habits, or all
 * check-ins). Call it for each table you need to keep in sync.
 *
 * Flow:
 *  1. Pull everything from the remote.
 *  2. Merge with local state via last-write-wins.
 *  3. Write the merged result back to local storage.
 *  4. Push whatever is still marked dirty (new/edited locally) to the remote.
 *  5. Clear dirty flags for what was successfully pushed.
 *
 * If the remote is unreachable at any point, the pass stops and reports
 * `status: 'offline'` — local data is untouched and already fully usable,
 * which is the whole point of offline-first.
 */
export async function runSync<T extends Syncable>(
  local: LocalStore<T>,
  remote: RemoteApi<T>
): Promise<SyncResult<T>> {
  let remoteRecords: T[];
  try {
    remoteRecords = await remote.fetchAll();
  } catch (err) {
    return { status: 'offline', pushed: 0, pulled: 0, conflicts: [], error: describeError(err) };
  }

  const localRecords = await local.getAll();
  const { merged, resolutions } = mergeRecordSets(localRecords, remoteRecords);
  await local.replaceAll(merged);

  const dirty = await local.getDirty();
  if (dirty.length === 0) {
    return { status: 'synced', pushed: 0, pulled: remoteRecords.length, conflicts: resolutions };
  }

  try {
    await remote.pushBatch(dirty);
  } catch (err) {
    return {
      status: 'offline',
      pushed: 0,
      pulled: remoteRecords.length,
      conflicts: resolutions,
      error: describeError(err),
    };
  }

  const now = new Date().toISOString();
  await local.markSynced(
    dirty.map((d) => d.id),
    now
  );

  return { status: 'synced', pushed: dirty.length, pulled: remoteRecords.length, conflicts: resolutions };
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
