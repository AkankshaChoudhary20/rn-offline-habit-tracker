/**
 * CRUD + sync-support access for the `habits` table.
 *
 * Every mutation bumps `updatedAt` and sets `dirty = 1` — that's what makes
 * last-write-wins sync work: the timestamp is the single source of truth for
 * "which copy is newer", and `dirty` marks "the remote hasn't seen this yet".
 */

import * as Crypto from 'expo-crypto';
import { getDb } from './database';
import { Habit } from '../types/models';
import { LocalStore } from '../sync/syncEngine';

interface HabitRow {
  id: string;
  name: string;
  description: string;
  scheduleDays: string;
  colorTag: string;
  createdAt: string;
  updatedAt: string;
  archived: number;
  remoteUpdatedAt: string | null;
  dirty: number;
  deleted: number;
}

function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scheduleDays: JSON.parse(row.scheduleDays),
    colorTag: row.colorTag,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archived: row.archived === 1,
    remoteUpdatedAt: row.remoteUpdatedAt ?? undefined,
    dirty: row.dirty === 1,
    deleted: row.deleted === 1,
  };
}

export async function listHabits(includeArchived = false): Promise<Habit[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT * FROM habits WHERE deleted = 0 ${includeArchived ? '' : 'AND archived = 0'} ORDER BY createdAt ASC`
  );
  return rows.map(rowToHabit);
}

export async function getHabit(id: string): Promise<Habit | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', [id]);
  return row ? rowToHabit(row) : null;
}

export interface HabitInput {
  name: string;
  description?: string;
  scheduleDays?: number[];
  colorTag?: string;
}

export async function createHabit(input: HabitInput): Promise<Habit> {
  const db = await getDb();
  const now = new Date().toISOString();
  const habit: Habit = {
    id: Crypto.randomUUID(),
    name: input.name,
    description: input.description ?? '',
    scheduleDays: input.scheduleDays ?? [],
    colorTag: input.colorTag ?? '#4F46E5',
    createdAt: now,
    updatedAt: now,
    archived: false,
    dirty: true,
    deleted: false,
  };
  await db.runAsync(
    `INSERT INTO habits (id, name, description, scheduleDays, colorTag, createdAt, updatedAt, archived, dirty, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, 0)`,
    [habit.id, habit.name, habit.description, JSON.stringify(habit.scheduleDays), habit.colorTag, habit.createdAt, habit.updatedAt]
  );
  return habit;
}

export async function updateHabit(id: string, patch: Partial<HabitInput & { archived: boolean }>): Promise<void> {
  const db = await getDb();
  const existing = await getHabit(id);
  if (!existing) throw new Error(`Habit ${id} not found`);
  const now = new Date().toISOString();
  const next: Habit = {
    ...existing,
    ...patch,
    updatedAt: now,
    dirty: true,
  };
  await db.runAsync(
    `UPDATE habits SET name = ?, description = ?, scheduleDays = ?, colorTag = ?, archived = ?, updatedAt = ?, dirty = 1 WHERE id = ?`,
    [next.name, next.description, JSON.stringify(next.scheduleDays), next.colorTag, next.archived ? 1 : 0, next.updatedAt, id]
  );
}

/** Soft delete — kept as a tombstone so the sync layer can propagate the deletion. */
export async function deleteHabit(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(`UPDATE habits SET deleted = 1, updatedAt = ?, dirty = 1 WHERE id = ?`, [now, id]);
}

/**
 * Adapts the habits table to the generic `LocalStore` interface the sync
 * engine expects. Kept separate from the CRUD functions above so screens can
 * use the ergonomic API while the sync engine uses the generic one.
 */
export const habitsLocalStore: LocalStore<Habit> = {
  async getAll() {
    const db = await getDb();
    const rows = await db.getAllAsync<HabitRow>('SELECT * FROM habits');
    return rows.map(rowToHabit);
  },
  async replaceAll(records) {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const habit of records) {
        await db.runAsync(
          `INSERT INTO habits (id, name, description, scheduleDays, colorTag, createdAt, updatedAt, archived, remoteUpdatedAt, dirty, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, description = excluded.description, scheduleDays = excluded.scheduleDays,
             colorTag = excluded.colorTag, updatedAt = excluded.updatedAt, archived = excluded.archived,
             remoteUpdatedAt = excluded.remoteUpdatedAt, dirty = excluded.dirty, deleted = excluded.deleted`,
          [
            habit.id,
            habit.name,
            habit.description,
            JSON.stringify(habit.scheduleDays),
            habit.colorTag,
            habit.createdAt,
            habit.updatedAt,
            habit.archived ? 1 : 0,
            habit.remoteUpdatedAt ?? null,
            habit.dirty ? 1 : 0,
            habit.deleted ? 1 : 0,
          ]
        );
      }
    });
  },
  async getDirty() {
    const db = await getDb();
    const rows = await db.getAllAsync<HabitRow>('SELECT * FROM habits WHERE dirty = 1');
    return rows.map(rowToHabit);
  },
  async markSynced(ids, remoteUpdatedAt) {
    if (ids.length === 0) return;
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(', ');
    await db.runAsync(
      `UPDATE habits SET dirty = 0, remoteUpdatedAt = ? WHERE id IN (${placeholders})`,
      [remoteUpdatedAt, ...ids]
    );
  },
};
