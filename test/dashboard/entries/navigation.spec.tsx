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

test('expands an entry with children when its row is clicked', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  const folder = tree.getByRole('row', {name: 'Folder', exact: true})

  await folder.click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toBeVisible()

  await tree.getByRole('button', {name: 'Collapse Folder'}).click()
  await expect(tree.getByRole('button', {name: 'Expand Folder'})).toBeVisible()

  await folder.click()
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

test('renders a missing entry route', async ({dashboard, mount}) => {
  const app = await dashboard.mount(
    () => mount(<DashboardScenarioMount />),
    {
      routeEntry: 'missing-entry',
      title: 'Entry not found'
    }
  )

  await expect(app.page.getByText('Requested id:')).toContainText(
    'missing-entry'
  )
  await expect(
    app.page.getByRole('button', {name: 'Go to Pages'})
  ).toBeVisible()
})
