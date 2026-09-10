# SQLite database core

This directory intentionally contains only the SQLite query engine and the
derived index tree needed for synchronization. Transport, authentication,
permissions, deployment checkpoints, source reconciliation, previews and
mutation protocols belong outside this core.

## Schema

The runtime creates three ordinary tables and one optional FTS5 table:

- `alinea_entry_index` contains the always-resident structural columns used to
  discover, relate, order and page entries.
- `alinea_entry_index.payloadId` identifies the current readable payload without
  loading it. A null value represents a structural-only entry.
- `alinea_entry_data` contains hydrated `data` and `source` JSON. Absence means
  that the payload has not been loaded. Serialized payloads are inserted as
  SQLite text and are not parsed by JavaScript first.
- `alinea_database_state` contains the current revision.
- `alinea_entry_search` is an FTS5 table rebuilt from resident searchable text
  only when a search is performed.

Keeping hydrated data separate from the index permits lazy payload loading.

## Index tree

`IndexTree` is a disposable Merkle view derived from an index snapshot. Entry
versions are leaves keyed by `versionId`. A stable hash of that key assigns each
leaf to one of 256 directories. A leaf commitment covers its version id,
structural row hash and payload hash; each directory hash covers its sorted
leaf keys and commitments.

Key-defined directories avoid the offset sensitivity of fixed-size chunks. An
insertion changes one directory and the root, while unrelated directory hashes
remain reusable. The 256-way layout keeps this implementation deliberately
smaller than a general Prolly tree; another level can be introduced if measured
bucket sizes outgrow this sync protocol.

The root hash cheaply detects equality. Comparing unequal directories descends
only into changed branches and produces replacement and removal version ids.
The tree has no persisted schema because all of its information already exists
in the entry index. A runtime caches the tree until its next delta, but it can
always rebuild it without loading entry payloads.

The tree is not the authored Git/source tree. It deliberately contains no
blobs, file modes, historical directory snapshots or non-entry files.

## Synchronization boundary

`EntryRuntime.apply` accepts a revision-bound delta containing replacement rows
and removed version ids. Applying it is transactional, invalidates affected
live queries and retains hydrated payloads whose hashes did not change.

The transport can therefore negotiate with the `IndexTree` root and directory
hashes, fetch the changed index rows in one response, and hydrate payload text
separately when a query needs it. No transport format is defined here.
