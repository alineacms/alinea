# SQLite database architecture

Status: proposed architecture for `back2sqlite`. These documents describe the
target and its verification gates; they do not describe an implemented cutover.
See [synchronization](./SYNC.md) for revision, deployment, and mutation semantics,
and [implementation](./IMPLEMENTATION.md) for the sequence of work.

## Direction and historical foundation

Alinea should query a relational database through Rado, using SQLite as its
default embedded storage format and `@alinea/sqlite-wasm` for browser replicas.
Retain Alinea's public Graph API for both querying and mutations. Translate
queries into SQL and route existing mutations through the new runtime. Preserve the
`sync-engine` work on incremental source reconciliation, compiled permissions,
lazy payloads, entry-level replication, and field-level mutations.

The last complete historical SQL implementation is available at
`e4e6eb8fdf4bdbabf7ed02576da2403d8eedbb32`, immediately before the removal in
`7cd7fcf59`. Inspect it without switching branches:

```sh
git show e4e6eb8fd:src/backend/resolver/EntryResolver.ts
git show e4e6eb8fd:src/core/EntryRow.ts
git show e4e6eb8fd:src/backend/Database.ts
git show e4e6eb8fd:src/backend/db/CreateEntrySearch.ts
git show e4e6eb8fd:src/dashboard/util/PersistentStore.ts
git show e4e6eb8fd:src/cli/util/ExportStore.server.ts
```

That resolver already compiled JSON predicates, projections, nested relations,
grouping, ordering, pagination, and recursive hierarchy queries into Rado SQL.
The schema indexed structural fields and used FTS5 for search. The generated
store was exported into JavaScript as base64; browser persistence exported the
whole database to IndexedDB. Restore and adapt the query compiler with current
query semantics and Rado APIs. Whole-file JS embedding, whole-database clones,
and whole-file persistence on every edit are not target behaviors.

The other reference is `303001ad6` on `sync-engine`, particularly
`src/database/README.md`, `SYNC.md`, `runtime/`, `replica/Operations.ts`, and
`handler/`. Its JSON index and JavaScript resolver are implementation choices;
its loading, access, source fidelity, and revision guarantees are requirements.

## Compatibility scope

Prefer a clean cutover. Historical code supplies useful algorithms and behavior
tests; it does not require retaining old storage formats, internal class APIs,
generated modules, replica protocols, or parallel resolvers. Refactor the Tree,
Source, and query boundaries together when that simplifies the implementation.
The public Graph querying and mutation API is a compatibility boundary: preserve
its signatures, expression shapes, and observable behavior. Internal refactoring
does not authorize Graph API changes. Preserve authored content and query/mutation
semantics rather than every historical implementation detail.

Use one current internal format. Incompatible dev databases and browser caches
can be discarded and rebuilt from durable source; no migration framework or
legacy readers are required for these caches. Checkpoint reuse targets databases
produced by the new architecture. Supporting old base64 SQLite exports or the
`sync-engine` JSON/frame format as startup inputs is outside this plan.

Compatibility checks still protect correctness during overlapping deployments:
accept a supported same-format state or require a fresh snapshot/reload/rebuild.
They do not imply support for arbitrary old application versions. Preserve
authored content and unacknowledged edits separately from disposable caches;
reject incompatible pending operations visibly instead of dropping them.

## Required properties

- Opening a generated database performs no full source parse, normalization,
  payload hydration, or content index rebuild.
- Structural queries use SQL indexes. Hydration follows query dependencies;
  projection-only fields are fetched after pagination whenever semantics permit.
- Changes update affected entry versions and derived rows. Structural edits may
  affect descendants whose inherited status, ancestry, or URL actually changes.
- A read observes one coherent revision across SQL stages and lazy fetches.
  Installing a replacement never exposes a mixture of old and new data.
- Browser replicas contain only authorized index rows and readable payloads.
  Permissions are evaluated by the handler, including content-dependent rules.
- Static releases remain immutable. Live changes survive handler instance loss
  through durable source recovery or a configured durable synchronization store.
- Unchanged payloads remain usable across revisions. Reads have a bounded
  storage lookup depth, independent of how many deltas have been received.
- Source operations retain exact authored bytes, filenames, and hashes. Query
  defaults and normalization must not rewrite source on ordinary reads.
- Deployment previews, editor previews, content revisions, and authentication
  views have distinct identities.
- Rado supplies the common SQL layer. Storage transport, full-text search, and
  transaction capabilities are explicit adapter concerns.

## One logical schema, different population strategies

A trusted server opens a prebuilt SQLite file with queryable content already
present. A browser creates the same logical entry tables, synchronizes its
authorized index, and progressively inserts permitted payloads. The SQL compiler
and result semantics are shared; the planner knows which payloads are resident.

The initial schema is conceptual, not a final migration. Table names are
prefixed with `alinea_` in an external database. Each database is scoped to a
source namespace; shared hosted tables must include that namespace in keys and
constraints.

| Relation            | Contents and identity                                                                                                                           | Browser population                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `replica_meta`      | Schema/config identity, source namespace, source revision, runtime revision, release binding, policy view                                       | On bootstrap and atomic sync                            |
| `entry_index`       | Non-null version key, logical entry ID, locale, type, workspace/root, ancestry, title, path/URL, ordering, source/effective status, active/main | Authorized rows only                                    |
| `entry_grant`       | Effective entry actions scoped to a policy view                                                                                                 | Compiled by handler; may be packed into wire index rows |
| `payload_manifest`  | Version key and immutable payload identity                                                                                                      | Readable identities only                                |
| `entry_data`        | Version key, payload identity, queryable JSON with defaults applied                                                                             | Lazy                                                    |
| `entry_search`      | Version key, payload identity, searchable text; adapter-managed search index                                                                    | Lazy                                                    |
| `entry_reference`   | Source version, payload identity, target source/entry, field path and link metadata                                                             | Lazy, complete per source version                       |
| `payload_residency` | Which class and exact payload identity has been completely installed, including empty payloads                                                  | Local cache metadata                                    |
| `source_file`       | Exact authored bytes, path and source blob hash; tree/checkpoint metadata                                                                       | Trusted source operations only                          |

Use a stable non-null version key derived unambiguously from entry ID, locale,
and source version status. Do not inherit the old nullable composite primary
key. Normalize locale matching explicitly and preserve current Alinea semantics.
Keep `versionStatus` separate from inherited effective `status`: archiving a
parent must not rewrite children's source files or destroy their own status.

Start with indexes required by ID/URL/type, workspace/root, hierarchy, locale,
status, and ordered listing queries. Reference rows need source and target
indexes. Add content scalar indexes when measured queries justify them. Avoid
prematurely projecting every user field into an independent SQL column.
Values needed by most queries belong in the structural index. For a hot value
that remains sourced from the raw payload, prefer a selective virtual/generated
column and index it only when measurements justify the write cost.

The trusted database must not store one user's grants in globally shared entry
rows. Grants are a view over content and policy. Their wire representation can
be attached directly to each index row as requested; the SQL layout may separate
them to avoid mixing authorization state with immutable content.

## The index exposes a Tree

The trusted SQL index should implement the source tree contract so the database
can participate directly in existing source synchronization and diffing. Persist
exact source paths, blob hashes, modes, directory relationships, and subtree
hashes alongside the entry index. These are small index metadata; reading a tree
or calculating a source diff must not hydrate entry JSON or search data.
Source bytes remain in separate payload storage, fetched only by `getBlobs`.

This tree describes the configured source files, including every file tracked by
that source, rather than the normalized CMS parent/child hierarchy. Seeded entries
without files have no source leaves, and draft/published/archived filenames remain
distinct leaves even when query status is inherited. Do not reconstruct source
paths or source hashes from normalized JSON, URLs, or effective status.

Model the metadata as a `source_tree` relation owned by the index, with path,
parent/name, node kind, mode, and hash. `source_file` supplies its blob contents.
The tree and query index are two views of one committed database revision; a
source reconciliation updates both in one SQL transaction. Keep the source tree
hash separate from the commit reference and runtime revision. A change to a
derived policy view does not change the source tree hash.

Use the public shape and semantics of `src/core/source/Tree.ts`: root `sha`,
lookup, traversal, serialization, and diff. Its `Tree` interface is currently a
serialized shape, while `ReadonlyTree` supplies the behavior through a concrete
Map-backed class. Extract a common read/diff contract if needed; do not force SQL
implementations to inherit its internal Maps or build another full entry graph.
For asynchronous Rado drivers, obtain a pinned index-only snapshot or use an
asynchronous contract rather than disguising database I/O as synchronous access.

Equal root hashes allow an immediate no-change result. Persisted subtree hashes
can skip equal subtrees; the current `ReadonlyTree.diff` flattens file indexes,
so subtree skipping is an implementation improvement to verify. Reuse existing
Git hash/serialization utilities and compare results with the existing tree
implementation, including file modes. Updated leaves and ancestor hashes must
describe the same source snapshot as the installed query rows.

The database can consequently implement `Source`: `getTree` reads its index,
`getTreeIfDifferent` checks the stored root hash first, and `getBlobs` lazily reads
exact source bytes by hash. A policy-filtered browser index is not the complete
source tree and must never expose hidden paths or hashes from the trusted tree.
Browser replica diffing continues to use its authorized view and runtime identity.

## Release artifacts and server reads

The release contains one private raw `release.sqlite` and a small loader binding
its schema/config/source/revision identity. The database includes queryable JSON,
references, and FTS5 data. Native server queries use SQLite file access rather
than loading an exported byte buffer into WASM.

Browser hydration does not require a second generated payload representation.
An authenticated handler reads exact permitted payload rows from the database and
streams them in large bounded batches. This avoids public bundle publication,
range manifests, encryption keys, and duplicate build output.

Do not publish the trusted SQLite file: it contains unrestricted content and
source metadata. An unpredictable URL is not authorization.

For native SQLite, prototype an immutable attached base plus one writable
overlay. Effective SQL relations select the overlay row when present and the
base row otherwise, respecting tombstones. Indexes, joins, FTS, and query plans
must remain efficient through that composition. A new delta replaces the current
overlay state rather than adding another query layer. Whole-file copying is a
benchmark alternative, not the default cold-start design.

This physical strategy is SQLite-specific. A hosted SQL database can maintain
its current state in ordinary transactional tables and provide repeatable reads.
Rado queries operate over effective relations in either case. Advertise the
driver's actual transaction capabilities; do not assume all HTTP drivers support
interactive transactions or identical isolation.

## Browser loading and query correctness

Bootstrap synchronizes the complete permitted structural index and entry-level
permissions into SQLite. Content stays in separate sparse tables. Residency is keyed
by exact payload identity, not just entry ID or a boolean `loaded` flag.
Unloaded data is distinct from `NULL`, a missing JSON field, an empty reference
list, and a payload class that does not exist for this entry.

The planner inspects the entire query, including nested selections and relations,
and builds SQL stages with dependencies on index, data, search, or references.
SQL remains responsible for predicates, joins, ordering, and projection;
the planner supplies missing inputs before executing each dependent stage.

| Query                                                       | Required hydration                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Index-only filter/order/projection/count                    | None                                                                           |
| Index-only filter/order with `take: 10` and data projection | Selected ten data payloads, plus explicitly requested linked data              |
| Data predicate, known index order, small limit              | Ordered batches until enough matches exist; apply skip to matches              |
| Data-dependent order, group, or aggregate                   | All remaining candidates whose data can affect the result                      |
| Full-content search                                         | Complete permitted search corpus for the chosen search scope, then result data |
| Outgoing references                                         | Reference payload for the source version                                       |
| Incoming references                                         | Complete reference coverage for the permitted scope, then result data          |

An inner join against only hydrated rows silently loses candidates. Do not use
that as an implicit loading strategy. For `OR`, `NOT`, missing fields, and mixed
structural/content conditions, derive a conservative candidate superset before
hydrating; optimize short-circuit cases only when equivalence is established.
Nested relations require their own dependency rounds. Never apply a global limit
before resolving a predicate or ordering expression that can change membership.

Pin the read revision while planning and fetching. Do not hold a write transaction
open across network I/O. After fetch, validate the expected revision, policy view,
and exact payload identities before installation; retry or finish against a retained pinned
snapshot if they changed. One worker serializes installs; readers must still have
explicit revision semantics when asynchronous work interleaves.

Payload insertion and residency marking are one transaction. FTS/reference rows
must correspond to the same payload identity. Full search cannot report partial
results as complete merely because some payloads are already loaded.
Explore-only search may use safe structural data, never unreadable content.

The dashboard's asynchronous page atoms await these queries. Requested tabs and
disclosures determine dependencies; the old page remains visible until the next
page and its required payloads are ready. Component mounting must not initiate
loads required to render the replacement page.

Persist the authorized index and exact payload cache records incrementally in
IndexedDB, or use a suitable persistent SQLite VFS after verification. The
historical `db.export()` persistence is a fallback to measure, not a write path
to assume scales. `@alinea/sqlite-wasm` availability does not establish OPFS,
HTTP VFS, FTS, or native file paging support in that build.

## Live queries in the browser

The browser database should expose query subscriptions alongside one-shot queries.
The same query compiler and hydration planner serve both. A subscription owns a
query, its source/config/policy binding, and the last complete result. The worker
publishes invalidations after a committed change; observers receive a new result
only after all SQL stages and required hydration finish at a coherent revision.

Track query dependencies at the relation/payload-class level initially, refining
to structural scope, fields, or entry IDs where provably safe. Include potential
matches: a query returning ten rows may change because an eleventh entry changes
its filter value or ordering. Tracking only returned IDs is insufficient. Nested
links, references, effective ancestor state, and FTS contribute
dependencies too. Use conservative invalidation for expressions whose narrower
dependencies cannot be established. Fine-grained tracking is an optimization.

Delta installs, acknowledged edits, source sync, and derived-data completion can
invalidate subscriptions. Hydration changes local residency without changing the
logical content revision; it resumes waiting queries rather than triggering an
endless content-invalidation loop. Coalesce changes from one transaction, share
in-flight hydration and identical queries where useful, and publish only the
latest valid execution. Superseded work cannot overwrite a newer result.

Keep the previous complete result visible while an ordinary content update is
being resolved. Initial subscriptions may expose loading/error state; failures
must not appear as successful empty results. Permission revocation or a change
of authenticated/source context invalidates the old result immediately instead
of retaining content the current context cannot read. Release dependency records
and cancel unneeded work when the final subscriber unsubscribes.

Bridge subscriptions into Jotai atoms scoped by query and replica identity.
Navigation still uses asynchronous page atoms to await the requested page's
dependencies; live updates do not bypass that loading boundary. Pending editor
operations may drive a separately scoped optimistic query view, with explicit
acknowledgment/rebase semantics, rather than silently modifying committed state.

Live queries react to changes already committed to the local replica. Receiving
remote changes is a separate transport concern: polling can initiate sync first,
with SSE/WebSocket revision notifications added later. Notifications are hints to
fetch authorized state, not authoritative row mutations. Reconnect uses the normal
cursor protocol and catches up before publishing a refreshed result. A Rado driver
alone does not supply reactive query subscriptions or remote change delivery.

## Permissions and cache lifetime

The handler evaluates roles against its trusted database and compiles effective
actions per entry. It can return these alongside structural rows. No explore
access means no row; explore without read means no payload identity,
keys, references, or searchable text. SQLite replicas intentionally support only
entry-level grants. Bootstrap rejects roles whose field permissions differ from
the entry grant; it never broadens them or creates per-user filtered payloads.

All server query and mutation endpoints enforce authorization independently of
the client's stored flags. Policy revisions can change without a source change.
Content-dependent policies must be reevaluated when their dependencies change;
invalidate the complete evaluated view when dependency tracking is insufficient.

Partition browser persistence and worker identity by project, source namespace,
schema/config compatibility, authenticated principal, and policy view. Keep the
release binding in replica metadata; cross-release cache reuse needs explicit
compatibility and exact payload identity checks. Role changes or logout replace the worker
and purge access that is no longer available, including in-flight responses.
Already disclosed plaintext cannot be revoked from a client.

## Other databases through Rado

Keep two future integrations distinct:

1. A user-provided SQL database storing Alinea's own schema. It supplies the
   equivalent queries and declared transaction capabilities through Rado.
2. An existing external database whose records are linked or queried by Alinea.
   It needs a schema mapping, source-qualified identity, credentials on the
   server, authorization, and a declared freshness/snapshot policy.

The first can reuse the database implementation directly. The second may serve
queries remotely or replicate mapped rows into SQLite. Rado alone does not
provide change capture, source mapping, cross-database transactions, or snapshots
across unrelated servers. Expose capabilities such as read, write, snapshot,
change feed and full-text search. Start external mappings as read-only
unless explicitly configured writable; do not auto-migrate a user's own tables.

Preserve source IDs on links and batch cross-source resolution. Arbitrary joins
across unrelated connections and atomic writes across sources are outside the
initial scope. Define null/missing JSON, collation, locale, boolean, and ordering
semantics in tests; the old `json_each`, `COLLATE NOCASE`, and FTS SQL needs
adapter treatment even though much of the original schema was universal.
