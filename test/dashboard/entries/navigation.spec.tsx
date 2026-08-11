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

test('search ranks title matches before rich-text matches', async ({
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
})
