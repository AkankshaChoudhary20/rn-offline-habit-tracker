/**
 * SQLite bootstrap.
 *
 * Uses the `expo-sqlite` async API (SDK 51+: openDatabaseAsync / execAsync /
 * runAsync / getAllAsync). One connection is opened lazily and reused for
 * the lifetime of the app.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'habit_tracker.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scheduleDays TEXT NOT NULL DEFAULT '[]',
  colorTag TEXT NOT NULL DEFAULT '#4F46E5',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  remoteUpdatedAt TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY NOT NULL,
  habitId TEXT NOT NULL,
  date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  remoteUpdatedAt TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (habitId) REFERENCES habits (id)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_habit_date ON check_ins (habitId, date);
`;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA_SQL);
      return db;
    })();
  }
  return dbPromise;
}

/** Test/dev helper: wipes all rows without dropping the schema. */
export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM check_ins; DELETE FROM habits;');
}
