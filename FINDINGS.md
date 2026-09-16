# sqlite-core parity findings

Differential validation of the `sqlite-core` branch against `main`,
run 2026-09-16. Methods: identical query matrix on both engines
(41 read queries over demo + synthetic fixtures), identical mutation
scenarios (7), targeted behavior probes (11, `probe-parity.ts`),
and property tests (`test/property/`).

Legend: ✅ parity · 🛠 fixed on branch · ⚠️ intentional change · 🔍 open

## Fixed on branch (commit `ad6b2cd4`)

| # | Finding | `main` | `sqlite-core` before fix |
|---|---------|--------|--------------------------|
| 1 | Mutations with `id: undefined` (`remove`, `update`, `move`, `publish`, `unpublish`, `archive`) | Safe no-op / miss (`remove` silently succeeds, rest miss the in-memory lookup) | `remove` **deleted every entry**: `undefined` is dropped from the SQL filter, matching all rows |
| 2 | Reorder (`move … before/after`) inside a parent whose type does not declare `contains` | Allowed (containment only checked on actual reparenting) | Rejected with `Parent of type X does not allow children of type X` |

Fix: `assert(id, …)` on all six ops (mirroring `create`), and the
containment check restored to `action === Permission.Move && parentId`.
Both are covered by new regression tests
(`src/database/EntryStore.test.ts`, `test/moves.test.ts`).

Backport candidates for `main`: the missing-id asserts. `main` is only
safe by accident of in-memory lookup; the asserts would harden it too.
The reorder guard already matches `main`, nothing to backport.

## Intentional behavior changes (need sign-off)

| # | Finding | `main` | `sqlite-core` |
|---|---------|--------|---------------|
| 3 | `translations` with `includeSelf: true` ordering | Locale-ascending (`["de","en"]` for both) | Self first (`["en","de"]` for `en`) — deliberate (`EntryQuery.ts`) |
| 4 | `remove` with `id: undefined` | Silent no-op success | Throws `Remove mutation is missing an id` (new assert from #1) |

#3 is pinned by an added assertion in `test/query-parity.test.ts`.
#4 is the safe direction; consider backporting the assert to `main`.

## Verified parity (identical on both engines)

- `take: 0` behaves as unlimited.
- Draft parents hide their subtrees (status inheritance, parent wins,
  including `draft`-over-`archived` and `archived`-over-`draft`).
- Removing a draft parent keeps the child directory: surviving orphans
  are adopted by the removed entry's parent, keeping stored index order.
- Removing a missing id is a no-op success.
- `archive`/`unpublish` accept any existing entry and are idempotent.
- `update` addresses the stored version even when hidden; publishing a
  version that does not exist throws `Entry not found` on both.
- Create-moves ordering on simple histories; stale-write conflicts raise
  `ShaMismatchError` on both; `referencesTo` agrees.
- Full read matrix: filters, paging, ordering (incl. case sensitivity),
  groupBy, all relation types, locales, entry links, rich text, image
  alts, search result sets, previews, and both error cases — 40/41
  identical, the one diff being #3.

## Open

| # | Finding | Status |
|---|---------|--------|
| 5 | Sibling order after combined move+create histories. Root cause was the test model, not the engine: key generation reads siblings in index order on both engines (verified identical keys `Zz`, `ZzV`, `a1` across move/create sequences on `main` and branch). Fixed in the model; 150-run soak green. | ✅ resolved as model bug |
| 6 | Moving an entry onto a sibling with the same path segment silently collided files and dropped a row. Neither engine deduped the target path on move (published moves throw on URL conflict, but drafts skipped validation). Fixed on `sqlite-core` (`Dedupe sibling paths on move`): the path now runs through `availablePath` like create/update, so the moved entry lands on `same-1` instead of overwriting. Pinned by `move onto a same-path …` tests in `test/moves.test.ts`. Same fix is still applicable to `main`, which has the identical hole. | 🛠 fixed on branch, backportable |

## Property suite

`test/property/` (new, uses `fast-check`): `graph.test.ts` holds
8 query-algebra laws with no oracle (paging composition, count/get/first
agreement, determinism, visibility, ordering totality, parent/children
symmetry, filter partitions). `transactions.test.ts` runs random mutation
sequences against an in-memory model with per-step convergence checks.
Default 20 runs; soak with `PROPERTY_RUNS=1000 bun test test/property`.
