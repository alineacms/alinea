# SQLite database core

This directory intentionally contains only the SQLite query engine and the
tree adapter needed for synchronization. Transport, authentication,
permissions, deployment checkpoints, source reconciliation, previews and
mutation protocols belong outside this core.

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

## Database tree

There is no separate tree table or second Merkle structure. `entryTree` groups
the complete entry rows by identity and constructs the existing `ReadonlyTree`
using `parentId`, `rowHash` and `childrenSha`. The runtime orders the rows by
parent, identity and version in SQLite, so the adapter performs no local sort.
It performs no hashing. All authored versions participate, including versions
hidden by an inherited archived status. The runtime reads only these structural
columns when building a tree; entry payload JSON is not selected or parsed.

## Synchronization boundary

`EntryRuntime.apply` accepts a revision-bound delta containing replacement rows
and removed version ids. Applying it is transactional, invalidates affected
live queries and replaces complete rows.

The transport can compare known revisions or construct a `ReadonlyTree` from a
database snapshot, then send changed complete rows in one response. No
transport format is defined here.
