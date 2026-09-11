# SQLite database core

This directory intentionally contains only the SQLite query engine and source
synchronization. Transport, authentication, permissions, deployment
checkpoints, previews and mutation protocols belong outside this core.

## Schema

The query runtime creates two ordinary tables and one optional FTS5 table:

- `alinea_entry_index` contains one complete row per authored version: query
  columns, full `filePath`, precomputed sync hashes, `data` JSON and remaining
  source JSON. Hidden authored versions remain rows with `visible = false`.
- `alinea_database_state` contains the current revision.
- `alinea_entry_search` is a standard FTS5 table rebuilt from searchable text
  only when a search is performed.

SQLite stores the JSON columns as text. Normal SQL can avoid decoding them;
JSON values are extracted only when a query selects or filters on them.

## Synchronization boundary

`EntryDatabase.syncWith` compares the source tree directly with ordered
`filePath`, `fileHash` and `childrenSha` columns. It does not construct a second
database-side tree or read unchanged payloads. Applying changes is
transactional and invalidates affected live queries. No transport format is
defined here.

Graph queries, including nested link resolution, run in one SQLite snapshot.
By default synchronization shares that connection and waits for active queries.
Supplying `syncDatabase` gives the syncer a second connection to the same
WAL-backed database, allowing commits while existing queries retain their old
snapshot. `EntryDatabase.close()` owns and closes both connections.
