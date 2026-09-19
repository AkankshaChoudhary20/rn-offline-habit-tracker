import { compareTimestamps, mergeRecordSets, resolveConflict } from '../sync/conflictResolution';
import { Syncable } from '../types/models';

interface TestRecord extends Syncable {
  value: string;
}

function record(id: string, updatedAt: string, value: string, deleted = false): TestRecord {
  return { id, updatedAt, value, deleted };
}

describe('compareTimestamps', () => {
  it('is positive when a is later', () => {
    expect(compareTimestamps('2026-09-19T10:00:00.000Z', '2026-09-19T09:00:00.000Z')).toBeGreaterThan(0);
  });

  it('is negative when b is later', () => {
    expect(compareTimestamps('2026-09-19T09:00:00.000Z', '2026-09-19T10:00:00.000Z')).toBeLessThan(0);
  });

  it('is zero for equal timestamps', () => {
    expect(compareTimestamps('2026-09-19T09:00:00.000Z', '2026-09-19T09:00:00.000Z')).toBe(0);
  });
});

describe('resolveConflict', () => {
  it('picks the local record when it is newer', () => {
    const local = record('1', '2026-09-19T10:00:00.000Z', 'local-edit');
    const remote = record('1', '2026-09-19T09:00:00.000Z', 'remote-edit');
    const result = resolveConflict(local, remote);
    expect(result.winner).toBe('local');
    expect(result.record.value).toBe('local-edit');
  });

  it('picks the remote record when it is newer', () => {
    const local = record('1', '2026-09-19T09:00:00.000Z', 'local-edit');
    const remote = record('1', '2026-09-19T10:00:00.000Z', 'remote-edit');
    const result = resolveConflict(local, remote);
    expect(result.winner).toBe('remote');
    expect(result.record.value).toBe('remote-edit');
  });

  it('breaks an exact tie in favor of local, deterministically', () => {
    const ts = '2026-09-19T09:00:00.000Z';
    const local = record('1', ts, 'local-edit');
    const remote = record('1', ts, 'remote-edit');
    const result = resolveConflict(local, remote);
    expect(result.winner).toBe('equal');
    expect(result.record.value).toBe('local-edit');
  });

  it('lets a newer delete win over an older edit (tombstone semantics)', () => {
    const local = record('1', '2026-09-19T09:00:00.000Z', 'edited', false);
    const remote = record('1', '2026-09-19T10:00:00.000Z', 'deleted-value', true);
    const result = resolveConflict(local, remote);
    expect(result.winner).toBe('remote');
    expect(result.record.deleted).toBe(true);
  });

  it('lets a newer edit resurrect a record over an older delete', () => {
    const local = record('1', '2026-09-19T10:00:00.000Z', 'resurrected', false);
    const remote = record('1', '2026-09-19T09:00:00.000Z', 'deleted-value', true);
    const result = resolveConflict(local, remote);
    expect(result.winner).toBe('local');
    expect(result.record.deleted).toBe(false);
  });
});

describe('mergeRecordSets', () => {
  it('keeps records that only exist locally, untouched', () => {
    const local = [record('a', '2026-09-19T00:00:00.000Z', 'only-local')];
    const { merged, resolutions } = mergeRecordSets(local, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a');
    expect(resolutions).toHaveLength(0);
  });

  it('keeps records that only exist remotely, untouched', () => {
    const remote = [record('b', '2026-09-19T00:00:00.000Z', 'only-remote')];
    const { merged, resolutions } = mergeRecordSets([], remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('b');
    expect(resolutions).toHaveLength(0);
  });

  it('resolves overlapping ids with last-write-wins and reports the resolution', () => {
    const local = [record('c', '2026-09-19T12:00:00.000Z', 'local-newer')];
    const remote = [record('c', '2026-09-19T08:00:00.000Z', 'remote-older')];
    const { merged, resolutions } = mergeRecordSets(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe('local-newer');
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].winner).toBe('local');
  });

  it('handles a mix of local-only, remote-only, and overlapping ids in one pass', () => {
    const local = [
      record('local-only', '2026-09-19T00:00:00.000Z', 'l'),
      record('shared', '2026-09-19T12:00:00.000Z', 'local-wins'),
    ];
    const remote = [
      record('remote-only', '2026-09-19T00:00:00.000Z', 'r'),
      record('shared', '2026-09-19T08:00:00.000Z', 'remote-loses'),
    ];
    const { merged } = mergeRecordSets(local, remote);
    const byId = Object.fromEntries(merged.map((r) => [r.id, r]));
    expect(Object.keys(byId).sort()).toEqual(['local-only', 'remote-only', 'shared']);
    expect(byId['shared'].value).toBe('local-wins');
  });
});
