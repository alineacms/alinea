# Implementation and verification plan

## Current implementation progress

`source/SqlTree.ts` now stores immutable directory metadata through Rado, skips
equal subtrees when diffing, and applies file changes by rehashing affected
directories and ancestors. Tests cover snapshots across connections, mode-only
changes, file/directory replacement, exact-base preconditions, and reopening a
raw SQLite file read-only. This is a foundation, not an integrated runtime: the
full entry compiler, source/Tree API integration, generation/NFT, dev boot,
browser hydration/subscriptions, and remaining gates below are still outstanding.

`source/SqlSource.ts` now implements the existing Source protocol over persistent
SQL trees/blobs and namespace-specific heads. Blob hashes and exact-base writes
are checked transactionally. Tests reopen a raw file read-only, fork isolated
namespaces from retained snapshots, reuse blobs on rename, and verify rollback,
stale writes, and cancellation. This is trusted source storage, not a browser
authorization boundary. Snapshot retention/GC and production dev wiring remain.

`driver/WasmDatabase.ts` restores `@alinea/sqlite-wasm` through Rado's SQL.js
driver. Tests run the actual WASM binary against native-built checkpoints,
Graph projections/relations/grouping, lazy payload caching, live invalidation,
transaction rollback, and batched binary source reads. The adapter copies blob
columns before SQLite advances the statement: this package returns borrowed WASM
memory, and an unadapted batched read demonstrably overwrites earlier blob results.
SQL.js types are pinned to the implemented API (newer types require `updateHook`).
The installed binary reports SQLite 3.46.1 and a direct FTS5 create/insert/search
probe succeeds. Driver unit tests run WASM under Bun; the browser check below
also exercises the binary in Chromium.
The optional input is a complete database copy into WASM memory, not page-lazy
file access; it must never be used to ship private server checkpoints to clients.
Permission-scoped replica transport, browser persistence, worker integration,
and vector extension capabilities remain separate gates.

`browser/QueryWorker.ts` and `browser/WorkerGraph.ts` now provide a per-port
Comlink query bridge using the existing config-scoped Graph serialization.
Subscriptions return explicit async cleanup; closing a client suppresses late
results, rejects pending hydration reads, and releases observers without closing
other clients' ports. The worker owner still owns the runtime/connection lifecycle.
`bun test/sqlite-browser.ts` bundles and runs the actual WASM runtime in a Chromium
module worker: structural queries fetch no payloads, field projections lazily load
and reuse data, live updates cross the port, unsubscribe stops delivery, errors
survive serialization, and closed clients reject new queries. The endpoint is
exposed before asynchronous initialization, with methods awaiting readiness, to
avoid dropping early worker messages. This is not yet the dashboard cutover:
permission-scoped transport/persistence and the writable runtime must be connected
before replacing the existing worker and its Graph mutation API.

`browser/ReplicaCache.ts` adds incremental IndexedDB persistence for structural
rows with compiled permissions and sparse opaque encrypted frame bytes. Its
partition includes project, namespace, epoch, schema/config, principal, policy
view, and release. Deltas compare the exact current revision and atomically update
rows, frame eviction, and revision; unchanged payload identities retain ciphertext.
Explore-only rows cannot retain readable descriptors. The cache whitelists index
columns rather than persisting entry data or a WASM database export. Purging writes
a new generation marker before closing, so already-open handles in other tabs
cannot repopulate the old generation. Concurrent-writer, rollback, partition,
revocation, and reopen tests use IndexedDB's transaction semantics.
The Chromium fixture now commits the index before its in-memory install, terminates
the original worker, and restores a new WASM index from IndexedDB without loading
payloads. Plaintext hydration remains memory-only. This fixture supplies trusted
test grants; production policy compilation, authenticated frame descriptors and
decryption, cache-to-runtime recovery orchestration, and dashboard wiring remain.
The cache is not an authorization authority: open it only after authentication,
and authenticate cached ciphertext against its descriptor before decoding it.

`handler/Policy.ts` evaluates configured role functions against the trusted SQL
Graph and exports structural authorized rows with effective entry/field action
masks. Masks use `Policy.check`, including denials, rather than packed allow flags.
No explore grant means no exported row; explore without read omits the payload
identity. Policy fingerprints include denied/field rules in canonical order and
use a domain-separated SHA-256 digest. Compound policy evaluation/index export
retries if a runtime commit overlaps it, including content-dependent role queries.
The index snapshot reads structural/manifests only, without hydration. Compiled
field masks now survive IndexedDB restore (cache format 2); mutation enforcement
must still reevaluate the policy independently on the handler. A whole-entry read
grant with a denied field fails closed until view-specific filtered payloads exist.
These are policy compilation building blocks, not yet production authorization
endpoints or authenticated encrypted-frame delivery.

`replica/Frame.ts` adapts independent AES-256-GCM framing with random keys/nonces
and an unambiguous, versioned authenticated identity: project, namespace, epoch,
schema/config, release, entry version, payload identity/class, compression, and
lengths. Decode checks the expected handler binding, exact encrypted size, and
bounded declared plaintext size; gzip collection cancels on overflow or revocation.
Native Compression/DecompressionStream is used because the older Bun wrapper in
`@alinea/iso` does not handle cancellation safely. Unit tests cover each identity
dimension, tampering, wrong keys, mutable input capture, producer length errors,
and cancellation. Chromium also verifies compressed framing and tamper rejection.

`browser/PayloadLoader.ts` connects authenticated data-frame grants to runtime
hydration, with six bounded concurrent fetch/decode tasks and in-flight deduplication.
It validates the complete request batch before fetching, checks cache identity,
authenticates cached frames, and refetches corrupted cached ciphertext once. Only
validated ciphertext is persisted; keys and decoded entry data stay in memory.
Close clears keys and aborts pending transport/decode/cache installation. Revision
CAS prevents stale downloads from installing after an index delta. WASM runtime
tests cover index-only reads, selected-field decryption, metadata, and ciphertext
reuse without network. This is not yet the production transport: handler grant
issuance, view-filtered payload generation, bundle/range manifests and coalescing,
and full browser boot/sync integration are still required.

`replica/Transport.ts` now packs bounded ciphertext bundles and resolves scoped
frame locations through exact HTTP byte ranges. The reader checks status,
Content-Range bounds, declared/actual lengths, transfer encoding, and streaming
byte limits; malformed/oversized bodies are cancelled. Public ciphertext requests
omit credentials and reject redirects. An explicit bounded 200-response fallback
supports hosts without Range; it is disabled by default. The default fetch is
bound to the global receiver, as required in actual browser workers.
The Chromium fixture now generates encrypted frames outside the browser, serves
test grants and a range endpoint, and drives the real PayloadLoader/SQL worker.
It verifies exactly one frame range is requested, no unrelated payload is fetched,
and after terminating/restarting the worker a new grant plus persisted ciphertext
can hydrate the field without another bundle request. This is a controlled test
grant endpoint, not production authentication. Nearby-range coalescing, generated
bundle publication, handler issuance and full live transport remain outstanding.

`release/FrameStore.ts` generates encrypted data frames from normalized SQL rows
in keyset batches and persists immutable descriptors, private keys and ciphertext
in the trusted database. It rejects sparse entry data before generating frames;
duplicate identities never overwrite a key. Grant lookup selects only metadata
and keys; ciphertext lookup never selects keys. Raw-file reopen tests retain keys
and successfully decrypt the persisted frames without source parsing.
`handler/Grants.ts` re-evaluates trusted-session roles, verifies revision/view
cursors and every requested read identity before looking up any key. A commit
overlapping key lookup invalidates the result. Policy-only changes invalidate old
cursors even when the source revision is unchanged. The Chromium fixture now
uses this SQL frame store and grant service for its controlled grant endpoint.
The authenticated production router and filtered-field payload path are not wired
yet. FrameStore/GrantService do not themselves authenticate a session.

`cli/generate/ExportFrameBundles.ts` publishes ciphertext in content-addressed
files, targeting bounded bundles while reading one frame at a time. Completed
temporary files are linked into their final names without overwriting existing
artifacts; existing files must match their hash. No keys or entry mapping are
selected for public output. The private frame-location manifest commits only after
all files exist and rolls back to its prior state on failure. Completed unreferenced
ciphertext may remain after failure/repacking; retention/GC is intentionally separate.
`GrantService.published` combines authorized keys with the committed public locations
under a trusted configured base URL, rejecting unpublished frames. Tests decrypt
the exact generated file ranges, reuse immutable files without rewriting them,
and verify failed publication preserves the previous manifest and conflicting files.
The main Generate/exportDatabase orchestration now invokes frame generation and
publication. Optional `config.replica` settings supply project, namespace and epoch;
defaults use production URL/local config identity, provider branch metadata and
epoch 1. Namespaces label sources, not Git checkout instructions; epoch reset
detection remains manual. Checkpoint format 5 stores/validates all frame identity
components. BuildDatabase generates frames in the same transaction as normalized
rows and the checkpoint. ExportDatabase publishes public ciphertext under
`/_alinea/payloads/` before closing/publishing the private SQLite file and loader.
The loader exports that public base path, not keys or the private frame manifest.
Tests verify complete frame/location coverage and raw Node reopening. Both real
Next fixture variants pass for this path. Production handler/dashboard consumption
still needs integration.

Private files now live in immutable `checkpoints/<uuid>/release.sqlite` generations.
Publication closes the database, installs its generation, then atomically renames
the single `database.js` pointer. Failed builds leave the old pointer intact;
already loaded modules retain their matching database and identity after rebuilds.
Tests exercise failed publication and retained old readers. `withAlinea` reads the
literal generated path without executing the loader and includes only that
generation, rejecting malformed paths. Run generation before the Next build;
concurrent rebuilds during a framework trace are not coordinated by this mechanism.
Old/orphaned generations remain available; retention and garbage collection must
respect active readers. Atomic visibility here does not claim power-loss durability.

`runtime/BuildDatabase.ts` now builds a private checkpoint from a captured source
snapshot and build-time normalization. Source heads, normalized rows, and the
checkpoint descriptor commit together. `runtime/Checkpoint.ts` validates format,
config/release/namespace identity and matching source/runtime revisions on open.
Reopen tests query the raw file read-only without calling blob reads, whole-tree
materialization, or normalization. Source-status identity is preserved separately
from effective inherited status; inactive authored versions remain in source
storage even when Graph intentionally excludes them from its effective rows.
The initial build reuses the existing normalizer transiently, not as the runtime
query store. `NormalizeSource` persists parsed authored records by blob hash,
including versions hidden by inherited status. `ReconcileDatabase` updates an
exclusively owned writable checkpoint copy: fetch remote differences before the
transaction, reuse cached parsing, normalize, replace changed rows and append only
missing immutable frames, then advance source/runtime/checkpoint revisions together.
No-change reconciliation skips normalization entirely. Tests cover one-blob edits,
preserved unrelated SQL rows and keys, unarchiving hidden versions, reverting to
cached source records/frames, and rollback without changing the published baseline.
The normalizer still reconstructs a transient whole graph and hashes all effective
payloads; affected-subgraph normalization and stable ordinals for insert/delete
remain scale gates. Live connections must not call this offline reconciliation
function. `driver/NodeReplica` provides the writable-copy ownership baseline:
restore a compatible private cache without parsing, reconcile a separate file,
validate/open it read-only, atomically switch the restart pointer and notify live
queries. Per-query leases keep old connections open across async projections and
nested reads; close prevents new work without invalidating active readers. Tests
cover restoration, config mismatch, failed updates, malformed cache paths, swaps
during nested reads, subscriptions and close during source lookup. Disk generations
are retained, and this cache is not a cross-process mutation authority. Copy cost,
retention and an attached-overlay comparison remain scale gates. Publishing new
frame locations, production query cutover and wiring this owner into the actual
dev-server mutation lifecycle remain outstanding.

Build generation now additionally writes a closed private `release.sqlite` and a
module-relative `database.js` loader. Node can open the relocated artifact read-only,
and the installed Next NFT tracer discovers the SQLite file from that loader.
`withAlinea` merges exact artifact includes, supports route scoping, resolves hoisted
symlinks, and preserves existing tracing mappings. Browser/edge package exports
reject this private native artifact. The old source export remains temporarily
until the query/backend cutover; it is not the intended final runtime path.
`bun test/sqlite-next.ts` and its `--turbopack` variant build a real Next 16 fixture
with a custom distDir, trace both an RSC page and a Node route, and run the relocated
standalone output after deleting the fixture source. Both query the bundled SQLite
file successfully. The fixture also verifies that an unrelated route does not
receive the database and that private test data/SQLite files are absent from static
client assets. Relocation must preserve relative symlinks (including Turbopack's
external-package aliases). These checks exercise the native artifact path, not yet
the production CMS adapter or Cloudflare runtime.
Configuration fingerprinting also needs the final normalizer/config
dependency contract before dev-cache reuse is enabled.

`entry/Schema.ts` and `query/` now define separate structural/data tables and
compile basic entry queries into Rado SQL with stage-specific data dependencies.
Tests compare supported queries against the current resolver on the demo
corpus, distinguish JSON primitive types and missing/null values, and verify an
index-only query runs without a payload table. Grouping ranks matching identities
before ordering/pagination and preserves JSON primitive distinctions. Alias
projections merge both storage locations, URL alias predicates ignore malformed
rows, and nested array `includes` compiles to scoped SQL existence checks. Page
locations use a resident source-root segment rather than the URL slug. The
checkpoint format is now 5, including release identity, derived FTS and parsed source records.
Natural collation, previews, and production integration remain.

`query/Search.ts` restores SQLite FTS5 through the existing Graph search/snippet
API: quoted AND-prefix terms, accent folding, title-weighted BM25, SQL snippets,
grouping before pagination, and explicit order overrides. This intentionally uses
FTS semantics, not MiniSearch's fuzzy matching or identical scores/highlighting.
Transactional insert/delete triggers keep search synchronized with runtime row
replacement, hydration, title changes, revocation and rollback, using payload rowids
instead of scanning unindexed version keys. Native and WASM tests cover these paths.
Other SQL dialects need explicit search adapters; ordinary queries remain portable.
Browser search currently hydrates every structurally eligible payload before
returning results and fails closed if any required payload is unreadable. Separate
lazy search frames, explore-only safe-title search, query-plan scale gates and
dedicated search coverage remain outstanding. Structural queries still hydrate none.

`runtime/EntryRuntime.ts` adds atomic revision-checked deltas, sparse payload
hydration before content filtering or after structural pagination, and conservative
live-query invalidation. Superseded payload responses are discarded. This runtime
implements the typed Graph query interface, but is not yet wired into production
connections, browser transport, permissions, or dashboard atoms. Mutations remain
on the existing backend pending the writable-runtime cutover.
Structural relation projections (parents, children, siblings, neighboring entries,
translations) now compile membership to SQL and resolve nested selections at one
revision, retrying the whole projection if a delta arrives during hydration.
Eleven nested-query cases agree with the existing Graph resolver on the demo
corpus; separate tests cover locale boundaries and nested hydration races.
Relation queries currently execute per selected source row; batched relation
execution remains necessary before production cutover.
Explicit single/multiple entry-link relations now expand stored references to SQL
rows, preserving authored order and duplicates, and hydrate source link data before
resolving target membership. Nine link queries match the existing Graph resolver;
lazy-loading tests verify unlocalized targets and selected-target-only hydration.
Field postprocessors now depend on a backend-neutral link loader. SQL selections
invoke the existing field query-value hooks at the same runtime revision; direct
entry-link selections and URL suffixes match the existing resolver. Source metadata
is stored alongside lazy payloads rather than in the resident index. Full `Entry`
projections match the demo resolver; an image test verifies localized alt fallback,
preview/build URL selection, and lazy metadata hydration. Broader field parity
still needs coverage.

Verification so far: thirty-six database tests and `bun lint` pass; the existing
resolver's 41 tests also pass (77 combined).
Including the existing rich-text field suite gives 88 passing tests.
The latest repository TypeScript check also passes.
The Next adapter and native artifact export checks add fourteen passing tests
(102 in the expanded targeted suite).
The explicit standalone integration fixture passes with Next 16.2.10 under both
webpack and Turbopack; it requires permission to bind a temporary localhost port.

Status: foundations implemented; production cutover outstanding. Read [README.md](./README.md) and [SYNC.md](./SYNC.md)
before implementing. Complete each gate before expanding the cutover. No
production performance or platform compatibility claim has been verified by
these documents.

Implement one current format and one final runtime path. Refactor internal APIs
freely and use historical code as a reference rather than retaining compatibility
wrappers. The public Graph querying and mutation API must stay: preserve its
signatures and behavior, and verify both against the new runtime. Unsupported checkpoints rebuild from source; old generated artifacts
and wire protocols do not need migration paths. Restrict platform/version testing
to the support scope chosen for this cutover, not every historical Alinea target.

## 1. Recover the SQL compiler and establish parity

Use `e4e6eb8fd` as the historical reference, especially `EntryResolver.ts`,
`ResolveContext.ts`, `EntryRow.ts`, `Database.ts`, and `CreateEntrySearch.ts`.
Adapt its query generation to current Alinea expressions and installed Rado;
do not revert current query, locale, alias, link, or status behavior.

Define the minimal structural/data schema and effective relation interface.
Compare current resolver results against SQL on shared fixtures. Cover nested
JSON, null versus missing fields, boolean conditions, aliases, links, locale,
source/effective status, hierarchy, grouping, ordering ties, and pagination.
Include current regressions in `src/core/db/EntryResolver.test.ts` and `test/`.

Gate: representative structural and JSON queries execute as SQL with matching
results. `EXPLAIN QUERY PLAN` confirms indexes for ID, URL, and ordered listing
paths. Identify dialect-specific SQL explicitly. Test portable queries on SQLite
and at least one supported non-SQLite driver before claiming universality.

## 2. Prove raw SQLite packaging and file tracing

Generate a closed, consistent `@alinea/generated/checkpoints/<uuid>/release.sqlite` plus private
manifest. Checkpoint any build-time WAL before packaging; the file must be
self-contained and open read-only without requiring adjacent writable files.
Validate manifest/schema compatibility without hashing or scanning the whole
database on each cold start.

Prototype a generated server loader whose path resolution works after deployment
relocation. Native SQLite opening is preferred for Node; loading the whole file
into `new Database(bytes)` must not be mistaken for lazy file access. Probe the
actual native driver and `@alinea/sqlite-wasm` package API, SQLite version,
compile options, FTS support, initialization cost, and persistence options.
No package upgrade or extension choice is implied by historical compatibility.

`withAlinea` now externalizes `@alinea/generated` and merges exact generated artifact paths into
`outputFileTracingIncludes`, preserving user mappings, configured `distDir`, and
tracing root. Resolve actual generated package paths, including hoisted/symlinked
monorepo installations. Native add-ons or WASM assets need their own verified
packaging. Expose route scoping if necessary to avoid including a large database
in every unrelated function.

File tracing packages dependencies; runtime code opens the SQLite file. It should
not parse `.nft.json` on requests to discover its database. Prefer a traceable
module-relative loader; explicit includes cover static-analysis gaps.

[Next.js output documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
describes route-keyed includes, project-relative file globs, monorepo roots, and
standalone output. Tracing includes do not apply to Edge Runtime routes. This
also matches the inspected local Next implementation in
`node_modules/next/dist/build/collect-build-traces.js`; neither establishes that
Alinea's proposed loader works until the build fixture passes.

Gate: build a small real Next application importing the generated loader from
an RSC page and route handler. Inspect their `.nft.json` files, copy/run standalone
output away from the source checkout, and successfully query the bundled file
without network access. Test the supported bundlers and a hoisted monorepo case.
Ensure the trusted DB, manifest secrets, and keys are absent from public/client
output. Validate the chosen supported Next versions; legacy configuration branches
may be removed rather than extended for this cutover.

Cloudflare needs a separate deployment test for the chosen Next/Workers adapter
and DB binding. Node filesystem tracing is not proof of a usable SQLite VFS in
Workers. Candidate paths are a configured Rado database such as D1, or a WASM
replica with authorized index and lazy frames. An HTTP range VFS is an optional
experiment, not a prerequisite. A file locator fallback alone does not turn a
native SQLite connection into an HTTP reader.

## 3. Reconcile source changes and read consistent overlays

Implement the index's Tree view using exact file/directory metadata and stored
hashes. Adapt the current serialized `Tree`/concrete `ReadonlyTree` boundary into
a shared contract where necessary, with explicit async behavior for remote Rado
drivers. Verify tree lookup, serialization, root/subtree hashes, and diff against
the existing implementation; include modes, renames, seeds without files, multiple
source versions, and files outside the queryable entry set. Tree operations must
not open content payloads. Test that filtered replicas reveal no hidden source
tree metadata.

Port source differences, exact authored bytes, normalization, and affected-entry
replacement from `sync-engine`. Update tree metadata and query rows atomically.
Generate server SQL data and browser frames from one normalization pass.
Add/delete/move/archive/publish must preserve inherited status and source semantics.

Prototype immutable attached base plus one writable overlay. Test SQL index
usage through effective relations, deletes, data changes, FTS updates, and
reference replacement. Pin read revisions across async stages and serialize
installs. Compare with a writable-copy baseline for startup, update cost, and
memory. Select the mechanism from evidence before porting every caller.

Gate: one content edit updates only its dependent rows/frames; structural edits
touch the necessary descendants; unchanged descriptors and caches survive.
Concurrent reads see a complete old or new state. No query-layer history chain
grows with the number of applied deltas.

### Development restart and previous-database hydration

Make checkpoint restoration part of the dev server boot path in this stage.
Prefer a compatible last committed dev DB/overlay, then a compatible generated
DB; reuse its payload tables and indexes as well as its Tree. Restore before
source scanning and reconcile only the differences. Preserve valid checkpoints
through startup and publish replacements atomically. Background compaction must
not determine startup readiness.

Gate: stop and restart the dev server with unchanged files and verify zero entry
parsing, zero payload regeneration, and no FTS/reference rebuild. Repeat after an
offline content edit, addition, deletion, rename, parent archive, and branch
switch; only affected content is normalized and old cached rows cannot reappear.
Test fallback from a missing dev DB to a generated DB, reuse of matching payloads
from an older DB, incomplete persistence, missing bundles, an overlay newer than
the base release, and config incompatibility. A crash must recover from the last
committed checkpoint plus source diff without losing accepted edits.

## 4. Browser index, compiled grants, and lazy SQL hydration

Port handler-side policy evaluation and filtered bootstrap. Serialize grants with
each visible index row. Add sparse payload tables, residency by immutable identity,
query dependency planning, bounded range fetching, and transactional installation.
Persist index and payload cache incrementally and reconstruct committed state after
a worker crash. Wire loading through existing asynchronous dashboard page atoms.

Gate: compare fully populated and sparsely hydrated query results across the same
suite. Assert zero data fetches for index-only queries; projection pagination loads
only selected entries and requested linked data. Exercise mixed `OR`/`NOT`, data
sort/count/group, nested relations, unloaded versus absent payloads, empty search
and reference payloads, interrupted fetches, sync during hydration, and policy
revocation during a request. Full search/reference results require scope coverage.

### Live browser query subscriptions

Add a worker subscription API over the same SQL compiler and hydration planner,
then bridge it to query/replica-scoped Jotai atoms. Emit dependency invalidation
after commits, starting with conservative relation/class dependencies. Coalesce
reruns, share loads, preserve complete results during ordinary refresh, and
discard superseded executions. Keep local reactivity independent of remote sync
transport; polling is enough to verify the first implementation.

Gate: a matching insert appears, a delete disappears, an initially nonmatching
entry enters after an edit, and order/limit results change when an off-page entry
moves into the page. Exercise nested links, reference changes, search/vector
completion, and inherited status changes. Newly matching rows hydrate before
publication; hydration cannot create an invalidation loop. Interleave two revisions
with slow fetches and verify the older completion never replaces the latest result.
Test transaction batching, unsubscribe cleanup, reconnect catch-up, error handling,
and immediate result invalidation on permission/context changes.

## 5. Deployment catch-up, recovery, and preview namespaces

Implement the identities and exact-base cursor checks in [SYNC.md](./SYNC.md).
Keep tree reconciliation as recovery for Git-backed sources. Add a journal only
where the adapter supplies durable storage or measurements justify it. Persist
derived-data state separately from source revision when needed.

Add provider-neutral deployment binding with Vercel and Cloudflare Pages inputs,
explicit overrides, source repository/ref identity, stable artifact locations,
and read-only behavior for unmapped previews. Keep public deployment-pinned reads
separate from synchronized dashboard/editor-preview reads.

Gate: simulate build at R10, edits to R13, activation, client migration, concurrent
R14, rollback, empty handler caches, truncated/missing journals, old bundle URLs,
config incompatibility, and force-pushed/recreated branches. Source namespaces,
credentials, caches, and writes stay isolated. Test protected preview deployments
on each target host before claiming host compatibility.

## 6. Field mutations and request previews

Port field hashes and operations, define transaction atomicity, and retain source
compare-and-swap. Solve durable idempotency and ambiguous response recovery before
advertising reliable retries across instances. Field hash tables remain optional.
Implement request-scoped SQL preview composition without global mutations or
whole-database cloning.

Gate: independent-field edits merge; same-field and overlapping-path edits
conflict correctly; list identity survives insertion/reordering; structural races
respect URL/tree constraints. Retry the same transaction on two handler instances,
reuse its ID with a different body, and kill a handler after durable source commit
but before local materialization/response. No duplicate writes or lost edits.
Interleave two previews and a normal read and verify complete isolation.

## 7. Optional vectors and linked database capabilities

Add embedding manifests, content/model identity, background job completion,
invalidation, chunk ownership, permission filtering, and lazy vector payloads.
Start with an exact-search correctness baseline and a capability interface. Verify
extension support in the actual native/WASM binaries before selecting sqlite-vec
or another implementation. Compare capable remote execution with bounded local
hydration. Unsupported vector search does not prevent ordinary content queries.

Gate: stale jobs cannot install obsolete vectors; model/dimension/metric mismatch
is rejected; media/document changes invalidate the correct chunks; source-unchanged
embedding completion synchronizes; unauthorized vectors never reach clients;
global search never presents cached-only results as complete. Measure approximate
recall with permission/metadata filters when ANN is enabled.

Exercise Alinea-owned tables through a second Rado driver. Define a read-only
external mapping prototype with source-qualified links and explicit freshness.
Writable external tables and cross-source transactions require their own design.

## 8. Benchmarks and cutover

Use small correctness fixtures, synthetic scale, and the same 11,374-entry imec
project cited by `sync-engine` when available. That branch reports roughly 4.47 MB
of packed index JSON and 70 MB of entry fields, with about 41 ms index module
import/open and 3 ms for an index-only page on its development machine. These
are historical comparison points, not measurements of SQLite or guarantees.

Record cold module/driver initialization, file pages or bytes read, first/warm
queries, index boot transfer, hydration bytes/requests, SQL query plans, source
reconciliation, preview latency, concurrent writes, search/vector first use,
retained memory, cache growth, artifact size, and browser persistence time.
Scale entry count and payload size independently to expose eager loading.

Gate: cold open does not scale with payload parsing or whole-file copying on the
native path; index-only browser queries fetch no payloads; one-entry updates and
previews do not rebuild the corpus; repeated queries reuse resident inputs. Report
WASM and native behavior separately, including setup and persistence costs.

Route generated server, handler, development, browser, source, and preview callers
through the completed SQL layer. Preserve current public query tests. Remove the
superseded implementation after parity and deployment gates pass, with no runtime
compatibility code for never-released internal formats. Run `bun format`, relevant
tests, `bun lint`, and targeted `bun spec` coverage for the cutover.

## Decisions to settle with the prototypes

- Immutable-base overlay SQL and preview isolation mechanism, including FTS.
- Browser persistence strategy supported by the actual Alinea WASM build.
- Artifact duplication and server deployment size versus a hybrid payload layout.
- Durable retry receipts for Git and whether a hosted journal is worth its cost.
- Preview edits going directly to configured Git branches or an Alinea overlay.
- Search behavior across dialects and optional vector extension/provider choices.

These do not block the schema/compiler and tracing prototypes. They must be
settled before depending on their behavior in the production cutover.
