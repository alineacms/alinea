import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('opens for the current folder without showing a suspense loader', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'folder'
  })
  // When the initial load is slow the activity spinner keeps spinning for its
  // minimum duration after the dashboard shows, wait until it has settled so
  // only progress shown while opening the dialog is detected
  await expect(
    app.page.getByRole('button', {name: 'Content is up to date'})
  ).toBeVisible()

  await app.page.evaluate(() => {
    document.documentElement.dataset.suspenseLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[role="progressbar"]'))
        document.documentElement.dataset.suspenseLoaderSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await app.page
    .locator('[data-slot="page-header"]')
    .getByRole('button', {name: 'Create new'})
    .click()
  const createEntry = app.page.getByRole('dialog', {name: 'Create new'})
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

  await app.page.getByRole('button', {name: 'Create new'}).click()
  const createEntry = app.page.getByRole('dialog')
  await createEntry.getByRole('textbox', {name: 'Title'}).fill('New page')
  await createEntry.getByRole('button', {name: 'Create entry'}).click()

  await expect(app.title).toHaveText('New page')
  await expect(app.field('Title')).toHaveValue('New page')
  await expect(app.page.getByText('Unpublished', {exact: true})).toBeVisible()

  await app.crumb('Alpha').click()
  await expect(app.title).toHaveText('Alpha')
  const expandAlpha = app.page.getByRole('button', {name: 'Expand Alpha'})
  if (await expandAlpha.isVisible()) await expandAlpha.click()
  await expect(
    app.page.getByRole('button', {name: 'Collapse Alpha'})
  ).toBeVisible()
  await app.openEntry('New page')
})

test('loads a parent selected from a collapsed branch by id', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Create new'}).click()
  const createEntry = app.page.getByRole('dialog', {name: 'Create new'})
  // Outside the entry editor the parent row opens the picker itself
  await createEntry
    .getByRole('listitem', {name: 'Link item 1'})
    .getByRole('button')
    .first()
    .click()

  const picker = app.page.getByRole('dialog', {
    name: 'Pick a link in expanded view',
    exact: true
  })
  await expect(
    app.page.getByRole('dialog', {name: 'Pick a link', exact: true})
  ).toHaveCount(0)
  await expect(
    picker.getByRole('treegrid', {name: 'Explorer entries'})
  ).toBeVisible()
  await picker
    .getByRole('checkbox', {name: 'Select Ordered folder'})
    .click({force: true})
  await picker.getByRole('button', {name: 'Select'}).click()
  await expect(picker).toBeHidden()

  await expect(createEntry.getByRole('list', {name: 'Parent'})).toContainText(
    'Ordered folder'
  )
  await createEntry.getByRole('button', {name: /Page Type/}).click()
  await expect(
    app.page.getByRole('option', {name: 'Ordered folder'})
  ).toHaveCount(0)
})
