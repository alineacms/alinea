# Tutorial step apps

This directory contains 5 standalone Next.js + Alinea tutorial apps, the
finished code of every step of the tutorial in the docs
(`/docs/get-started/tutorial`):

- `step1`: fixed landing page entry
- `step2`: landing page with block list
- `step3`: shared layout root (`Globals/settings`)
- `step4`: dedicated blog routes (`/blog`, `/blog/[slug]`)
- `step5`: catch-all route (`/[[...slug]]`)

They resolve `alinea` to the repository root, so build it first (or keep
`bun web` or `bun dev` running, which rebuilds `dist` on changes). Run them from
`apps/web`:

```bash
bun step1:dev
bun step2:dev
bun step3:dev
bun step4:dev
bun step5:dev
```

Ports (site, Alinea dev server):

- Step 1: `3101`, `4601`
- Step 2: `3102`, `4602`
- Step 3: `3103`, `4603`
- Step 4: `3104`, `4604`
- Step 5: `3105`, `4605`

The dashboard of each step is at `/admin`. Each step app has its own `content/`
folder for local testing. `bun screenshots --tutorial` (from the repository
root) captures the tutorial screenshots used in the docs from these apps.
