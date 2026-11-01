import { calculateStreak, daysBetween } from '../utils/streak';
import { CheckIn } from '../types/models';
const checkIn = (date: string): CheckIn => ({ id: date, habitId: 'habit', date, completed: true, deleted: false, updatedAt: '2026-01-01T00:00:00Z' });

test('invalid stored dates never distort streaks or last completion', () => {
  const rows = ['2026-03-01', '2026-03-02', '2026-02-30', 'not-a-date', '2026-3-3', '2026-13-01'].map(checkIn);
  expect(calculateStreak(rows, '2026-03-02')).toEqual({ currentStreak: 2, longestStreak: 2, lastCompletedDate: '2026-03-02' });
});

test('only invalid dates produce empty streaks', () => {
  expect(calculateStreak([checkIn('2026-02-30')], '2026-03-02')).toEqual({ currentStreak: 0, longestStreak: 0, lastCompletedDate: null });
});

test('invalid reference dates are rejected explicitly', () => {
  expect(() => calculateStreak([], '2026-02-30')).toThrow(RangeError);
});

test('date math supports four-digit years below 0100', () => {
  expect(daysBetween('0099-12-31', '0100-01-01')).toBe(1);
});
