# Alinea SQLite playground

Interactive visual tour of the SQLite content engine: edit a simulated
cloud source, sync it into SQLite, query, mutate, and scale to 50K+
documents — all live, all timed.

```sh
bun playground/server.ts
# open http://localhost:4123 (PORT env to override)
```

## Guided tour

1. **Remote source** — stage adds, retitles and removals on the simulated cloud.
2. **Sync** — pull the remote in: parse, index, derive hierarchy, status and URLs, atomically.
3. **Query** — full-text search, pagination and relation lookups, all compiled to SQL. Click a row for its relations.
4. **Mutate** — create, rename, move, publish/unpublish and delete through transactions (failures roll back).
5. **Scale lab** — seed 5K/25K/50K documents and watch sync timings and database size.

API endpoints (all JSON): `GET /api/status`, `GET /api/entries?search&take&skip`,
`GET /api/tree`, `GET /api/relations?id=`, `POST /api/seed {count}`,
`POST /api/remote-add`, `/api/remote-edit`, `/api/remote-remove`,
`POST /api/sync`, `POST /api/mutate`, `POST /api/reset`.
