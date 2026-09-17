# Tutorial step apps

This directory contains 5 standalone Next.js + Alinea tutorial apps:

- `step1`: fixed landing page entry
- `step2`: landing page with block list
- `step3`: shared layout root (`Globals/settings`)
- `step4`: dedicated blog routes (`/blog`, `/blog/[slug]`)
- `step5`: catch-all route (`/[[...slug]]`)

Run from the repository root:

```bash
bun step1:dev
bun step2:dev
bun step3:dev
bun step4:dev
bun step5:dev
```

Ports:

- Step 1: `3101`
- Step 2: `3102`
- Step 3: `3103`
- Step 4: `3104`
- Step 5: `3105`

Each step app has its own `content/` folder for local testing.
