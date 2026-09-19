/**
 * Last-write-wins conflict resolution.
 *
 * This is real, testable logic — it's just fed by a mock "remote" in this
 * project instead of a live server (see remoteApi.ts). The rules:
 *
 *  1. Compare `updatedAt` timestamps (ISO 8601 strings, comparable lexically
 *     and chronologically). The record with the later timestamp wins.
 *  2. Exact tie on timestamp -> local wins (arbitrary but deterministic;
 *     documented so it's not "undefined behaviour").
 *  3. A `deleted: true` record is a normal record for LWW purposes — a
 *     delete with a newer timestamp beats an edit, and vice versa. This
 *     gives us tombstone semantics for free.
 */

import { Syncable } from '../types/models';

export type ConflictWinner = 'local' | 'remote' | 'equal';

export interface ResolutionResult<T extends Syncable> {
  winner: ConflictWinner;
  record: T;
}

/** Compares two ISO timestamps. Returns >0 if a is later, <0 if b is later, 0 if equal. */
export function compareTimestamps(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    // Fall back to plain string comparison for malformed input rather than
    // throwing mid-sync — ISO strings still sort correctly lexically.
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return ta - tb;
}

/**
 * Resolves a single-record conflict between a local and remote version using
 * last-write-wins on `updatedAt`.
 */
export function resolveConflict<T extends Syncable>(local: T, remote: T): ResolutionResult<T> {
  const cmp = compareTimestamps(local.updatedAt, remote.updatedAt);
  if (cmp > 0) return { winner: 'local', record: local };
  if (cmp < 0) return { winner: 'remote', record: remote };
  return { winner: 'equal', record: local };
}

/**
 * Merges a full local table and remote table (keyed by id) into the set of
 * records that should end up on both sides after sync, using LWW per id.
 *
 * - Ids present only locally -> kept as-is (they're new, need pushing).
 * - Ids present only remotely -> kept as-is (need pulling).
 * - Ids present on both -> resolved via `resolveConflict`.
 */
export function mergeRecordSets<T extends Syncable>(
  localRecords: T[],
  remoteRecords: T[]
): { merged: T[]; resolutions: ResolutionResult<T>[] } {
  const remoteById = new Map(remoteRecords.map((r) => [r.id, r]));
  const localById = new Map(localRecords.map((r) => [r.id, r]));
  const merged: T[] = [];
  const resolutions: ResolutionResult<T>[] = [];

  for (const local of localRecords) {
    const remote = remoteById.get(local.id);
    if (!remote) {
      merged.push(local);
      continue;
    }
    const result = resolveConflict(local, remote);
    resolutions.push(result);
    merged.push(result.record);
  }

  for (const remote of remoteRecords) {
    if (!localById.has(remote.id)) {
      merged.push(remote);
    }
  }

  return { merged, resolutions };
}
