import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('publishes field edits and keeps them after navigation', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.field('Title').fill('Published Alpha')
  await app.page.getByRole('button', {name: 'Publish'}).click()
  await expect(app.title).toHaveText('Published Alpha')
  await expect(app.page.getByText('Published', {exact: true})).toHaveCount(0)

  await app.openEntry('Beta')
  await app.openEntry('Published Alpha')
  await expect(app.field('Title')).toHaveValue('Published Alpha')
})

test('unpublishes and republishes an entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const header = app.page.locator('header')

  await app.runEntryAction('Unpublish')
  await expect(header.getByText('Unpublished', {exact: true})).toBeVisible()

  await app.page.getByRole('button', {name: 'Publish'}).click()
  await app.page.getByRole('button', {name: 'More actions'}).click()
  await expect(
    app.page.getByRole('menuitem', {name: 'Unpublish', exact: true})
  ).toBeVisible()
})

test('blocks publishing while a field is invalid', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.field('Title').fill('Invalid')
  await expect(app.page.getByText('Pick another title')).toBeVisible()
  await app.page.getByRole('button', {name: 'Publish'}).click()
  const dialog = app.page.getByRole('dialog', {
    name: 'Fix invalid fields before publishing'
  })
  await expect(dialog.getByText('Title', {exact: true})).toBeVisible()
  await expect(dialog.getByText('Pick another title')).toBeVisible()
  await dialog.getByRole('button', {name: 'Show fields'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.field('Title')).toBeFocused()

  // Drafts are work in progress and may be saved with errors
  await app.page.getByRole('button', {name: 'Save draft'}).click()
  await expect(
    app.page.locator('header').getByText('Draft', {exact: true})
  ).toBeVisible()

  await app.field('Title').fill('Valid')
  await app.page.getByRole('button', {name: 'Publish'}).click()
  await expect(app.title).toHaveText('Valid')
  await expect(dialog).toHaveCount(0)
})
