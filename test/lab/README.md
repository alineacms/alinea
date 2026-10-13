# Sync lab

One page that runs Alinea's own sync code (the handler, the CMS of server
renders, the dashboard's shared worker, the WASM databases and their overlays)
against simulated hosts, and draws where content lives and how it moves.

```sh
bun lab          # http://localhost:4700
bun lab:check    # every scenario headless, fails on a failed check
```

## What runs for real

| Node            | Code                                                                                    | Host in the lab                                                     |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Isolate λ1, λ2  | `createHandlerWithDatabase`, `NextCMS`, `createGeneratedDatabase`, `EntryStore`         | A dedicated Worker each, with `next/*` shimmed                      |
| Browser A, B    | `loadWorker`, `DashboardWorker`, `BrowserEntryStore`, `Client`, `WorkerDB` over Comlink | A SharedWorker per dashboard build; IndexedDB prefixed per browser  |
| Backend DB      | `DatabaseApi` and its blob store, through rado's libSQL or D1 driver                    | WASM SQLite on the page                                             |
| Cloud           | `CloudRemote`                                                                           | The cloud's tree, blobs and write endpoints over the lab repository |
| Next data cache | `syncIfStale`, `revalidateContentSha`                                                   | `unstable_cache` and `revalidateTag`, shared by every isolate       |
| Build           | `EntryDatabase.createSchema`, `EntryStore.syncWith`, `compact`                          | The page, exporting the database file a deployment ships            |

The git host is the lab's own: self-hosted isolates reach it through
`LabGithub`, which keeps the contract of `GithubApi` (a tree per content sha,
blobs by sha, a commit that fails when the branch moved) without GitHub's REST
and GraphQL APIs.

## How the hosts are simulated

- Every realm patches `fetch` to post requests to the page, which routes them
  by host (`site.lab`, `github.lab`, `cloud.lab`) with a latency per hop and
  the faults set on a node (down, hangs, loses answers).
- `Date.now` and timers of two seconds and more follow the lab clock, so
  jumping ahead runs dashboards' interval syncs, expires the cached content sha
  and gives up on hung reads.
- The generated database is read into WASM memory, as `runtimeDatabase` does
  where the native overlay VFS is missing.
- The backend database emulates what Alinea's WASM SQLite build leaves out
  (foreign keys, schema pragmas, `alter table ... rename`).
- Store methods are wrapped to trace what they do; their behavior is
  unchanged.

## Scenarios

Each scenario starts from a fresh world, plays a story through the real code
and checks what every node ends up with. Checks are ✓ pass, ✗ fail, i (what
happened, when either outcome is valid) or ⚑ (a finding: behavior that holds
but looks unintended).
