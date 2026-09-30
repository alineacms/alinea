import sharp from 'sharp'
import {expect, test} from '../support/DashboardTest.js'
import {dashboardLinkScenarioIds} from '../support/DashboardScenarioData.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

async function openMediaDirectory(
  dashboard: Parameters<Parameters<typeof test>[2]>[0]['dashboard'],
  mount: Parameters<Parameters<typeof test>[2]>[0]['mount']
) {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.emptyMediaDirectory,
    routeRoot: 'media',
    title: 'Empty media directory'
  })
  const uploads: Array<Buffer> = []
  await app.page.route('**/__dashboard-scenario-upload', async route => {
    const body = route.request().postDataBuffer()
    if (body) uploads.push(body)
    await route.fulfill({status: 200})
  })
  async function upload(
    file:
      | string
      | {name: string; mimeType: string; buffer: Buffer}
      | Array<{name: string; mimeType: string; buffer: Buffer}>
  ) {
    const chooser = app.page.waitForEvent('filechooser')
    await app.page.getByRole('button', {name: 'Upload media'}).click()
    await (await chooser).setFiles(file)
    return app.page.getByRole('dialog', {name: 'Upload files'})
  }
  return {app, uploads, upload}
}

function jpeg(width: number, height: number) {
  return sharp({
    create: {width, height, channels: 3, background: {r: 40, g: 120, b: 200}}
  })
    .jpeg()
    .toBuffer()
}

test('keeps the upload button in view while a long list of files scrolls', async ({
  dashboard,
  mount
}) => {
  const {app, upload} = await openMediaDirectory(dashboard, mount)
  const buffer = await jpeg(120, 80)
  const dialog = await upload(
    Array.from({length: 22}, (_, i) => ({
      name: `photo-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer
    }))
  )
  const files = dialog.getByRole('list', {name: 'Files'})
  await expect(files).toHaveAttribute('data-slot', 'list')
  const rows = files.locator('[data-slot="list-item"]')
  await expect(rows).toHaveCount(22)
  await expect(
    rows.first().locator('[data-slot="list-item-visual-image"]')
  ).toBeVisible()
  const confirm = dialog.getByRole('button', {name: 'Upload 22 files'})
  await expect(confirm).toBeInViewport()
  await expect(
    dialog.getByRole('heading', {name: 'Upload 22 files'})
  ).toBeInViewport()
  await expect(rows.last()).not.toBeInViewport()
  await rows.last().scrollIntoViewIfNeeded()
  await expect(rows.last()).toBeInViewport()
  await expect(confirm).toBeInViewport()
  await expect(
    dialog.getByRole('heading', {name: 'Upload 22 files'})
  ).toBeInViewport()
})

test('ends a crop drag when the button is released', async ({
  dashboard,
  mount
}) => {
  const {app, upload} = await openMediaDirectory(dashboard, mount)
  const dialog = await upload({
    name: 'landscape.jpg',
    mimeType: 'image/jpeg',
    buffer: await jpeg(1200, 800)
  })
  await dialog.getByRole('button', {name: 'Edit landscape.jpg'}).click()
  const crop = dialog.getByRole('group', {name: /Crop area/})
  const mouse = app.page.mouse
  async function drag(handle: string, dx: number, dy: number) {
    const box = (await crop.locator(`[data-handle="${handle}"]`).boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await mouse.move(x, y)
    await mouse.down()
    await mouse.move(x + dx, y + dy, {steps: 4})
    return {x: x + dx, y: y + dy}
  }

  const end = await drag('se', -200, -150)
  await mouse.up()
  const cropped = await crop.boundingBox()
  await mouse.move(end.x - 100, end.y - 80, {steps: 4})
  await dialog.getByRole('button', {name: 'Aspect ratio'}).click()
  await app.page.keyboard.press('Escape')
  await mouse.move(end.x + 60, end.y + 40, {steps: 4})
  expect(await crop.boundingBox()).toEqual(cropped)

  // A release the crop never heard about ends the drag at the next move
  const {x, y} = await drag('nw', 40, 30)
  const moved = await crop.boundingBox()
  await crop.dispatchEvent('pointermove', {
    pointerId: 1,
    isPrimary: true,
    clientX: x + 50,
    clientY: y + 50,
    buttons: 0
  })
  await mouse.move(x + 80, y + 60, {steps: 4})
  expect(await crop.boundingBox()).toEqual(moved)
  await mouse.up()
})

test('rotates an image in the upload dialog before uploading it', async ({
  dashboard,
  mount
}) => {
  const {app, uploads, upload} = await openMediaDirectory(dashboard, mount)
  // Red on the left, blue on the right
  const halves = Buffer.alloc(1200 * 800 * 3)
  for (let i = 0; i < 1200 * 800; i++) {
    const red = i % 1200 < 600
    halves[i * 3] = red ? 220 : 20
    halves[i * 3 + 2] = red ? 20 : 220
  }
  const photo = await sharp(halves, {
    raw: {width: 1200, height: 800, channels: 3}
  })
    .jpeg()
    .toBuffer()
  const dialog = await upload({
    name: 'landscape.jpg',
    mimeType: 'image/jpeg',
    buffer: photo
  })

  await dialog.getByRole('button', {name: 'Edit landscape.jpg'}).click()
  await dialog.getByRole('button', {name: 'Rotate right'}).click()
  await expect(dialog.getByText('800 × 1200 px')).toBeVisible()
  await dialog.getByRole('button', {name: 'Aspect ratio'}).click()
  await app.page.getByRole('option', {name: 'Square'}).click()
  await expect(dialog.getByText('800 × 800 px')).toBeVisible()
  await dialog.getByRole('button', {name: 'Apply'}).click()
  await expect(dialog.getByText('Edited')).toBeVisible()
  await dialog.getByRole('button', {name: 'Upload 1 file'}).click()

  await expect.poll(() => uploads.length).toBe(1)
  const uploaded = sharp(uploads[0])
  const metadata = await uploaded.metadata()
  expect([metadata.width, metadata.height]).toEqual([800, 800])
  // Turned clockwise the left (red) half is on top, the square crop keeps
  // the middle
  const {data} = await uploaded.raw().toBuffer({resolveWithObject: true})
  const pixel = (x: number, y: number) => {
    const offset = (y * 800 + x) * 3
    return data[offset] > data[offset + 2] ? 'red' : 'blue'
  }
  expect([pixel(400, 100), pixel(400, 700)]).toEqual(['red', 'blue'])
  await expect(
    app.page
      .getByRole('grid', {name: 'Explorer entries'})
      .getByRole('row', {name: 'landscape', exact: true})
  ).toBeVisible()
})

test('offers the existing media file when the same file is uploaded again', async ({
  dashboard,
  mount
}) => {
  const {app, uploads, upload} = await openMediaDirectory(dashboard, mount)
  const first = await upload('test/fixtures/example.jpg')
  await first.getByRole('button', {name: 'Upload 1 file'}).click()
  await expect.poll(() => uploads.length).toBe(1)
  const explorer = app.page.getByRole('grid', {name: 'Explorer entries'})
  await expect(
    explorer.getByRole('row', {name: 'example', exact: true})
  ).toBeVisible()

  const again = await upload('test/fixtures/example.jpg')
  await expect(
    again.getByText('Already in the media library as “example”')
  ).toBeVisible()
  await expect(again.getByRole('radio', {name: 'Use existing'})).toBeChecked()
  await again.getByRole('button', {name: 'Use existing file'}).click()
  await expect(again).toBeHidden()
  expect(uploads).toHaveLength(1)

  // Keeping both uploads the file under a new name
  const both = await upload('test/fixtures/example.jpg')
  await both.getByRole('radio', {name: 'Keep both'}).click()
  await both.getByRole('button', {name: 'Upload 1 file'}).click()
  await expect.poll(() => uploads.length).toBe(2)
  await expect(explorer.getByRole('row', {name: /^example/})).toHaveCount(2)
})
