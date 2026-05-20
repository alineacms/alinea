# Entry engine

This directory is the RXB entry database. The public engine surface is
`RxbEntryDB`: it opens an RXB `Uint8Array`, resolves entry queries, applies local
mutation arrays, syncs from a `RemoteSource`, rolls back checkpoints, and exports
updated bytes.

The previous in-memory/snapshot engine attempts have been removed from this
directory. The remaining modules support one path:

```txt
Source -> RxbEntryArtifact -> Uint8Array -> RxbEntryDB
```

## Public API

Use `RxbEntryDB` for browser/local runtime state:

- `RxbEntryDB.open(config, bytes)`
- `db.resolve(query)`
- `db.mutations(mutations, options?)`
- `db.syncWith(remoteSource)`
- `db.checkpoint()` / `db.rollback(checkpoint)`
- `db.exportBytes()` / `db.bytes`

`mutations` is local and optimistic. Server commits should still send the same
mutation array to the authoritative backend, then call `syncWith` to rebase onto
the confirmed source state.

## Modules

- `RxbEntryDB`: byte-array backed database facade.
- `RxbEntryArtifact`: artifact shape, tree/blob export, and RXB encode/decode
  helpers.
- `RxbEntryEngine`: query executor over RXB rows and indexes.
- `RxbEntryPlanner`: candidate row-id planner over RXB indexes.
- `EntryFilter` and `QueryTrace`: small query helpers still shared by the RXB
  engine.

## Current Constraints

- Query support is the subset implemented by `RxbEntryEngine`.
- Hot query planning uses compact decoded index records, column arrays, and
  lazily hydrated rows. `active`, `main`, and `status` are packed into one
  byte per row and exposed as virtual indexes; they are not duplicated as
  artifact maps.
- The artifact includes compact ordinal indexes for stable high-value fields:
  id, type, exact scalar content fields, and numeric content fields. Other entry
  fields such as workspace, root, locale, and parentId are indexed lazily by the
  planner only when a query actually uses them; they are not baked into the
  artifact around one dashboard trace.
- Sparse flag reads can use the RXB cursor directly. Broad flag scans switch to
  a cached flag column because cursor-per-row scans are measurably slower on
  dashboard workloads.
- Search is a lazy in-memory MiniSearch side index. It is built on first search
  from the RXB rows and discarded when mutations or sync replace the artifact.
  Search text is not encoded as another artifact section unless benchmark data
  shows the first-search cost is worth the size increase.
- Selected link fields are post-processed with an RXB-local link resolver. This
  keeps entry-link fields behavior-compatible with the baseline resolver and is
  a major target workload for RXB query speedups.
- Local mutations apply directly to the RXB-backed tree/blob snapshot, then
  rebuild the artifact from that snapshot. The baseline transaction/index
  machinery is no longer part of the runtime mutation path.
- No-op sync checks `meta.graphSha` and keeps the existing byte buffer.
- Changed sync fetches only changed blobs and applies them through the
  local tree plus the current artifact rows, then re-encodes RXB. Unchanged
  rows are reused from RXB; only newly fetched blobs are parsed. This avoids
  requiring source JSON files locally.
- Local mutations run directly against the RXB tree/version snapshot. Existing
  rows are reused from the artifact, and only newly written records are encoded
  and hashed.
- RXB bytes are the durable local checkpoint. For optimistic rollback, keep the
  returned checkpoint instead of duplicating every byte array.

## Benchmarks

`EntryIndex.bench.ts` compares the RXB database against the current baseline
resolver and source export. It reports:

- baseline `syncWith` vs RXB byte build
- RXB open/export cost
- baseline resolver vs RXB resolve for id, count, numeric filter, nested/list
  filters, dashboard children, media explorer count/batch, and search
- a separate entry-link resolver fixture where each benchmark row links to a
  small number of other entries, so normal dashboard/media timings are not
  inflated by link-field payloads
- raw `exportSource` JSON size vs exported RXB bytes and compressed RXB bytes

Compression and alternate packed snapshot benchmarks are intentionally removed.
The deploy/browser artifact is the RXB byte array; compression is only applied
when comparing against the existing source export transport.

## Useful Commands

```sh
bun test src/core/engine/RxbEntryDB.test.ts
bun test src/core/engine/RxbEntryEngine.test.ts
bun test ./src/core/engine/EntryIndex.bench.ts
```
