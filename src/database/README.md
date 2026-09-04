# Database architecture

This directory contains Alinea's database, query resolver, encrypted release
format, and replica synchronization code.

The branch implements the consolidated runtime read and source reconciliation
paths described here. There is one database representation after source input:
the compact runtime index, lazy payload frames, and entry-level overlays.

## Goals

Opening a database must be cheap. A cold server should load only a compact JSON
index and must not parse, decrypt, normalize, or index all entry fields. Work on
the large payload corpus happens only when a query asks for it.

For the 11,374-entry imec project used to verify this branch:

- the pathless packed index is 4,466,356 bytes of JSON;
- the entry fields are approximately 70 MB before JavaScript object overhead;
- the previous RSC path can take almost ten seconds to parse source data,
  normalize entries, and construct its in-memory graph.

On the same project Node imports the generated index module and constructs the
database in roughly 41 ms, then answers an index-only page in roughly 3 ms
without reading the payload. These numbers are development-machine benchmarks,
not API guarantees; the scaling boundary is the important part.

The new read path must have these properties:

- cold boot is proportional to the JSON index and unapplied index changes, not
  to the payload corpus;
- generated data is already queryable and is never passed through
  `graph.withChanges` or another whole-database indexing step at runtime;
- a query loads only the content-derived frames needed for its conditions,
  ordering, grouping, search, references, and final projection;
- decoded data may remain in memory for the lifetime of a server process, so a
  naturally warmed server can eventually answer every query from memory;
- previews and mutations replace only affected entries and never clone or
  rebuild the complete payload database;
- deployed data remains immutable while live changes are represented by small
  entry-level overlays;
- clients receive only the index rows and decode keys allowed by their effective
  policy;
- encryption protects the complete read-only representation of an entry. It is
  not performed independently for every field.

Simplicity is an explicit goal. The design uses JSON, a small transient
structural lookup, entry-level frames, and entry-level synchronization patches.
More elaborate binary formats and persistent content indexes should be added
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
  revision: string
  entries: ReadonlyArray<PackedIndexEntry>
  sourceTreeFrame: FrameDescriptor
}

interface IndexEntry {
  // Physical id is derived from id + locale + versionStatus.
  id: string
  // Status encoded by the source filename. Never inherited.
  versionStatus: 'draft' | 'published' | 'archived'
  // Effective query status after inheritance from ancestors.
  status: 'draft' | 'published' | 'archived'
  active: boolean
  main: boolean
  type: string
  title: string
  // Workspace/root are references into separate shared string tables.
  workspace: number
  root: number
  locale: string | null
  level: number
  index: string
  // parentId and level are derived from this chain.
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

The wire representation is compact JSON: entries and frame descriptors are
tuples, repeated type, locale, workspace, and root strings use shared tables,
and queryable, active, main, source status, and effective status share a bit
mask. Opening it requires `JSON.parse` plus one small linear expansion into the
semantic rows the resolver scans. It does not parse entry fields or construct a
second database. On imec, native JSON decode is substantially faster than
MicroCBOR for this hot startup artifact; MicroCBOR is reserved for lazy frames.
There is no children table or eager secondary index. Parent traversal uses
`parentId` and `parents`.

`versionStatus` and `status` are intentionally different. For example, a
published child beneath an archived parent has `versionStatus: 'published'`
and `status: 'archived'`. Queries use effective `status`; writes, Source sync,
and reactivating an archived subtree preserve and use `versionStatus`.
Archiving a parent must not rewrite its descendants on disk. Re-publishing the
parent therefore restores every descendant to the state encoded by its own
source version.

The exact source tree is a server-only, encrypted lazy frame in the payload,
not part of the boot index. It is opened only by a Source operation. Exact
source blobs are range-loaded lazily by SHA. Normal entry source bytes are the
same bytes used by the data frame, so they are not stored twice. The trusted
server index contains this capability; a policy-filtered browser index omits it.

For the generated handler and local server path, the same JSON-compatible value
is emitted as inline JavaScript and imported with the server bundle. This avoids
shipping `source.json`, locating a private runtime file, and rebuilding the
normalized database. Browser replicas receive the serialized, policy-filtered
form from the authenticated handler.

The implementation deliberately has no persisted indexes by type, location,
URL, field value, or ordering expression. The resolver creates a small
in-memory lookup by entry id, parent id, URL, and type only when a query first
needs one. This keeps boot index-only, avoids repeated full scans for routed
pages and links, and is discarded with the resolver when a new index is
installed. Content conditions and ordering expressions remain unindexed.

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
frames. Frames are grouped physically by access pattern:

```text
[data frame][data frame][data frame] ...
[search frame][search frame][search frame] ...
[reference frame][reference frame][reference frame] ...
[source tree][otherwise-unrepresented source blob frames] ...
```

The frame classes are:

```ts
interface DataFrame {
  filePath: string
  fileHash: string
  defaults?: Readonly<Record<string, unknown>>
  authoredJson: Uint8Array
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

interface SourceTreeFrame {
  tree: Tree
  entryPositionBySha: ReadonlyMap<string, number>
}
```

Each entry version has at most one frame of each class. The frames share the
entry's read grant but use distinct frame identities and AES-GCM nonces. Reading
one frame never requires decrypting or decoding its neighbours.

Data frames retain the exact authored JSON bytes. A small MicroCBOR tuple wraps
those bytes with source-only metadata; the JSON is parsed only when the entry is
actually requested. Search, reference, and source-tree frames also use compact
MicroCBOR tuples because they are lazy and benefit from the smaller transfer.
Gzip may be applied before encryption. The current runtime has one data-frame
format rather than compatibility branches for formats that were never released.
The frame descriptor records only the compression choice needed to decode it.

Grouping frames by class allows a range loader to merge adjacent reads. A search
over many permitted entries can fetch most of the search section in one or a few
requests without downloading the much larger data section.

Source access returns exact authored bytes rather than reconstructing files from
normalized data. The source tree maps an entry blob SHA to its data-frame
position; only blobs not represented by an entry receive a separate server-only
frame. File paths, hashes, defaults, and authored bytes therefore stay out of
the startup index while Source semantics remain exact.

## Encryption boundary

Encryption enforces read access, not field-level access. The complete data,
search, and reference representation of one entry is protected by that entry's
read grant.

Per-entry keys are retained because read permissions can differ per entry. The
handler includes a key only in a filtered index view that grants read access to
that entry. Explore access alone never grants a payload key.

Each random 256-bit entry key is imported directly as an AES-GCM key and reused
for that entry's data, search, and reference frames. Every frame has a random
96-bit nonce, and its release, frame, access-class, and compression identities
are authenticated as additional data. There is no per-frame HKDF: it added CPU
to payload-heavy cold queries without strengthening this already random,
entry-scoped key boundary.

Editor operations may continue to address field paths and carry field hashes
for authorization, conflict detection, and merging. That mutation protocol does
not determine the storage boundary. After accepting operations, the handler
serializes and encrypts a complete replacement frame for each changed class.

Already disclosed plaintext cannot be revoked from a client. A new payload
revision uses a new descriptor and may rotate its decode key. AES-GCM
authenticates the encrypted frame; descriptor identity keys the decoded cache,
so encrypted bytes are not retained in a second ciphertext cache.

## Cold and hot operation

At cold boot a server:

1. reads and parses the deployed JSON index;
2. expands its packed tuples into lightweight semantic rows;
3. installs payload frame locators without downloading their bytes;
4. begins serving queries and checks remote revision only when synchronization
   is required.

It does not import the complete source export, normalize entries, construct a
second graph, build MiniSearch, build a reverse reference map, or open payload
frames.

The database itself implements `Source`. Its source view and query view share
the same immutable release and live overlay. `getTree` lazily opens the source
tree frame; `getTreeIfDifferent` compares the known revision without doing so;
`getBlobs` opens only requested entry/source frames. `applyChanges` advances the
source and the shared reconciler installs affected rows and replacement frames.
Callers do not need a second generated source object beside the database.

Decoded entries and parsed search/reference frames remain cached by entry key
and descriptor identity. Concurrent requests for the same frame share one promise. The
server does not also retain encrypted or decrypted byte buffers after parsing;
those bytes are only coalesced while a read is in flight. When synchronization
replaces a frame, only the old value for that entry and frame class is
invalidated. Unchanged decoded entries remain hot across index revisions.

The browser persists serialized replica state in IndexedDB. It does not retain a
second normalized database or cache ciphertext separately; decoded values live
only in the current worker's ordinary hot cache.

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

The immutable deployed index and payload bundle form the base revision. Every
source refresh starts by diffing its tree against the tree stored in the runtime
index. Only added or changed blobs are fetched and parsed. The reconciler emits
an overlay containing:

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

The reconciler retains decoded entries whose frame descriptors did not change.
Changed entries are encrypted once and decoded lazily if the accepting handler
queries them again.

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
start. The checkpoint is reused only when its generated index has the current
shape and its compiled config fingerprint matches the current process. There
are no readers for earlier unreleased runtime formats.

The startup sequence is:

1. open the previous inline runtime index and its payload without loading any
   frames;
2. seed the filesystem scanner from the checkpoint's exact source tree and
   development-only file fingerprints;
3. list and stat the working tree, reading and hashing only files whose size,
   modification time, or change time differ;
4. return immediately when the source tree hash is unchanged;
5. feed the tree diff through the runtime reconciler, including additions,
   removals, moves, status changes, and ordinary content edits;
6. reuse every unchanged frame and retain the new runtime index in memory.

The first process without a valid checkpoint performs a full development
build. Later filesystem differences remain in-memory overlays regardless of
whether they are content or structural changes. The fingerprints are only a
scan accelerator. Source hashes remain the identity and correctness boundary,
and production artifacts do not depend on local timestamps. A later background
compaction may fold many development overlays into a new payload, but
compaction must never delay startup. See
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

## Runtime-only cutover

The server, handler, replica, preview, and mutation paths now share the runtime
index and frame store. The previous normalized database, reader, release,
replica catalog, projection, and synchronization representations have been
removed rather than retained as compatibility fallbacks. Initial artifact
generation still has to parse the complete source once; that is build work, not
request-time database boot.

`EntryTransaction` is asynchronous and queries the same runtime-backed `Graph`
used for reads. There is no `TransactionLookup`, `TransactionPayload`, preload
planner, or transaction-specific index. Structural transaction queries select
core fields and remain index-only; a query that needs source bytes or entry data
lets the normal resolver open and cache exactly those frames. A tiny in-request
URL-claim overlay is retained only so sequential mutations in one request can
see claims created earlier in that same request.

`SourceDB.sync()` performs seed repair only after an initial build or a real
source reconciliation. An unchanged revision returns immediately; it must not
scan every entry merely because a query or mutation calls `sync()`.

## Current implementation

The branch now implements the consolidated server read path:

- generation emits an inline runtime index through
  `@alinea/generated/runtime-index.js` and a public
  `/admin/$releaseId/payload.bundle`;
- a clean build writes the complete runtime artifact already produced by its
  initial database sync instead of parsing, compressing, and encrypting the
  source a second time; seed, fix, or source changes invalidate that reusable
  artifact and take the consolidating export path;
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
  and reconciles all filesystem changes as runtime overlays;
- dashboard writes run `EntryTransaction` against the ordinary lazy graph and
  open only payloads selected by its queries;
- source synchronization from dashboard writes, GitHub, and the development
  filesystem shares one tree-diff reconciler that parses only changed blobs,
  recomputes hierarchy from lightweight index metadata, and reuses unchanged
  encrypted frames;
- policy-filtered replica state carries entry-sized live overlay ciphertext, so
  lazy reads remain valid across handler instances without embedding the large
  immutable base;
- the Next runtime validates the generated environment and reports a missing
  `withAlinea` wrapper or stale release binding before opening payload data.

The dashboard replica and RSC synchronization paths now install the same runtime
index representation without eagerly opening payload frames. Handler source
synchronization compares source trees first; an unchanged revision does no
database work. A changed revision scans the compact index, parses only changed
source blobs, and emits replacement data, search, reference, and source frames
only for those files. Structural consequences such as inherited archive status
are recomputed from index metadata without opening unchanged payloads.
Already-decoded unchanged entries remain hot.

There is no normalized transaction, database-reader, or legacy replica fallback
left. An initial build or a development browser starting only from its cached
raw Source must still parse all source files to create the runtime artifacts;
once a runtime checkpoint is available, consumers install it without opening
payload frames. Exceptionally large live deltas may later justify shared object
storage rather than embedding their ciphertext in replica state.
