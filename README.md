# rn-offline-habit-tracker

A small, offline-first habit tracker built with React Native (Expo) and TypeScript.
Habits and daily check-ins are stored locally in SQLite and work fully without a
network connection; a sync layer with real last-write-wins conflict resolution is
included, wired up against a mock "remote" (there is no backend server in this repo).

No navigation library, no auth, no backend to stand up. The point of this project is
to show a working offline-first data model and a sync/conflict strategy that's
actually testable — not a polished production app.

## What it does

1. **Track habits locally** — create a habit (name, description, optional weekly
   schedule, color tag), edit or delete it, all persisted to on-device SQLite via
   `expo-sqlite`. Works with the device in airplane mode; there is nothing to wait on.
2. **Daily check-ins** — mark a habit done for today, add an optional note, see a
   30-entry history and a computed streak (current + longest) per habit.
3. **Sync (mocked remote)** — tapping the sync indicator runs a real pull → merge →
   push pass against `MockRemoteApi`, an in-memory stand-in for a server that
   simulates network latency and occasional failures. The merge step applies
   last-write-wins conflict resolution by comparing `updatedAt` timestamps, including
   tombstone semantics (a newer delete beats an older edit and vice versa). Swap
   `src/sync/remoteApi.ts`'s internals for real `fetch()` calls to a backend and
   nothing else in the sync layer has to change — it only depends on the small
   `RemoteApi` interface.

## Architecture

```
                    ┌─────────────────────────────┐
   UI (App.tsx,     │  screens/                    │
   state-based       │   HabitListScreen.tsx        │
   screen switcher,  │   AddEditHabitScreen.tsx     │
   no nav library) ─►│   CheckInScreen.tsx          │
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │  db/ (expo-sqlite)            │
                     │   database.ts   — schema/open  │
                     │   habitsRepo.ts — CRUD, bumps  │
                     │   checkInsRepo.ts  updatedAt + │
                     │                    dirty flag  │
                     └──────────────┬───────────────┘
                                    │ LocalStore interface
                     ┌──────────────▼───────────────┐
                     │  sync/                        │
                     │   syncEngine.ts  — pull, merge,│
                     │                    push, report│
                     │   conflictResolution.ts        │
                     │     — last-write-wins by       │
                     │       updatedAt, tombstones     │
                     │   remoteApi.ts                 │
                     │     — MockRemoteApi: in-memory  │
                     │       stub, simulated latency   │
                     │       + failure rate            │
                     └───────────────────────────────┘
                        (swap MockRemoteApi's guts for
                         real fetch() calls to add a
                         real backend — nothing else
                         in the sync layer changes)
```

`utils/streak.ts` is pure and RN-free (day-diff math on `YYYY-MM-DD` strings) so it's
unit tested directly with plain Jest.

## Sync design notes

- Every local mutation to a habit or check-in bumps `updatedAt` to `now` and sets
  `dirty = true`. `dirty` means "the remote hasn't seen this row yet."
- A sync pass (`runSync` in `src/sync/syncEngine.ts`):
  1. Pulls every remote record.
  2. Merges pulled records with local records by id, resolving any id present on
     both sides via `resolveConflict` — later `updatedAt` wins; an exact tie is
     deterministic (local wins, documented in code rather than left as undefined
     behavior).
  3. Writes the merged result back to local storage (so the pull side is applied
     even if the push side later fails).
  4. Pushes whatever is still `dirty` to the remote, then clears the flag for what
     was accepted.
- Deletes are soft (`deleted: true` tombstones with a normal `updatedAt`), so a
  delete on one device propagates through the exact same LWW comparison as an edit
  instead of needing special-case logic.
- If the remote is unreachable at any point, the pass stops and reports
  `status: 'offline'` — local data is left fully intact and usable. Offline is the
  default mode, not a degraded one.
- There is no real backend. `MockRemoteApi` (`src/sync/remoteApi.ts`) is an
  in-memory `Map` that simulates latency and can simulate dropped connections. It
  implements the same `RemoteApi<T>` interface a real HTTP client would, so the
  rest of the sync layer doesn't know or care that it's fake.

## Project layout

```
rn-offline-habit-tracker/
├── App.tsx                        # root component + state-based screen switcher
├── app.json                       # Expo config
├── babel.config.js
├── tsconfig.json                  # full project config (extends expo/tsconfig.base)
├── tsconfig.jest.json             # standalone config used by ts-jest (RN-free)
├── package.json
└── src/
    ├── types/
    │   └── models.ts              # Habit, CheckIn, Syncable, StreakInfo
    ├── db/
    │   ├── database.ts            # expo-sqlite open + schema (habits, check_ins)
    │   ├── habitsRepo.ts          # CRUD + LocalStore adapter for habits
    │   └── checkInsRepo.ts        # CRUD + LocalStore adapter for check-ins
    ├── sync/
    │   ├── conflictResolution.ts  # pure LWW logic — unit tested
    │   ├── syncEngine.ts          # pull/merge/push orchestration
    │   └── remoteApi.ts           # RemoteApi interface + MockRemoteApi stub
    ├── utils/
    │   └── streak.ts              # pure streak calculation — unit tested
    ├── components/
    │   ├── HabitCard.tsx
    │   ├── StreakBadge.tsx
    │   ├── SyncStatusBar.tsx
    │   └── PrimaryButton.tsx
    ├── screens/
    │   ├── HabitListScreen.tsx
    │   ├── AddEditHabitScreen.tsx
    │   └── CheckInScreen.tsx
    └── __tests__/
        ├── streak.test.ts
        └── conflictResolution.test.ts
```

## Stack

- **Framework**: React Native via Expo SDK 51, TypeScript
- **Local storage**: `expo-sqlite` (async API: `openDatabaseAsync` / `execAsync` /
  `runAsync` / `getAllAsync`), two tables (`habits`, `check_ins`)
- **Navigation**: none — a plain `useState`-driven screen switcher in `App.tsx`. The
  app has three screens and no deep linking or nested stacks, so a navigation library
  would add setup weight without buying anything here.
- **Sync target**: a documented in-repo stub (`MockRemoteApi`), not a real backend
- **Testing**: Jest + `ts-jest`, targeting only the RN-free pure-logic modules

## What was actually verified in this sandbox

This was built in a sandboxed environment with **no device or emulator available**,
and a full `expo`/`react-native` `npm install` was skipped as too slow/flaky for this
environment. Being explicit about what that means in practice:

- **Verified**: `npx jest` was run against `src/__tests__/streak.test.ts` and
  `src/__tests__/conflictResolution.test.ts`, using a minimal, RN-free dev dependency
  set (`jest`, `ts-jest`, `typescript`, `@types/jest` only — no Expo/React Native
  packages installed). These cover the streak math and the LWW conflict resolver,
  including the tie-break rule and tombstone (delete-vs-edit) behavior.
- **Not verified**: the app has not been launched in Expo Go, a simulator, or a
  device — there was no emulator available in this environment. The screens, the
  `expo-sqlite` schema/queries, and the wiring in `App.tsx` are written to the real
  `expo-sqlite` async API and follow standard Expo/React Native patterns, but they
  have not been exercised at runtime.
- **Not run**: `tsc --noEmit` against the full project `tsconfig.json` (which extends
  `expo/tsconfig.base`) was skipped because it requires a full `npm install` of Expo
  and its type packages, which is exactly the slow step this build was scoped to
  avoid. `src/utils/streak.ts` and `src/sync/conflictResolution.ts` (plus their
  shared types) do type-check cleanly under the lighter, RN-free
  `tsconfig.jest.json` used by the test run above.
- If you clone this and run `npm install` (pulling in the real Expo/RN toolchain),
  `npm start` should bring up the Expo dev server normally — that step just wasn't
  exercised here.

## Running it yourself

```bash
npm install
npm start        # opens Expo Dev Tools; scan the QR code with Expo Go, or press
                  # `i` / `a` for an iOS simulator / Android emulator
npm test          # runs the Jest unit tests (streak calc + conflict resolution)
npm run typecheck # tsc --noEmit against the full project
```
