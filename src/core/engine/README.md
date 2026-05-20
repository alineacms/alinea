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
- `RxbEntryArtifact`: artifact shape, baseline-index export, and RXB
  encode/decode helpers.
- `RxbEntryEngine`: query executor over RXB rows and indexes.
- `RxbEntryPlanner`: candidate row-id planner over RXB indexes.
- `EntryFilter` and `QueryTrace`: small query helpers still shared by the RXB
  engine.

## Current Constraints

- Query support is the subset implemented by `RxbEntryEngine`.
- Hot query planning uses the artifact's decoded index records and lazily
  hydrates touched rows into a small cache. RXB cursor reads are not on the
  repeated query path.
- Local mutations currently use the existing baseline transaction semantics
  internally for correctness, then rebuild the RXB artifact.
- Sync diffs the local RXB tree against a `RemoteSource`, fetches only changed
  blobs, then rebuilds the RXB artifact from that tree/blob view.
- RXB bytes are the durable local checkpoint. For optimistic rollback, keep the
  returned checkpoint instead of duplicating every byte array.

## Benchmarks

`EntryIndex.bench.ts` compares the RXB database against the current baseline
resolver and source export. It reports:

- baseline `syncWith` vs RXB byte build
- RXB open/export cost
- baseline resolver vs RXB resolve for id, count, numeric filter, and nested/list
  filters
- raw `exportSource` JSON size vs exported RXB bytes

Compression and alternate packed snapshot benchmarks are intentionally removed.
The deploy/browser artifact is the RXB byte array.

## Useful Commands

```sh
bun test src/core/engine/RxbEntryDB.test.ts
bun test src/core/engine/RxbEntryEngine.test.ts
bun src/core/engine/EntryIndex.bench.ts
```
