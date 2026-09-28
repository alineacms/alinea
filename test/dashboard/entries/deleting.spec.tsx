import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

// Slow reads keep the parent page loading while the entry is removed
const readDelay = 5

test('deletes an archived entry and lands on its parent overview', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(
    () => mount(<DashboardScenarioMount readDelay={readDelay} />),
    {
      entry: 'orderedZebra',
      title: 'Zebra'
    }
  )

  await app.runEntryAction('Archive')
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()
  await app.runEntryAction('Delete')

  await expect(app.page).toHaveURL(/workflow-ordered-folder$/)
  await expect(app.title).toHaveText('Ordered folder')
  const explorer = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(explorer.getByRole('row', {name: /^Apple /})).toBeVisible()
  await expect(explorer.getByRole('row', {name: /^Zebra /})).toHaveCount(0)
})

test('deletes an unpublished entry and lands on its parent overview', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(
    () => mount(<DashboardScenarioMount readDelay={readDelay} />),
    {
      entry: 'orderedFolder',
      title: 'Ordered folder'
    }
  )

  await app.page.getByRole('button', {name: 'Edit entry'}).click()
  await app.runEntryAction('Unpublish')
  await expect(app.page.getByText('Unpublished', {exact: true})).toBeVisible()
  await app.page.getByRole('button', {name: 'Expand Ordered folder'}).click()
  // Unpublishing the parent also unpublishes its children
  await app.openEntry('Zebra')
  await app.runEntryAction('Delete')

  await expect(app.page).toHaveURL(/workflow-ordered-folder$/)
  await expect(app.title).toHaveText('Ordered folder')
  const explorer = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(explorer.getByRole('row', {name: /^Apple /})).toBeVisible()
  await expect(explorer.getByRole('row', {name: /^Zebra /})).toHaveCount(0)
})
