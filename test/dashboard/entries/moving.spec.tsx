import type {Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

/** Moving a page under another parent changes its url, which asks first */
async function confirmMove(page: Page) {
  const dialog = page.getByRole('dialog', {name: /^Move pages?$/})
  await dialog.getByRole('button', {name: 'Move', exact: true}).click()
  await expect(dialog).toBeHidden()
}

test('moves an entry into another entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await confirmMove(app.page)
  // The open entry stays selected, which reveals it in its new parent
  await expect(app.entry('Alpha')).toHaveAttribute('aria-level', '2')
  await expect(app.entry('Folder')).toHaveAttribute('aria-expanded', 'true')
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

  await overview
    .getByRole('button', {name: 'Drag Child'})
    .dragTo(tree.getByRole('row', {name: 'Folder', exact: true}), {
      force: true,
      targetPosition: {x: 100, y: 1}
    })
  await confirmMove(app.page)

  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toHaveAttribute('aria-level', '1')
})

test('moves a child above its expanded parent', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await confirmMove(app.page)
  const workspaceRoots = app.page.getByRole('complementary', {
    name: 'Workspace roots'
  })
  await workspaceRoots.getByRole('button', {name: 'Pages', exact: true}).click()
  // The tree changes with the root page once it is shown, the folder no
  // longer holds the open entry so it collapses
  await expect(app.title).toHaveCount(0)
  await tree.getByRole('button', {name: 'Expand Folder'}).click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()

  const child = tree.getByRole('button', {name: 'Drag Child'})
  const folder = tree.getByRole('row', {name: 'Folder', exact: true})

  await child.dragTo(folder, {
    force: true,
    targetPosition: {x: 100, y: 1}
  })
  await confirmMove(app.page)

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
  await confirmMove(app.page)
  const workspaceRoots = app.page.getByRole('complementary', {
    name: 'Workspace roots'
  })
  await workspaceRoots.getByRole('button', {name: 'Pages', exact: true}).click()
  // The tree changes with the root page once it is shown, the folder no
  // longer holds the open entry so it collapses
  await expect(app.title).toHaveCount(0)
  await tree.getByRole('button', {name: 'Expand Folder'}).click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()

  await tree
    .getByRole('button', {name: 'Drag Child'})
    .dragTo(tree.getByRole('row', {name: 'Alpha', exact: true}), {force: true})
  await confirmMove(app.page)

  await tree.getByRole('button', {name: 'Expand Alpha'}).click()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toHaveAttribute('aria-level', '3')
})

test('reorders entries by dragging them in an overview', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await app.page.getByRole('button', {name: 'Back to root'}).click()
  const overview = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  const rows = overview.getByRole('row')
  await expect(rows.nth(0)).toHaveAccessibleName(/^Alpha/)
  await expect(rows.nth(1)).toHaveAccessibleName(/^Beta/)

  await overview
    .getByRole('button', {name: 'Drag Beta'})
    .dragTo(rows.nth(0), {force: true, targetPosition: {x: 100, y: 1}})

  // The url stays the same, so this does not ask
  await expect(app.page.getByRole('dialog')).toHaveCount(0)
  await expect(rows.nth(0)).toHaveAccessibleName(/^Beta/)
  await expect(rows.nth(1)).toHaveAccessibleName(/^Alpha/)
})

test('moves an entry into a folder by dragging it in an overview', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await app.page.getByRole('button', {name: 'Back to root'}).click()
  const overview = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  const folder = overview.getByRole('row', {name: /^Folder/})

  await overview
    .getByRole('button', {name: 'Drag Alpha'})
    .dragTo(folder, {force: true})
  await confirmMove(app.page)

  await expect(overview.getByRole('row', {name: /^Alpha/})).toHaveCount(0)
  await overview.getByRole('row', {name: /^Folder/}).click()
  await expect(app.title).toHaveText('Folder')
  await expect(overview.getByRole('row', {name: /^Alpha/})).toBeVisible()
})

test('asks before moving a page under another parent', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const dialog = app.page.getByRole('dialog', {name: 'Move page'})

  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await expect(dialog).toContainText('"Alpha"')
  await expect(dialog).toContainText('changes the URL')
  await dialog.getByRole('button', {name: 'Cancel'}).click()
  await expect(dialog).toBeHidden()
  await expect(app.entry('Alpha')).toHaveAttribute('aria-level', '1')

  await app.entry('Alpha').dragTo(app.entry('Folder'))
  await dialog.getByRole('button', {name: "Move and don't ask again"}).click()
  await expect(app.entry('Alpha')).toHaveAttribute('aria-level', '2')

  // Moving it on no longer asks
  await app.entry('Alpha').dragTo(app.entry('Other folder'))
  await expect(dialog).toHaveCount(0)
  await expect(app.entry('Other folder')).toHaveAttribute(
    'aria-expanded',
    'true'
  )
})

test('does not offer a parent that can not hold the entry', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  // Pages hold pages, not ordered folders
  await app.entry('Ordered folder').dragTo(app.entry('Folder'))
  await expect(app.page.getByRole('dialog')).toHaveCount(0)
  await expect(app.entry('Ordered folder')).toHaveAttribute('aria-level', '1')
})
