import type {Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {dashboardScenarioIds} from '../support/DashboardScenarioData.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

function mediaLocations(page: Page) {
  const main = page.getByRole('main')
  return {
    root: main.getByRole('button', {name: 'Media', exact: true}),
    tree: main.getByRole('treegrid', {name: 'Content tree'}),
    explorer: main.getByRole('grid', {name: 'Explorer entries'})
  }
}

test('opens a media folder page from the root explorer and returns to the root', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(
    () => mount(<DashboardScenarioMount readDelay={5} />),
    {
      routeEntry: dashboardScenarioIds.mediaFolder,
      routeRoot: 'media',
      title: 'Media folder'
    }
  )
  const {root, tree, explorer} = mediaLocations(app.page)
  const folderRow = tree.getByRole('row', {name: /^Media folder/})

  // Rapidly open the folder from the root explorer and go back to the root
  for (let i = 0; i < 3; i++) {
    await root.click()
    await explorer.getByRole('row', {name: 'Media folder', exact: true}).click()
    await folderRow.click()
  }
  await root.click()

  await expect(app.page).toHaveURL(/#\/entry\/main\/media$/)
  await expect(root).toHaveAttribute('aria-current', 'page')
  await expect(tree.getByRole('row', {selected: true})).toHaveCount(0)
  await expect(app.title).toHaveCount(0)
  await expect(
    explorer.getByRole('row', {name: 'Media folder', exact: true})
  ).toBeVisible()
  await expect(
    explorer.getByRole('row', {name: 'Legacy image', exact: true})
  ).toBeVisible()

  // Opening the folder from the explorer shows its page
  await explorer.getByRole('row', {name: 'Media folder', exact: true}).click()

  await expect(app.page).toHaveURL(/workflow-media-folder\?view=overview$/)
  await expect(app.title).toHaveText('Media folder')
  await expect(folderRow).toHaveAttribute('aria-selected', 'true')
  await expect(root).not.toHaveAttribute('aria-current', 'page')
  await expect(
    explorer.getByRole('row', {name: 'Nested media folder', exact: true})
  ).toBeVisible()
})
