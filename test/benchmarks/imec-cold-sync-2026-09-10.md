# Imec browser cold-sync benchmark — 2026-09-10

## Result

A real headless Chromium client with the authorized structural index already
cached and no payloads cached took **8.400 seconds** to return every full entry:

| Phase | Time |
| --- | ---: |
| Reopen and install structural index in WASM | 0.981 s |
| Stream and install raw payload text, then project all entries | 7.419 s |
| Total | **8.400 s** |
| Same full projection after hydration | 2.115 s |

The query returned 11,373 published entries. Transport used one authenticated
request and 83,531,833 uncompressed bytes for 61,486,398 bytes of normalized
field JSON. Native server reads and streaming took 0.607 s.

An isolated run that first received every serialized payload, then installed it
into a fresh WASM database, measured 0.905 s for the single streamed response,
about 5.469 s for SQLite installation, and 2.184 s for the full projection. The
payload is kept as raw SQLite JSON text across server, wire, cache and browser
insertion; JavaScript does not parse and re-serialize it. Standard FTS5
population is deferred until a search actually needs it.

Payload persistence uses an idle write-behind queue and is drained during an
orderly session shutdown, so IndexedDB latency is not part of query readiness.

## Method and limits

- Imec source: `/Users/ben/projects/codeurs/imec-rebuild`
- Entries came from the previously normalized 11,374-version benchmark fixture.
- Browser: Playwright headless Chromium on macOS arm64.
- Runtime: actual `@alinea/sqlite-wasm`, browser IndexedDB, current
  `ReplicaSession`, streaming decoder, and exact-payload cache.
- The server and browser ran on the same machine through Playwright routing, so
  there was no real network latency or bandwidth constraint.
- The wire measurement is before HTTP compression. Production responses use
  streaming gzip/deflate when accepted.
- The timed query was `find({select: Entry})`, deliberately forcing every
  query-visible payload to hydrate and every complete entry to materialize.
  Normal dashboard startup remains lazy and should be materially faster.
- This is an end-to-end stress measurement, not a statistically isolated
  microbenchmark.
