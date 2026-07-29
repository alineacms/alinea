import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('saves a draft and shows it again after navigating away', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.field('Title').fill('Alpha edited')
  await app.page.getByRole('button', {name: 'Save draft'}).click()
  await expect(app.title).toHaveText('Alpha edited')

  await app.openEntry('Beta')
  await app.openEntry('Alpha edited')
  await expect(app.field('Title')).toHaveValue('Alpha edited')
})
