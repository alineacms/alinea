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

test('moves an entry from an overview to the root level', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'folder',
    title: 'Folder'
  })
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  const overview = app.page.getByRole('treegrid', {name: 'Explorer entries'})

  await tree
    .getByRole('button', {name: 'Drag Beta'})
    .dragTo(tree.getByRole('row', {name: 'Folder', exact: true}), {force: true})
  await expect(overview.getByRole('row', {name: /^Beta/})).toBeVisible()
  await overview.getByRole('button', {name: 'Drag Child'}).dragTo(
    tree.getByRole('row', {name: 'Alpha', exact: true}),
    {force: true, targetPosition: {x: 100, y: 1}}
  )

  await expect(tree.getByRole('row', {name: 'Child', exact: true})).toHaveAttribute(
    'aria-level',
    '1'
  )
})

test('moves a child above its expanded parent', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await app.entry('Alpha').dragTo(app.entry('Folder'))
  const workspaceRoots = app.page.getByRole('complementary', {
    name: 'Workspace roots'
  })
  await workspaceRoots
    .getByRole('button', {name: 'Pages', exact: true})
    .click()
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
    /Other folder$/,
    /Ordered folder$/,
    /Receiver archive for wireless systems$/,
    /Archive$/,
    /Wireless receiver at 77 GHz$/
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
  await workspaceRoots
    .getByRole('button', {name: 'Pages', exact: true})
    .click()
  const expandFolder = tree.getByRole('button', {name: 'Expand Folder'})
  if (await expandFolder.isVisible()) await expandFolder.click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()

  await tree
    .getByRole('button', {name: 'Drag Child'})
    .dragTo(tree.getByRole('row', {name: 'Alpha', exact: true}), {force: true})

  await tree.getByRole('button', {name: 'Expand Alpha'}).click()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toHaveAttribute('aria-level', '3')
})
