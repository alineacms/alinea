# Dashboard E2E Patterns

The v2 dashboard E2E suite runs against the root Vite fixture:

```sh
bun run test:e2e
```

Playwright starts `index.html` through Vite, which renders `frontend.tsx` and the fixture CMS from `src/dashboard/fixture/cms.ts`. This keeps the suite focused on v2 dashboard behavior and avoids the slower Next fixture unless a test explicitly needs adapter coverage.

Use role and label selectors first. The dashboard is built on React Aria, so tests should describe user-visible behavior instead of CSS structure.

```ts
import {expect, test} from './fixtures/dashboard.js'

test('opens an entry', async ({dashboard}) => {
  await dashboard.goto()
  await dashboard.openTreeItem('Home')

  await expect(dashboard.field('Title')).toHaveValue('Home')
})
```

Common flows:

```ts
await dashboard.goto({workspace: 'simple', root: 'pages'})
await dashboard.goto({workspace: 'i18n', root: 'pages', locale: 'fr'})
await dashboard.selectRoot('Media')
await dashboard.expandTreeItem('Blog')
await dashboard.openTreeItem('Hello world')
await dashboard.field('Title').fill('Updated title')
await dashboard.button('Save draft').click()
```

For field suites, prefer one spec file per workflow or field family, and keep setup in the fixture CMS data instead of building state through the UI. Use the UI to verify the behavior under test: navigation, editing, dirty state, publish actions, picker flows, keyboard behavior, and dialogs.
