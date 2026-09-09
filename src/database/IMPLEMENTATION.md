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
detection remains manual. Checkpoint format 6 stores/validates all frame identity
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
storage and private query rows even when Graph excludes them from normal results.
The resident `visible` flag distinguishes effective rows from suppressed authored
versions. Trusted mutation reads opt in through `internalSourceVersions`, a symbol
that JSON Graph transport cannot carry; normal SQL/JS queries remain unchanged,
and browser policy views omit suppressed versions. Tests compare both query modes
under inherited archive status and verify serialization cannot enable the opt-in.
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
frame locations and production query cutover remain outstanding.

The CLI build and dev paths now pass a config-bound private cache into `DevDB`,
using separate build/dev directories. Ordinary
Graph queries and subscriptions use `NodeReplica`; source writes reconcile SQL
before returning, and the served revision follows the ready SQL snapshot. Media
effects reject a stale filesystem revision even while an older SQL snapshot
is still being served. Watcher/config teardown closes the owner and prevents late
cache emissions. Integration tests exercise filesystem-backed Graph updates, live
results, restart reuse and watcher shutdown. SQL-configured dev startup, seeding,
reads, writes, fixes, references and previews no longer build the legacy index.
An unchanged restart test verifies zero source-record parsing. Preview routing
now uses the leased snapshot and request-local overlay described below; there is
no catch-all query fallback. `DevDB` now extends WritableGraph directly, requires
a SQLite cache and has no legacy index/resolver instance. Its remote source-sync
adapter serializes filesystem updates and reconciles SQL before returning. Tests
disable EntryIndex synchronization, seed and mutation readers, and exercise
snapshot replacement, source deletion, restart reuse and closed-owner rejection.
The HTTP handler depends on a Graph/source/commit interface instead of the
concrete LocalDB class. Existing production adapters still use LocalDB; this does
not claim their cutover.

Release export now captures a leased immutable NodeReplica generation into its
private staging directory (exclusive destination, opportunistic filesystem
clone). It validates configuration/namespace/schema and source revision, replaces
the copied frame store with fresh release-bound keys/ciphertext, and updates the
release descriptor without parsing source records or reconstructing EntryGraph.
The temporary legacy source module is exported from the same SQL source snapshot
and stored beside the immutable checkpoint. Its separate compatibility loader
and the database loader are individually atomic pointers, not a joint atomic
switch; production legacy-adapter removal is still required. Tests advance and
close the working owner after capture, forbid parsing/normalization during
export, verify the retained revision and decrypted data, reject scope mismatch
and destination overwrite, and retain existing relocation/NFT and failed-build
checks. Copy cost, retained source history and fresh frame encryption remain
explicit build costs, not an incremental normalization claim.

Private checkpoint format 7 adds `alinea_entry_reference`, keyed by authored
version and reference ordinal with an indexed target ID. Build and reconciliation
use the existing field reference extractors and commit reference replacements or
removals with the source/index/payload transaction. Unchanged payload references
are retained; status, visibility and locale filtering join current structural
rows. `NodeReplica.referencesTo` leases the immutable snapshot, and dev reference
lookups no longer materialize the JS index or parse source records on restart.
Tests compare all status/locale modes, duplicate and media links, hidden versions,
reconciliation, removal and rollback after extraction failure. Queries still work
with no resident entry payloads. This is a complete private checkpoint index, not
a browser authorization boundary: permission-scoped reference frames and sparse
browser coverage remain to be implemented.

Explicit dev content fixes now use `runtime/FixDatabase` to compare SQL Graph
entry values with their authored blob hashes and prepare updates through the same
SQL mutation compiler. `NodeReplica.requestFix` keeps planning on one leased
snapshot under its update queue; dev commits the resulting request through the
filesystem authority. It is intentionally full-content maintenance, not a startup
scan. The integration test disables JS indexing, normalizes a compact source
record without changing its content, and verifies a second fix leaves the source
revision unchanged.

`driver/NodeOverlay` now provides a request-local storage prototype: a fresh
in-memory SQLite database attaches the immutable checkpoint read-only and uses
TEMP views to merge complete changed versions with untouched base rows. A mask
handles replacements and removals across index/data/payload tables. Nested Graph
queries share the same view, and in-flight reads retain their connection across
close. Tests interleave two overlays, query nested children and data predicates,
check identity failures and conflicting masks, and verify the original file is
byte-for-byte unchanged with no copy files or source reconstruction. Callers
supply normalized rows; the snapshot owner's preview adapter and merged search
integration are described below.

`runtime/NormalizePreview` now normalizes existing-entry data previews from the
edited identity's authored versions and ancestors, read directly from the private
parsed-record cache. Fixed physical paths and authored statuses mean these data
edits do not require reconstructing descendants. Only changed normalized rows are
returned for the attached overlay; original ordinals and untouched base rows are
retained. Tests compare full Graph results and nested children across all status
modes under published/archived ancestors, with 100 unrelated entries present. A
child edit reads three records, a root edit one, and each parses only the supplied
preview record. New-identity and translation support are described below.

New authored versions of an existing identity (for example a draft or archived
version) now use a recursive structural query to include descendants as well as
ancestors. Normalization updates their inherited status/visibility in the overlay
without touching unrelated rows. Private checkpoint format 8 spaces source
ordinals to reserve integer insertion slots for these request-local versions;
tests include an unrelated entry with the same order key. Existing source paths
cannot be claimed by another identity, and new versions must share the existing
physical entry directory. Tests compare added draft/archive versions under both
published and archived ancestors across all status modes.

Type and order previews now use the same bounded normalization. The existing
authored-version consistency checks reject changing only one of several versions
to an incompatible type/order; unknown types also reject explicitly. Tests cover
custom type URLs, ancestors and children, and moving entries onto occupied sort
keys without loading unrelated records. Checkpoint format 9 assigns tie ordinals
by flattened source-path identity order, not by the editable sort key, retaining
each identity's locale/version grouping. This keeps tie placement correct when a
preview changes an entry's key. Source files are sorted before reconstruction,
avoiding traversal-dependent placement of a parent after its child directory.

New-identity previews now load the physical parent's ancestors and existing
versions under the new directory. This correctly adopts previously orphaned
children and recomputes their inherited status, paths and URLs, without loading
unrelated payloads. New identities append a request-local tie ordinal; existing
rows keep theirs. Tests compare all status modes and nested children with Graph,
cover empty checkpoints and published/draft/archived inserts, and verify one parse
and only affected source records with 100 unrelated entries. Exact-file and
cross-status directory collisions reject, as do noncanonical source paths and
attempts to move an existing locale by adding it at another directory.

New translations reuse all authored versions of the identity and its ancestors,
and include the physical destination parent and subtree. Graph consistency checks
validate workspace/root/type/order and matching parent identities; mismatched
same-locale paths and unrelated destination parents reject. A new locale appends
within the identity's reserved ordinal slots, preserving grouping with existing
locales and versions. Tests compare all status/locale modes, localized parent
paths, inherited archive status and newly adopted children against Graph.

The snapshot owner's preview path now connects decoding, revision checks, Graph-
based patch application, bounded normalization and the attached row overlay.
`applyPreview` depends on Graph rather than LocalDB, so it can apply the existing
wire format without a JS index. Encoded requests must match the leased source
revision; invalid patches reject. Tests run two distinct entry previews using the
same marker alongside a patch preview and a normal query, and hold a preview
across a base swap and owner close while nested reads retain the original view.
No preview publishes files or changes the source revision. SQL-configured DevDB
now routes previews through this same owner and removes its legacy indexing
boundary. The restart integration test makes both the old index and resolver
throw, then verifies edited/search and new-entry previews, isolation from normal
reads, and only one supplied-record parse for the first preview.

Overlay FTS investigation ruled out replacing FTS shadow tables with views (the
installed SQLite rejects dropping the protected shadow tables). The ranking path
now has tested read-only primitives in `query/FtsStatistics`: decode documented
FTS5 corpus/document token counts and reproduce the configured weighted BM25
formula. Native and WASM tests compare scores directly with SQLite for multiple
phrases and common terms, exercise attached databases, empty documents and
multi-byte sizes, and reject malformed records. See SQLite's
[FTS5 storage and ranking documentation](https://sqlite.org/fts5.html).
`query/MergedFts` now merges base and overlay vocabulary postings, excluding
replaced/deleted base rows and adjusting corpus statistics before scoring. SQLite
tokenization preserves accent folding and phrase positions; indexed term ranges
avoid scanning document text. Native tests compare the complete match set and
numeric ranks with a freshly rebuilt reference index, including overlapping
prefixes, duplicate terms, replacements and deletions. The corresponding WASM
gate remains explicitly skipped: the installed 0.1.18 binary reports "out of
memory" when creating TEMP FTS/vocabulary tables. This is a native overlay
primitive, not a claimed browser capability.

`query/OverlaySearch` now connects these matches to the existing Graph compiler
through a queued search-plan provider. Each immutable overlay caches query-scoped
version/rank rows; nested and concurrent searches cannot overwrite one another.
Snippets read the matched document from its original base or overlay FTS index.
The merged data view's missing implicit rowids do not matter: search resolves
version identities through the explicitly qualified source tables. Native Graph
tests compare a rebuilt reference corpus for ranking, snippets, pagination,
counts, grouping, ordering, filters and concurrent nested searches, with more
than one batch of matched identities. Revision-bound snapshot previews can now
search their edited view, including through DevDB. Browser overlay FTS still
requires a compatible storage strategy.

`replica/Operations` now implements detached, all-or-nothing field CAS with
canonical JSON hashes, strict pointers, overlapping-path rejection, and stable-ID
collection operations. Numeric array offsets are rejected; collection operations
still require the entire collection hash, not automatic independent-item merging.
`handler/SqlFieldWriter` is a SQL-authoritative content writer, not a Git/cache
adapter: trusted role checks, source/derived-row/frame changes and a principal-
scoped request-digest receipt commit in one transaction. Reopened receipts dedupe
successful retries, reject changed bodies and never bypass current authorization.
Before/after source roots are retained for future delivery. Tests cover independent
stale edits, whole-transaction conflicts, reopened retries, revocation and rollback.
Writes require read/update rights and publish rights for published versions;
path/metadata/aliases and derived structural changes are rejected pending the
structural stage. Full Graph mutation routing, Git-carried durable receipts,
outbox delivery, concurrent-connection retry policy and production authority
configuration remain outstanding; dev writes still use the existing Git/FS path.

`EntryTransaction` now plans through a Graph-backed `MutationReader` instead of
directly reading an `EntryIndex`. The legacy adapter retains sequential batch
semantics, while `handler/SqlMutationRequest` prepares the same source commit
request through SQL queries. It advances an exclusively owned writable connection
inside a transaction, then rolls back all intermediate source, index, payload and
frame changes before returning. This is preparation only: the Git/FS authority
still has to accept the request against its exact source revision. Tests compare
rename, publish, unpublish, archive, move, remove and create-then-update requests,
and verify rollback on successful preparation and failed later operations.
Dev mutations now use this adapter through `NodeReplica.request`: a private
scratch copy (reflink where supported) supplies the writable connection, never a
published reader file. Preparation shares the owner's update queue and cleans
scratch files on success, denial, failure and close. It neither publishes a
snapshot nor notifies live queries. The existing filesystem commit remains
authoritative and reconciles SQL before acknowledgement. Tests disable the legacy
mutation reader during a real dev Graph update, verify unchanged published state
during preparation, and close an owner during a pending request. Per-operation
reconciliation still rebuilds the transient normalizer graph; removing that cost,
scratch-copy costs and seed/reference boot dependencies remains cutover work.

`runtime/SeedDatabase` now discovers missing configured pages through structural
Graph reads. Dev sync applies each yielded seed through the SQL mutation reader
and filesystem authority before considering the next seed. It preserves nested
parents, shared IDs across locales, config-only default titles and renamed seed
identities. Tests disable JS seeding, create four localized parent/child entries,
rename a parent, edit it again, and verify repeat sync/restart does not duplicate
seeds or republish an unchanged checkpoint. Normalization now resolves retained
seed markers when a renamed entry or descendant no longer has its configured
physical path. Dev startup no longer builds the legacy index or calls its seeding
algorithm. Seed-marker lookups currently
scan structural rows in the root; direct indexed seed lookups remain an optimization.

Dev writes and sync now share one owner queue. Before media effects, SQL-mode
writes refresh and compare the filesystem source revision, validate added blob
hashes and the proposed target tree, then commit the source and reconcile SQL.
Tests submit two requests with the same base revision and verify one commits while
the stale one cannot remove media; malformed blob/target hashes are also rejected
before effects. This is per-instance serialization, not cross-process filesystem
locking or atomic media/content delivery. Those durable authority guarantees still
require the later source receipt/outbox work.

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
the complete production CMS adapter or Cloudflare runtime.

`driver/NodeCheckpoint` now opens deployment-pinned Graph reads directly on the
read-only artifact, with descriptor validation and leases for pending asynchronous
projections. It does not copy the database, parse source or synchronize it. The
generated Node loader exposes `openDatabase(config)` through the packaged native
driver. NextCMS uses that Graph for build-phase queries without preview cookies;
tests forbid legacy initialization and verify checkpoint failures do not fall
back. The real Next standalone
fixture now calls this generated Graph opener rather than hand-written SQLite
queries. Package declaration generation also required explicit named Graph/edge
return types on query helpers, avoiding inferred leakage of an internal symbol.

The live-replica bootstrap now accepts a packaged checkpoint directly. Initial
reads and unchanged syncs use that file in place; the first real delta forks an
exclusive working file, opportunistically cloning it before SQL reconciliation.
Packaged-baseline cache reuse requires the exact release identity as well as the
normal configuration/namespace/epoch checks, unlike dev restart reuse. Tests
verify zero cold parsing/copy files, previews over the packaged path, one changed
record parsed during catch-up, unchanged packaged bytes, same-release restart
reuse, and isolation from another deployment's cached revision. The generated
loader exposes `openReplica(config, directory)` for this path.

NextCMS now uses the SQLite replica for live Node reads and previews as well as
the pinned reader for builds. Configured sync intervals and disableSync retain
their behavior; explicit query previews are no longer lost when there is no
preview cookie. The default live owner uses a fresh process-local temporary
directory, avoiding shared cross-process writable caches. Failed opens remove
their temporary directory; successful-owner generation retention/GC remains a
separate lifecycle task. Native opening stays inside the generated package's
Node export; Edge/dev client routes still use the HTTP Graph API. Mutations and
uploads still forward through the authenticated client.

Live preview patch verification, normalization and nested queries now share one
snapshot lease. A valid per-file patch may apply across unrelated tree changes;
an unavailable base allows one remote catch-up attempt, while an invalid patch
against the current revision fails immediately. Failure never silently removes
the preview. Tests cover normal catch-up, disabled sync, cookie/direct previews,
concurrent reads, missing/invalid patch bases and a sync/close between base lookup
and preview querying. The real webpack/Turbopack fixture now installs the built
package in isolation and invokes NextCMS from the relocated deployment, including
an authenticated Edge-to-Node query. The production HTTP handler's own legacy
database, permission-scoped browser bootstrap/deltas, and Cloudflare deployment
remain separate unfinished integration work.

The Node replica now exposes leased source tree/blob reads and `acceptCommit`
for the handler's post-authority cache handoff. It validates the exact base,
content hashes and resulting tree revision, then publishes via the same serialized
immutable-generation path as remote catch-up. Replaying the current target is a
no-op; an intervening remote generation rejects the stale handoff. No source or
media write happens here, and this is not a durable mutation receipt. Tests cover
validation failure without publication, restart reuse, races with remote sync,
and blob-stream leases through sync/close/cancellation.

The Next Node handler now shares the CMS replica through `ReplicaDatabase`, a
Graph adapter that prepares SQL mutations but only caches commits accepted by the
remote source. The handler's source contract only requires read access, and SQL
previews use the replica's single-lease preview/catch-up path. Legacy preview
fallbacks also fail closed when patches cannot apply. An adapter integration test
covers API-key reads, rejection of API-key-only mutations, authenticated source
writes, hooks, updated SQL queries and isolated previews. The Edge handler still
uses its explicit legacy path until a portable SQLite owner is available; this
is unfinished integration, not the target architecture.
The real webpack/Turbopack fixture now routes its authenticated Edge query through
the actual Node handler. Cache conflicts after a successful authority write trigger
catch-up only, outside the authority-conflict retry loop; an integration race test
verifies that an intervening remote edit does not resubmit the accepted mutation.

Authenticated Node handlers expose `POST ?action=replicaIndex` as the first browser
bootstrap boundary. API keys alone cannot obtain this user view. The handler
catches up before evaluating verified/enriched session roles, ignores caller
identity/roles, and emits a versioned index with full replica identity, policy
view ID, revision and compiled row/field permissions. Responses are private and
no-store. One replica lease binds graph-backed role evaluation, row projection
and identity even through concurrent sync/close. Tests cover that lease, hidden
rows, forged roles/principals, policy-only revocation, and absence of payload data.
This is currently a full filtered index response; dashboard consumption, tree
deltas and filtered-field payloads remain unfinished.

`POST ?action=replicaPayloads` now delivers lazy encrypted data frames through the
authenticated handler, including live frames without published bundle locations.
The request carries the complete bootstrap identity/revision and at most 100
version/payload pairs. The handler bounds actual request bytes (64 KiB), catches
up, verifies session principal and deployment binding, and reevaluates the current
policy view before reading any keys. A single immutable lease covers grants and
ciphertext; the batch is capped at 32 MiB of ciphertext before reading frame bytes.
The base64 wire envelope includes keys only in a private, no-store response; only
ciphertext may enter browser persistence. Integration tests decrypt authorized
payloads and reject API-key-only access, foreign principals/releases, unreadable
entries, duplicate/oversized/malformed requests and policy/content-stale cursors.
Browser wire validation/loading, filtered-field frames and CDN optimization remain
unfinished. Mixed field-read policies still fail closed rather than grant an
unfiltered frame.

`HttpPayloadLoader` now connects this endpoint to the existing lazy SQL loader.
It captures one replica identity/revision, deduplicates overlapping version/payload
loads, limits HTTP concurrency to six, disables fetch caching/redirects and bounds
streamed response bytes. Complete envelope validation checks principal/view/release,
revision, exact requested membership, frame class, descriptor sizes and base64
lengths before decryption or persistence. Grant keys are copied into the short-lived
decrypting loader and cleared on completion/close. Authorization/stale-cursor
responses close the loader and notify the owning session to discard its SQL view.
Tests cover lazy WASM hydration, ciphertext-only IndexedDB persistence, malformed
envelopes, session invalidation, late responses after close, and the actual Node
handler-to-browser-loader path. This initial inline transport requests one frame
per deduplicated load; grant batching/CDN reuse and the dashboard/session owner
are still unfinished.

`ReplicaSession` now owns one authenticated browser Graph generation: it validates
the bootstrap's authority binding, status/structural fields and permission masks,
explicitly projects structural columns, then builds an in-memory WASM database.
SQLite rows always come from the fresh authenticated bootstrap, never cached rows.
An optional identity-scoped IndexedDB cache retains only index/ciphertext; a fresh
session still obtains fresh grants before decrypting cached frames. Close gates
new and late query results immediately, aborts loaders and drains pending reads
before closing SQLite. Revocation closes and purges the cache; logout can also
purge an already ordinarily closed session. Tests cover lazy hydration, reopen,
strict bootstrap filtering, revocation, cache purge and the actual Node handler
bootstrap/payload-to-WASM session path. Generation refresh/live-query ownership
and dashboard integration remain unfinished.

`ReplicaSession.connect` now obtains that bootstrap through authenticated HTTP
before allocating its ready Graph. The bounded fetch requires a 200 JSON response,
disables caching/redirects, captures the expected identity before awaiting I/O,
and cancels rejected or over-limit bodies. Startup cancellation is checked through
WASM/cache initialization and closes partially opened resources; it does not own
the lifetime of an already-ready session. Tests cover the handler-to-session HTTP
path, no payload fetch for index-only reads, invalid authority/content, chunked
response limits and cancellation before or during bootstrap. Generation refresh,
live-query ownership, incremental deltas and dashboard integration remain open.

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
checkpoint format is now 6, including release identity, derived FTS, parsed source records and authored-version visibility.
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
