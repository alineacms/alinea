# Entry engine

This directory contains the internal contracts for Alinea's future high-performance entry engine. The engine is intentionally scoped to data, indexing, query planning, snapshot import/export, and mutation planning. It does not own React views, dashboard behavior, source-specific I/O, role construction, upload preview generation, or arbitrary field callbacks.

`EntryIndex`, `EntryResolver`, and `EntryTransaction` now live in this directory as engine-owned implementations. They may keep temporary compatibility-shaped helpers while the public graph API is still backed by the engine, but the internal contract is free to move toward snapshot rows, indexes, and compiled plans.

## Goals

- Keep code style consistent with the existing core modules.
- Keep engine modules self-contained and avoid requiring live config callbacks for deploy/runtime reads.
- Preserve the public resolver API while internal compatibility layers evolve.
- Prioritize query and indexing performance before broad feature coverage.
- Support writing snapshots into compact, minimal representations that can be bundled with deploys.

## Snapshot boundary

Generated deploys should eventually hydrate an `EntrySnapshot` instead of rebuilding the full graph from JSON blobs. The snapshot stores a serializable manifest, flat source tree metadata, normalized rows, lookup indexes, and optional search data.

Live JavaScript behavior stays outside the snapshot. The build/wrapper layer precomputes values such as URLs and searchable text, and supplies shared-field metadata through the manifest.

`CompactEntrySnapshot` is the deploy-oriented wire shape. It stores normalized rows as positional tuples and omits derived indexes; hydration expands the rows and rebuilds indexes in memory.

## Query tracing

Engine queries can optionally collect a `QueryTrace`. A trace records the graph sha, row/version ids, node ids, and index keys read while composing a result. Traces should be conservative: false positives are acceptable, but missed invalidations are not.

Future live-query support can compare traces with changed rows, changed hierarchy nodes, and touched index keys to decide which queries must rerun.

## Candidate planning

`SnapshotEntryPlanner` is the first concrete planner. It consumes explicit engine constraints and snapshot indexes to reduce candidate row ids before resolver compatibility code applies field predicates, sorting, grouping, projection, and link post-processing.

`compileEntryQueryConstraints` handles the self-contained subset of public `GraphQuery` that maps directly to snapshot indexes. Unsupported query features are rejected in the baseline memory engine instead of being silently ignored.

## Current Performance

Latest local benchmark settings: 10,000 rows, 1,000 query runs, 5 samples.

- Fresh `syncWith`: baseline ~247 ms, engine ~18 ms, about 14x faster.
- Fresh `syncWith + snapshot`: baseline ~247 ms, engine ~41 ms, about 6x faster.
- Native `syncWith`: baseline ~247 ms, engine ~17 ms, about 15x faster.
- Native `syncWith + snapshot`: baseline ~247 ms, engine ~36 ms, about 7x faster.
- One-row `indexChanges`: baseline ~40 ms, engine ~21 ms, about 1.9x faster.
- One-row `indexChanges + snapshot`: baseline ~40 ms, engine ~21-23 ms, about 1.8-1.9x faster.
- Planner id lookup x1000: scan baseline ~606 ms, engine planner ~0.18 ms, thousands of times faster.
- Planner type lookup x1000: scan baseline ~810 ms, engine planner ~0.13 ms, thousands of times faster.
- Resolver id query x1000: baseline ~121 ms, engine ~0.82 ms, about 147x faster.
- Resolver count-by-type x1000: baseline ~837 ms, engine ~0.48 ms, about 1,743x faster.
- Compact snapshot write: ~0.4 ms. Expand compact snapshot: ~9 ms. Hydrate memory engine: ~11 ms.

The clear remaining performance gap is broader incremental snapshot/index maintenance and source-tree update cost. Same-shape content updates now patch the current snapshot without rebuilding all rows, and tree compilation reuses unchanged previous subtrees, but structural changes still rebuild the full snapshot.

## Implementation Roadmap

Keep these goals in mind while completing the engine:

- Prefer small self-contained engine modules over copied baseline classes.
- Keep resolver public API compatibility, but do not preserve old internal contracts between resolver, transaction, and index.
- Make snapshot/index lookups the main path for reads and mutation planning.
- Remove graph-style compatibility helpers from internal engine use once native helpers cover the same behavior.
- Keep parity tests broad enough to cover the behavior being replaced.

Next steps, in priority order:

1. Done: replace copied resolver predicate code with a small compiled filter module. `EntryFilter` now compiles public filter objects to field accessors and predicate closures without `cito` validators or the baseline `createConditions` block.
2. Next: expand query compilation so status, locale, id, type, parent, path, url, level, workspace/root, order, group, projection, and supported filters share one native planning path.
3. Next: replace transaction scans with native index/snapshot lookups for by-id, parent, locale, status, children, siblings, and path-conflict checks.
4. In progress: add incremental snapshot/index maintenance for small changes instead of rebuilding all rows and indexes after every mutation. Same-file, same-shape replacements are covered; creates, deletes, moves, path/status changes, and inherited-status cascades still rebuild.
5. Next: split resolver behavior into focused engine modules: query normalization, candidate planning, post-filtering, projection, ordering/grouping, edge traversal, and link post-processing.
6. Next: remove transitional `filter`, `findFirst`, `findMany`, and graph-like usage from resolver/transaction internals after native helpers cover those call sites.
