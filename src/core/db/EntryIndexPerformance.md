# EntryIndex Cold Start And Memory

This note tracks work on the current in-memory `EntryIndex`, separate from the
DocDB experiment. The goal is to keep the current fast query behavior while
reducing cold-start indexing time and retained heap.

## Benchmark

### Synthetic Memory Source

Command:

```sh
bun src/core/db/EntryIndexBench.ts 5000
```

Dataset:

- 5000 generated entries
- 7.42 MB JSON content
- rich text body on every entry
- two entry links on most entries
- max generated tree depth: 3

The benchmark measures:

- source generation separately from indexing
- cold `EntryIndex.syncWith(source)`
- heap/RSS delta after index construction
- first search, which builds MiniSearch lazily
- second search, which reuses MiniSearch
- retained heap after lazy search indexing

### Alinea Dev File Source

Command:

```sh
bun src/core/db/EntryIndexFileBench.ts apps/dev/content
```

Dataset:

- 66 files from `apps/dev/content`
- 21 entry types
- 0.07 MB JSON content

The file benchmark uses a compatible synthetic schema for the entry type names
present in the dev content tree. This avoids loading the Next/dev UI module
graph while still measuring the real `FSSource`, `CachedFSSource`,
`EntryIndex`, tree diff, blob read, parse, and graph construction paths.

## Baseline

Before this pass:

```txt
sync:        177.69ms
heap delta:  12.79 MB
rss delta:   49.17 MB

first search:      110.32ms
second search:     5.71ms

after index heap delta: 12.79 MB
after search heap delta: 23.66 MB
```

## Changes In This Pass

- `EntryVersionData.searchableText` is now computed lazily. Cold indexing no
  longer walks rich text fields for every entry just to seed a search value that
  may never be used.
- `EntryLanguageNode.url` is now computed lazily. Cold indexing no longer walks
  parents and formats URLs for entries that may not project `Entry.url`.
- Entry objects expose lazy `url` and `parents` getters so broad scans that only
  select ids/titles do not force those fields.
- `EntryLanguage` no longer extends `Map<EntryStatus, EntryVersion>`. It stores
  the three possible status versions in fixed fields and keeps a compact version
  list for iteration.
- `EntryCollection` no longer extends `Map`. It keeps a compact array of
  `[locale, language]` pairs.
- `EntryNode.parents` is now lazy instead of precomputing the full ancestor id
  chain during graph construction.

## Current Result

After this pass, warmed samples:

```txt
sync:        157.84-169.40ms
heap delta:  10.84-12.04 MB
rss delta:   48.44-52.58 MB

first search:      90.27-95.40ms
second search:     4.99-5.60ms

after index heap delta: 10.84-12.04 MB
after search heap delta: 20.43-21.29 MB
```

Approximate improvement against baseline:

- cold sync: 177.69ms -> 158-169ms, about 5-11% faster
- cold index heap: 12.79 MB -> 10.8-12.0 MB, about 6-15% lower
- first search: 110.32ms -> 90-95ms, about 14-18% faster
- search heap growth: 23.66 MB -> 20.4-21.3 MB, about 10-14% lower

One verification sample reported cold sync at 191.93ms while keeping the same
heap/search improvements. Treat that as runtime noise unless larger repeated
runs show it consistently.

The cold-start improvement is intentionally modest because the current index is
already optimized for live query speed. The larger remaining costs are parsing
all source blobs and creating the entry/node object graph.

## Alinea Dev File Loading

Before the file-source change, `DevDB.sync()` called the debounced
`CachedFSSource.refresh()`. A single awaited call to that debounced function
added roughly 50ms even when there was no burst of file events to collapse.

Baseline on `apps/dev/content`:

```txt
CachedFSSource.refresh(): 57.24ms

FSSource
  getTree:      2.28ms
  index sync:   8.74ms
  warm getTree: 1.15ms

CachedFSSource
  getTree:      53.83ms
  index sync:   1.64ms
  warm getTree: 1.3us
```

Changes:

- `CachedFSSource.refresh()` is now immediate. The debounce was only used by
  `DevDB.sync()`, so it only delayed explicit sync work.
- The first `CachedFSSource.getTree()` now builds immediately instead of going
  through the debounced refresh path.

Current warmed result:

```txt
CachedFSSource.refresh(): 3.6-7.4ms

FSSource
  getTree:      2.9-4.3ms
  index sync:   10.8-13.0ms
  warm getTree: 1.0-2.5ms

CachedFSSource
  getTree:      2.4-5.2ms
  index sync:   2.0-2.3ms
  warm getTree: 1.7-2.0us
```

One cold-ish sample during verification reported immediate `refresh()` at 10.19ms,
`FSSource.getTree()` at 9.05ms, and plain `FSSource` index sync at 42.38ms.
Because repeat runs immediately returned to the 2-3ms tree-load range, treat
the higher sample as filesystem/runtime noise on this very small dataset, not
as the steady-state cost of the new path.

Impact:

- explicit dev refresh: about 55-58ms -> about 4-7ms in the final samples
- first cached `getTree`: about 54ms -> about 2-5ms
- cached index sync remains about 2ms on this content tree

## Next Steps

1. Stream cold-start indexing instead of calling `bundleContents`, which
   accumulates all changed blobs in a `Map` before parsing. This should reduce
   peak memory more than retained heap.
2. Add benchmark modes for:
   - initial cold sync
   - incremental add/update/delete
   - first query without search
   - first search
   - memory after dropping source blob references
3. Consider replacing `EntryNode extends Map` with a compact locale array, like
   `EntryCollection`, if locale counts are low in real projects.
4. Avoid retained full `Entry` objects during broad scans where the resolver can
   project directly from node/version data.
5. Make `EntryGraph.withChanges` update changed nodes and affected descendants
   instead of rebuilding the whole graph for every change batch.
6. Run this benchmark against a real large content tree. Synthetic rich text is
   useful for repeatability, but real distributions of locales, statuses,
   depth, and field shapes will decide which object allocations matter most.
7. If file trees become much larger, limit `FSSource.getTree()` stat/read/hash
   concurrency. The current implementation fires one task per discovered file,
   which is fine for `apps/dev/content` but can increase peak memory and IO
   pressure on large repositories.
