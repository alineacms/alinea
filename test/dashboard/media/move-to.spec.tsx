import {expect, test} from '../support/DashboardTest.js'
import {dashboardLinkScenarioIds} from '../support/DashboardScenarioData.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

test('moves a media file to a media directory from the entry menu', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.existingImage,
    routeRoot: 'media',
    title: 'Existing image'
  })
  await expect(
    app.page.getByRole('button', {name: 'Back to root'})
  ).toBeVisible()

  await app.runEntryAction('Move to…')
  const dialog = app.page.getByRole('dialog', {name: 'Move "Existing image"'})
  const targets = dialog.getByRole('treegrid', {name: 'Move targets'})
  await expect(
    targets.getByRole('row', {name: 'Empty media directory', exact: true})
  ).toBeVisible()
  // Files are not a place to move to
  await expect(
    targets.getByRole('row', {name: 'Existing file', exact: true})
  ).toHaveCount(0)
  await targets.getByRole('row', {name: 'Media directory', exact: true}).click()
  await expect(dialog.getByText('Move to Media directory')).toBeVisible()
  await dialog.getByRole('button', {name: 'Move', exact: true}).click()

  await expect(dialog).toHaveCount(0)
  await app.page.getByRole('button', {name: 'Back to parent entry'}).click()
  await expect(app.title).toHaveText('Media directory')
  const explorer = app.page.getByRole('grid', {name: 'Explorer entries'})
  await expect(
    explorer.getByRole('row', {name: 'Existing image', exact: true})
  ).toBeVisible()
  await expect(
    explorer.getByRole('row', {name: 'Nested image', exact: true})
  ).toBeVisible()
})

test('moves selected media files to a media directory', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.mediaDirectory,
    routeRoot: 'media',
    title: 'Media directory'
  })
  await app.page.getByRole('button', {name: 'Back to root'}).click()

  const explorer = app.page.getByRole('grid', {name: 'Explorer entries'})
  for (const name of ['Existing image', 'Existing file'])
    await explorer
      .getByRole('row', {name, exact: true})
      .locator('[data-slot="selection-checkbox"]')
      .click()
  const selection = app.page.getByRole('toolbar', {name: 'Selected entries'})
  await expect(selection.getByText('2 selected')).toBeVisible()

  await selection.getByRole('button', {name: 'Move to…'}).click()
  const dialog = app.page.getByRole('dialog', {name: 'Move 2 items'})
  await dialog
    .getByRole('treegrid', {name: 'Move targets'})
    .getByRole('row', {name: 'Empty media directory', exact: true})
    .click()
  await dialog.getByRole('button', {name: 'Move', exact: true}).click()

  await expect(dialog).toHaveCount(0)
  await expect(selection).toHaveCount(0)
  await expect(
    explorer.getByRole('row', {name: 'Existing image', exact: true})
  ).toHaveCount(0)
  await expect(
    explorer.getByRole('row', {name: 'Existing file', exact: true})
  ).toHaveCount(0)

  await explorer
    .getByRole('row', {name: 'Empty media directory', exact: true})
    .click()
  await expect(
    explorer.getByRole('row', {name: 'Existing image', exact: true})
  ).toBeVisible()
  await expect(
    explorer.getByRole('row', {name: 'Existing file', exact: true})
  ).toBeVisible()
})

test('deletes selected media files after confirming', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.mediaDirectory,
    routeRoot: 'media',
    title: 'Media directory'
  })
  await app.page.getByRole('button', {name: 'Back to root'}).click()

  const explorer = app.page.getByRole('grid', {name: 'Explorer entries'})
  for (const name of ['Existing image', 'Existing file'])
    await explorer
      .getByRole('row', {name, exact: true})
      .locator('[data-slot="selection-checkbox"]')
      .click()
  const selection = app.page.getByRole('toolbar', {name: 'Selected entries'})
  await selection.getByRole('button', {name: 'Delete'}).click()

  const dialog = app.page.getByRole('dialog', {name: 'Delete 2 items?'})
  await expect(
    dialog.getByText('2 files are removed from the media library')
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Delete', exact: true}).click()

  await expect(dialog).toHaveCount(0)
  await expect(
    explorer.getByRole('row', {name: 'Existing image', exact: true})
  ).toHaveCount(0)
  await expect(
    explorer.getByRole('row', {name: 'Existing file', exact: true})
  ).toHaveCount(0)
  await expect(
    explorer.getByRole('row', {name: 'Media directory', exact: true})
  ).toBeVisible()
})
