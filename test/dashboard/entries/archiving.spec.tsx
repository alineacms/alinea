import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('archives and restores an entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.runEntryAction('Archive')
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()

  await app.runEntryAction('Publish')
  await expect(app.page.getByText('Published', {exact: true})).toBeVisible()
})
