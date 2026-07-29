import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('creates a draft entry and opens it for editing', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Create entry'}).click()
  const createEntry = app.page.getByRole('dialog')
  await createEntry.getByRole('textbox', {name: 'Title'}).fill('New page')
  await createEntry.getByRole('button', {name: 'Create entry'}).click()

  await expect(app.title).toHaveText('New page')
  await expect(app.field('Title')).toHaveValue('New page')
  await expect(app.page.getByText('Unpublished', {exact: true})).toBeVisible()

  await app.page.getByRole('button', {name: 'Back to parent entry'}).click()
  await expect(app.title).toHaveText('Alpha')
  await app.page.getByRole('button', {name: 'Expand Alpha'}).click()
  await app.openEntry('New page')
})
