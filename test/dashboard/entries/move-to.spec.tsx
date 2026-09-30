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
  await expect(dialog.getByText('Move to "Localized target"')).toBeVisible()
  await dialog.getByRole('button', {name: 'Move', exact: true}).click()

  await expect(dialog).toHaveCount(0)
  await expect(
    app.page.getByRole('button', {name: 'Back to parent entry'})
  ).toBeVisible()
})

test('searches the whole root and shows where entries move to', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'child'
  })

  await app.runEntryAction('Move to…')
  const dialog = app.page.getByRole('dialog', {name: 'Move "Child"'})
  const entries = dialog.getByRole('treegrid', {name: 'Explorer entries'})
  const search = dialog.getByRole('searchbox', {name: 'Search'})
  const move = dialog.getByRole('button', {name: 'Move', exact: true})
  // Opened in its folder, the search still finds entries outside of it
  await search.fill('folder')
  await entries.getByRole('row', {name: /^Other folder/}).click()
  await expect(dialog.getByText('Move to "Other folder"')).toBeVisible()
  await expect(move).toBeEnabled()

  // The entry is in its folder already
  await entries.getByRole('row', {name: /^Folder/}).click()
  await expect(dialog.getByText('Already in "Folder"')).toBeVisible()
  await expect(move).toBeDisabled()

  // A target that is no longer listed can not be moved to
  await search.fill('')
  await expect(entries.getByRole('row', {name: /^Child/})).toBeVisible()
  await expect(dialog.getByText('Move "Child"')).toBeVisible()
  await expect(move).toBeDisabled()
})
