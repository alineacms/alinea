import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('opens for the current folder without showing a suspense loader', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'folder'
  })

  await app.page.evaluate(() => {
    document.documentElement.dataset.suspenseLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[role="progressbar"]'))
        document.documentElement.dataset.suspenseLoaderSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await app.page.getByRole('button', {name: 'Create entry'}).click()
  const createEntry = app.page.getByRole('dialog', {name: 'Create entry'})
  await expect(createEntry.getByRole('textbox', {name: 'Title'})).toBeVisible()
  await expect(createEntry.getByRole('list', {name: 'Parent'})).toContainText(
    'Folder'
  )
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.suspenseLoaderSeen
      )
    )
    .toBe('false')
})

test('creates a draft entry and opens it for editing', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Create entry'}).click()
  const createEntry = app.page.getByRole('dialog')
  await createEntry.getByRole('textbox', {name: 'Title'}).fill('New page')
  await createEntry.getByRole('button', {name: 'Create entry'}).click()

  await expect(app.title).toHaveText('New page')
  await expect(app.field('Title')).toHaveValue('New page')
  await expect(app.page.getByText('Unpublished', {exact: true})).toBeVisible()

  await app.page.getByRole('button', {name: 'Back to parent entry'}).click()
  await expect(app.title).toHaveText('Alpha')
  const expandAlpha = app.page.getByRole('button', {name: 'Expand Alpha'})
  if (await expandAlpha.isVisible()) await expandAlpha.click()
  await expect(
    app.page.getByRole('button', {name: 'Collapse Alpha'})
  ).toBeVisible()
  await app.openEntry('New page')
})
