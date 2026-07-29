import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('moves an entry into another entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await app.page.getByRole('button', {name: 'Expand Folder'}).click()

  await expect(app.entry('Alpha')).toBeVisible()
  await expect(app.entry('Alpha')).toHaveAttribute('aria-level', '2')
})
