# Replica architecture

This directory contains the database replacing `EntryIndex`, `EntryGraph`, and
`EntryResolver`. The same database and query engine run over a complete handler
snapshot and a selectively synchronized client snapshot. The Next build,
authenticated handler routes, encrypted static data plane, persistent client
cache, and production dashboard read path are connected; compatibility paths
remain for development and existing mutation commands during cutover.

## Boundaries

- The existing cloud APIs remain authoritative and unchanged.
- The handler authenticates users, evaluates the existing `Policy`, authorizes
  mutations, and grants access to the appropriate encrypted frames.
- `Policy.explore` and `Policy.read` produce different synchronized projections.
  Either permission may grant the compact core record needed to show an entry
  in explorers and link pickers. Only `read` grants its payload and full-content
  search data. Explore search is generated separately from discovery-safe fields
  such as title and path.
- The explore core is a deliberate data boundary, not a complete entry with
  fields hidden by UI convention. Source paths, row/file hashes, payload ids,
  full search text, and entry data live in separate read-only records/frames.
- Link-picker conditions must not force explore-only payloads onto the client.
  They are evaluated by the handler or compiled into discovery-safe eligibility
  indexes that expose matching record ids without exposing the tested fields.
- Build output may contain one static bundle with independently compressed and
  encrypted frames. A frame is an entry or field group with one read boundary.
- Build generates an unguessable release id and writes the bundle below a path
  such as `admin/release/$GENERATED_RELEASE`. `with-alinea` may persist this as a
  build-time environment value, but it must only be referenced by server/handler
  modules. Referencing it from client-reachable Next.js code would inline it in
  that client bundle.
- After authentication, the handler returns the secret release URL, the scoped
  catalog, and the granted decryption keys. The client can then range-load
  ciphertext directly from static hosting without proxying bundle bytes through
  the handler.
- A static release remains the base after cloud mutations. The handler encrypts
  only changed records and exact changed index buckets into a small overlay
  bundle. Catalog frame descriptors can address either source, so clients reuse
  all unchanged cached frames.
- The client installs an immutable catalog, range-loads granted frames, and runs
  queries over a snapshot-scoped `IndexReader`.
- The authenticated state labels each synchronized entry as `explore` or `read`
  so the dashboard can offer it as a link target without making an explore-only
  entry navigable as readable content.
- The new query engine owns filtering, graph traversal, locale/status selection,
  ordering, paging, projection, references, and search. It does not delegate
  query execution to `EntryResolver`.
- `EntryIndex` and `EntryResolver` are temporary correctness and benchmark
  oracles only. Production migration removes them rather than wrapping them.
- Ordinary concurrent mutations operate on field paths and carry a base hash.
  Rich text remains an opaque field until its concurrency semantics are designed
  separately. This package does not introduce CRDTs.
- Role callbacks remain JavaScript and therefore the handler still loads the
  compiled server config. It runs callbacks against the complete normalized
  `DatabaseResolver`; clients receive the resulting projection and never rerun
  role code. A hosted handler must receive this server artifact (or a future
  compiled policy representation). Knowing release keys alone cannot reproduce
  arbitrary graph-backed role functions.
- Client config has a different unguessable URL from the data release. The
  minimal dashboard authenticates first, receives that URL in bootstrap, and
  only then imports the client config. The current config may still contain role
  declarations for compatibility, but the client does not call them.

## Framework integration

The bundle format, bootstrap protocol, grants, database, and query engine are
framework-neutral. Next.js support through `with-alinea` is one adapter with
three small responsibilities: run the build export, retain the release id in
server-only output, and mount the authenticated handler routes. Adapters for
other frameworks provide the equivalent build hook and server route; dashboard
reads still go directly to the same static bundle or CDN. The handler remains
responsible for authentication, policy evaluation, cloud synchronization, and
mutations, but no longer proxies the static read data plane.

## Delivery plan

1. **Foundation (implemented)**
   - role masks and read-access classes;
   - independently encrypted bundle frames and range reads;
   - immutable replica catalogs and change sets;
   - lazy index/record loading;
   - dependency-tracked live query invalidation;
   - per-field operation contracts.
2. **Database core (implemented)**
   - define normalized structural nodes and locale/status entry versions;
   - build persistent primary, children, type, location, reference, and search
     indexes;
   - apply record changes transactionally and emit exact changed index buckets;
   - support complete in-memory and lazy content-addressed snapshots through the
     same `IndexReader` contract.
3. **Query engine (implemented and parity-tested)**
   - compile `GraphQuery` into scans, filters, traversals, sorts, paging, and
     projections;
   - implement locale fallback, status preference, previews, links, references,
     snippets, grouping, and aggregates;
   - expose the existing `Resolver` API from the new engine;
   - run the current `EntryResolver` test corpus against both implementations
     until results are identical.
4. **Build integration (implemented)**
   - export normalized records, index buckets, references, and frame metadata;
   - compile immutable build content into the encrypted release bundle;
   - retain the handler-only access/key catalog beside the generated source;
   - persist the generated release id in server-only build configuration.
5. **Handler integration (implemented)**
   - load a complete new-database snapshot instead of constructing `EntryIndex`;
   - authenticate before returning catalogs or grants;
   - execute graph-backed role policies using the new query engine, project a
     scoped snapshot, and cache visibility by revision and role fingerprint;
   - include core/index frames for both explored and readable entries, but grant
     payload and full-search frames only for readable entries;
   - expose an authenticated bootstrap containing the secret release URL,
     scoped catalog, grants, and current revision;
   - expose state, grant refresh, object fallback, and mutation endpoints.
6. **Dashboard integration (production read path implemented)**
   - add IndexedDB ciphertext/object caches;
   - install catalogs atomically and request only missing ranges;
   - switch dashboard queries to the new resolver and delete local `EntryIndex`
     hydration;
   - replace broad index refreshes with live query dependencies.
7. **Writes, concurrency, and deltas (production transport implemented; internal cutover remains)**
   - field-operation endpoint translates accepted paths into cloud mutations;
   - operations on unchanged paths merge across stale base revisions;
   - competing writes to the same scalar field return conflicts;
   - rich text remains one opaque field value;
   - ordered revision notifications trigger scoped state refreshes;
   - production dashboard updates are converted to hashed field operations;
   - structural writes use a separate authenticated replica command endpoint,
     and no production dashboard write calls the legacy mutation HTTP endpoint;
   - dashboard operation helpers still construct internal `Mutation` arrays and
     the structural command writer still delegates to `LocalDB` until the source
     writer migration is complete.

## Remaining cutover

- move field-update construction from the replica transport boundary into the
  editor operation producers so dashboard-facing APIs no longer exchange
  legacy `Mutation` arrays;
- replace the structural command handler's `LocalDB`/`EntryTransaction` writer
  with a normalized-database source writer;
- move server build artifacts out of the temporary `@alinea/generated` package
  once every framework adapter can trace an equivalent private server artifact;
- remove `EntryIndex`/`EntryResolver` after the development server and remaining
  write utilities use the normalized database;
- keep running `Benchmark.test.ts` and the shared resolver corpus during that
  removal.

## Replacement strategy

The migration is a dual-run, not an adapter architecture:

```text
Source records ──► new DatabaseSnapshot ──► new QueryEngine
       │                                      │
       └────► EntryIndex + EntryResolver ─────┘ compare in tests/benchmarks only
```

New production code must not depend on `EntryIndex` or `EntryResolver`. A small
compatibility facade may implement the public `Resolver` and `Graph` interfaces
while callers migrate, but its implementation is entirely backed by the new
database.

## Security properties

Role names are not encryption keys. The externally hosted bundle contains
ciphertext and opaque frame metadata only. Its unguessable URL is a capability
and remains secret until authenticated bootstrap, while frame encryption is an
independent protection layer. The handler releases random, release-scoped
access-class keys after evaluating the user's complete effective policy,
including denies. Already disclosed URLs, keys, and plaintext are not treated as
revocable; a later build naturally rotates the release URL and keys.
