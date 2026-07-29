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

test('selects existing images and files', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />))
  const imageField = app.page.getByRole('list', {name: 'Featured image'})
  const fileField = app.page.getByRole('list', {name: 'Download'})

  await imageField.getByRole('button', {name: 'Image'}).click()
  const imagePicker = app.page.getByRole('dialog', {name: 'Pick an image'})
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
