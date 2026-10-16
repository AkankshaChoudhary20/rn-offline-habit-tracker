/**
 * Pure streak-calculation logic.
 *
 * No RN / expo-sqlite imports on purpose: this module takes plain data in and
 * returns plain data out, so it can be unit tested with vanilla Jest and no
 * device/emulator/runtime.
 */

import { CheckIn, StreakInfo } from '../types/models';

/** Parses a YYYY-MM-DD string as a UTC date so day-diff math is DST-safe. */
function parseDateOnly(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = parseDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnlyString(d);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseDateOnly(b).getTime() - parseDateOnly(a).getTime()) / msPerDay);
}

/**
 * Computes current and longest streaks for a single habit from its check-ins.
 *
 * Rules:
 * - Only `completed: true` and non-deleted check-ins count.
 * - Duplicate dates for the same habit are de-duplicated (keeps one).
 * - The "current streak" is the run of consecutive completed days ending at
 *   `asOfDate` or `asOfDate - 1` (so a streak isn't broken just because
 *   today hasn't been checked in yet, but IS broken once a day is skipped).
 * - `longestStreak` scans the whole history for the longest consecutive run.
 */
export function calculateStreak(checkIns: CheckIn[], asOfDate: string = toDateOnlyString(new Date())): StreakInfo {
  const completedDates = Array.from(
    new Set(
      checkIns
        .filter((c) => c.completed && !c.deleted)
        .map((c) => c.date)
    )
  ).sort();

  if (completedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
  }

  // Longest streak: walk the sorted unique dates, breaking the run whenever
  // the gap to the previous date isn't exactly 1 day.
  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < completedDates.length; i++) {
    const gap = daysBetween(completedDates[i - 1], completedDates[i]);
    if (gap === 1) {
      runLength += 1;
    } else if (gap > 1) {
      runLength = 1;
    }
    // gap === 0 can't happen after de-duplication.
    longestStreak = Math.max(longestStreak, runLength);
  }

  const lastCompletedDate = completedDates[completedDates.length - 1];

  // Current streak: only "alive" if the most recent completion is today or
  // yesterday relative to asOfDate. Otherwise the streak is broken (0).
  // Future check-ins cannot extend or hide a streak that is active today.
  // Keep the whole-history longest streak/last-completion metadata above.
  const currentDates = completedDates.filter(date => daysBetween(date, asOfDate) >= 0);
  const lastCurrentDate = currentDates[currentDates.length - 1];
  const gapToToday = lastCurrentDate ? daysBetween(lastCurrentDate, asOfDate) : Infinity;
  let currentStreak = 0;
  if (gapToToday >= 0 && gapToToday <= 1) {
    currentStreak = 1;
    let cursor = lastCurrentDate;
    for (let i = currentDates.length - 2; i >= 0; i--) {
      const gap = daysBetween(currentDates[i], cursor);
      if (gap === 1) {
        currentStreak += 1;
        cursor = currentDates[i];
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak, lastCompletedDate };
}

/** Convenience helper used by the check-in screen to know if "today" is already logged. */
export function isCompletedOn(checkIns: CheckIn[], date: string): boolean {
  return checkIns.some((c) => c.date === date && c.completed && !c.deleted);
}

export { addDays, daysBetween, toDateOnlyString };
