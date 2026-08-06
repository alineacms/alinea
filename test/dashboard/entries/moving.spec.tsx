import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'
import type {Page} from 'playwright'

test('moves an entry into another entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await confirmParentMove(app.page)
  await expect(async () => {
    const expand = app.page.getByRole('button', {name: 'Expand Folder'})
    if (await expand.isVisible()) await expand.click()
    await expect(app.entry('Alpha')).toBeVisible({timeout: 1000})
  }).toPass()
  await expect(app.entry('Alpha')).toHaveAttribute('aria-level', '2')
})

test('moves a child above its expanded parent', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await confirmParentMove(app.page)
  const workspaceRoots = app.page.getByRole('complementary', {
    name: 'Workspace roots'
  })
  await workspaceRoots.getByRole('button', {name: 'Pages'}).click()
  const expandFolder = tree.getByRole('button', {name: 'Expand Folder'})
  if (await expandFolder.isVisible()) await expandFolder.click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()

  const child = tree.getByRole('button', {name: 'Drag Child'})
  const folder = tree.getByRole('row', {name: 'Folder', exact: true})

  await child.dragTo(folder, {
    force: true,
    targetPosition: {x: 100, y: 1}
  })

  const movedChild = tree.getByRole('row', {name: 'Child', exact: true})
  await expect(movedChild).toHaveAttribute('aria-level', '1')
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()
  await expect(tree.getByRole('row')).toHaveText([
    /Beta$/,
    /Child$/,
    /Folder$/,
    /Alpha$/,
    /Wireless receiver at 77 GHz$/,
    /Archive$/
  ])
})

test('moves a child between expanded tree levels', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await confirmParentMove(app.page)
  const workspaceRoots = app.page.getByRole('complementary', {
    name: 'Workspace roots'
  })
  await workspaceRoots.getByRole('button', {name: 'Pages'}).click()
  const expandFolder = tree.getByRole('button', {name: 'Expand Folder'})
  if (await expandFolder.isVisible()) await expandFolder.click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()

  await tree
    .getByRole('button', {name: 'Drag Child'})
    .dragTo(tree.getByRole('row', {name: 'Alpha', exact: true}), {force: true})
  await confirmParentMove(app.page)

  await tree.getByRole('button', {name: 'Expand Alpha'}).click()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toHaveAttribute('aria-level', '3')
})

async function confirmParentMove(page: Page) {
  const confirmation = page.getByRole('dialog')
  await expect(confirmation).toBeVisible()
  await expect(
    confirmation.getByRole('heading', {name: 'Move entry'})
  ).toBeVisible()
  await confirmation.getByRole('button', {name: 'Move entry'}).click()
}
