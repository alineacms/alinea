# What alinea needs from graft

Found while making alinea's index and dashboard sync on the graft backend
faster (branch `graft-sync-perf`, against the vendored graft `7de650f`, and
still true of graft `main` at `9d776de`). Each need has an example that
fails or is slow today, and what alinea does meanwhile. Numbers are from an
Apple M4, Bun 1.4.4, Chromium from Playwright, on the generated site of
`test/bench/initial-sync.ts` (20,000 files, 120 MB of JSON).

## 1. Deltas against the receiver's version only (`writePack` with `window: 0`)

`writePack` considers the `bases` hint only when `window > 0`
(`src/git/Pack.ts`, `deltable = window > 0 && ...`). A pack of edited files,
each a delta of the version the client has, also tries a neighbour of the
same type for every object, which almost never helps: the neighbours are
ordered by type and size, not by path.

```ts
import {blob, stored, writePack} from '@alinea/graft/git'

const before = await stored(blob(new TextEncoder().encode('{"title": "A", "body": "...6 KB..."}')))
const after = await stored(blob(new TextEncoder().encode('{"title": "B", "body": "...6 KB..."}')))
const pack = await writePack([after], {bases: new Map([[after.sha, before]]), window: 0})
// Expected: one REF_DELTA entry of a few dozen bytes
// Actual: `after` stored whole, as window 0 turns every delta off
```

A sync of 1,000 edits (1,861 changed trees and blobs) writes in 317 ms with
`window: 1`, 109 ms with `window: 0`, but the latter is 1.1 MB instead of
122 KB. alinea uses `window: 1` for thin packs (`src/backend/api/ContentPack.ts`).
Wanted: hints tried with any window, or `window: 0` meaning "hints only".

## 2. A full pack with deltas, fast enough for a build

A pack of all 20,000 blobs takes 1.05 s and 13.3 MB with `window: 0`, and
17.8 s and 3.3 MB with `window: 10` (`readPack` of it: 1.8 s and 0.9 s).
The prebuilt pack of point 3 of the plan (a static, cacheable pack of the
content at a commit, for a first dashboard load) wants the 3.3 MB at build
time, where 18 s per 20,000 files is too slow, and gzip of the plain
concatenated JSON already gets 4.7 MB.

```ts
const objects = files.map(file => blob(file.contents)) // 20,000 entry files
await writePack(objects, {window: 10}) // 17.8 s
```

Wanted: candidates ordered by path (git's name hash: files of one directory
or one name in other locales are near each other) instead of by size only,
and a faster `createDelta` (an index of the base, as git's `diff-delta`, is
built once per base rather than once per pair).

## 3. A pack of what a content tree lacks, as an engine function

The design's `GET /sync?have=` (decision 7) needs "the objects head holds
that have does not". `gitServer` computes that for upload-pack (`collect`
in `src/git/Server.ts`, with thin bases paired by path), but works on
commits and is not exported. `diffTrees` returns changed files only: not
the trees it read, not the directories that moved whole, so it cannot
build that pack, nor let an index skip a moved directory.

```ts
import {diffTrees} from '@alinea/graft'

// pages/a moved to pages/b/a with 800 files below it
await diffTrees(store, before, after)
// Actual: 800 removals and 800 additions, and the moved trees read
// Wanted: {files, trees read, moves: [{from: 'pages/a', to: 'pages/b/a', sha}]}
```

alinea has its own level-by-level comparison for this
(`src/core/source/CompareTrees.ts`: changed files, moved directories, the
trees of the new side it read, the previous sha of each object changed in
place, the shas the old side lists) and builds the pack from it
(`src/backend/api/ContentPack.ts`). Wanted: `diffTrees` with moves and the
trees it read, and `packSince(store, haveTree, headTree, options)` returning
a thin pack, so the cloud and alinea run the same code.

## 4. Reading git's index for local development

Local development indexes the content directory of a working tree. The
committed content is in `.git`, which `@alinea/graft/fs` reads
(`gitRepository`), but which working-tree files changed since `HEAD` can
only be known by hashing every file: graft does not parse `.git/index`.

```ts
import {gitRepository} from '@alinea/graft/fs'

const repo = gitRepository('.') // reads objects and refs, never the index
// Wanted: the staged entries with the stat data git compares
await repo.index() // Property 'index' does not exist on type GitRepository
// -> Map<path, {sha, mode, size, mtimeMs, ctimeMs, ino, dev}>
```

With it a cold dev start (no `.alinea` database yet) would stat each file,
take the sha from the index for files whose stat matches, and hash only the
others, then reuse an index built for `HEAD`'s content tree and parse only
the changed files. Today alinea's dev database keeps its own stat cache
(`alinea_source_file`, `CachedFSSource`), so a warm start already hashes
only changed files; a cold start reads and hashes all of them. Index
versions 2 to 4 (with path prefix compression in 4), and the `split index`
and `untracked cache` extensions, would need handling or an explicit
refusal.

## 5. Observations that are not needs (yet)

- `readPack` inflates in JavaScript (the pack format needs to know where
  each zlib stream ends): 1.8 s for 13 MB with 20,000 objects in Bun. alinea
  avoids full packs on a first dashboard load for this reason, and syncs
  trees and blobs through its own endpoints, keeping them as objects.
- `sqlRepository` stores objects uncompressed, so the server's database
  holds the 120 MB of content once more beside alinea's index.
- Hashing in `readPack` is one `crypto.subtle.digest` per object, awaited
  in turn. That measured 8 µs per 6 KB object in a Chromium worker, so it is
  not where time goes.
