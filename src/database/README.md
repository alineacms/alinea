# Replica architecture

This directory contains the database replacing `EntryIndex`, `EntryGraph`, and
`EntryResolver`. The same database and query engine run over a complete handler
snapshot and a selectively synchronized client snapshot. The Next build,
authenticated handler routes, encrypted static data plane, persistent client
cache, and production dashboard read path are connected; compatibility paths
remain only at the unchanged cloud `Mutation` protocol boundary.

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
- The legacy `EntryIndex` and `EntryResolver` implementations have been removed.
  Their useful query, source, and mutation cases run against this database.
- Ordinary concurrent mutations operate on field paths and carry a base hash.
  Rich text remains an opaque field until its concurrency semantics are designed
  separately. This package does not introduce CRDTs.
- Role callbacks remain JavaScript and therefore the handler still loads the
  compiled server config. It runs callbacks against the complete normalized
  `DatabaseResolver`; authenticated bootstrap includes the resulting evaluated
  ACL, so clients never rerun role code against a partial graph. A hosted
  handler must receive this server artifact (or a future
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
   - port the useful `EntryResolver` corpus to stable expectations on the new
     implementation after dual-run parity was established.
4. **Build integration (implemented)**
   - export normalized records, index buckets, references, and frame metadata;
   - compile immutable build content into the encrypted release bundle;
   - retain the handler-only access/key catalog and compatibility source export
     in `.alinea/generated`, traced as private server files rather than an npm
     package;
   - persist the generated release id in server-only build configuration.
5. **Handler integration (implemented)**
   - load a complete new-database snapshot instead of constructing `EntryIndex`;
   - authenticate before returning catalogs or grants;
   - execute graph-backed role policies using the new query engine, project a
     scoped snapshot, and cache visibility by revision and role fingerprint;
   - include core/index frames for both explored and readable entries, but grant
     payload and full-search frames only for readable entries;
   - expose an authenticated bootstrap containing the secret release URL,
     evaluated ACL, scoped catalog, grants, and current revision;
   - expose state, grant refresh, object fallback, and mutation endpoints.
6. **Dashboard integration (production read path implemented)**
   - add IndexedDB ciphertext/object caches;
   - install catalogs atomically and request only missing ranges;
   - switch dashboard queries to the new resolver and delete local `EntryIndex`
     hydration;
   - record per-query index/record dependencies in the worker and invalidate
     only intersecting queries and affected logical entry ids.
   - use the normalized `SourceDB` for development/offline-cache reads and
     writes instead of constructing the legacy index and resolver.
7. **Writes, concurrency, and deltas (implemented)**
   - field-operation endpoint translates accepted paths into cloud mutations;
   - operations on unchanged paths merge across stale base revisions;
   - competing writes to the same scalar field return conflicts;
   - rich text remains one opaque field value;
   - ordered revision notifications trigger scoped state refreshes;
   - production dashboard updates are converted to hashed field operations;
   - structural writes use a separate authenticated replica command endpoint,
     and no production dashboard write calls the legacy mutation HTTP endpoint;
   - editor operation producers emit typed entry writes directly; replica field
     updates become hashed operations, structural writes become authenticated
     commands, and only the handler/cloud compatibility boundary converts them
     to the unchanged cloud `Mutation` format;
   - replica field and structural writes use a normalized snapshot-backed source
     writer.

## Completed cutover

- production, development, handler, and test database paths use normalized
  snapshots and `DatabaseResolver`;
- the legacy `EntryIndex`, `EntryResolver`, `EntryDB`, and `LocalDB` classes are
  deleted;
- `Benchmark.test.ts` measures normalized build, query, and encrypted bundle
  costs, while resolver/source tests retain the useful behavioral cases.

## Replacement strategy

The completed data path is direct rather than an adapter around the old index:

```text
Source records ──► new DatabaseSnapshot ──► new QueryEngine
```

The public `Resolver` and `Graph` interfaces are implemented entirely by the new
database, without a compatibility index or resolver beneath them.

## Security properties

Role names are not encryption keys. The externally hosted bundle contains
ciphertext and opaque frame metadata only. Its unguessable URL is a capability
and remains secret until authenticated bootstrap, while frame encryption is an
independent protection layer. The handler releases random, release-scoped
access-class keys after evaluating the user's complete effective policy,
including denies. Already disclosed URLs, keys, and plaintext are not treated as
revocable; a later build naturally rotates the release URL and keys.
