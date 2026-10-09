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

test('warns about invalid fields before publishing', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const publish = app.page.getByRole('button', {name: 'Publish', exact: true})

  await app.field('Title').fill('Invalid')
  await expect(app.page.getByText('Pick another title')).toBeVisible()
  await publish.click()
  const dialog = app.page.getByRole('dialog', {name: 'Some fields are invalid'})
  await expect(dialog.getByText('Title', {exact: true})).toBeVisible()
  await expect(dialog.getByText('Pick another title')).toBeVisible()
  await dialog.getByRole('button', {name: 'Show fields'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.field('Title')).toBeFocused()

  await publish.click()
  await dialog.getByRole('button', {name: 'Publish anyway'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.title).toHaveText('Invalid')
  await expect(
    app.page.locator('header').getByText('Draft', {exact: true})
  ).toHaveCount(0)
})
