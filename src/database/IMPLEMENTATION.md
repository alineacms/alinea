# Implementation and verification plan

## Current implementation progress

`source/SqlTree.ts` now stores immutable directory metadata through Rado, skips
equal subtrees when diffing, and applies file changes by rehashing affected
directories and ancestors. Tests cover snapshots across connections, mode-only
changes, file/directory replacement, exact-base preconditions, and reopening a
raw SQLite file read-only. This is a foundation, not an integrated runtime: the
full entry compiler, source/Tree API integration, generation/NFT, dev boot,
browser hydration/subscriptions, and remaining gates below are still outstanding.

`entry/Schema.ts` and `query/` now define separate structural/data tables and
compile basic entry queries into Rado SQL with stage-specific data dependencies.
Tests compare ten supported queries against the current resolver on the demo
corpus, distinguish JSON primitive types and missing/null values, and verify an
index-only query runs without a payload table. Relations, search, grouping,
aliases, natural collation, lazy execution, and production integration remain.

Verification so far: eleven database tests and `bun lint` pass; the existing
resolver's 41 tests also pass.
The repository type check reports missing `allotment` in
`src/dashboard/app/SidebarLayout.tsx`; no SQL Tree type errors were reported.

Status: planning only. Read [README.md](./README.md) and [SYNC.md](./SYNC.md)
before implementing. Complete each gate before expanding the cutover. No
production performance or platform compatibility claim has been verified by
these documents.

Implement one current format and one final runtime path. Refactor internal APIs
freely and use historical code as a reference rather than retaining compatibility
wrappers. Unsupported checkpoints rebuild from source; old generated artifacts
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

Generate a closed, consistent `@alinea/generated/release.sqlite` plus private
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

`withAlinea` currently externalizes `@alinea/generated` but does not configure
tracing includes. Merge exact generated artifact paths into
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
