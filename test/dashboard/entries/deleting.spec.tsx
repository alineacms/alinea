import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

// Slow reads keep the parent page loading while the entry is removed
const readDelay = 5

test('deletes a published entry after confirming and lands on its parent overview', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(
    () => mount(<DashboardScenarioMount readDelay={readDelay} />),
    {
      entry: 'orderedZebra',
      title: 'Zebra'
    }
  )

  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete entry'})
  await expect(
    dialog.getByText('This entry will be permanently deleted')
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Cancel'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.title).toHaveText('Zebra')

  await app.runEntryAction('Delete')
  await dialog.getByRole('button', {name: 'Delete', exact: true}).click()

  await expect(app.page).toHaveURL(/workflow-ordered-folder$/)
  await expect(app.title).toHaveText('Ordered folder')
  const explorer = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(explorer.getByRole('row', {name: /^Apple /})).toBeVisible()
  await expect(explorer.getByRole('row', {name: /^Zebra /})).toHaveCount(0)
})

test('deletes an unpublished entry and lands on its parent overview', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(
    () => mount(<DashboardScenarioMount readDelay={readDelay} />),
    {
      entry: 'orderedFolder',
      title: 'Ordered folder'
    }
  )

  await app.page.getByRole('button', {name: 'Edit entry'}).click()
  await app.runEntryAction('Unpublish')
  await expect(app.page.getByText('Unpublished', {exact: true})).toBeVisible()
  await app.page.getByRole('button', {name: 'Expand Ordered folder'}).click()
  // Unpublishing the parent also unpublishes its children
  await app.openEntry('Zebra')
  await app.runEntryAction('Delete')
  await app.page
    .getByRole('dialog', {name: 'Delete entry'})
    .getByRole('button', {name: 'Delete', exact: true})
    .click()

  await expect(app.page).toHaveURL(/workflow-ordered-folder$/)
  await expect(app.title).toHaveText('Ordered folder')
  const explorer = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(explorer.getByRole('row', {name: /^Apple /})).toBeVisible()
  await expect(explorer.getByRole('row', {name: /^Zebra /})).toHaveCount(0)
})

test('deletes only the chosen language and warns about its references', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedTarget',
    routeRoot: 'localized',
    title: 'Localized target'
  })

  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete entry'})
  const languages = dialog.getByRole('group', {name: 'Languages to delete'})
  await expect(languages.getByRole('checkbox', {name: 'EN'})).toBeChecked()
  await expect(languages.getByRole('checkbox', {name: 'FR'})).not.toBeChecked()
  const alert = dialog.getByRole('alert')
  await expect(alert).toContainText('This entry has 1 reference')
  const references = dialog.getByRole('list', {name: 'References'})
  await expect(references).toContainText('Localized linking')
  await expect(references).not.toContainText('Lien localisé')

  await languages.getByText('FR').click()
  await expect(alert).toContainText('This entry has 2 references')
  await expect(references).toContainText('Lien localisé')
  await languages.getByText('FR').click()
  await expect(alert).toContainText('This entry has 1 reference')

  await dialog.getByRole('button', {name: 'Delete', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await expect(tree.getByRole('row', {name: 'Localized linking'})).toBeVisible()
  await expect(tree.getByRole('row', {name: 'Localized target'})).toHaveCount(0)

  // The French translation remains
  await app.page.evaluate(hash => {
    window.location.hash = hash
  }, '#/entry/main/localized:fr/workflow-localized-target')
  await expect(app.title).toHaveText('Cible localisée')
})
