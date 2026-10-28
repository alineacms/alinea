import type {Locator, Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

async function expandLinkPicker(page: Page): Promise<Locator> {
  const compactPicker = page.getByRole('dialog', {
    name: 'Pick a link',
    exact: true
  })
  await compactPicker.getByRole('button', {name: 'Expand entry picker'}).click()
  const expandedPicker = page.getByRole('dialog', {
    name: 'Pick a link in expanded view',
    exact: true
  })
  await expect(expandedPicker).toBeVisible()
  return expandedPicker
}

async function expectVerticallyUnclipped(locator: Locator) {
  await expect(locator).toBeVisible()
  const dimensions = await locator.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }))
  expect(dimensions.clientHeight).toBeGreaterThanOrEqual(
    dimensions.scrollHeight
  )
}

test('opens entry fields in the compact picker', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page.evaluate(() => {
    document.documentElement.dataset.compactPickerLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Loading entry picker"]'))
        document.documentElement.dataset.compactPickerLoaderSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await app.page
    .getByRole('list', {name: 'Browse page'})
    .getByRole('button', {name: 'Browse page'})
    .click()

  const picker = app.page.getByRole('dialog', {
    name: 'Pick a link',
    exact: true
  })
  await expect(picker).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.compactPickerLoaderSeen
      )
    )
    .toBe('false')
})

test('opens a functional location in another workspace and root', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Related page'})
    .getByRole('button', {name: 'Related page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  await expect(
    picker.getByRole('row', {name: 'Reference target'})
  ).toBeVisible()
  await expect(picker.getByRole('row', {name: 'Beta'})).toHaveCount(0)
})

test('switches a localized card picker without showing its loader', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Localized page'})
    .getByRole('button', {name: 'Localized page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio', {name: 'Card view'})
    .click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select I18 result'})
  ).toBeVisible()

  await app.page.evaluate(() => {
    document.documentElement.dataset.localizedPickerLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Loading explorer"]'))
        document.documentElement.dataset.localizedPickerLoaderSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await picker
    .getByRole('button', {name: 'Language', exact: true})
    .first()
    .click()
  await app.page.getByRole('menuitemradio', {name: /^FR/}).click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select French result'})
  ).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.localizedPickerLoaderSeen
      )
    )
    .toBe('false')
})

test('shows links without a stored locale in the edited locale', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeWorkspace: 'localized',
    routeRoot: 'pages:fr',
    routeEntry: 'localized-link-source',
    title: 'Source française'
  })

  const field = app.page.getByRole('list', {name: 'Localized page'})
  await expect(field).toContainText('Cible française')
  await expect(field).not.toContainText('English target')
})

test('hides card navigation when picker locations are limited', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Limited page'})
    .getByRole('button', {name: 'Limited page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio', {name: 'Card view'})
    .click()

  await expect(
    picker.getByRole('treegrid', {name: 'Link folders'})
  ).toHaveCount(0)
  await expect(
    picker.getByRole('group', {name: 'Explorer scope'}).getByRole('button')
  ).toHaveCount(0)
  await expect(
    picker.getByRole('checkbox', {name: 'Select Alpha'})
  ).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toHaveCount(0)
})

test('filters entries with a functional condition', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Filtered page', exact: true})
    .getByRole('button', {name: 'Filtered page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  const location = picker.getByRole('group', {name: 'Explorer location'})
  const scope = picker.getByRole('group', {name: 'Explorer scope'})
  await expect(scope.getByRole('button', {name: 'References'})).toBeVisible()
  await expect(location).toContainText('Reference library')
  await expect(
    picker.getByRole('row', {name: /Reference target/})
  ).toBeVisible()
  await expect(picker.getByRole('row', {name: /Reference folder/})).toHaveCount(
    0
  )

  await scope.getByRole('button', {name: 'References'}).click()
  await app.page.getByRole('menuitemradio', {name: 'All workspaces'}).click()
  await expect(
    scope.getByRole('button', {name: 'All workspaces'})
  ).toBeVisible()
  await expect(
    picker.getByRole('row', {name: /Reference target/})
  ).toBeVisible()
  await expect(
    location.getByText('Reference library', {exact: true})
  ).toHaveCount(0)
  await expect(picker.getByRole('row', {name: /Other reference/})).toHaveCount(
    0
  )

  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio', {name: 'Card view'})
    .click()
  await expect(
    picker.getByRole('treegrid', {name: 'Link folders'})
  ).toHaveCount(0)
  await expect(
    picker.getByRole('checkbox', {name: 'Select Reference target'})
  ).toBeVisible()
})

test('defaults a condition without a location to all locations', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Global filtered page'})
    .getByRole('button', {name: 'Global filtered page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const scope = picker.getByRole('group', {name: 'Explorer scope'})
  const location = picker.getByRole('group', {name: 'Explorer location'})
  const resultModes = location.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  const browseMode = resultModes.getByRole('radio', {name: 'Browse'})
  const filteredMode = resultModes.getByRole('radio', {name: 'Filtered'})
  await expect(filteredMode).toBeChecked()
  await expect(
    scope.getByRole('button', {name: 'All workspaces'})
  ).toBeVisible()
  await expect(location.getByText('Pages', {exact: true})).toHaveCount(0)
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Folder/})).toHaveCount(0)

  // Searches list matches, there is nothing to switch to
  const search = picker.getByRole('searchbox', {name: 'Search'})
  await search.fill('Child')
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()
  await expect(resultModes).toHaveCount(0)
  await search.fill('')
  await expect(filteredMode).toBeChecked()
  await expect(
    scope.getByRole('button', {name: 'All workspaces'})
  ).toBeVisible()
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()

  // Browsing lists the folders of the root
  await browseMode.click()
  await expect(browseMode).toBeChecked()
  await expect(scope.getByRole('button', {name: 'Main'})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Folder/})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Child/})).toHaveCount(0)
  await filteredMode.click()
  await expect(filteredMode).toBeChecked()
  await expect(
    scope.getByRole('button', {name: 'All workspaces'})
  ).toBeVisible()
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()

  const view = picker.getByRole('radiogroup', {name: 'Explorer view'})
  await view.getByRole('radio', {name: 'Card view'}).click()
  const cards = picker.getByRole('grid', {name: 'Explorer entries'})
  await expect(cards.getByRole('row', {name: /Child/})).toContainText(
    /Main.*Pages.*Folder/
  )
  await expectVerticallyUnclipped(cards.getByText('Child', {exact: true}))
  await view.getByRole('radio', {name: 'Row view'}).click()

  // The matches of the picked location are listed
  await scope.getByRole('button', {name: 'All workspaces'}).click()
  await app.page.getByRole('menuitemradio', {name: 'Main'}).click()
  await expect(scope.getByRole('button', {name: 'Main'})).toBeVisible()
  await expect(location.getByText('Pages', {exact: true})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Folder/})).toHaveCount(0)
})

test('toggles multiple links by clicking cards before using a checkbox', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))
  const field = app.page.getByRole('list', {name: 'Repeated pages'})
  await field.getByRole('button', {name: 'Repeated pages'}).click()
  const picker = await expandLinkPicker(app.page)
  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio', {name: 'Card view'})
    .click()

  const cards = picker.getByRole('grid', {name: 'Explorer entries'})
  const alpha = cards.getByRole('checkbox', {name: 'Select Alpha'})
  const beta = cards.getByRole('checkbox', {name: 'Select Beta'})
  await cards.getByText('Alpha', {exact: true}).click()
  await expect(alpha).toBeChecked()
  await cards.getByText('Beta', {exact: true}).click()
  await expect(alpha).toBeChecked()
  await expect(beta).toBeChecked()
  await cards.getByText('Alpha', {exact: true}).click()
  await expect(alpha).not.toBeChecked()
  await expect(beta).toBeChecked()
  await alpha.locator('xpath=ancestor::label').click()
  await expect(alpha).toBeChecked()
  await expect(beta).toBeChecked()
  await picker.getByRole('button', {name: 'Select', exact: true}).click()
  await expect(field).toContainText('Alpha')
  await expect(field).toContainText('Beta')
})

test('opens pickChildren at the children of the edited entry', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    entry: 'folder'
  })
  await app.page.getByRole('button', {name: 'Edit entry'}).click()

  await app.page
    .getByRole('list', {name: 'Child page'})
    .getByRole('button', {name: 'Child page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  await expect(
    picker.getByRole('group', {name: 'Explorer scope'}).getByRole('button')
  ).toHaveCount(0)
  // Children are only listed, not browsed
  await expect(
    picker.getByRole('radiogroup', {name: 'Explorer results'})
  ).toHaveCount(0)
  // The breadcrumbs only tell where the children are
  const location = picker.getByRole('group', {name: 'Explorer location'})
  await expect(location.getByText('Folder', {exact: true})).toBeVisible()
  await expect(picker.getByRole('button', {name: /^Back to/})).toHaveCount(0)
  for (const breadcrumb of ['Pages', 'Folder'])
    await expect(
      location.getByRole('button', {name: breadcrumb, exact: true})
    ).toHaveCount(0)
  await expect(picker.getByRole('row', {name: 'Child'})).toBeVisible()
  await expect(picker.getByRole('row', {name: 'Beta'})).toHaveCount(0)
})

test('navigates into folders without showing a suspense loader', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Browse page'})
    .getByRole('button', {name: 'Browse page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const folder = entries.getByRole('row', {name: /Folder/})
  await expect(folder).toBeVisible()
  // Without a condition there are no matches to filter
  await expect(
    picker.getByRole('radiogroup', {name: 'Explorer results'})
  ).toHaveCount(0)
  await expect(
    picker.getByRole('treegrid', {name: 'Link folders'})
  ).toHaveCount(0)
  await expect(picker.getByRole('progressbar')).toHaveCount(0)

  await app.page.evaluate(() => {
    document.documentElement.dataset.suspenseLoaderSeen = 'false'
    document.documentElement.dataset.incompleteExplorerRowSeen = 'false'
    document.documentElement.dataset.placeholderExplorerRowSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Loading explorer"]'))
        document.documentElement.dataset.suspenseLoaderSeen = 'true'
      if (
        document.querySelector(
          '[role="treegrid"][aria-label="Explorer entries"] ' +
            '[role="row"][aria-label="Loading entries"]'
        )
      ) {
        document.documentElement.dataset.placeholderExplorerRowSeen = 'true'
      }
      const childRow = Array.from(
        document.querySelectorAll(
          '[role="treegrid"][aria-label="Explorer entries"] [role="row"]'
        )
      ).find(row => row.textContent?.includes('Child'))
      if (childRow && !childRow.textContent?.includes('Summary for Child')) {
        document.documentElement.dataset.incompleteExplorerRowSeen = 'true'
      }
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await folder.getByRole('button', {name: 'Expand Folder'}).click()
  await expect(entries.getByRole('row', {name: /Child/})).toContainText(
    'Summary for Child'
  )
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.suspenseLoaderSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.incompleteExplorerRowSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.placeholderExplorerRowSeen
      )
    )
    .toBe('false')
})

test('keeps root overview rows flat', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page.evaluate(() => {
    document.documentElement.dataset.rootExplorerLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (
        document.querySelector(
          '[role="treegrid"][aria-label="Explorer entries"] ' +
            '[aria-label="Loading entry"]'
        )
      ) {
        document.documentElement.dataset.rootExplorerLoaderSeen = 'true'
      }
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })
  await app.page.getByRole('button', {name: 'Back to root'}).click()

  const entries = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  const folder = entries.getByRole('row', {name: /Folder/})
  await expect(folder.getByRole('button', {name: 'Expand Folder'})).toHaveCount(
    0
  )
  await expect(entries.getByRole('row', {name: /Child/})).toHaveCount(0)
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.rootExplorerLoaderSeen
      )
    )
    .toBe('false')
})

test('preloads entries before card sidebar navigation commits', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Browse page'})
    .getByRole('button', {name: 'Browse page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio', {name: 'Card view'})
    .click()

  const folders = picker.getByRole('treegrid', {name: 'Link folders'})
  await expect(folders).toBeVisible()

  await app.page.evaluate(() => {
    document.documentElement.dataset.cardNavigationLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Loading entry"]'))
        document.documentElement.dataset.cardNavigationLoaderSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await folders.getByRole('row', {name: /Folder/}).click()
  await expect(
    folders.getByRole('row', {name: 'Child', exact: true})
  ).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardNavigationLoaderSeen
      )
    )
    .toBe('false')
})

test('keeps card mode rendered while navigating sidebar parents', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Browse page'})
    .getByRole('button', {name: 'Browse page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio', {name: 'Card view'})
    .click()

  const folders = picker.getByRole('treegrid', {name: 'Link folders'})
  const sidebar = folders.locator('xpath=ancestor::aside')
  const folder = folders.getByRole('row', {name: /Folder/})
  await expect(folder).toBeVisible()
  await expect(picker.getByRole('progressbar')).toHaveCount(0)
  await expect(picker.getByLabel('Loading entry')).toHaveCount(0)

  await app.page.evaluate(() => {
    const seen = new Set<string>()
    Object.assign(window, {cardModeGaps: seen})
    function resultsGap() {
      const picker = document.querySelector(
        '[role="dialog"][aria-label="Pick a link in expanded view"]'
      )
      return (
        picker && !picker.querySelector('[aria-label="Explorer card results"]')
      )
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Loading explorer"]'))
        seen.add('suspense fallback')
      if (document.querySelector('[aria-label="Loading entry"]'))
        seen.add('placeholder')
      // Only a gap that is still there in the next frame is painted
      if (resultsGap())
        requestAnimationFrame(() => {
          if (resultsGap()) seen.add('results gap')
        })
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })
  const gaps = () =>
    app.page.evaluate(() =>
      Array.from(
        (window as unknown as {cardModeGaps: Set<string>}).cardModeGaps
      )
    )

  await folder.click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()

  const location = picker.getByRole('group', {name: 'Explorer location'})
  const scope = picker.getByRole('group', {name: 'Explorer scope'})
  await expect(location).toContainText(/Pages.*Folder/)
  await expect(location.getByRole('button', {name: 'Pages'})).toBeVisible()

  const search = picker.getByRole('searchbox', {name: 'Search'})
  await search.fill('i18')
  await expect(folders).toHaveCount(0)
  await expect(picker.getByText('No results found')).toBeVisible()

  await scope.getByRole('button', {name: 'Main'}).click()
  await app.page.getByRole('menuitemradio', {name: 'All workspaces'}).click()
  await expect(location.getByText('Pages', {exact: true})).toHaveCount(0)
  await expect(
    picker.getByRole('checkbox', {name: 'Select I18 result'})
  ).toBeVisible()

  await scope.getByRole('button', {name: 'All workspaces'}).click()
  await app.page.getByRole('menuitemradio', {name: 'Main'}).click()
  await expect(location).toContainText(/Pages.*Folder/)
  await expect(picker.getByText('No results found')).toBeVisible()

  await search.fill('')
  await expect(folders).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()
  await expect.poll(gaps).toEqual([])

  await sidebar.getByRole('button', {name: 'Pages', exact: true}).click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Alpha'})
  ).toBeVisible()
  await folder.click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()
  await expect
    .poll(async () => (await gaps()).filter(gap => gap !== 'results gap'))
    .toEqual([])
})

test('navigates through folders to matching rows in a link picker', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Navigable page'})
    .getByRole('button', {name: 'Navigable page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const folder = entries.getByRole('row', {name: /Folder/})
  await expect(
    folder.getByRole('checkbox', {name: 'Select Folder'})
  ).toHaveCount(0)
  await expect(folder).toHaveAttribute('data-unselectable', 'true')
  await expect(entries.getByRole('row', {name: /Child/})).toHaveCount(0)

  await folder.click()

  const child = entries.getByRole('row', {name: /Child/})
  await expect(child).toBeVisible()
  await expect(
    child.getByRole('checkbox', {name: 'Select Child'})
  ).toBeEnabled()

  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio', {name: 'Card view'})
    .click()
  const cardFolder = picker
    .getByRole('grid', {name: 'Explorer entries'})
    .getByRole('row', {name: 'Folder', exact: true})
  await expect(cardFolder).toBeVisible()
  await expect(
    cardFolder.getByRole('checkbox', {name: 'Select Folder'})
  ).toHaveCount(0)
  await picker
    .getByRole('treegrid', {name: 'Link folders'})
    .getByRole('row', {name: 'Folder', exact: true})
    .click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()
})

test('opens a table parent as the current location on double click', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Navigable page'})
    .getByRole('button', {name: 'Navigable page'})
    .click()

  const picker = await expandLinkPicker(app.page)
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const folder = entries.getByRole('row', {name: /Folder/})
  await folder.dblclick()

  await expect(folder).toHaveCount(0)
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()
  await expect(
    picker.getByRole('group', {name: 'Explorer location'})
  ).toContainText(/Pages.*Folder/)
})

test('selects existing images and files', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))
  const imageField = app.page.getByRole('list', {name: 'Featured image'})
  const fileField = app.page.getByRole('list', {name: 'Download'})

  await app.page.evaluate(() => {
    document.documentElement.dataset.sidebarLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[title="Loading entry"]'))
        document.documentElement.dataset.sidebarLoaderSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await imageField.getByRole('button', {name: 'Image'}).click()
  const imagePicker = app.page.getByRole('dialog', {name: 'Pick an image'})
  await expect(
    imagePicker
      .getByRole('radiogroup', {name: 'Explorer view'})
      .getByRole('radio', {name: 'Card view'})
  ).toBeChecked()
  await expect(
    imagePicker.getByRole('treegrid', {name: 'Media folders'})
  ).toBeVisible()
  await expect(
    imagePicker
      .getByRole('grid', {name: 'Explorer entries'})
      .getByText('Existing file', {exact: true})
  ).toBeVisible()
  await expect(
    imagePicker.getByRole('checkbox', {name: 'Select Existing file'})
  ).toHaveCount(0)
  await expect(
    imagePicker
      .getByRole('grid', {name: 'Explorer entries'})
      .getByRole('row', {name: 'Media directory', exact: true})
  ).toBeVisible()
  await expect(
    imagePicker.getByRole('checkbox', {name: 'Select Media directory'})
  ).toHaveCount(0)
  await expectVerticallyUnclipped(
    imagePicker.getByText('Existing image', {exact: true})
  )
  await expect(
    imagePicker.getByRole('checkbox', {name: 'Select Nested image'})
  ).toHaveCount(0)
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.sidebarLoaderSeen
      )
    )
    .toBe('false')
  // A single image is picked as soon as it is clicked
  await imagePicker.getByText('Existing image', {exact: true}).click()
  await expect(imagePicker).toBeHidden()
  await expect(imageField).toContainText('Existing image')

  await fileField.getByRole('button', {name: 'File'}).click()
  const filePicker = app.page.getByRole('dialog', {name: 'Pick a file'})
  await expect(
    filePicker
      .getByRole('radiogroup', {name: 'Explorer view'})
      .getByRole('radio', {name: 'Card view'})
  ).toBeChecked()
  await filePicker.getByText('Existing file', {exact: true}).click()
  await expect(filePicker).toBeHidden()
  await expect(fileField).toContainText('Existing file')
})

test('shows images and files picked into multiple link fields', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))
  const gallery = app.page.getByRole('list', {name: 'Gallery'})
  const attachments = app.page.getByRole('list', {name: 'Attachments'})

  await gallery.getByRole('button', {name: 'Image'}).click()
  const imagePicker = app.page.getByRole('dialog', {name: 'Pick an image'})
  await imagePicker.getByText('Existing image', {exact: true}).click()
  await imagePicker.getByRole('button', {name: 'Select'}).click()
  await expect(imagePicker).toBeHidden()
  await expect(gallery.getByRole('listitem')).toHaveCount(1)
  await expect(gallery).toContainText('Existing image')

  await attachments.getByRole('button', {name: 'File'}).click()
  const filePicker = app.page.getByRole('dialog', {name: 'Pick a file'})
  await filePicker.getByText('Existing file', {exact: true}).click()
  await filePicker.getByRole('button', {name: 'Select'}).click()
  await expect(filePicker).toBeHidden()
  await expect(attachments).toContainText('Existing file')
})

test('card image picker browses directories and filters within them', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Featured image'})
    .getByRole('button', {name: 'Image'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick an image'})
  const folders = picker.getByRole('treegrid', {name: 'Media folders'})
  const resultModes = picker.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  const browseMode = resultModes.getByRole('radio', {name: 'Browse'})
  const filteredMode = resultModes.getByRole('radio', {name: 'Filtered'})
  await expect(browseMode).toBeChecked()
  await expect(folders).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Existing image'})
  ).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Nested image'})
  ).toHaveCount(0)
  const mediaDirectoryCard = picker
    .getByRole('grid', {name: 'Explorer entries'})
    .getByRole('row', {name: 'Media directory', exact: true})
  await expect(mediaDirectoryCard).toBeVisible()

  await mediaDirectoryCard.click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Nested image'})
  ).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Existing image'})
  ).toHaveCount(0)

  // The images below the directory are listed
  await filteredMode.click()
  await expect(filteredMode).toBeChecked()
  await expect(folders).toHaveCount(0)
  await expect(
    picker.getByRole('checkbox', {name: 'Select Nested image'})
  ).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Existing image'})
  ).toHaveCount(0)

  await picker.getByRole('searchbox', {name: 'Search'}).fill('image')
  await expect(resultModes).toHaveCount(0)
  await expect(
    picker.getByRole('checkbox', {name: 'Select Nested image'})
  ).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Existing image'})
  ).toHaveCount(0)
})

test('card image picker opens empty media directories', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Featured image'})
    .getByRole('button', {name: 'Image'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick an image'})
  await picker
    .getByRole('grid', {name: 'Explorer entries'})
    .getByRole('row', {name: 'Empty media directory', exact: true})
    .click()

  await expect(
    picker
      .getByRole('group', {name: 'Explorer location'})
      .getByText('Empty media directory', {exact: true})
  ).toBeVisible()
  await expect(picker.getByText('No results found')).toBeVisible()
})

test('uploads images and files from their picker modals', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))
  await app.page.route('**/__dashboard-scenario-upload', route =>
    route.fulfill({status: 200})
  )
  const imageField = app.page.getByRole('list', {name: 'Featured image'})
  const fileField = app.page.getByRole('list', {name: 'Download'})

  await imageField.getByRole('button', {name: 'Image'}).click()
  const imagePicker = app.page.getByRole('dialog', {name: 'Pick an image'})
  const imageChooser = app.page.waitForEvent('filechooser')
  await imagePicker.getByRole('button', {name: 'Upload media'}).click()
  await (await imageChooser).setFiles('test/fixtures/example.jpg')
  const uploadDialog = app.page.getByRole('dialog', {name: 'Upload files'})
  await uploadDialog.getByRole('button', {name: 'Upload 1 file'}).click()
  // Uploaded files are selected in the picker
  await expect(
    imagePicker.getByRole('checkbox', {name: 'Select example'})
  ).toBeChecked()
  await imagePicker.getByRole('button', {name: 'Select'}).click()
  await expect(imageField).toContainText('example')

  await fileField.getByRole('button', {name: 'File'}).click()
  const filePicker = app.page.getByRole('dialog', {name: 'Pick a file'})
  const fileChooser = app.page.waitForEvent('filechooser')
  await filePicker.getByRole('button', {name: 'Upload media'}).click()
  await (
    await fileChooser
  ).setFiles({
    name: 'uploaded.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fixture')
  })
  await uploadDialog.getByRole('button', {name: 'Upload 1 file'}).click()
  await expect(
    filePicker.getByRole('checkbox', {name: 'Select uploaded'})
  ).toBeChecked()
  await filePicker.getByRole('button', {name: 'Select'}).click()
  await expect(fileField).toContainText('uploaded')
})
