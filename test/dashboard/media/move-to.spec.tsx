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
    app.page
      .getByRole('navigation', {name: 'Breadcrumb'})
      .getByRole('button')
      .last()
  ).toBeVisible()

  await app.runEntryAction('Move to…')
  const dialog = app.page.getByRole('dialog', {name: 'Move "Existing image"'})
  const entries = dialog.getByRole('treegrid', {name: 'Explorer entries'})
  const move = dialog.getByRole('button', {name: 'Move', exact: true})
  await expect(move).toBeDisabled()
  // The file is at the root already
  await expect(
    dialog.getByRole('button', {name: 'Move to root'})
  ).toBeDisabled()
  // Files are not a place to move to
  for (const name of [/^Existing image/, /^Existing file/])
    await expect(entries.getByRole('row', {name})).toHaveAttribute(
      'data-unselectable',
      'true'
    )
  await entries.getByRole('row', {name: /^Media directory/}).click()
  await move.click()

  await expect(dialog).toHaveCount(0)
  await app.page
    .getByRole('navigation', {name: 'Breadcrumb'})
    .getByRole('button')
    .last()
    .click()
  await expect(app.title).toHaveText('Media directory')
  const explorer = app.page.getByRole('grid', {name: 'Explorer entries'})
  await expect(
    explorer.getByRole('row', {name: 'Existing image', exact: true})
  ).toBeVisible()
  await expect(
    explorer.getByRole('row', {name: 'Nested image', exact: true})
  ).toBeVisible()
})

test('moves a media file out of its directory to the root', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.nestedImage,
    routeRoot: 'media',
    title: 'Nested image'
  })

  await app.runEntryAction('Move to…')
  const dialog = app.page.getByRole('dialog', {name: 'Move "Nested image"'})
  // The picker opens at the current location of the file
  await expect(
    dialog
      .getByRole('treegrid', {name: 'Explorer entries'})
      .getByRole('row', {name: /^Nested image/})
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Move to root'}).click()

  await expect(dialog).toHaveCount(0)
  await app.page
    .getByRole('navigation', {name: 'Breadcrumb'})
    .getByRole('button')
    .last()
    .click()
  await expect(
    app.page
      .getByRole('grid', {name: 'Explorer entries'})
      .getByRole('row', {name: 'Nested image', exact: true})
  ).toBeVisible()
})

test('never moves a media directory into itself', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.mediaDirectory,
    routeRoot: 'media',
    title: 'Media directory'
  })
  await app.page
    .getByRole('navigation', {name: 'Breadcrumb'})
    .getByRole('button')
    .last()
    .click()
  await app.page
    .getByRole('grid', {name: 'Explorer entries'})
    .getByRole('row', {name: 'Media directory', exact: true})
    .locator('[data-slot="selection-checkbox"]')
    .click()
  await app.page
    .getByRole('toolbar', {name: 'Selected entries'})
    .getByRole('button', {name: 'Move to…'})
    .click()

  const dialog = app.page.getByRole('dialog', {name: 'Move "Media directory"'})
  const entries = dialog.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(
    entries.getByRole('row', {name: /^Media directory/})
  ).toHaveAttribute('data-unselectable', 'true')
  await expect(
    entries.getByRole('row', {name: /^Empty media directory/})
  ).not.toHaveAttribute('data-unselectable')
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
  await app.page
    .getByRole('navigation', {name: 'Breadcrumb'})
    .getByRole('button')
    .last()
    .click()

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
    .getByRole('treegrid', {name: 'Explorer entries'})
    .getByRole('row', {name: /^Empty media directory/})
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
  await app.page
    .getByRole('navigation', {name: 'Breadcrumb'})
    .getByRole('button')
    .last()
    .click()

  const explorer = app.page.getByRole('grid', {name: 'Explorer entries'})
  for (const name of ['Existing image', 'Existing file'])
    await explorer
      .getByRole('row', {name, exact: true})
      .locator('[data-slot="selection-checkbox"]')
      .click()
  const selection = app.page.getByRole('toolbar', {name: 'Selected entries'})
  await selection.getByRole('button', {name: 'Delete'}).click()

  const dialog = app.page.getByRole('dialog', {name: 'Delete 2 items'})
  await expect(
    dialog.getByText(
      '2 files will be permanently deleted from the media library'
    )
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
