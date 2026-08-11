import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('applies and persists the selected theme', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.openProfile()
  await app.page.getByRole('button', {name: 'Use dark theme'}).click()
  await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect
    .poll(() =>
      app.page.evaluate(() => localStorage.getItem('alinea-dashboard-theme'))
    )
    .toBe('"dark"')

  await app.page.getByRole('button', {name: 'Use system theme'}).click()
  await expect(app.page.locator('html')).not.toHaveAttribute('data-theme')
})
