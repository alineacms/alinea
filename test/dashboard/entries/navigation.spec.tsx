import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('navigates between entries and through browser history', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.openEntry('Beta')
  await expect(app.page).toHaveURL(/workflow-beta$/)

  await app.page.goBack()
  await expect(app.title).toHaveText('Alpha')
  await expect(app.field('Title')).toHaveValue('Alpha')
})

test('keeps the sidebar and editor mounted between entry navigations', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  const title = app.field('Title')
  await tree.evaluate(element => {
    element.dataset.navigationMarker = 'preserved'
  })
  await title.evaluate(element => {
    element.dataset.navigationMarker = 'preserved'
  })

  await app.openEntry('Beta')

  await expect(tree).toHaveAttribute('data-navigation-marker', 'preserved')
  await expect(app.field('Title')).toHaveAttribute(
    'data-navigation-marker',
    'preserved'
  )
})

test('selects the sidebar root when navigating back to it', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})

  await expect(tree.getByRole('row', {selected: true})).toHaveText(/Alpha$/)
  await app.page.getByRole('button', {name: 'Back to root'}).click()

  await expect(
    app.page.locator('button[aria-current="page"]', {hasText: 'Pages'})
  ).toBeVisible()
  await expect(tree.getByRole('row', {selected: true})).toHaveCount(0)
})

test('shows the loaded entry title on an overview outside the sidebar tree', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'hiddenFolder',
    title: 'Hidden folder'
  })

  await expect(app.title).toHaveText('Hidden folder')
  await expect(
    app.page.getByRole('button', {name: 'Back to root'})
  ).toBeVisible()
  await expect(app.page.getByRole('button', {name: 'Edit entry'})).toBeVisible()
})

test('expands and collapses an entry with the sidebar chevron', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await tree.getByRole('button', {name: 'Expand Folder'}).click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toBeVisible()

  await tree.getByRole('button', {name: 'Collapse Folder'}).click()
  await expect(tree.getByRole('button', {name: 'Expand Folder'})).toBeVisible()

  await tree.getByRole('button', {name: 'Expand Folder'}).click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toBeVisible()
})

test('orders children by their parent type and disables dragging', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})

  await tree.getByRole('button', {name: 'Expand Ordered folder'}).click()

  const children = tree.locator('[role="row"][aria-level="2"]')
  await expect(children).toHaveText([/Apple$/, /Zebra$/])
  await expect(tree.getByRole('button', {name: 'Drag Apple'})).toHaveCount(0)
  await expect(tree.getByRole('button', {name: 'Drag Zebra'})).toHaveCount(0)
})

test('keeps a collapsed parent closed when selecting a child elsewhere', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'child',
    title: 'Child'
  })
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})

  await tree.getByRole('button', {name: 'Collapse Folder'}).click()
  await tree.getByRole('button', {name: 'Expand Other folder'}).click()
  await app.openEntry('Other child')

  await expect(
    tree.getByRole('button', {name: 'Expand Folder'})
  ).toBeVisible()
})

test('blocks navigation until unsaved changes are resolved', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.field('Title').fill('Unsaved title')
  await app.entry('Beta').click()

  const confirmation = app.page.getByRole('dialog')
  await expect(
    confirmation.getByRole('heading', {name: 'Confirm navigation'})
  ).toBeVisible()
  await expect(confirmation).toContainText('This entry has unsaved changes')
  await expect(app.title).toHaveText('Alpha')

  await confirmation.getByRole('button', {name: 'Discard my changes'}).click()
  await expect(app.title).toHaveText('Beta')
})

test('blocks browser history until unsaved changes are resolved', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await app.openEntry('Beta')

  await app.field('Title').fill('Unsaved beta')
  await app.page.goBack({waitUntil: 'commit'})

  const confirmation = app.page.getByRole('dialog')
  await expect(
    confirmation.getByRole('heading', {name: 'Confirm navigation'})
  ).toBeVisible()
  await expect(app.title).toHaveText('Beta')
  await expect(app.page).toHaveURL(/workflow-beta$/)

  await confirmation.getByRole('button', {name: 'Discard my changes'}).click()
  await expect(app.title).toHaveText('Alpha')
  await expect(app.field('Title')).toHaveValue('Alpha')
})

test('updates document metadata with dashboard navigation', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await expect(app.page).toHaveTitle('Main: Alpha')
  await app.openEntry('Beta')
  await expect(app.page).toHaveTitle('Main: Beta')

  await app.page.getByRole('button', {name: 'Back to root'}).click()
  await expect(app.page).toHaveTitle('Main: Pages')
  await expect(app.page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    /^data:image\/svg\+xml;base64,/
  )
})

test('renders a missing entry route', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    routeEntry: 'missing-entry',
    title: 'Entry not found'
  })

  await expect(app.page.getByText('Requested id:')).toContainText(
    'missing-entry'
  )
  await expect(
    app.page.getByRole('button', {name: 'Go to Pages'})
  ).toBeVisible()
})

test('renders a missing root route without falling through to an entry', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    routeRoot: 'missing-root',
    title: 'Root not found'
  })

  await expect(app.page.getByText('Requested root:')).toContainText(
    'missing-root'
  )
  await expect(
    app.page.getByRole('button', {name: 'Go to Pages'})
  ).toBeVisible()
})

test('searches entries and navigates with enter or click', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Search entries'}).click()
  const enterSearch = app.page.getByRole('dialog', {name: 'Search entries'})
  const enterSearchbox = enterSearch.getByRole('searchbox', {name: 'Search'})
  await enterSearchbox.fill('Beta')
  const betaResult = enterSearch.getByRole('row', {name: /Beta/})
  await expect(betaResult).toBeVisible()
  await enterSearchbox.press('ArrowDown')
  await expect(betaResult).toHaveAttribute('aria-selected', 'true')
  await enterSearchbox.press('Enter')
  await expect(app.title).toHaveText('Beta')
  await expect(enterSearch).not.toBeVisible()

  await app.page.getByRole('button', {name: 'Search entries'}).click()
  const clickSearch = app.page.getByRole('dialog', {name: 'Search entries'})
  await clickSearch.getByRole('searchbox', {name: 'Search'}).fill('Alpha')
  await clickSearch.getByRole('row', {name: /Alpha/}).click()
  await expect(app.title).toHaveText('Alpha')
  await expect(clickSearch).not.toBeVisible()
})

test('search requires every word and prioritizes title prefixes', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Search entries'}).click()
  const search = app.page.getByRole('dialog', {name: 'Search entries'})
  await search
    .getByRole('searchbox', {name: 'Search'})
    .fill('wireless receiver 77 GHz')

  const results = search
    .getByRole('treegrid', {name: 'Explorer entries'})
    .getByRole('row')
  await expect(results).toHaveCount(2)
  await expect(results.nth(0)).toContainText('Wireless receiver at 77 GHz')
  await expect(results.nth(1)).toContainText('Archive')

  await search.getByRole('searchbox', {name: 'Search'}).fill('wireless')

  await expect(results).toHaveCount(3)
  await expect(results.nth(0)).toContainText('Wireless receiver at 77 GHz')
  await expect(results.nth(1)).toContainText(
    'Receiver archive for wireless systems'
  )
  await expect(results.nth(2)).toContainText('Archive')
})

test('opens metadata for a localised file with null alt text', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'mediaFile',
    routeRoot: 'media',
    title: 'Legacy image'
  })

  await app.page.getByRole('tab', {name: 'Metadata'}).click()

  await expect(app.field('Alt text')).toBeVisible()
  await expect(app.field('Alt text')).toHaveValue('')
})
