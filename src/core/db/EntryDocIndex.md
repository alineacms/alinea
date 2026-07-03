# EntryDocIndex on DocDB

`EntryDocIndex` is the experimental CMS layer on top of `DocDB`. The current
direction is to keep `DocDB` generic and let the CMS-specific resolver translate
entry queries into document queries and projections.

## Current Shape

- `DocDB` owns persistent storage and indexing:
  - `doc_node` stores hierarchy, parent links, kind, index order, level, and
    ancestry.
  - `doc` stores structured variants such as `{status, locale}` and the JSON
    entry payload.
- `edge` stores extracted entry references.
- `doc_search` stores FTS rows.
- effective status, `active`, and `main` are materialized into `doc.data` by
  the CMS layer so reads do not recursively derive status per result.
- `EntryDocIndex` syncs source records into `DocDB`.
- `EntryDocResolver` no longer extends `EntryResolver` and no longer casts this
  index into the old `EntryIndex` API.
- The old compatibility graph is removed. There are no persistent in-memory
  maps of every entry, node, language, status, child list, or reference.

The resolver projects directly from `Doc` rows. It does not construct full
`Entry` objects for normal reads. Entry-shaped data is only accepted as preview
input because the existing preview request already carries an `Entry`.

## Query Pushdown

These parts are handled by SQLite through `DocDB.query`:

- entry type via a JSON expression index on `type`
- entry id via JSON field filtering on `id`
- locale through structured variant indexes
- effective status, `active`, and `main` through materialized JSON expression
  indexes
- direct children through `doc_node.parentId`
- deeper children through `doc_node.ancestry` and level bounds
- full-text search through FTS5
- simple ordering through JSON expression paths
- reference lookup through the `edge` table
- exact simple field filters compiled from `GraphQuery.filter`
- top-level schema fields through config-derived `data.<field>` expression
  indexes
- safe `take`/`skip` pushdown for exact SQL-backed query shapes, especially FTS
- prepared JSON equality lookups for common data-field predicates

`DocDB.variantWhere` now treats `null` with `IS NULL`; this matters for
non-localized entries where `locale` is stored as `null`.

## Transient Work

Some CMS semantics are still computed outside SQLite query results:

- active/main/inherited status is computed during sync and preview overlay
  materialization, then stored in DocDB rows
- `parentId`, `parents`, and `url` projection fields
- complex filters that cannot be faithfully translated to a `DocDB` condition
- final projection object assembly
- field `queryValue` post-processing and link hydration, only for fields that
  declare `queryValue` or `applyLinks`

This is not a retained content graph. It is a read cache scoped to one resolver
call, used so repeated projected fields on the same result do not repeat parent
status lookups.

## Preview

Preview uses `DocDB.withOverlay`. It inserts the preview document inside a
SQLite transaction/savepoint, runs the resolver synchronously, and rolls back.
It does not copy the database and does not create a long-lived overlay view.

## Selective Browser Sync

A DocDB-backed browser index can be restored without the original source blobs.
Each indexed entry stores `filePath` and `fileHash`, which is enough to rebuild
the filtered `ReadonlyTree` used by the sync diff. `EntryDocIndex` exposes
`hydrateTreeFromDocs()` for this.

The intended browser flow is:

1. Load one persisted SQLite/DocDB blob from IndexedDB.
2. Create `EntryDocIndex` over that database.
3. Call `hydrateTreeFromDocs()` to rebuild the current filtered tree from stored
   file paths and content shas.
4. Ask the remote for the next filtered tree for the entries the user may sync.
5. Diff by sha and fetch blob contents only for changed or added files.
6. Apply those changes through `indexChanges`.

This means unchanged source documents do not need to be available locally. The
server still needs to provide a tree for the same authorization slice. If the
client has only a selective DocDB and the server returns the full repository
tree, the diff would correctly interpret inaccessible files as new files to
fetch, which is not what we want.

The test `hydrates tree from DocDB rows and syncs changed blobs only` covers the
important invariant: a hydrated index syncs using only changed blob contents and
does not request unchanged/original blobs.

## Required Work

- Reduce point lookup overhead. The hot path now uses prepared JSON equality
  statements, but still pays resolver/projection overhead that the current
  in-memory index avoids.
- Improve child edge queries. They are SQL-backed, but still slower than the
  current pre-linked in-memory child iterators.
- Make status materialization incremental for non-initial syncs. Initial sync
  materializes before insert, but updates/removals still rematerialize rows
  broadly to stay correct.
- Tune the number of schema-field expression indexes. Indexing every top-level
  field helps generic filters but increases sync time and SQLite image size.
- Expand the filter compiler so more `GraphQuery.filter` trees become exact
  `DocCondition`s. Unsupported filters still run correctly after the SQLite
  query, but they are not fast yet.
- Use the `edge` table for complex entry-reference projections where possible,
  instead of reading link ids from JSON field values.
- Define the selective remote tree contract: same filtered tree shape, stable
  content shas, and remote blob access only for authorized changed files.
- Persist and hydrate the SQLite database blob in the browser IndexedDB path,
  then replace the existing IndexedDB source cache with this DocDB snapshot.

## Implemented Since The First Pass

- SQL-backed `parents`, `siblings`, `next`, and `previous` resolver edges.
- Locale `translations` by shared entry id.
- Field `queryValue` post-processing through a DocDB-backed link resolver.
- Conservative filter pushdown from simple `GraphQuery.filter` shapes to
  `DocCondition`.
- Materialized effective status, `active`, and `main` fields in DocDB rows.
- Safe pagination pushdown for SQL-exact query shapes.
- Config-derived top-level schema field expression indexes.
- Prepared JSON equality lookups for common point queries.
- Scalar field projection fast path that skips link resolver setup.
- Hydration of an `EntryDocIndex` tree from persisted DocDB rows.
- A benchmark script at `src/core/db/EntryDocBench.ts`.

## Benchmark Snapshot

Command:

```sh
bun src/core/db/EntryDocBench.ts 3000
```

Dataset:

- 3000 synthetic entries
- 4.44 MB source JSON
- 18.16 MB serialized SQLite image

One-time costs:

- current `LocalDB` sync: 93.66 ms
- EntryDoc sync into SQLite: 426.87 ms
- EntryDoc serialize SQLite: 2.10 ms
- EntryDoc hydrate SQLite image: 34.14 ms

Query cost per operation:

| Query             |  Current | EntryDoc | Ratio |
| ----------------- | -------: | -------: | ----: |
| id first + title  |  43.9 us |  1.96 ms | 0.02x |
| children edge ids | 279.0 us |  2.42 ms | 0.12x |
| filter category   | 414.5 us |  1.77 ms | 0.23x |
| search take 100   |  1.78 ms |  2.03 ms | 0.88x |
| referencesTo      |   1.5 us |  13.6 us | 0.11x |

This means the current EntryDoc resolver is benchmarkable but not yet
competitive for point and child-edge reads. Search is now close to the current
implementation on this dataset, and field filtering improved materially once
schema fields received expression indexes. The remaining gap is mostly
per-query resolver/projection overhead and the fact that current keeps
CMS-shaped object links ready in memory.

## Next Steps

1. Replace `LocalDB` construction with this resolver behind an option or branch
   point so real dashboard/query flows can exercise it.
2. Profile point lookup and child edge queries with `EXPLAIN QUERY PLAN` plus
   resolver timing so we know how much is SQLite and how much is projection.
3. Make status materialization incremental for changed subtrees.
4. Add an index policy so projects can choose which schema fields receive
   expression indexes.
5. Add complex edge projections for entry reference fields using the `edge`
   table rather than JSON field reads where possible.
6. Build the IndexedDB persisted DocDB snapshot path and sync it from a filtered
   remote tree.
7. Measure common preview and dashboard queries with `EXPLAIN QUERY PLAN` and
   add missing expression indexes deliberately.
