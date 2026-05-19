# Entry engine

This directory contains the internal contracts for Alinea's future high-performance entry engine. The engine is intentionally scoped to data, indexing, query planning, snapshot import/export, and mutation planning. It does not own React views, dashboard behavior, source-specific I/O, role construction, upload preview generation, or arbitrary field callbacks.

The current `EntryIndex`, `EntryResolver`, and `EntryTransaction` APIs remain the compatibility layer. Follow-up work can route those classes through this engine once parity tests prove identical behavior.

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
