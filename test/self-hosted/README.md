# Self-hosted dashboard fixture

Run a self-hosted dashboard without Next.js:

```sh
bun test/self-hosted/server.ts
```

Open:

```txt
http://admin:password@localhost:4600/
```

The server uses Basic Auth. Any username with password `password` can sign in,
but only `admin` receives the `admin` role.

The dashboard reads and writes source files directly from:

```txt
src/dashboard/fixture/content
```

Restart the server after changing dashboard source code. Content changes are
read from disk through `CachedFSSource`.
