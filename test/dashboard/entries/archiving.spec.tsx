import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('archives and restores an entry', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.runEntryAction('Archive')
  const dialog = app.page.getByRole('dialog', {name: 'Archive entry'})
  await expect(
    dialog.getByText('This entry will be archived and can be restored later.')
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Cancel'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.page.getByText('Archived', {exact: true})).toHaveCount(0)

  await app.runEntryAction('Archive')
  await dialog.getByRole('button', {name: 'Archive', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()

  await app.runEntryAction('Publish')
  await app.page.getByRole('button', {name: 'More actions'}).click()
  await expect(
    app.page.getByRole('menuitem', {name: 'Unpublish', exact: true})
  ).toBeVisible()
})

test('deletes an archived entry and navigates to its parent', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'child'
  })
  const pageErrors: Array<Error> = []
  app.page.on('pageerror', error => pageErrors.push(error))

  await app.runEntryAction('Archive')
  await app.page
    .getByRole('dialog', {name: 'Archive entry'})
    .getByRole('button', {name: 'Archive', exact: true})
    .click()
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()
  await app.runEntryAction('Delete')
  await app.page
    .getByRole('dialog', {name: 'Delete entry'})
    .getByRole('button', {name: 'Delete', exact: true})
    .click()

  await expect(app.page).toHaveURL(/workflow-folder$/)
  await expect(app.title).toHaveText('Folder')
  await expect(app.entry('Child')).toHaveCount(0)

  await app.page.goBack()
  await expect(app.title).toHaveText('Entry not found')
  await expect(app.page.getByText('Requested id:')).toContainText(
    'workflow-child'
  )
  expect(pageErrors).toEqual([])
})

test('lists the links that break when an entry is archived', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedTarget',
    routeRoot: 'localized',
    title: 'Localized target'
  })

  await app.runEntryAction('Archive')
  const dialog = app.page.getByRole('dialog', {name: 'Archive entry'})
  await expect(dialog.getByRole('alert')).toContainText(
    'This entry has 1 reference'
  )
  await expect(dialog.getByRole('list', {name: 'References'})).toContainText(
    'Localized linking'
  )
  await expect(dialog.getByText('If this page was publicly')).toHaveCount(0)
  await expect(
    dialog.getByText('Redirect the URL to another page (recommended)')
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Archive', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()
})

test('suggests a redirect for a page nothing links to', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.runEntryAction('Archive')
  const dialog = app.page.getByRole('dialog', {name: 'Archive entry'})
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(
    dialog.getByText(
      'If this page was publicly available, links to its URL may still be around elsewhere. It can be useful to redirect its URL to another page.'
    )
  ).toBeVisible()
})

test('redirects the url of the archived page to the picked page', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'beta'
  })

  await app.runEntryAction('Archive')
  const dialog = app.page.getByRole('dialog', {name: 'Archive entry'})
  await dialog.getByRole('button', {name: 'Choose page…'}).click()
  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await picker.getByRole('row', {name: /^Alpha/}).click()
  await expect(picker).toHaveCount(0)
  await expect(dialog.getByText('/alpha', {exact: true})).toBeVisible()
  await dialog.getByRole('button', {name: 'Archive', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()

  await app.openEntry('Alpha')
  await app.page.getByRole('tab', {name: 'Details'}).click()
  await expect(app.page.getByRole('textbox', {name: 'URL'})).toHaveValue(
    '/beta'
  )
})

test('archives without asking again during the session', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.runEntryAction('Archive')
  const dialog = app.page.getByRole('dialog', {name: 'Archive entry'})
  const skip = dialog.getByRole('checkbox', {
    name: "Don't show this again during this session"
  })
  await dialog.getByText("Don't show this again during this session").click()
  await expect(skip).toBeChecked()
  await dialog.getByRole('button', {name: 'Archive', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()

  await app.openEntry('Beta')
  await app.runEntryAction('Archive')
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()
  await expect(dialog).toHaveCount(0)

  // Deleting always asks
  await app.runEntryAction('Delete')
  await expect(
    app.page.getByRole('dialog', {name: 'Delete entry'})
  ).toBeVisible()
})
