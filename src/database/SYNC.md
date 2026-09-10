# SQLite synchronization and deployments

Status: proposed. Companion to the [database architecture](./README.md).

## Authority and identities

The initial cutover retains Git/files as the durable source for existing
projects. SQL is their queryable materialization. A future SQL-authoritative
source must be explicitly configured; changing the runtime engine does not
silently change where content is owned.

| Identity                 | Meaning                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Project/source namespace | Repository or database identity plus exact branch/ref or configured content environment   |
| Source epoch             | Namespace generation; changes when history is reset or a branch is recreated incompatibly |
| Source revision          | Exact durable source tree/commit or equivalent database source token                      |
| Runtime revision         | Materialized state, including derived payload changes; can advance without a source edit  |
| Schema/config identity   | Storage/query format plus normalization and policy configuration compatibility            |
| Release ID               | Immutable built artifact and the source/runtime revision it contains                      |
| Deployment ID            | Hosting instance of an application build; distinct from the content branch                |
| Policy view ID           | Effective authorized view for the authenticated principal                                 |
| Payload identity         | Immutable normalized content identity for one entry version                               |

These are opaque identities, not sortable strings. Git commit IDs and content
hashes cannot establish which revision is newer by lexical comparison.

Current builds accept optional `config.replica` identity settings:

```ts
replica: {project: 'my-project', namespace: 'content-main', epoch: '1'}
```

Absent overrides, the production base URL identifies the project (a local config
file path is used for URL-less development), namespace comes from
`VERCEL_GIT_COMMIT_REF`, then `CF_PAGES_BRANCH`, then `main`, and epoch defaults
to `1`. Set an explicit project ID if domains move or the production URL itself
varies per deployment. Namespace labels the configured content source; it does
not check out a Git branch or redirect source reads. An explicit namespace must
match the source configuration. Bump the epoch when resetting/replacing source
history; automatic provider history-reset detection is still outstanding.
Every build gets a fresh release ID; all identity components are stored in the
private checkpoint and checked on reopen. These defaults do not enable implicit
cross-release cache reuse or change public rendering into live-content mode.

Conceptual cursor and delta envelopes:

```ts
interface ReplicaCursor {
  namespace: string
  epoch: string
  schemaId: string
  configId: string
  releaseId: string
  revision: string
  viewId: string
}

interface ReplicaDelta {
  from: ReplicaCursor
  to: ReplicaCursor
  sourceRevision: string
  entries: ReadonlyArray<EntryReplacement>
  removedVersionIds: ReadonlyArray<string>
}
```

`EntryReplacement` represents the complete visible structural row, effective
permissions, and payload identity for that version. Detailed types belong to the
protocol implementation. Deltas carry domain data, never executable SQL. Physical
SQLite pages or native SQLite changesets are not the cross-engine wire protocol.

## Build and ordinary reads

The build pins one source revision and compiled config, reconciles/normalizes it,
and generates the private query DB from that same state.
Publish the completed manifest only after all referenced artifacts exist. A
moving branch cannot change the source halfway through a release build.

Public server rendering initially remains pinned to the deployment's bundled
published content, preserving deployment-based publishing. Dashboard reads and
authenticated editor previews synchronize to the configured source head. A
future explicit live-content mode may synchronize public rendering too. This
choice must remain visible in adapter configuration and cache keys; do not
silently turn every RSC read into a remote synchronization request.

RSC, handler, and browser have independent caches. The handler coordinates
authentication, source refresh, policy evaluation, mutations, and replica state.
Each process opens the release or its filtered replica and queries locally.
An authorized synchronization response streams exact readable payload rows from
that pinned database state.

## Browser bootstrap and delta installation

1. Authenticate against the deployment's handler and obtain the exact source,
   release, config, principal, and policy binding.
2. Submit a compatible cached cursor, or request a full filtered index.
3. Receive unchanged, a delta with an exact base cursor, or a full filtered
   index snapshot. A full index snapshot does not imply full content hydration.
4. Stage rows, permissions, payload identities, and tombstones.
5. Commit a complete next replica state and revision atomically. Invalidate
   stale payload residency; retain unchanged permitted payloads by identity.
6. Hydrate required payload classes when query stages ask for them.

Only return unchanged when both data and policy bindings match. A read-to-explore
transition removes payload identities and resident content; explore-to-read adds
readable payload identities; loss of explore removes the row. A policy change may use a full
filtered index instead of a cross-view delta. Never expose old view data during
the switch. Deletes remove dependent search/reference rows as well.

If payloads are in IndexedDB while active query state is in WASM memory, these
are not a distributed transaction. Persist a complete committed checkpoint first,
then install its in-memory generation; after a crash reconstruct only a committed
generation. Reject stale fetch completion after revision or view replacement.

After installing a committed replica revision, invalidate affected live browser
query subscriptions. Their planner hydrates any newly required payloads and
publishes complete replacement results; receiving a delta must not expose partial
query results. Remote revision notifications or polling trigger this same sync
path, so live queries also recover after a missed notification or reconnect.

## Catch-up while a deployment builds

Example: release B begins building from R10 while release A is serving. Editors
commit R11, R12, and R13 before B activates. B still contains R10. Activation must
not reset the durable head to R10, and clients must not lose R11–R13.

| Event                                 | Required behavior                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| B pins R10                            | Record exact source, schema/config, and immutable payload binding                                    |
| R11–R13 are accepted                  | Commit to the same durable source namespace; publish recoverable live state                          |
| B activates                           | Its dashboard/preview handler catches up from R10 to source head; public pinned reads still use R10  |
| Client from A connects to B           | Validate namespace/epoch/config; send compatible transition or replace the filtered index            |
| R14 races with catch-up               | Finish one pinned state, then catch up again; never combine mismatched manifests                     |
| A remains reachable or is rolled back | Recover using its own compatibility contract; never assume newest release assets exist at its origin |

A durable logical delta journal can accelerate catch-up, but is optional for a
Git-backed installation. If the journal is absent, truncated, or incompatible,
diff the release index's Tree view against a pinned current source tree. Fetch
and parse changed blobs only, recompute affected structure, and materialize the
result. Return a complete filtered index when the client's exact base cannot be
reconstructed economically. This retains selective payload loading.

For sources that cannot recover snapshots/tree differences, the source adapter
must supply a durable journal or replacement snapshot. An instance-local latest
delta is only a fast path. A journal, when configured, commits rows, revision,
and outbox records atomically in its authoritative SQL store; background delivery
can retry. It may coalesce many transitions into one exact-base response.

Retain immutable release databases for active and rollback deployments. An old
deployment serves its own checkpoint; authenticated live payloads come from its
current compatible replica rather than static payload bundle URLs.

Schema/config changes require compatibility checks before replay. Reconcile
with the deployment's matching schema when supported; otherwise return a clear
reload/redeploy requirement and disable incompatible writes. An old handler
must not normalize new-schema content using an incompatible configuration.
Force-push, branch deletion/recreation, and source remapping can require a new
epoch and a replacement snapshot, with outstanding edits surfaced for rebase.

## Vercel and Cloudflare preview branches

Build a provider-neutral deployment context with explicit configuration taking
precedence over provider metadata. Persist the resolved binding for runtime use.
Existing `src/cli/util/CommitSha.ts` detects commit SHA but does not establish the
source namespace or whether writes are allowed.

Vercel exposes deployment and Git metadata including `VERCEL_ENV`, `VERCEL_URL`,
`VERCEL_GIT_COMMIT_REF`, and `VERCEL_GIT_COMMIT_SHA`; use the actual configured
project/source mapping rather than interpreting a URL as write authority.
See [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables).

Cloudflare Pages supplies `CF_PAGES_BRANCH`, `CF_PAGES_COMMIT_SHA`, and
`CF_PAGES_URL` during builds. Workers deployments need their own adapter/binding;
do not assume Pages variables exist in every Cloudflare runtime. See
[Cloudflare Pages build variables](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables).

The proposed initial mapping is a preview deployment to its configured Git
branch, with exact repository identity included. Branch names alone are not
globally unique, especially for forked pull requests. Missing credentials, an
unknown source mapping, or a detached commit yields a read-only preview unless a
write target is explicitly configured. Never silently fall back to production.

Whether preview edits commit directly to that branch or use a separate Alinea
content overlay remains a product decision. Both use explicit namespaces; the
initial implementation should support the existing branch-backed source without
requiring an automatic branch-creation or merge service. Promotion/merge follows
the chosen source workflow and builds a release; promoting an application URL
alone does not retarget the database's write namespace.

Keep handler URLs, preview tokens, browser caches, payload origins, and pending
operations bound to the namespace and permitted deployment origins. Bind editor
preview sessions separately from hosting preview deployments. Deployment
protection and custom domains must be covered by adapter integration tests.

## Mutations and concurrent editors

Port `sync-engine` field operations: set, add/remove set item, and move list item,
with transaction ID, base revision, entry version, JSON pointer, and expected
field hash. A stale global revision may still accept changes to untouched fields.
Return explicit local/remote values for a conflicting path. Preserve the API's
defined atomicity; proposed default is all-or-nothing per submitted transaction,
with independent submissions able to merge.

Field hashes can be computed from the few affected loaded entries. A persisted
field-hash relation is an optimization to measure, not a mandatory extra index.
Validate parent/child path overlap and hash effects, including replacing an
object while another edit targets a nested field. Numeric array offsets are not
stable under concurrent insertion: resolve item operations through stable item
IDs and test reorder/delete/edit conflicts explicitly. The existing implementation
hashes the addressed collection for item operations, so automatic merging of
different list items is additional work, not an existing guarantee.

Structural commands validate ancestry, URL claims, versions, and affected
descendants against the accepted head. Permission evaluation occurs at commit
time against trusted state. Authorization failure rejects the transaction.
Presence/cursors and character-level collaborative rich text are separate
features; per-field optimistic concurrency does not provide them automatically.

For Git authority:

1. Refresh and pin the source head; load affected entries and evaluate access.
2. Check field/structural preconditions and prepare exact source changes.
3. Commit with source compare-and-swap against the pinned head.
4. On a source race, refresh and recheck/rebase; do not overwrite the new head.
5. After durable success, materialize SQL rows and runtime deltas. If the process
   dies here, the next handler recovers the accepted commit by source diff.

A local SQL transaction cannot atomically commit a Git change. Never report an
edit as durable merely because an ephemeral SQLite overlay committed. For SQL
authority, affected content rows, authoritative revision, idempotency receipt,
and journal/outbox can share one transaction where the driver supports it.

Retries need durable idempotency scoped by namespace, principal, transaction ID,
and request digest. Reusing an ID with a different body is an error. The branch's
process-local transaction cache is insufficient across serverless instances.
For Git, prototype a source-carried receipt or configured durable receipt store
that can recover an ambiguous commit response. Do not promise exactly-once
behavior until that commit/receipt gap is solved.

Keep unacknowledged editor operations separate from acknowledged replica state.
After sync or reconnect, rebase pending operations and expose conflicts; replacing
the local replica must not erase unsent work.

## Request-scoped editor previews

Apply preview replacements to effective SQL relations before filtering, ordering,
search, and pagination so entries can enter or leave results. A preview includes
only changed entry versions and any truly affected structural descendants.

Use request-bound overlay relations/parameters or an isolated connection strategy
that preserves the shared immutable base. Never mutate a shared connection and
rely on rollback while other requests can read it. SQLite connection pools,
temporary tables, FTS behavior, and lifetime of prepared statements need a
prototype before selecting the mechanism. No full database export/clone per
preview, and no global search rebuild per keystroke.

## Development hydrates from previous databases

The dev server must start from a previous compatible database, including its
queryable payloads and derived indexes. Reusing only the source tree while parsing
every source file again does not satisfy this requirement. Preserve the most
recent committed development state across restarts, including accepted changes
since the last generated release. A generated build database is also a valid
starting checkpoint when its source and config bindings match.
These are previous databases in the new format, not a requirement to import
historical Alinea database formats. Rebuild incompatible caches from source.

1. Resolve the latest committed compatible dev checkpoint; otherwise try a
   compatible generated release. Validate namespace, storage version, config,
   normalization identity, and availability of the checkpoint.
2. Open the previous SQLite database and any committed overlay as the starting
   state. Reuse resident entry data, search/reference indexes, and manifests
   without exporting the complete database through JS.
3. Obtain the previous source Tree from its SQL index. Seed the filesystem
   scanner with stored fingerprints, compare the current working tree, and
   read/hash only changed candidates. Source hashes remain authoritative.
4. Diff the trees. For an unchanged source and config, finish startup without
   loading or normalizing unchanged content. For changes, fetch/parse only changed
   source blobs and reconcile affected rows, leaves, and ancestor hashes.
5. Complete reconciliation before exposing the ready dev state. Atomically
   advance the in-process revision and persist a recoverable checkpoint; optional
   compaction may run afterward. Do not require full export before becoming ready.

Previous databases can also supply matching payloads that are absent in the
chosen checkpoint. Reuse only exact content/derivation identities within the same
trust scope, and use the current tree to decide membership: an older cached entry
must not resurrect a deleted file. Validate actual bytes/index availability rather
than trusting a residency flag. Missing optional cache data may hydrate lazily;
missing source bytes must be recoverable from the source or invalidate that
checkpoint. Avoid retaining a chain of old DBs to answer ordinary queries: pin a
bounded base/overlay set or import the needed cache rows, then release old handles.

Checkpoint persistence must survive interrupted writes. Publish the manifest
only after its database/overlay is durable; retain the
previous valid generation until the replacement is complete. A crash before
persistence recovers uncheckpointed accepted edits by diffing the durable source.
Never overwrite a valid checkpoint with an empty DB during process startup.

Only the absence of a usable checkpoint or incompatible normalization requires
a full source rebuild. On config changes, distinguish reusable exact source bytes
from normalized rows and derived indexes requiring regeneration. Do not serve
old-schema results under the new config; reuse compatible data where provable.

Development uses the same SQL queries, Tree-based source reconciler, permissions,
and lazy browser protocol as production. The browser may restore its own scoped
replica independently; it must synchronize with the ready dev server afterward.
Source repair remains an explicit operation. Config changes reload compatible
worker/config state or replace the replica.
