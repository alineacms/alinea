import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('moves an entry into another entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await expect(app.entry('Alpha')).toHaveCount(0)
  await expect(async () => {
    const expand = app.page.getByRole('button', {name: 'Expand Folder'})
    if (await expand.isVisible()) await expand.click()
    await expect(app.entry('Alpha')).toBeVisible({timeout: 1000})
  }).toPass()
  await expect(app.entry('Alpha')).toHaveAttribute('aria-level', '2')
})
