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
