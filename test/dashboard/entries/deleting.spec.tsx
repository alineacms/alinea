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

test('lists a few references and links to the references tab of an entry with children', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'popularTarget',
    routeRoot: 'localized',
    title: 'Popular target'
  })

  await app.page.getByRole('button', {name: 'Edit entry'}).click()
  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete entry'})
  await expect(dialog.getByRole('alert')).toContainText(
    'This entry has 4 references'
  )
  const references = dialog.getByRole('list', {name: 'References'})
  await expect(references.getByRole('listitem')).toHaveCount(3)
  await dialog.getByRole('button', {name: 'See all 4 references'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.title).toHaveText('Popular target')
  await expect(app.page.getByRole('tab', {name: 'References'})).toHaveAttribute(
    'aria-selected',
    'true'
  )
  const tab = app.page.getByRole('tabpanel', {name: 'References'})
  await expect(tab.getByText(/^Popular linking \d$/)).toHaveCount(4)
})

test('warns about links to the files in a deleted media folder', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'mediaFolder',
    routeRoot: 'media',
    title: 'Media folder'
  })

  await app.page.getByRole('button', {name: 'Edit entry'}).click()
  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete folder'})
  await expect(dialog.getByRole('alert')).toContainText(
    'This folder and its contents have 1 reference'
  )
  await expect(dialog.getByRole('list', {name: 'References'})).toContainText(
    'Media linking'
  )
})

test('warns about links to the entries deleted with a page', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedFolder',
    routeRoot: 'localized',
    title: 'Localized folder'
  })

  await app.page.getByRole('button', {name: 'Edit entry'}).click()
  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete entry'})
  await expect(
    dialog.getByText('Entries are deleted with the entries they contain.')
  ).toBeVisible()
  await expect(dialog.getByRole('alert')).toContainText(
    'This entry and its contents have 1 reference'
  )
  await expect(dialog.getByRole('list', {name: 'References'})).toContainText(
    'Child linking'
  )
})

test('archives the entry instead of deleting it', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'child',
    title: 'Child'
  })

  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete entry'})
  await dialog.getByRole('button', {name: 'Archive instead'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(app.title).toHaveText('Child')
  await expect(app.page.getByText('Archived', {exact: true})).toBeVisible()

  // An archived entry is only deleted
  await app.runEntryAction('Delete')
  await expect(
    dialog.getByRole('button', {name: 'Delete', exact: true})
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', {name: 'Archive instead'})
  ).toHaveCount(0)
})

test('redirects the url of a deleted page to the picked page', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'beta'
  })

  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete entry'})
  await expect(
    dialog.getByText(
      'If this page was publicly available, links to its URL may still be around elsewhere.',
      {exact: false}
    )
  ).toBeVisible()
  await expect(
    dialog.getByText('Redirect the URL to another page (recommended)')
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Choose page…'}).click()
  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  // The deleted page can't be picked
  await expect(picker.getByRole('row', {name: /^Beta/})).toHaveAttribute(
    'data-unselectable',
    'true'
  )
  await picker.getByRole('row', {name: /^Alpha/}).click()
  await expect(picker).toHaveCount(0)
  await expect(dialog.getByText('/alpha', {exact: true})).toBeVisible()
  await dialog.getByRole('button', {name: 'Delete', exact: true}).click()
  await expect(dialog).toHaveCount(0)

  // The old url opens the page it redirects to
  await app.page.evaluate(() => {
    window.location.hash = '#/edit?url=%2Fbeta'
  })
  await expect(app.title).toHaveText('Alpha')
  await app.page.getByRole('tab', {name: 'Details'}).click()
  await expect(app.page.getByRole('textbox', {name: 'URL'})).toHaveValue(
    '/beta'
  )
})

test('tells which languages the redirect target is missing', async ({
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
  await dialog
    .getByRole('group', {name: 'Languages to delete'})
    .getByText('FR')
    .click()
  await expect(
    dialog.getByText('Redirect the URLs to another page (recommended)')
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Choose page…'}).click()
  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await picker.getByRole('row', {name: /^Localized start/}).click()
  await expect(
    dialog.getByText(
      `"Localized start" isn't available in FR, that URL won't redirect.`
    )
  ).toBeVisible()
  await dialog.getByRole('button', {name: "Don't redirect"}).click()
  await expect(dialog.getByText('Localized start')).toHaveCount(0)
})

test('deletes an entry from a language it is not translated in', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedStart',
    routeRoot: 'localized:fr',
    title: 'Localized start'
  })
  await expect(
    app.page.getByText('This entry has not been translated yet')
  ).toBeVisible()

  await app.runEntryAction('Delete')
  const dialog = app.page.getByRole('dialog', {name: 'Delete entry'})
  const languages = dialog.getByRole('group', {name: 'Languages to delete'})
  const english = languages.getByRole('checkbox', {name: 'EN'})
  const confirm = dialog.getByRole('button', {name: 'Delete', exact: true})
  // No language is picked for the one shown
  await expect(english).not.toBeChecked()
  await expect(confirm).toBeDisabled()
  await languages.getByText('EN').click()
  await expect(english).toBeChecked()
  await confirm.click()

  await expect(dialog).toHaveCount(0)
  await expect(app.page).toHaveURL(/localized:fr$/)
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await expect(tree.getByRole('row', {name: 'Localized folder'})).toBeVisible()
  await expect(tree.getByRole('row', {name: 'Localized start'})).toHaveCount(0)
})
