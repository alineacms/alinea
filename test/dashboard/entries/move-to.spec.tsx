import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('only moves into entries that exist in every language of the entry', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedLinking',
    routeRoot: 'localized',
    title: 'Localized linking'
  })

  await app.runEntryAction('Move to…')
  const dialog = app.page.getByRole('dialog', {
    name: 'Move "Localized linking"'
  })
  const entries = dialog.getByRole('treegrid', {name: 'Explorer entries'})
  // The folder has no French version to hold the French one
  await expect(
    entries.getByRole('row', {name: /^Localized folder/})
  ).toHaveAttribute('data-unselectable', 'true')
  await entries.getByRole('row', {name: /^Localized target/}).click()
  await dialog.getByRole('button', {name: 'Move', exact: true}).click()

  await expect(dialog).toHaveCount(0)
  await expect(
    app.page.getByRole('button', {name: 'Back to parent entry'})
  ).toBeVisible()
})
