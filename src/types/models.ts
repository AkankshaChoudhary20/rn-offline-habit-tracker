/**
 * Core domain types shared across the db, sync, and UI layers.
 *
 * These types intentionally have no dependency on React Native or expo-sqlite
 * so they can be imported from pure-logic modules and unit tested under
 * plain Node/Jest.
 */

export interface Habit {
  id: string;
  name: string;
  description: string;
  /** Days of week this habit is scheduled for. 0 = Sunday .. 6 = Saturday. Empty = every day. */
  scheduleDays: number[];
  colorTag: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601, bumped on every local edit — drives last-write-wins sync
  archived: boolean;
  /** Set by the sync layer once the remote has accepted this record. Undefined = never synced. */
  remoteUpdatedAt?: string;
  /** Local-only flag: true while this record has edits the remote hasn't seen yet. */
  dirty: boolean;
  deleted: boolean;
}

export interface CheckIn {
  id: string;
  habitId: string;
  /** Calendar date the check-in applies to, YYYY-MM-DD (local date, not a timestamp). */
  date: string;
  completed: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
  remoteUpdatedAt?: string;
  dirty: boolean;
  deleted: boolean;
}

/** A generic record shape the conflict resolver operates on. Habit and CheckIn both satisfy it. */
export interface Syncable {
  id: string;
  updatedAt: string;
  deleted: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}
