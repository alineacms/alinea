import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('moves an entry into another entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.entry('Alpha').dragTo(app.entry('Folder'))
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
  const workspaceRoots = app.page.getByRole('complementary', {
    name: 'Workspace roots'
  })
  await workspaceRoots.getByRole('button', {name: 'Pages'}).click()
  await tree.getByRole('button', {name: 'Expand Folder'}).click()

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
    /Alpha$/
  ])
})

test('moves a child between expanded tree levels', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await app.entry('Alpha').dragTo(app.entry('Folder'))
  const workspaceRoots = app.page.getByRole('complementary', {
    name: 'Workspace roots'
  })
  await workspaceRoots.getByRole('button', {name: 'Pages'}).click()
  await tree.getByRole('button', {name: 'Expand Folder'}).click()

  await tree
    .getByRole('button', {name: 'Drag Child'})
    .dragTo(tree.getByRole('row', {name: 'Alpha', exact: true}), {force: true})

  await tree.getByRole('button', {name: 'Expand Alpha'}).click()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toHaveAttribute('aria-level', '3')
})
