# Sync and index benchmarks: graft backend

Before and after the `graft-sync-perf` branch: commit-keyed index on the
graft store, content apart from the index, move-aware derive, and the
dashboard syncing with packs.

- Machine: Apple M4, 32 GB, macOS (Darwin 27.2), Bun 1.4.4, Chromium from
  Playwright, nothing else running. Everything on localhost, no bandwidth
  limit, no request overhead.
- Before: `acb9d09d9` (`graft-integration` at `6bee16f98` plus the bench
  fix below), run with the benchmark files of this branch copied in, so the
  new phases (moves, bytes, `--graft`, cold handler) are measured on the old
  code too.
- After: `24d01b439` (the code of this branch; later commits only touch
  benchmarks and notes).
- Raw output: `test/bench/results/{baseline,before,after}`. `baseline` is
  the original benchmark at `acb9d09d9`, before its new phases.
- The generated site: 20,000 files (19,836 blobs, 120 MB of JSON), a
  multilingual site with pages nested five deep, articles, people and a
  media library.

```sh
bun test/bench/initial-sync.ts                       # Bun, old backend
bun test/bench/initial-sync.ts 20000 --graft         # Bun, graft store
bun test/bench/initial-sync.ts 20000 --browser       # Chromium worker
bun test/bench/initial-sync.ts 20000 --browser --graft
bun test/bench/move.ts                               # move, in memory
bun test/bench/fragmentation.ts
bun test/bench/explorer-overview.ts
```

Timings vary by 10 to 30% between runs on this machine (the explorer page
load measured 149 to 202 ms on the same old code), so differences below
that are noise. Where two runs were made both are in the raw output.

## The bench fix

On both `graft-integration` and `main`, the end-to-end and browser phases
of `initial-sync.ts` synced nothing ("0 entries indexed"): the handler asks
its remote whether a client is current before it syncs (6481d27de), and the
benchmark's remote answered `undefined`, "current", for every tree. Its
remote now serves the generated site. Fixed in `acb9d09d9`, before any
other change; `test/bench/results/baseline` was taken right after it.

## Bytes per sync (the dashboard's store, graft backend)

What the handler sent, as is and gzipped as a host would. Before, a sync is
a Tree request (the whole tree as JSON, 2.2 MB at 20,000 files) plus a Blob
request; after, one `?action=sync&have=` request answered with a thin pack.

| sync | before | before, gzipped | after | after, gzipped |
| --- | ---: | ---: | ---: | ---: |
| current | 4 B | 24 B | 0 B (304) | 0 B |
| 1 edit | 2.2 MB | 591 KB | 269 B | 292 B |
| 100 changes | 2.6 MB | 615 KB | 17 KB | 15 KB |
| 1,000 changes | 6.4 MB | 820 KB | 118 KB | 99 KB |
| move of a page with 799 descendants, 4 locales (2,795 files) | 16.5 MB | 1.4 MB | 973 B | 945 B |
| first sync (empty store) | 85.1 MB | 4.7 MB | 122.8 MB | 5.4 MB |

The first sync is larger after: the Blob action of a graft backend now
serves blobs exactly as saved (indented JSON) instead of the index's
minified data, which the dashboard needs to keep them as git objects.

## Dashboard store in Bun (`initial-sync.ts`, "dashboard store, end to end")

`BrowserEntryStore` on memory snapshots, ms. Two runs each (run 1 / run 2).

| sync | old backend before | old backend after | graft before | graft after |
| --- | ---: | ---: | ---: | ---: |
| first sync | 2609 / 2151 | 2502 / 1911 | 2436 / 1790 | 2663 / 1971 |
| 1 edit | 41 / 49 | 102 / 42 | 69 / 53 | 11 / 19 |
| 100 changes | 80 / 72 | 102 / 70 | 90 / 76 | 170 / 94 |
| 1,000 changes | 258 / 257 | 379 / 293 | 364 / 234 | 485 / 451 |
| move, 2,795 files | 661 / 498 | 259 / 282 | 709 / 425 | 221 / 153 |
| cold handler: open the build's index, catch up with 1,101 changes and the move | 1844 / 1597 | 1772 / 1542 | 2493 / 1353 | 1749 / 1523 |

## Dashboard store in Chromium (`--browser`), ms

Snapshots in IndexedDB, in a worker, as the dashboard runs it.

| step | old backend before | old backend after | graft before | graft after |
| --- | ---: | ---: | ---: | ---: |
| first sync: tree, blobs, index | 4102 | 3710 | 4052 | 4032 |
| 1 edit | 97 | 92 | 135 | 37 |
| 100 changes | 454 | 397 | 403 | 359 |
| 1,000 changes | 907 | 921 | 963 | 1169 |
| move, 2,795 files | 890 | 404 | 980 | 271 |
| blobs fetched by the move | 2795 | 4 | 2795 | 0 |
| another config: open (reindex) + first sync | 37 + 4134 (refetch) | 5415 + 8 | 35 + 4219 (refetch) | 5705 + 4 |

Peak Wasm heap is unchanged: 300 MB for the first sync, 184 to 189 MB for
the incremental syncs.

"Another config": before, both runs started that store over from an empty
database and fetched every blob again, as the bases had been rewritten past
`rewriteLimit` by the extra move step; the original benchmark at the
baseline, without the move, reindexed in 4898 ms. After, the stores
reindex from what they hold, without a request. Graft after reads the
blobs from its IndexedDB objects instead of the index's payloads.

## Move of a directory (`move.ts`, in memory, no network)

| move | before | after | blobs read before | after |
| --- | ---: | ---: | ---: | ---: |
| a page with 799 descendants, 4 locales (2,795 files) | 579 ms | 241 ms | 2795 | 4 |
| a page with 1,596 descendants (5,467 files) | 1106 ms | 463 ms | 5467 | 4 |
| a page with 2,290 descendants (7,727 files) | 1549 ms | 700 ms | 7727 | 4 |

The 4 blobs are the moved page's own file in each locale. The versions
below it get their paths in one statement and their urls derived again.

## Other benchmarks

| benchmark | before | after |
| --- | ---: | ---: |
| index from memory, 20,000 files (`initial-sync.ts`) | 2804 ms | 2526 ms |
| `fragmentation.ts`: sync of 20,000 files | 2403 ms | 1881 ms |
| `fragmentation.ts`: leaves in order (synced / compacted) | 82% / 100% | 82% / 100% |
| `explorer-overview.ts`: page load, medians of 3 runs | 181, 149, 160 ms | 267, 222, 193 ms |
| `explorer-overview.ts`: sort change and back | 389, 342, 331 ms | 432, 327, 341 ms |

The explorer page load does not touch sync code. Later runs interleaved on
the same machine measured 200 and 203 ms on the old code, 210 and 218 ms at
the first commit of this branch, and 221 and 238 ms after: perhaps 10%
slower, within the noise of these runs; worth a closer look.

## What changed

- **Commit-keyed index** (`EntryDatabase`, `EntrySyncer`, `CompareTrees`):
  a source that keeps content as git objects (`getHead`, the graft
  backend) is synced by comparing the indexed content tree with the head
  by sha, reading only directories whose sha changed, and blobs from the
  objects. The index records the content tree it is at (its revision) and
  no tree JSON. The key is the content tree rather than the commit: it is
  what the index derives from, saves already name their base by it, and two
  commits with the same content share an index.
- **Content apart from the index**: on the server the graft store holds the
  content and the index reads trees and blobs from it (Tree, Blob, reindex,
  mutations). In the browser, `IndexedDBObjects` keeps git objects next to
  the SQLite snapshots, one record per sync.
- **Move-aware derive** (`Ingest`, `Derive`): a directory removed in one
  place and added in another with the same sha is relocated. Both sync
  paths have it, so old backends and the dashboard's own mutations gain too.
- **One-request sync** (`?action=sync&have=`, `ContentPack`, `Client`,
  `BrowserEntryStore`): 304, or a thin pack of the changed trees and blobs,
  deltas of the client's versions. The first sync of a store goes through
  Tree and Blob as before (see "slower" below) and keeps what it fetched.

## What got slower

- **Syncs of 100 to 1,000 changes on graft** (Chromium 963 to 1169 ms for
  1,000; Bun 234 to 451 ms in the second run). Writing the pack costs the
  server about 300 ms for 1,861 objects: graft's `writePack` only uses the
  delta hints with `window >= 1`, which also tries a neighbour per object
  (GRAFT-NEEDS.md 1). On a real network the 8x smaller transfer (99 KB
  against 820 KB gzipped) pays some of it back. Small edits, the common
  case, are 2 to 5 times faster.
- **Reindex for another config in the browser** reads the blobs from
  IndexedDB rather than the index's payloads: 5.4 to 5.7 s, against 4.9 s
  at the baseline, but no longer depending on a base that was not rewritten
  too much, and without fetching.
- **First sync on graft** sends 122.8 MB (5.4 MB gzipped) instead of 85.1
  MB (4.7 MB): exact blobs rather than the index's minified data. A full
  pack would be worse without deltas (13.3 MB, 1 s to write and 1.8 s to
  read), which is why the first sync does not use one.

## A prebuilt index per content tree (not done)

The index is deterministic for a content tree plus a config fingerprint and
`databaseVersion`. Half of this exists: the build already emits the SQLite
file (`.alinea/database-v9.sqlite`, `GeneratedPaths`, copied next to the
handler by `CopyStaticFiles`), a cold serverless instance opens it
(`createGeneratedDatabase`) and, on graft, now catches up by comparing the
build's content tree with the head in the store (1.5 s for 1,101 changes
and a move above). What a first dashboard load would need:

1. Serve the build's index to signed-in users only: it holds drafts and
   archived entries, so it cannot be a public static file. A handler action
   (`?action=index`) streaming the generated file, with an ETag of
   `<content tree>-<fingerprint>-v<databaseVersion>` and
   `cache-control: private, immutable`. The handler's own copy is written
   to by its syncs (the bench found the file changed), so the build must
   keep a pristine copy to serve.
2. Make the file a browser base: built with the browser's `page_size`
   (16384) and the JSONB the browser's SQLite reads, then opened with
   `Database.load(bytes)` from `@alinea/sqlite-wasm` and saved through
   `storage.session` as the first base of the fingerprint's branch, in
   `BrowserEntryStore.open` when there is no base yet.
3. The objects for it: a pack of the build's content tree, so the next sync
   can be `have=<build tree>`. With deltas it is 3.3 MB at 20,000 files,
   but graft takes 17.8 s to write it (GRAFT-NEEDS.md 2); without, 13.3 MB
   and 1.8 s to read. Until then the browser would fetch the blobs it keeps
   through the Blob action (4.7 to 5.4 MB gzipped), which costs what the
   first sync costs today minus the indexing (about 2.5 of its 4 s).
4. The fingerprint the dashboard computes must match the build's
   (`DashboardWorker` names it), and a dashboard build of another config
   must ignore the file and reindex.

## Local development from `.git` (not done)

Local dev already checks only changed files on a warm start: the dev
database records each file's mtime and size (`alinea_source_file`,
`CachedFSSource`). Taking the committed tree from `.git` through
`@alinea/graft/fs` would only help a cold start if the stat data in git's
index told which working-tree files changed since `HEAD`, and graft does
not parse `.git/index` (GRAFT-NEEDS.md 4). Without it every file must still
be read and hashed, which a cold start does anyway to index them.

## The dev dashboard syncs with packs

`alinea dev` answers `?action=sync&have=` too (`src/cli/serve/DevPacks.ts`):
it keeps every content tree it served as git trees in memory and reads
blobs from disk, so an edit on disk reaches the dashboard as a thin pack of
the changed file and the directories above it. As on the graft backend the
dashboard's first sync still goes through Tree and Blob, until graft writes
a full pack with deltas fast enough (GRAFT-NEEDS.md 2). After a restart of
the dev server, a dashboard's tree is no base, so its next pack holds all.

Measured on `apps/dev` (61 records), the dashboard in headless Chromium
behind a logging proxy:

| sync | Tree and Blob | pack |
| --- | ---: | ---: |
| first load | 9.8 KB tree + 84.9 KB blobs | (Tree and Blob) |
| one entry edited on disk | 9.8 KB tree + the blob | 282 B |
| reload, nothing changed | tree request | 304, 0 B |

## With graft `31d51ac`

graft now writes packs since a tree with deltas of the client's versions
only (`packSince`, `window: 0`), and alinea uses it for `?action=sync&have=`.
Raw output: `test/bench/results/graft-31d51ac`. Same machine, single runs.

| graft backend | before | after (graft `7de650f`) | graft `31d51ac` |
| --- | ---: | ---: | ---: |
| Bun, sync 1 change | 69 ms | 11–19 ms | 26 ms |
| Bun, sync 100 changes | 90 ms | 94–170 ms | 206 ms |
| Bun, sync 1,000 changes | 364 ms | 451–485 ms | 483 ms |
| Bun, move of 2,795 files | 709 ms | 153–221 ms | 271 ms |
| Bun, cold handler catching up | 2493 ms | 1523–1749 ms | 2322 ms |
| Chromium, sync 1 change | 135 ms | 37 ms | 57 ms |
| Chromium, sync 100 changes | 403 ms | 359 ms | 486 ms |
| Chromium, sync 1,000 changes | 963 ms | 1169 ms | 1203 ms |
| Chromium, move of 2,795 files | 980 ms | 271 ms | 387 ms |
| bytes, 100 changes (gzipped) | 615 KB | 15 KB | 17 KB |
| bytes, 1,000 changes (gzipped) | 820 KB | 99 KB | 119 KB |

End to end these are within the run-to-run noise of this machine, or
slower, so the update does not by itself win back the syncs of 100 to
1,000 changes. Writing the pack is not where that time goes any more: timed
alone, on a store of 20,000 files of about 6 KB,

| pack since a tree | `window: 0` | default window |
| --- | ---: | ---: |
| 100 changes | 23 ms, 15 KB | 20 ms, 15 KB |
| 1,000 changes | 73 ms, 81 KB | 119 ms, 81 KB |

against about 300 ms before for the bench's 1,000 changes. What is left is
the client's index: a sync of 1,000 changes in Chromium reads 513 MB of
pages from the snapshots in IndexedDB. Packs with `window: 0` are a little
larger, as files a sync adds are no longer deltas of their neighbours.

A full pack of the same store took 5.2 s (2.5 MB); graft reports about 2 s
on the bench's site. The first dashboard load still syncs through Tree and
Blob.

A cold `alinea dev` takes the shas git's index stages for files whose stat
matches (`src/cli/generate/StagedFiles.ts`). Building the content tree of
20,000 files of 6 KB:

| cold start | hash every file | from git's index |
| --- | ---: | ---: |
| run 1 | 542 ms | 127 ms (index read 23 ms) |
| run 2 | 407 ms | 105 ms (index read 19 ms) |

The trees were identical in both runs.
