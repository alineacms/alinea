# Alinea dev app

The app used to develop alinea against, deployed to dev.alineacms.com to
verify the Next.js integration on Vercel.

## Routes

- `/` — index of the demos below
- `/demo/static` — `force-static` with a 5 minute revalidate (ISR), rendered
  at build time from the bundled SQLite database
- `/demo/dynamic` — `force-dynamic` in the Node runtime, answered from the
  bundled database after a throttled sync with the handler
- `/demo/edge` — `force-dynamic` in the Edge runtime, queries forwarded to
  the handler
- `/admin` — the dashboard, `/api/cms` — the handler,
  `/[...slug]` — entries by URL

Each demo shows where its answer came from, the content revision and when
the isolate last synced.

## Deploying

`bun run build` compiles the package from the monorepo root, generates the
content database through the alinea CLI and runs `next build`. On Vercel:

- Root Directory `apps/dev`, with "Include source files outside of the Root
  Directory" enabled
- Node.js 24.x
- Production branch set to the branch under test (Settings → Git)
- `ALINEA_API_KEY` (and `ALINEA_CLOUD_URL` when not using the default cloud)

Install and build commands come from `vercel.json`. Preview deployments use
`VERCEL_URL` as their base URL, which Vercel's deployment protection may
block for server-side handler calls; production uses the custom domain.
