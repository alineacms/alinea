import {expect, test} from '../support/DashboardTest.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

test('opens a functional location in another workspace and root', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Related page'})
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await expect(
    picker.getByRole('row', {name: 'Reference target'})
  ).toBeVisible()
  await expect(picker.getByRole('row', {name: 'Beta'})).toHaveCount(0)

  const search = picker.getByRole('searchbox', {name: 'Search'})
  const view = picker.getByRole('radiogroup', {name: 'Explorer view'})
  const location = picker.getByRole('group', {name: 'Explorer location'})
  const singleRoot = location.getByText('Reference library', {exact: true})
  await expect(singleRoot).toHaveCSS('font-weight', '600')
  await expect
    .poll(async () => {
      const searchBox = await search.locator('..').boundingBox()
      const locationBox = await location.boundingBox()
      return Boolean(
        searchBox &&
        locationBox &&
        locationBox.y >= searchBox.y + searchBox.height + 8
      )
    })
    .toBe(true)
  await expect
    .poll(async () => {
      const searchBox = await search.locator('..').boundingBox()
      const viewBox = await view.boundingBox()
      return searchBox?.height === viewBox?.height
    })
    .toBe(true)
  const resultModes = location.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  await expect(
    resultModes
      .getByRole('radio', {name: 'Browse'})
      .locator('[data-slot="icon"]')
  ).toHaveCount(1)
  await expect(
    resultModes
      .getByRole('radio', {name: 'Matches'})
      .locator('[data-slot="icon"]')
  ).toHaveCount(1)
})

test('filters entries with a functional condition', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Filtered page', exact: true})
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  const location = picker.getByRole('group', {name: 'Explorer location'})
  const resultModes = location.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  const allLocations = picker.getByRole('switch', {name: 'All locations'})
  await expect(resultModes.getByRole('radio', {name: 'Matches'})).toBeChecked()
  await expect(allLocations).not.toBeChecked()
  await expect(location).toContainText(/References.*Reference library/)
  await expect(
    picker.getByRole('row', {name: /Reference target/})
  ).toBeVisible()
  await expect(picker.getByRole('row', {name: /Reference folder/})).toHaveCount(
    0
  )

  await allLocations.press('Space')
  await expect(allLocations).toBeChecked()
  await expect(
    picker.getByRole('row', {name: /Reference target/})
  ).toBeVisible()
  await expect(location.getByText('References', {exact: true})).toHaveCount(0)
  await expect(picker.getByRole('row', {name: /Other reference/})).toHaveCount(
    0
  )

  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio')
    .first()
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
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const resultModes = picker.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  const allLocations = picker.getByRole('switch', {name: 'All locations'})
  await expect(resultModes.getByRole('radio', {name: 'Matches'})).toBeChecked()
  await expect(allLocations).toBeChecked()
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Folder/})).toHaveCount(0)

  await allLocations.press('Space')
  await expect(allLocations).not.toBeChecked()
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Folder/})).toHaveCount(0)

  await resultModes.getByRole('radio', {name: 'Browse'}).click()
  await expect(allLocations).toBeDisabled()
  await expect(entries.getByRole('row', {name: /Folder/})).toBeVisible()
  await expect(entries.getByRole('row', {name: /Child/})).toHaveCount(0)
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
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  const resultModes = picker.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  await expect(resultModes.getByRole('radio', {name: 'Matches'})).toBeChecked()
  await expect(resultModes.getByRole('radio', {name: 'Browse'})).toBeDisabled()
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
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const allLocations = picker.getByRole('switch', {name: 'All locations'})
  await expect(allLocations).not.toBeChecked()
  await expect(allLocations).toBeDisabled()
  const folder = entries.getByRole('row', {name: /Folder/})
  await expect(folder).toBeVisible()
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
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio')
    .first()
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
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await picker
    .getByRole('radiogroup', {name: 'Explorer view'})
    .getByRole('radio')
    .first()
    .click()

  const folders = picker.getByRole('treegrid', {name: 'Link folders'})
  const sidebar = folders.locator('xpath=ancestor::aside')
  const folder = folders.getByRole('row', {name: /Folder/})
  await expect(folder).toBeVisible()
  await expect(picker.getByRole('progressbar')).toHaveCount(0)
  await expect(picker.getByLabel('Loading entry')).toHaveCount(0)

  await app.page.evaluate(() => {
    document.documentElement.dataset.cardParentSuspenseFallbackSeen = 'false'
    document.documentElement.dataset.cardParentPlaceholderSeen = 'false'
    document.documentElement.dataset.cardScopeGapSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Loading explorer"]'))
        document.documentElement.dataset.cardParentSuspenseFallbackSeen = 'true'
      if (document.querySelector('[aria-label="Loading entry"]'))
        document.documentElement.dataset.cardParentPlaceholderSeen = 'true'
      const picker = document.querySelector(
        '[role="dialog"][aria-label="Pick a link"]'
      )
      const results = picker?.querySelector(
        '[aria-label="Explorer card results"]'
      )
      if (picker && !results) {
        requestAnimationFrame(() => {
          const currentPicker = document.querySelector(
            '[role="dialog"][aria-label="Pick a link"]'
          )
          const currentResults = currentPicker?.querySelector(
            '[aria-label="Explorer card results"]'
          )
          if (currentPicker && !currentResults)
            document.documentElement.dataset.cardScopeGapSeen = 'true'
        })
      }
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })

  await folder.click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentSuspenseFallbackSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentPlaceholderSeen
      )
    )
    .toBe('false')

  const location = picker.getByRole('group', {name: 'Explorer location'})
  const resultModes = location.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  const allLocations = picker.getByRole('switch', {name: 'All locations'})
  await expect(location).toContainText(/Browse.*Matches.*Main.*Pages.*Folder/)
  await expect(resultModes.getByRole('radio', {name: 'Browse'})).toBeChecked()
  await expect(allLocations).toBeDisabled()

  const search = picker.getByRole('searchbox', {name: 'Search'})
  await search.fill('i18')
  await expect(resultModes.getByRole('radio', {name: 'Matches'})).toBeChecked()
  await expect(allLocations).toBeEnabled()
  await expect(folders).toHaveCount(0)
  await expect(picker.getByText('No results found')).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentSuspenseFallbackSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentPlaceholderSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(() => document.documentElement.dataset.cardScopeGapSeen)
    )
    .toBe('false')
  await app.page.evaluate(() => {
    document.documentElement.dataset.cardParentSuspenseFallbackSeen = 'false'
    document.documentElement.dataset.cardParentPlaceholderSeen = 'false'
    document.documentElement.dataset.cardScopeGapSeen = 'false'
  })

  await resultModes.getByRole('radio', {name: 'Browse'}).click()
  await expect(resultModes.getByRole('radio', {name: 'Browse'})).toBeChecked()
  await expect(folders).toBeVisible()
  await resultModes.getByRole('radio', {name: 'Matches'}).click()
  await expect(resultModes.getByRole('radio', {name: 'Matches'})).toBeChecked()
  await expect(folders).toHaveCount(0)
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentSuspenseFallbackSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentPlaceholderSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(() => document.documentElement.dataset.cardScopeGapSeen)
    )
    .toBe('false')
  await app.page.evaluate(() => {
    document.documentElement.dataset.cardParentSuspenseFallbackSeen = 'false'
    document.documentElement.dataset.cardParentPlaceholderSeen = 'false'
    document.documentElement.dataset.cardScopeGapSeen = 'false'
  })

  await allLocations.press('Space')
  await expect(allLocations).toBeChecked()
  await expect(location.getByText('Main', {exact: true})).toHaveCount(0)
  await expect(folders).toHaveCount(0)
  await expect(
    picker.getByRole('checkbox', {name: 'Select I18 result'})
  ).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentSuspenseFallbackSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentPlaceholderSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(() => document.documentElement.dataset.cardScopeGapSeen)
    )
    .toBe('false')

  await app.page.evaluate(() => {
    document.documentElement.dataset.cardParentSuspenseFallbackSeen = 'false'
    document.documentElement.dataset.cardParentPlaceholderSeen = 'false'
    document.documentElement.dataset.cardScopeGapSeen = 'false'
  })

  await allLocations.press('Space')
  await expect(allLocations).not.toBeChecked()
  await expect(location).toContainText(/Main.*Pages.*Folder/)
  await expect(folders).toHaveCount(0)
  await expect(picker.getByText('No results found')).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentSuspenseFallbackSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentPlaceholderSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(() => document.documentElement.dataset.cardScopeGapSeen)
    )
    .toBe('false')
  await search.fill('')
  await expect(resultModes.getByRole('radio', {name: 'Browse'})).toBeChecked()
  await expect(allLocations).toBeDisabled()
  await expect(folders).toBeVisible()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()

  await app.page.evaluate(() => {
    document.documentElement.dataset.cardParentSuspenseFallbackSeen = 'false'
    document.documentElement.dataset.cardParentPlaceholderSeen = 'false'
  })

  await sidebar.getByRole('button', {name: 'Pages', exact: true}).click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Alpha'})
  ).toBeVisible()

  await folder.click()
  await expect(
    picker.getByRole('checkbox', {name: 'Select Child'})
  ).toBeVisible()
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentSuspenseFallbackSeen
      )
    )
    .toBe('false')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.cardParentPlaceholderSeen
      )
    )
    .toBe('false')
})

test('navigates through folders to matching rows in a link picker', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Navigable page'})
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const resultModes = picker.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  await expect(resultModes.getByRole('radio', {name: 'Browse'})).toBeChecked()
  await expect(
    picker.getByRole('switch', {name: 'All locations'})
  ).not.toBeChecked()
  await expect(
    picker.getByRole('switch', {name: 'All locations'})
  ).toBeDisabled()
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
    .getByRole('radio')
    .first()
    .click()
  const folderCard = picker.locator('[data-unselectable="true"]', {
    hasText: 'Folder'
  })
  await expect(folderCard).toBeVisible()
  await expect(
    folderCard.getByRole('checkbox', {name: 'Select Folder'})
  ).toHaveCount(0)

  await folderCard.click()
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
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const folder = entries.getByRole('row', {name: /Folder/})
  await folder.dblclick()

  await expect(folder).toHaveCount(0)
  await expect(entries.getByRole('row', {name: /Child/})).toBeVisible()
  await expect(
    picker.getByRole('group', {name: 'Explorer location'})
  ).toContainText(/Main.*Pages.*Folder/)
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
      .getByRole('radio')
      .first()
  ).toBeChecked()
  await expect(
    imagePicker.getByRole('switch', {name: 'All locations'})
  ).not.toBeChecked()
  await expect(
    imagePicker.getByRole('switch', {name: 'All locations'})
  ).toBeEnabled()
  await expect(
    imagePicker.getByRole('treegrid', {name: 'Media folders'})
  ).toHaveCount(0)
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.sidebarLoaderSeen
      )
    )
    .toBe('false')
  await imagePicker
    .getByRole('checkbox', {name: 'Select Existing image'})
    .locator('xpath=ancestor::label')
    .click()
  await imagePicker.getByRole('button', {name: 'Select'}).click()
  await expect(imageField).toContainText('Existing image')

  await fileField.getByRole('button', {name: 'File'}).click()
  const filePicker = app.page.getByRole('dialog', {name: 'Pick a file'})
  await expect(
    filePicker
      .getByRole('radiogroup', {name: 'Explorer view'})
      .getByRole('radio')
      .nth(1)
  ).toBeChecked()
  await expect(
    filePicker.getByRole('switch', {name: 'All locations'})
  ).not.toBeChecked()
  await expect(
    filePicker.getByRole('switch', {name: 'All locations'})
  ).toBeEnabled()
  await filePicker
    .getByRole('checkbox', {name: 'Select Existing file'})
    .locator('xpath=ancestor::label')
    .click()
  await filePicker.getByRole('button', {name: 'Select'}).click()
  await expect(fileField).toContainText('Existing file')
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
  await imagePicker
    .getByRole('checkbox', {name: 'Select example'})
    .locator('xpath=ancestor::label')
    .click()
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
  await filePicker
    .getByRole('checkbox', {name: 'Select uploaded'})
    .locator('xpath=ancestor::label')
    .click()
  await filePicker.getByRole('button', {name: 'Select'}).click()
  await expect(fileField).toContainText('uploaded')
})
