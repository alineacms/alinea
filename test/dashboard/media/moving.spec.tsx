import {expect, test} from '../support/DashboardTest.js'
import {dashboardLinkScenarioIds} from '../support/DashboardScenarioData.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

test('moves media files from an overview into a media directory card', async ({
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
  await explorer
    .getByRole('button', {name: 'Drag Existing image'})
    .dragTo(
      explorer.getByRole('row', {name: 'Media directory', exact: true}),
      {force: true}
    )

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
  await app.page.getByRole('button', {name: 'Back to root'}).click()

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
