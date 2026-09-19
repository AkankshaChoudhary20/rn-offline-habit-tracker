import { calculateStreak, isCompletedOn } from '../utils/streak';
import { CheckIn } from '../types/models';

function makeCheckIn(date: string, completed = true, overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: `ci-${date}`,
    habitId: 'habit-1',
    date,
    completed,
    note: '',
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    dirty: false,
    deleted: false,
    ...overrides,
  };
}

describe('calculateStreak', () => {
  it('returns zeroes for no check-ins', () => {
    expect(calculateStreak([])).toEqual({ currentStreak: 0, longestStreak: 0, lastCompletedDate: null });
  });

  it('counts a single consecutive run ending today', () => {
    const checkIns = [makeCheckIn('2026-09-17'), makeCheckIn('2026-09-18'), makeCheckIn('2026-09-19')];
    const result = calculateStreak(checkIns, '2026-09-19');
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.lastCompletedDate).toBe('2026-09-19');
  });

  it('keeps the streak alive if today has not been checked in yet, but yesterday was', () => {
    const checkIns = [makeCheckIn('2026-09-17'), makeCheckIn('2026-09-18')];
    const result = calculateStreak(checkIns, '2026-09-19');
    expect(result.currentStreak).toBe(2);
  });

  it('breaks the current streak once a day is skipped', () => {
    const checkIns = [makeCheckIn('2026-09-10'), makeCheckIn('2026-09-11')];
    // asOf is 3 days after the last completion -> streak is dead
    const result = calculateStreak(checkIns, '2026-09-14');
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(2);
  });

  it('finds the longest streak even when it is not the most recent run', () => {
    const checkIns = [
      makeCheckIn('2026-09-01'),
      makeCheckIn('2026-09-02'),
      makeCheckIn('2026-09-03'),
      makeCheckIn('2026-09-04'),
      // gap
      makeCheckIn('2026-09-10'),
      makeCheckIn('2026-09-11'),
    ];
    const result = calculateStreak(checkIns, '2026-09-11');
    expect(result.longestStreak).toBe(4);
    expect(result.currentStreak).toBe(2);
  });

  it('ignores non-completed and deleted check-ins', () => {
    const checkIns = [
      makeCheckIn('2026-09-18', true),
      makeCheckIn('2026-09-19', false),
      makeCheckIn('2026-09-17', true, { deleted: true }),
    ];
    const result = calculateStreak(checkIns, '2026-09-19');
    // only 09-18 counts; 09-19 wasn't completed, 09-17 is deleted
    expect(result.currentStreak).toBe(1);
    expect(result.lastCompletedDate).toBe('2026-09-18');
  });

  it('de-duplicates multiple rows on the same date', () => {
    const checkIns = [makeCheckIn('2026-09-19'), { ...makeCheckIn('2026-09-19'), id: 'dup' }];
    const result = calculateStreak(checkIns, '2026-09-19');
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });
});

describe('isCompletedOn', () => {
  it('returns true only for a completed, non-deleted check-in on that date', () => {
    const checkIns = [makeCheckIn('2026-09-19', true)];
    expect(isCompletedOn(checkIns, '2026-09-19')).toBe(true);
    expect(isCompletedOn(checkIns, '2026-09-18')).toBe(false);
  });

  it('returns false for a deleted check-in even if completed', () => {
    const checkIns = [makeCheckIn('2026-09-19', true, { deleted: true })];
    expect(isCompletedOn(checkIns, '2026-09-19')).toBe(false);
  });
});
