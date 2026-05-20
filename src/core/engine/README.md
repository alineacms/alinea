# Entry engine

This directory now treats the RXB entry artifact as the production direction for
Alinea's high-performance entry reads.

The previous in-memory engine work is no longer the target architecture. Keep it
only where it helps build snapshots, prove parity, or provide temporary fallback
coverage while the RXB path matures. New production work should move toward a
small deploy artifact, a direct RXB planner, and a minimal query runtime.

## Decision

RXB is the engine boundary.

- Build time creates an `EntrySnapshot`, turns it into an `RxbEntryArtifact`, and
  encodes it with `@creationix/rx`.
- Runtime opens that RXB buffer with `openRxbEntryEngine` and answers supported
  entry queries directly from RXB-backed rows and indexes.
- `EntryIndex`, `EntryResolver`, `MemoryEntryEngine`, packed snapshots, and
  graph-shaped compatibility helpers are transitional support code. They should
  not grow into a second production engine.

The goal is not to port every old resolver behavior into a new abstraction. The
goal is to make the common deploy/runtime read path fast, predictable, compact,
and easy to simplify once it is wired in.

## Scope

The production RXB layer owns:

- A versioned artifact format: `RxbEntryArtifact`.
- Artifact creation from `EntrySnapshot`: `createRxbEntryArtifact`.
- Artifact encoding/opening: `encodeRxbEntryArtifact`, `decodeRxbEntryArtifact`,
  and `openRxbEntryEngine`.
- Direct candidate planning over RXB indexes: `RxbEntryPlanner`.
- Direct query execution over row ids and materialized rows: `RxbEntryEngine`.
- Byte-array local database state: `RxbEntryDB`.
- Conservative query traces for future invalidation.

The RXB layer should not own React views, dashboard behavior, source-specific
I/O, role construction, upload preview generation, arbitrary field callbacks, or
editor mutation semantics unless a production read path requires them.

## Current State

Already in place:

- RXB artifacts include manifest, flat tree metadata, rows, core row indexes,
  exact field indexes, and numeric field indexes.
- The planner uses core constraints plus exact, nested, list, and numeric field
  filters to reduce candidate row ids.
- The engine supports direct projection of entry fields, ordering/grouping for
  supported entry fields, counts, first/get/list modes, preferred status and
  locale constraints, and post-filter fallback for unsupported filter pieces.
- Query tracing records graph sha, row ids, node ids, and index keys.
- Focused RXB tests cover artifact opening, planner indexes, trace stability,
  direct projection, and post-filter fallback.
- `RxbEntryDB` opens an RXB `Uint8Array`, resolves supported graph queries,
  applies local optimistic mutations, rolls back checkpoints, syncs from
  `RemoteSource`, and exports updated bytes.

Known gaps:

- RXB is not wired as the deploy/runtime default read engine.
- Snapshot export and change application on `RxbEntryEngine` are intentionally
  unimplemented.
- Unsupported query features still need a deliberate fallback or rejection
  policy at the integration boundary.
- Artifact size and open/query benchmarks need tracked budgets before shipping.
- Some old engine modules still imply a broader memory-engine direction.

## Minimal Production Plan

1. Lock the target contract.
   Define the small public surface the app needs for deploy/runtime reads:
   `openRxbEntryEngine(buffer)`, `query(plan, options)`, `graphSha`, and trace
   output. Avoid adding mutable engine APIs to the RXB path.

2. Wire the build artifact.
   Add the build step that creates an `EntrySnapshot`, converts it with
   `createRxbEntryArtifact`, encodes it, and emits the RXB buffer next to the
   deployed data. Keep JSON snapshot output only as a debug/fallback artifact.

3. Wire the runtime read path.
   Load the RXB buffer in deployed/runtime reads and route supported entry
   queries through `RxbEntryEngine`. Keep the current resolver as a temporary
   fallback for unsupported query shapes until the allowlist is complete.

4. Make query support explicit.
   Convert supported public query shapes into RXB constraints and projections:
   id, type, workspace, root, locale, status, parent, path, url, level, order,
   group, count, get/first/list, and indexed field filters. Unsupported edges,
   includes, search, location, preview, live-scope projections, and arbitrary
   callbacks should fail clearly or use the fallback path.

5. Put budgets on speed and size.
   Track artifact encode size, open time, id lookup, count-by-type, indexed
   field filter, range filter, nested/list filter, and projection query timings
   in `EntryIndex.bench.ts`. Use those numbers as regression gates before
   changing the artifact shape.

6. Remove competing engine growth.
   Stop expanding `MemoryEntryEngine` and the broad snapshot engine beyond test
   parity and artifact construction. Delete or demote roadmap items that add
   mutable snapshot maintenance, broad transaction planning, or graph-style
   resolver internals unless they directly unblock RXB production reads.

7. Ship behind one switch.
   Add one feature flag or adapter switch for the RXB runtime path. The switch
   should make it easy to compare old resolver behavior with RXB behavior in
   tests and local deploys, then flip the default once parity and budgets hold.

## Implementation Rules

- Prefer direct RXB row/index access over hydrating full object graphs.
- Keep row ids as the common currency between planner, trace, and projection.
- Add indexes only for query shapes that are actually routed to RXB.
- Let unsupported behavior be visible. Silent partial support is worse than a
  controlled fallback.
- Keep caches small and local to the RXB planner/engine.
- Treat mutation support as out of scope for the production RXB read engine.
- Preserve broad parity tests, but add focused RXB tests for each supported query
  shape before routing that shape through the production path.

## Useful Commands

```sh
bun test src/core/engine/RxbEntryArtifactSource.test.ts
bun test src/core/engine/RxbEntryEngine.test.ts
bun test src/core/engine/EntryCompatibility.test.ts
bun run test:engine-src
```

Use `EntryIndex.bench.ts` when evaluating artifact size, open cost, and query
speed. Benchmark changes should be read as RXB production-read regressions first,
not as progress on the older in-memory engine.
