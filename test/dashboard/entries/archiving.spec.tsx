import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('archives and restores an entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.runEntryAction('Archive')
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()

  await app.runEntryAction('Publish')
  await expect(app.page.getByText('Published', {exact: true})).toBeVisible()
})

test('deletes an entry and navigates to its parent', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'child'
  })
  const pageErrors: Array<Error> = []
  app.page.on('pageerror', error => pageErrors.push(error))

  await app.runEntryAction('Archive')
  await app.runEntryAction('Delete')

  await expect(app.page).toHaveURL(/workflow-folder$/)
  await expect(app.title).toHaveText('Folder')
  await expect(app.entry('Child')).toHaveCount(0)

  await app.page.goBack()
  await expect(app.title).toHaveText('Entry not found')
  await expect(app.page.getByText('Requested id:')).toContainText(
    'workflow-child'
  )
  expect(pageErrors).toEqual([])
})
