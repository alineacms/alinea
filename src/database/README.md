# Database architecture

This directory contains Alinea's database, query resolver, encrypted release
format, and replica synchronization code.

The branch implements the consolidated runtime read path described here. The
remaining migration work is confined to structural write fallbacks and the
development browser's legacy Source cache; those boundaries are called out in
the current implementation section.

## Goals

Opening a database must be cheap. A cold server should load only a compact JSON
index and must not parse, decrypt, normalize, or index all entry fields. Work on
the large payload corpus happens only when a query asks for it.

For a representative large project:

- the complete index is less than 2 MB of JSON;
- the entry fields are approximately 70 MB before JavaScript object overhead;
- there are approximately 11,000 entries;
- the current RSC path can take almost ten seconds to parse source data,
  normalize entries, and construct its in-memory graph.

The new read path must have these properties:

- cold boot is proportional to the JSON index and unapplied index changes, not
  to the payload corpus;
- generated data is already queryable and is never passed through
  `graph.withChanges` or another whole-database indexing step at runtime;
- a query loads only the content-derived frames needed for its conditions,
  ordering, grouping, search, references, and final projection;
- decoded data may remain in memory for the lifetime of a server process, so a
  naturally warmed server can eventually answer every query from memory;
- previews and mutations replace individual entries and never clone or rebuild
  the complete database;
- deployed data remains immutable while live changes are represented by small
  entry-level overlays;
- clients receive only the index rows and decode keys allowed by their effective
  policy;
- encryption protects the complete read-only representation of an entry. It is
  not performed independently for every field.

Simplicity is an explicit goal. The initial design uses JSON, linear scans over
the compact index, entry-level frames, and entry-level synchronization patches.
More elaborate binary formats and persistent secondary indexes should be added
only if measurements of the real read path require them.

## Logical artifacts

A deployed release consists of two logical artifacts:

1. a compact JSON-compatible index;
2. a byte-addressable payload bundle.

Live changes may add delta bundles, but they remain overlays of the same two
logical artifacts. Periodic deployment or compaction folds the overlays into a
new immutable base.

### JSON index

The index contains the structural and discovery-safe data needed to construct
query candidates without loading payloads. It also locates the independently
readable frames belonging to each entry.

A concrete schema will evolve with the implementation, but its responsibilities
are equivalent to:

```ts
interface DatabaseIndex {
  version: number
  revision: string
  sourceTree: Tree
  entries: ReadonlyArray<IndexEntry>
  children: Record<string, ReadonlyArray<string>>
}

interface IndexEntry {
  key: string
  id: string
  // Status encoded by the source filename. Never inherited.
  versionStatus: 'draft' | 'published' | 'archived'
  // Effective query status after inheritance from ancestors.
  status: 'draft' | 'published' | 'archived'
  active: boolean
  main: boolean
  type: string
  title: string
  workspace: string
  root: string
  locale: string | null
  level: number
  index: string
  parentId: string | null
  parents: ReadonlyArray<string>
  path: string
  url: string
  frames?: {
    data: FrameDescriptor
    search?: FrameDescriptor
    references?: FrameDescriptor
    decodeKey: string
  }
}
```

The index is emitted in its runtime-ready shape. Opening its serialized form is
a file read and `JSON.parse`; importing its generated server form uses the same
value directly. Neither path requires another pass that constructs maps, graph
objects, or database records. The entries array is already in deterministic
scan order, and `children` supports graph traversal. At the current 11,000-entry
scale, occasional linear lookup is cheaper at boot than eagerly constructing
additional maps; a measured lookup bottleneck can justify a lazy map later.

`versionStatus` and `status` are intentionally different. For example, a
published child beneath an archived parent has `versionStatus: 'published'`
and `status: 'archived'`. Queries use effective `status`; writes, Source sync,
and reactivating an archived subtree preserve and use `versionStatus`.
Archiving a parent must not rewrite its descendants on disk. Re-publishing the
parent therefore restores every descendant to the state encoded by its own
source version.

The index also retains the exact source tree manifest. It is structural data,
not entry payload, and lets the database implement `Source` without opening all
source files. Exact source blobs are range-loaded lazily from the payload bundle
by SHA. The trusted server index contains their descriptors and key; a
policy-filtered browser index omits this server-only source capability.

For the generated handler and local server path, the same JSON-compatible value
is emitted as inline JavaScript and imported with the server bundle. This avoids
shipping `source.json`, locating a private runtime file, and rebuilding the
normalized database. Browser replicas receive the serialized, policy-filtered
form from the authenticated handler.

The initial implementation deliberately has no persisted indexes by type,
location, URL, field value, or ordering expression. Scanning 11,000 compact
index rows is acceptable and keeps generation, synchronization, preview, and
query execution easy to reason about. A measured hot path may justify a specific
additional lookup later.

Servers and trusted handlers may receive the complete index. A client receives
a policy-filtered view:

- an entry with no explore access is absent;
- explore access includes only structural and discovery-safe fields;
- read access additionally includes the entry's frame descriptors and decode
  key.

The index itself must not contain content-derived values for an explore-only
entry.

### Payload bundle

The payload bundle is a concatenation of independently compressed and encrypted
JSON frames. Frames are grouped physically by access pattern:

```text
[data frame][data frame][data frame] ...
[search frame][search frame][search frame] ...
[reference frame][reference frame][reference frame] ...
[source blob frame][source blob frame][source blob frame] ...
```

The frame classes are:

```ts
interface DataFrame {
  data: Readonly<Record<string, unknown>>
}

interface SearchFrame {
  id: string
  title: string
  searchableText: string
}

interface ReferenceFrame {
  sourceId: string
  references: ReadonlyArray<{
    targetId: string
    fieldPath: string
    fieldLabel?: string
    linkId?: string
    linkType?: 'entry' | 'image' | 'file'
  }>
}

interface SourceBlobFrame {
  sha: string
  contents: Uint8Array
}
```

Each entry version has at most one frame of each class. The frames share the
entry's read grant but use distinct frame identities and AES-GCM nonces. Reading
one frame never requires decrypting or decoding its neighbours.

JSON is the default encoding for every frame. Native `JSON.parse` was faster
than MicroCBOR in the synthetic evaluation, and entry-sized frames make complete
decode cheap. Gzip may be applied before encryption when its transfer savings
justify decompression. The bundle format must retain explicit encoding and
compression versions so they can change in a later release.

Grouping frames by class allows a range loader to merge adjacent reads. A search
over many permitted entries can fetch most of the search section in one or a few
requests without downloading the much larger data section.

Source blob frames retain the exact authored bytes rather than reconstructing
files from normalized entry data. Exact bytes are required because the Source
tree addresses blobs by hash and may contain files that are not entry payloads.
For a normal entry file, those same authored JSON bytes are also its data frame;
the index supplies the derived read metadata needed to turn them into an
`Entry`. This avoids storing the large payload corpus twice. Only source blobs
that are not represented by an entry data frame receive a separate, server-only
frame. Boot and API semantics do not depend on this physical deduplication.

## Encryption boundary

Encryption enforces read access, not field-level access. The complete data,
search, and reference representation of one entry is protected by that entry's
read grant.

Per-entry keys are retained because read permissions can differ per entry. The
handler includes a key only in a filtered index view that grants read access to
that entry. Explore access alone never grants a payload key.

Editor operations may continue to address field paths and carry field hashes
for authorization, conflict detection, and merging. That mutation protocol does
not determine the storage boundary. After accepting operations, the handler
serializes and encrypts a complete replacement frame for each changed class.

Already disclosed plaintext cannot be revoked from a client. A new payload
revision uses a new descriptor and may rotate its decode key. AES-GCM
authenticates the encrypted frame; frame hashes provide stable cache identity
and corruption detection.

## Cold and hot operation

At cold boot a server:

1. reads and parses the deployed JSON index;
2. obtains and applies index patches newer than the deployed revision;
3. installs payload frame locators without downloading their bytes;
4. begins serving queries.

It does not import the complete source export, normalize entries, construct a
second graph, build MiniSearch, build a reverse reference map, or open payload
frames.

The database itself implements `Source`. Its source view and query view share
the same immutable release and live overlay. `getTree` returns the inline tree;
`getBlobs` lazily opens only requested source frames; `applyChanges` updates the
source tree, blob overlay, affected index rows, and replacement frames. Callers
do not need a second generated source object beside the database.

Decoded entries and parsed search/reference frames remain cached by entry key
and frame hash. Concurrent requests for the same frame share one promise. The
server does not also retain encrypted or decrypted byte buffers after parsing;
those bytes are only coalesced while a read is in flight. When synchronization
replaces a frame, only the old value for that entry and frame class is
invalidated. Unchanged decoded entries remain hot across index revisions.

The legacy browser replica has an optional IndexedDB ciphertext cache so static
ranges can survive page reloads without storing plaintext. That transport-level
offline cache is not used by the server runtime and is not required by this
format.

The cache may grow to contain the complete readable database. That is desirable
for a long-lived server: startup remains cheap and the server becomes faster as
real queries warm it. A deployment may add an optional memory limit for
constrained runtimes, but bounded eviction is not part of the core architecture.

## Query planning and lazy loading

The resolver operates on index entries until an operation explicitly requires a
payload frame:

```text
scan index candidates
  -> apply index-only conditions
  -> load frames required by remaining conditions, grouping, or ordering
  -> filter, group, and order
  -> apply skip/take
  -> load frames required only by the projection
  -> return
```

The planner inspects query expressions and classifies their dependencies as
index, data, search, or references. Conditions are evaluated in the cheapest
safe order. Mixed boolean conditions preserve short-circuit behaviour: an index
clause may reject an `and` branch or satisfy an `or` branch without loading its
data frame.

Expected frame loading is:

| Query                                                         | Required frames                                           |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| Index-only filter, order, and projection                      | None                                                      |
| Index-only filter/order with a data projection and `take: 10` | At most ten data frames                                   |
| Data condition with known index order and `take: 10`          | Data frames until ten matches are found                   |
| Data-dependent order, group, or count                         | Data frames for every structural candidate                |
| Search                                                        | Search frames first, then result data frames if projected |
| `referencesFrom(id)`                                          | The source entry's reference frame                        |
| `referencesTo(id)` without a hot reverse map                  | Permitted reference frames, then projected result frames  |

These are semantic lower bounds. Sorting by a field that exists only in data
requires reading that field for every candidate. If a real query makes that
prohibitively expensive, explicitly copying that particular scalar into the
index is preferable to adding a generic secondary-index system.

### Batched range loading

Loading many frames must not create an unbounded `Promise.all` of individual
HTTP requests. A batch loader:

1. removes decoded and in-flight frames;
2. groups remaining descriptors by bundle;
3. sorts them by byte offset;
4. merges adjacent or sufficiently close ranges;
5. fetches ranges with bounded concurrency;
6. splits, authenticates, decrypts, decompresses, and parses the frames;
7. publishes the decoded results to the shared hot cache.

When one stage determines the next set of ids, two rounds are intentionally
required. Search must identify matching ids before result data frames are known;
references must identify related ids before their projections are loaded.

## Lazy search

Searchable text is stored in per-entry search frames and is protected by read
access. On the first full-content search for a view, the runtime loads its
permitted search frames, creates one MiniSearch instance, and retains it. Later
entry changes add, replace, or remove only their corresponding MiniSearch
documents when the search subsystem is already hot. Otherwise those updates are
deferred until the first search.

MiniSearch can serialize and restore an index with `toJSON`, `loadJSON`, and
`loadJSONAsync`. An exported aggregate index is not the initial format because
it combines information from many entries: filtering it for per-entry read
permissions and synchronizing one changed document become more complicated.
Exported MiniSearch remains an optimization to evaluate if building the real
11,000-document search index on first use is too expensive.

Explore-only search may use safe index fields such as title and path. It must not
load or expose full-content search frames.

## Lazy references

Each reference frame contains the outgoing references derived from one entry.
`referencesFrom` therefore loads at most one reference frame. The first
`referencesTo` query may load the permitted reference section and construct an
in-memory reverse map. The reverse map remains hot and is updated entry by entry
as reference frames change.

This defers global reference work until a feature needs it and avoids a
persistent reference index in the base JSON. If first-use reference cost proves
material in production, references may be exported as a separate aggregate
frame without changing data-frame or index semantics.

## Synchronization and overlays

See [Database synchronization flows](./SYNC.md) for separate production and
development diagrams covering the dashboard worker, RSC routes, application
handler, hosted database, and GitHub-backed sources.

The immutable deployed index and payload bundle form the base revision. A live
mutation produces an entry-level overlay containing:

- one complete replacement index row, or an entry tombstone;
- a replacement data frame when fields changed;
- a replacement search frame when searchable content changed;
- a replacement reference frame when outgoing references changed;
- exact changed source blobs and the updated source tree.

Changed ciphertext is appended to a small delta bundle. Frame descriptors can
point to either the deployed bundle or a delta bundle, so unchanged entries keep
their original locations and cached bytes. A logical read resolves in this
order:

```text
live decoded overlay
  -> decoded frame cache
  -> changed frame in a delta bundle
  -> frame in the deployed bundle
```

The handler that accepted a mutation installs its plaintext directly into the
hot entry cache together with the index overlay; it does not fetch and decrypt
its own output. It serializes and encrypts the replacement frames once for
other processes and clients.

Entry-sized live delta bundles are included as ciphertext in the filtered state
response. This makes them independent of the particular handler instance that
answered synchronization: another serverless instance does not need the first
instance's memory in order for the replica to read the change. Receipt and
storage happen during synchronization, but JSON parsing and decryption remain
lazy until a query needs the data, search, or reference frame. The large
immutable base bundle is never included and remains a static range source.

### Selective index synchronization

A replica sends its known revision. The handler returns a policy-filtered,
entry-level patch:

```ts
interface IndexDelta {
  fromRevision: string
  toRevision: string
  upserts: ReadonlyArray<IndexEntry>
  removals: ReadonlyArray<string>
}
```

An upsert replaces the complete index row; synchronization does not patch
individual index properties. The handler compares the replica's previous and
current views so access changes produce the correct result:

- newly visible or changed entries are upserted;
- deleted or newly hidden entries are removed;
- a read-to-explore change replaces the row without frame keys;
- an explore-to-read change replaces the row with readable frame descriptors
  and its decode key.

Applying an index delta does not range-read its referenced base frames. A cold
subsystem observes the new descriptors when it is eventually used. Small live
overlay ciphertext may accompany the state atomically, but a hot data, search,
or reference subsystem decrypts only the changed frames it actually uses.

For the first implementation, returning a complete filtered index on revision
change is an acceptable simplification because the index is small and compresses
well. Entry-level deltas should replace that only when measured synchronization
frequency or bandwidth justifies them. Payload frames remain selective and lazy
in either case.

After too many overlays accumulate, the handler can publish a compacted current
index and bundle. Compaction is background work and is never part of database
boot, preview, or an RSC request.

## Preview

Preview is a request-scoped entry overlay, not a new database. A preview derives
only the changed entry's index row, data, searchable text, and outgoing
references. It then shadows the shared base entry for that request.

The preview must be considered during candidate construction so an entry can
enter or leave results after a structural, filter, order, search, or reference
change. It must never call `graph.withChanges`, normalize all source files,
clone the complete database, or rebuild global search/reference structures.

A content-only preview is proportional to the preview entry. A structural
preview may additionally update the affected parent child lists and descendants
whose inherited structural values actually change.

## Development checkpoint boot

Development reuses the same index and payload as a persistent checkpoint
instead of rebuilding the database from every source file on each process
start. The checkpoint is valid only when its runtime format and compiled config
fingerprint match the current process.

The startup sequence is:

1. open the previous inline runtime index and its payload without loading any
   frames;
2. seed the filesystem scanner from the checkpoint's exact source tree and
   development-only file fingerprints;
3. list and stat the working tree, reading and hashing only files whose size,
   modification time, or change time differ;
4. return immediately when the source tree hash is unchanged;
5. turn in-place entry edits into runtime row/frame overlays;
6. fall back to a full source rebuild for additions, removals, moves, config
   changes, or edits that affect structure, then replace the checkpoint.

The first implementation writes a fresh checkpoint after a required full
development build. Content-only differences from that checkpoint remain
in-memory overlays; a later structural fallback replaces the checkpoint. The
fingerprints are only a scan accelerator. Source hashes remain the identity and
correctness boundary, and production artifacts do not depend on local
timestamps. A later background compaction may fold many development overlays
into a new payload, but compaction must never delay startup. See
[Database synchronization flows](./SYNC.md#development) for the process
boundaries.

## Framework integration

The format and resolver remain framework-neutral. The next adapter's `localdb`
imports the generated inline index from `@alinea/generated/runtime-index.js`
and refers to the public payload bundle at
`/admin/$releaseId/payload.bundle`. RSC routes must not import `source.json` or
construct a normalized database on first query.

`@alinea/generated` is an ESM package (`package.json` declares
`"type": "module"`). It owns `server-config.js`, the trusted compiled CMS
configuration, and `runtime-index.js`, the trusted inline database index. This
also gives generated JavaScript an unambiguous ESM package boundary and avoids
Node's `MODULE_TYPELESS_PACKAGE_JSON` warning.

The browser configuration is a separate `client-config.js` bundle at
`/admin/config/$configId/client-config.js`. The handler returns this URL only
after authenticated replica bootstrap. The unpredictable config id acts as a
capability that keeps the schema out of the public dashboard entry bundle. Once
the URL has been disclosed it is not access control by itself, so it must never
contain secrets.

No runtime or generated artifact lives in `.alinea`. Build coordination is
carried through environment variables: the admin path, release id, config id,
payload URL, and client-config URL. The immutable payload is emitted at
`public/admin/$releaseId/payload.bundle`; all other generated server modules are
in `@alinea/generated`.

The Next runtime validates that complete binding before opening the generated
database. Missing variables produce a descriptive error that instructs the user
to wrap `next.config` with `withAlinea` and rebuild. A release id or payload URL
that does not match the inline runtime index is treated as a stale build and
also fails before any payload read.

`with-alinea` places the unique release id in server configuration/environment
and constructs the public payload URL from it. The release id and generated
index import must remain server-only so framework bundlers do not expose them in
unrelated client code. The payload URL is disclosed to an authenticated browser
only together with its filtered index and permitted decode keys.

An `HttpReplicaTransport` or equivalent provides the same logical view to a
remote server or browser. The handler remains responsible for authentication,
policy evaluation, synchronization, and mutations, while permitted static
payload ranges may be read directly from static hosting or a CDN.

As a Node deployment optimization, `with-alinea` can emit an exact
`outputFileTracingIncludes` entry for the generated payload. This lets the
handler range-read the traced file directly and avoids an HTTP request back to
its own public route. The public route, generated release id, traced filesystem
path, and index `bundleUrl` must be treated as one binding contract known at
build time. Environments that do not expose traced files use the same index and
fall back to HTTP range reads; this optimization must not change storage or
query semantics.

## Performance verification

Benchmarks must use both synthetic data and the real heavy project. They should
report cold and warm behaviour separately:

1. module import, index transfer, `JSON.parse`, and reader construction;
2. first and repeated id lookup and paged listing;
3. number and total bytes of payload ranges fetched per query;
4. first and repeated data-dependent filter and order;
5. first MiniSearch construction and repeated search;
6. first reverse-reference construction and repeated reference lookup;
7. content-only and structural preview;
8. one payload mutation and synchronization into cold and hot replicas;
9. retained heap after the index, after representative queries, and after the
   complete database becomes hot;
10. index, data, search, reference, and delta transfer sizes.

The primary assertions concern scaling:

- boot must not read or iterate payload frames;
- an index-only query must not read payload frames;
- a paged index-only query with data projection must read no more data frames
  than its result page;
- a one-entry mutation or preview must not rebuild the database, MiniSearch, or
  reverse-reference map;
- a sync must preserve cached decoded frames whose hashes did not change.

## Migration plan

The migration should keep behavioural query tests passing while replacing the
storage path in small slices:

1. **Query staging**
   - distinguish index-resident expressions from data expressions;
   - paginate before loading projection-only data;
   - avoid data loads entirely for index-only projections and counts;
   - add an explicit batch-loading contract.
2. **Runtime index**
   - define and export the runtime JSON index;
   - open it directly in the next adapter's `localdb`;
   - stop constructing all `EntryCoreRecord` objects through individual frame
     reads at server boot.
3. **Payload frame consolidation**
   - emit one JSON data, search, and reference frame per entry version;
   - reduce encryption classes to explore visibility and complete entry read;
   - add grouped range coalescing and shared in-flight/decoded caches.
4. **Lazy search and references**
   - create and retain MiniSearch on first full-content search;
   - create and retain the reverse-reference map on first incoming-reference
     query;
   - update hot structures entry by entry after synchronization.
5. **Entry-level overlays**
   - replace record and index-bucket deltas with complete index-row upserts,
     tombstones, and replacement content frames;
   - let handlers install their decoded mutation results directly;
   - compact overlay bundles only in background work.
6. **Preview and cutover**
   - represent preview as the same request-scoped entry overlay;
   - switch RSC, handler, and client read paths to the consolidated format;
   - remove the normalized-record release representation after parity and
     performance verification.

## Current implementation

The branch now implements the consolidated server read path:

- generation emits an inline runtime index through
  `@alinea/generated/runtime-index.js` and a public
  `/admin/$releaseId/payload.bundle`;
- the Next.js local database opens the runtime index directly and reads payload
  byte ranges from the generated file;
- `SourceDB` can boot directly over the runtime store and implements `Source`
  without reading payload frames;
- entry data, searchable text, outgoing references, and otherwise-unrepresented
  source blobs are independently encrypted and range-addressable;
- authored entry JSON is shared by the data and exact-source views instead of
  being duplicated in the bundle;
- core-only queries and counts read no payload data, projection-only data is
  loaded after pagination, and batch reads coalesce adjacent frames;
- MiniSearch and the incoming-reference map are built only on first use and are
  retained; decoded entries and auxiliary objects remain hot;
- preview uses a request-scoped entry value and no longer rebuilds the database;
- stored and inherited effective statuses remain separate throughout the index,
  preview, query, and Source paths;
- development opens a config-compatible generated checkpoint, seeds its
  filesystem scan from stored fingerprints, skips normalization when unchanged,
  and converts in-place content edits to runtime overlays;
- content-only dashboard field writes build their source commit from the
  addressed lazy entries and then publish entry overlays, without loading the
  complete Source database;
- policy-filtered replica state carries entry-sized live overlay ciphertext, so
  lazy reads remain valid across handler instances without embedding the large
  immutable base;
- the Next runtime validates the generated environment and reports a missing
  `withAlinea` wrapper or stale release binding before opening payload data.

The dashboard replica and RSC synchronization paths now install the same runtime
index representation without eagerly opening payload frames. Handler source
synchronization compares source trees first; an unchanged revision does no
database rebuild, while a single in-place entry edit replaces one index row and
emits only its replacement data, search, reference, and source frames. The
shared handler runtime store is updated in place so already-decoded unchanged
entries remain hot.

Structural and multi-file mutations still use the normalized transaction path
as a compatibility fallback before exporting a replacement runtime index. Path
updates, localized shared-field propagation, and media URL changes deliberately
join that fallback until their entry-level graph effects are represented
directly. This work occurs on those writes rather than at process boot or
ordinary replica sync. The browser worker's development-only IndexedDB
`SourceDB` also still normalizes its cached Source during dashboard startup; it
is independent of the newly checkpointed dev-server boot.

The structural fallback still performs full normalization and frame encryption
in temporary memory. Its exported result is then reduced against the current
runtime index: unchanged frame descriptors are retained and only new or changed
frames are packed into the live delta carried by replica state. This makes the
result instance-safe and avoids transferring a full replacement payload, but
removing the temporary full CPU/memory pass remains the principal write-path
optimization. Exceptionally large live deltas may later justify shared object
storage rather than embedding their ciphertext in state.
