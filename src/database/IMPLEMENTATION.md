# SQLite engine implementation

This file describes the current implementation. The architectural constraints and
deployment model live in [README.md](./README.md) and [SYNC.md](./SYNC.md).

## Storage and source state

- `SqlTree` stores the source tree, blobs, namespace heads, directory metadata,
  and subtree hashes in SQLite. Tree diffs skip equal subtrees.
- `SqlSource` implements the existing `Source` protocol over those tables.
- `EntryRuntime` owns the normalized entry index, exact payload manifests,
  resident payload rows, standard FTS5 search, Graph query compilation, and query
  subscriptions.
- `BuildDatabase` creates one checkpoint from one pinned source revision.
  `ReconcileDatabase` parses changed source records and updates the source tree,
  normalized entries, references, FTS, and checkpoint revision transactionally.
- Checkpoints bind project, namespace, epoch, schema, config, release, and source
  revision. Incompatible checkpoints fail closed.

## Native server and preview reads

Generated deployments contain one private immutable `release.sqlite` plus a
small loader module. Native Node queries open that file directly; the generator
does not export/import the database through JavaScript and does not publish a
second payload representation.

`NodeReplica` retains immutable reader generations. A source update is reconciled
in a private writable generation and published only after validation. Existing
readers finish against their pinned generation.

`NodeOverlay` attaches the immutable base read-only and uses in-memory
replacement/tombstone tables with TEMP effective views. It does not copy the base
database. Preview search builds a temporary standard FTS5 index over the effective
view when a search is actually requested.

Generated loaders resolve the SQLite file through `import.meta.url`; NFT tracing
tests verify that the database is included and remains readable after relocation.

## Browser replica

The browser never receives the unrestricted server database. Bootstrap returns:

- the complete permitted structural index;
- entry-level compiled permission masks;
- exact payload IDs for readable rows;
- the complete replica identity and policy view ID.

The browser creates an in-memory `@alinea/sqlite-wasm` database and installs the
authorized index. Queries that only need structural fields perform no payload
request. Queries that require content ask `EntryRuntime` to hydrate the exact
missing payload IDs before executing the dependent SQL stage.

Payload transport is an authenticated `application/x-alinea-payloads` text
stream. The header and row identities are JSON encoded, while the payload and
source bodies remain raw SQLite JSON text. Browser hydration therefore does not
parse, validate or re-serialize every payload before inserting it into SQLite.
Queries and selective generated columns can ask SQLite to interpret individual
values when needed.

1. the client coalesces simultaneous misses and sends up to 20,000 exact identities;
2. the server validates principal, release identity, revision, view, read access,
   and payload identity against one consistent SQL snapshot;
3. the response sends one identity/revision header line followed by raw payload
   text rows;
4. the browser validates the framing and exact identities, queues raw rows for
   idle cache persistence, and installs a complete query result only after all
   requested rows arrive;
5. a 413 response recursively splits a batch, allowing large documents without
   reducing the normal cold-start batch size.

Responses are capped at 128 MiB and can be gzip/deflate compressed as a stream.
There is no request-per-entry path, frame encryption, public range bundle, key
grant, or complete database copy.

`ReplicaCache` stores the authorized structural index and raw plaintext payload
text in identity-partitioned IndexedDB stores. Payload residency is keyed by
`versionId + payloadId`; descriptor changes and permission loss evict old data.
Authentication is always required before a cache is opened. Logout/revocation
invalidates the cache generation so old tabs cannot repopulate it.

## Query and live-query behavior

The public Graph API remains the query and mutation surface. `EntryQuery` compiles
filters, projections, relations, grouping, ordering, pagination, `when`, and
`exists` through Rado. Primitive-array `includes` compiles to SQLite JSON
membership. Search uses ordinary FTS5.

`QueryWorker` and `WorkerGraph` expose the same Graph over a dedicated worker.
`LiveReplica` retains the currently rendered generation while the replacement
index and all payloads needed by active subscriptions are loading. Observers see a
complete next result or an error, never a partially hydrated result.

## Permissions

SQLite browser replicas support entry-level permissions. Explore controls index
visibility; Read controls whether a payload ID can be advertised and fetched.
Configurations whose field permissions differ from the entry grant are rejected
for this replica path. Mutation permissions are independently evaluated on the
trusted handler.

## Builds, branches, and development

`releaseIdentity` derives a provider-neutral project/namespace/epoch binding.
Explicit configuration wins; Vercel and Cloudflare branch metadata provide
defaults. A deployment remains pinned to its built release for ordinary rendering,
while its authenticated dashboard replica catches up to the configured source.

The development server reopens the latest compatible checkpoint and reconciles it
against the current source tree. Unchanged source records and normalized payloads
are reused. It does not start by copying a generated database or exporting it
through JS.

Advanced cross-release delta journals and linked external databases are deferred.
The correctness fallback is a fresh authorized index plus lazy exact-payload
hydration; tree/source reconciliation avoids reparsing unchanged server content.

## Mutations

Writable browser replicas keep pending edits in a separate encrypted IndexedDB
outbox and submit them through the existing Graph mutation API. Accepted writes
refresh the SQLite view. Source compare-and-swap and top-level field hashes protect
against overwriting a concurrent edit.

Cross-process source-carried receipts and collection-specific stable-ID/list
operations are intentionally outside the core cutover. They should only return
after a concrete product requirement and benchmark justify their protocol cost.

## Verification

The normal gates are:

- `bun test`
- `bun lint`
- `bun format`
- `bun test/sqlite-browser.ts` when Chromium is installed

The browser fixture bundles the real WASM runtime, exercises authenticated streamed
hydration, IndexedDB restart, live queries, worker ownership, mutation recovery,
and logout/crash cleanup. The imec benchmark and captured results are under
`test/benchmarks/`.
