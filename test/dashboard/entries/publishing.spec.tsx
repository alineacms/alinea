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
  await expect(app.page.getByText('Published', {exact: true})).toBeVisible()

  await app.openEntry('Beta')
  await app.openEntry('Published Alpha')
  await expect(app.field('Title')).toHaveValue('Published Alpha')
})

test('unpublishes and republishes an entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.runEntryAction('Unpublish')
  await expect(app.page.getByText('Unpublished', {exact: true})).toBeVisible()

  await app.page.getByRole('button', {name: 'Publish'}).click()
  await expect(app.page.getByText('Published', {exact: true})).toBeVisible()
})
