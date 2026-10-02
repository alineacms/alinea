import {expect, test} from '../support/DashboardTest.js'
import {dashboardLinkScenarioIds} from '../support/DashboardScenarioData.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

test('opens a media directory overview from its sidebar icon', async ({
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
  const sidebar = app.page.getByRole('treegrid', {name: 'Content tree'})
  const directory = sidebar.getByRole('row', {
    name: 'Media directory',
    exact: true
  })

  await directory.locator('[data-slot="tree-item-icon"]').click()

  await expect(app.page).toHaveURL(/workflow-media-directory$/)
  await expect(app.title).toHaveText('Media directory')
  await expect(
    app.page
      .getByRole('grid', {name: 'Explorer entries'})
      .getByRole('row', {name: 'Nested image', exact: true})
  ).toBeVisible()
})

test('opens a media directory card', async ({dashboard, mount}) => {
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
  await explorer
    .getByRole('row', {name: 'Media directory', exact: true})
    .click()

  await expect(
    explorer.getByRole('row', {name: 'Nested image', exact: true})
  ).toBeVisible()
})

test('moves media files from an overview into a media directory card', async ({
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
  await expect(
    explorer.getByRole('row', {name: 'Nested image', exact: true})
  ).toHaveCount(0)
  await explorer
    .getByRole('button', {name: 'Drag Existing image'})
    .dragTo(explorer.getByRole('row', {name: 'Media directory', exact: true}), {
      force: true
    })

  await expect(
    explorer.getByRole('row', {name: 'Existing image', exact: true})
  ).toHaveCount(0)
})

test('moves media files from an overview into a sidebar media directory', async ({
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
  const sidebar = app.page.getByRole('treegrid', {name: 'Content tree'})
  await explorer
    .getByRole('button', {name: 'Drag Existing image'})
    .dragTo(sidebar.getByRole('row', {name: 'Media directory', exact: true}), {
      force: true
    })

  await expect(
    explorer.getByRole('row', {name: 'Existing image', exact: true})
  ).toHaveCount(0)
})

test('only drops media files on media directories', async ({
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
  const image = explorer.getByRole('row', {name: 'Existing image', exact: true})
  const drag = explorer.getByRole('button', {name: 'Drag Existing image'})
  // A file holds no children, dropping on it does nothing
  await drag.dragTo(
    explorer.getByRole('row', {name: 'Existing file', exact: true}),
    {force: true}
  )
  await expect(image).toBeVisible()
  await drag.dragTo(
    explorer.getByRole('row', {name: 'Media directory', exact: true}),
    {force: true}
  )
  await expect(image).toHaveCount(0)
})

test('moves a media directory into another in the sidebar', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.mediaDirectory,
    routeRoot: 'media',
    title: 'Media directory'
  })
  const sidebar = app.page.getByRole('treegrid', {name: 'Content tree'})
  // Media directories are listed in their manual order, before the files
  await sidebar
    .getByRole('button', {name: 'Drag Empty media directory'})
    .dragTo(sidebar.getByRole('row', {name: 'Media directory', exact: true}), {
      force: true
    })

  await expect(async () => {
    const expand = sidebar.getByRole('button', {name: 'Expand Media directory'})
    if (await expand.isVisible()) await expand.click()
    await expect(
      sidebar.getByRole('row', {name: 'Empty media directory', exact: true})
    ).toHaveAttribute('aria-level', '2', {timeout: 1000})
  }).toPass()
})
