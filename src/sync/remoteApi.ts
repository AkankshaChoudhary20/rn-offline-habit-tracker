/**
 * Stub "remote" sync target.
 *
 * There is no backend server in this project. In a real deployment this
 * module would be replaced with `fetch()` calls to something like
 * `POST /api/habits/sync`. For now it's an in-memory table that stands in
 * for "the cloud", which is enough to exercise the real push/pull/merge
 * logic in `syncEngine.ts` end-to-end (including on device, since it needs
 * no network).
 *
 * Swap this file's internals for real HTTP calls and nothing else in the
 * sync layer has to change — `syncEngine.ts` only depends on the
 * `RemoteApi` interface below.
 */

import { Syncable } from '../types/models';

export interface RemoteApi<T extends Syncable> {
  /** Returns every record the remote knows about (including tombstones). */
  fetchAll(): Promise<T[]>;
  /** Upserts a batch of records on the remote, LWW is applied server-side too in a real backend. */
  pushBatch(records: T[]): Promise<void>;
}

/**
 * In-memory mock remote. Simulates network latency and occasional
 * connectivity loss so the sync engine's "best effort, retry later" behavior
 * is real and exercised, not hand-waved.
 */
export class MockRemoteApi<T extends Syncable> implements RemoteApi<T> {
  private table = new Map<string, T>();
  private latencyMs: number;
  private failureRate: number;

  constructor(options: { latencyMs?: number; failureRate?: number } = {}) {
    this.latencyMs = options.latencyMs ?? 50;
    this.failureRate = options.failureRate ?? 0;
  }

  /** Test/dev helper to seed the mock remote directly. */
  seed(records: T[]): void {
    for (const r of records) this.table.set(r.id, r);
  }

  private async simulateNetwork(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    if (Math.random() < this.failureRate) {
      throw new Error('MockRemoteApi: simulated network failure');
    }
  }

  async fetchAll(): Promise<T[]> {
    await this.simulateNetwork();
    return Array.from(this.table.values());
  }

  async pushBatch(records: T[]): Promise<void> {
    await this.simulateNetwork();
    for (const incoming of records) {
      const existing = this.table.get(incoming.id);
      if (!existing || Date.parse(incoming.updatedAt) >= Date.parse(existing.updatedAt)) {
        this.table.set(incoming.id, incoming);
      }
      // else: remote already has a newer version (e.g. another device pushed
      // first) — keep it, the next pull will surface it locally via LWW.
    }
  }
}
