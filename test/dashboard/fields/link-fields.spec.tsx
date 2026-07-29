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
})

test('filters entries with a functional condition', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Filtered page'})
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await expect(
    picker.getByRole('row', {name: 'Reference target'})
  ).toBeVisible()
  await expect(picker.getByRole('row', {name: 'Other reference'})).toHaveCount(
    0
  )
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
      if (document.querySelector('[role="progressbar"]'))
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

test('keeps the root list explorer flat', async ({dashboard, mount}) => {
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

test('disables non-matching rows in a navigable link picker', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))

  await app.page
    .getByRole('list', {name: 'Navigable page'})
    .getByRole('button', {name: 'Page link'})
    .click()

  const picker = app.page.getByRole('dialog', {name: 'Pick a link'})
  await expect(
    picker.getByRole('treegrid', {name: 'Link folders'})
  ).toHaveCount(0)

  const entries = picker.getByRole('treegrid', {name: 'Explorer entries'})
  const folder = entries.getByRole('row', {name: /Folder/})
  await expect(
    folder.getByRole('checkbox', {name: 'Select Folder'})
  ).toBeDisabled()
  await expect(entries.getByRole('row', {name: /Child/})).toHaveCount(0)

  await folder.getByRole('button', {name: 'Expand Folder'}).click()

  const child = entries.getByRole('row', {name: /Child/})
  await expect(child).toBeVisible()
  await expect(
    child.getByRole('checkbox', {name: 'Select Child'})
  ).toBeEnabled()
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
    imagePicker.getByRole('treegrid', {name: 'Media folders'})
  ).toBeVisible()
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
