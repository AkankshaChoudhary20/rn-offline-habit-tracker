/**
 * CRUD + sync-support access for the `check_ins` table.
 * Mirrors habitsRepo.ts — see that file for the dirty/updatedAt rationale.
 */

import * as Crypto from 'expo-crypto';
import { getDb } from './database';
import { CheckIn } from '../types/models';
import { LocalStore } from '../sync/syncEngine';

interface CheckInRow {
  id: string;
  habitId: string;
  date: string;
  completed: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  remoteUpdatedAt: string | null;
  dirty: number;
  deleted: number;
}

function rowToCheckIn(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    habitId: row.habitId,
    date: row.date,
    completed: row.completed === 1,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    remoteUpdatedAt: row.remoteUpdatedAt ?? undefined,
    dirty: row.dirty === 1,
    deleted: row.deleted === 1,
  };
}

export async function listCheckInsForHabit(habitId: string): Promise<CheckIn[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CheckInRow>(
    'SELECT * FROM check_ins WHERE habitId = ? AND deleted = 0 ORDER BY date ASC',
    [habitId]
  );
  return rows.map(rowToCheckIn);
}

/**
 * Toggles today's (or any given date's) check-in for a habit.
 * If a check-in already exists for that date it's updated in place rather
 * than duplicated — one row per (habit, date).
 */
export async function setCheckIn(habitId: string, date: string, completed: boolean, note = ''): Promise<CheckIn> {
  const db = await getDb();
  const existing = await db.getFirstAsync<CheckInRow>(
    'SELECT * FROM check_ins WHERE habitId = ? AND date = ? AND deleted = 0',
    [habitId, date]
  );
  const now = new Date().toISOString();

  if (existing) {
    await db.runAsync('UPDATE check_ins SET completed = ?, note = ?, updatedAt = ?, dirty = 1 WHERE id = ?', [
      completed ? 1 : 0,
      note,
      now,
      existing.id,
    ]);
    return rowToCheckIn({ ...existing, completed: completed ? 1 : 0, note, updatedAt: now, dirty: 1 });
  }

  const checkIn: CheckIn = {
    id: Crypto.randomUUID(),
    habitId,
    date,
    completed,
    note,
    createdAt: now,
    updatedAt: now,
    dirty: true,
    deleted: false,
  };
  await db.runAsync(
    `INSERT INTO check_ins (id, habitId, date, completed, note, createdAt, updatedAt, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [checkIn.id, checkIn.habitId, checkIn.date, checkIn.completed ? 1 : 0, checkIn.note, checkIn.createdAt, checkIn.updatedAt]
  );
  return checkIn;
}

export const checkInsLocalStore: LocalStore<CheckIn> = {
  async getAll() {
    const db = await getDb();
    const rows = await db.getAllAsync<CheckInRow>('SELECT * FROM check_ins');
    return rows.map(rowToCheckIn);
  },
  async replaceAll(records) {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const c of records) {
        await db.runAsync(
          `INSERT INTO check_ins (id, habitId, date, completed, note, createdAt, updatedAt, remoteUpdatedAt, dirty, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             completed = excluded.completed, note = excluded.note, updatedAt = excluded.updatedAt,
             remoteUpdatedAt = excluded.remoteUpdatedAt, dirty = excluded.dirty, deleted = excluded.deleted`,
          [
            c.id,
            c.habitId,
            c.date,
            c.completed ? 1 : 0,
            c.note,
            c.createdAt,
            c.updatedAt,
            c.remoteUpdatedAt ?? null,
            c.dirty ? 1 : 0,
            c.deleted ? 1 : 0,
          ]
        );
      }
    });
  },
  async getDirty() {
    const db = await getDb();
    const rows = await db.getAllAsync<CheckInRow>('SELECT * FROM check_ins WHERE dirty = 1');
    return rows.map(rowToCheckIn);
  },
  async markSynced(ids, remoteUpdatedAt) {
    if (ids.length === 0) return;
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(', ');
    await db.runAsync(
      `UPDATE check_ins SET dirty = 0, remoteUpdatedAt = ? WHERE id IN (${placeholders})`,
      [remoteUpdatedAt, ...ids]
    );
  },
};
