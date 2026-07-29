import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('opens a functional location in another workspace and root', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Page link'}).click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await expect(
    picker.getByRole('row', {name: 'Reference target'})
  ).toBeVisible()
  await expect(picker.getByRole('row', {name: 'Beta'})).toHaveCount(0)
})
