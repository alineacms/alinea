import {PDFDocument} from '@cantoo/pdf-lib'
import sharp from 'sharp'
import {expect, test} from '../support/DashboardTest.js'
import {dashboardLinkScenarioIds} from '../support/DashboardScenarioData.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

test('scales down large images in the browser before uploading', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.existingImage,
    routeRoot: 'media',
    title: 'Existing image'
  })
  let uploaded: Buffer | undefined
  await app.page.route('**/__dashboard-scenario-upload', async route => {
    uploaded = route.request().postDataBuffer() ?? undefined
    await route.fulfill({status: 200})
  })
  const width = 2400
  const height = 1600
  const noise = Buffer.alloc(width * height * 3)
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 251
  const photo = await sharp(noise, {raw: {width, height, channels: 3}})
    .jpeg({quality: 95})
    .toBuffer()

  const fileChooser = app.page.waitForEvent('filechooser')
  await app.runEntryAction('Replace')
  await (
    await fileChooser
  ).setFiles({
    name: 'large.jpg',
    mimeType: 'image/jpeg',
    buffer: photo
  })
  await app.page
    .getByRole('dialog', {name: 'Upload files'})
    .getByRole('button', {name: 'Replace file'})
    .click()

  await expect.poll(() => uploaded?.byteLength ?? 0).toBeGreaterThan(0)
  expect(uploaded!.byteLength).toBeLessThan(photo.byteLength)
  const metadata = await sharp(uploaded!).metadata()
  expect([metadata.format, metadata.width, metadata.height]).toEqual([
    'jpeg',
    1000,
    667
  ])
  await expect(app.title).toHaveText('large')
})

test('scales down the images of large PDFs in the browser before uploading', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.existingFile,
    routeRoot: 'media',
    title: 'Existing file'
  })
  let uploaded: Buffer | undefined
  await app.page.route('**/__dashboard-scenario-upload', async route => {
    uploaded = route.request().postDataBuffer() ?? undefined
    await route.fulfill({status: 200})
  })
  const scan = await sharp({
    create: {
      width: 2480,
      height: 3508,
      channels: 3,
      background: '#888',
      noise: {type: 'gaussian', mean: 128, sigma: 40}
    }
  })
    .blur(2)
    .jpeg({quality: 95})
    .toBuffer()
  const pdf = await PDFDocument.create()
  pdf.addPage().drawImage(await pdf.embedJpg(scan))
  const brochure = Buffer.from(await pdf.save())

  const fileChooser = app.page.waitForEvent('filechooser')
  await app.runEntryAction('Replace')
  await (
    await fileChooser
  ).setFiles({
    name: 'brochure.pdf',
    mimeType: 'application/pdf',
    buffer: brochure
  })
  await app.page
    .getByRole('dialog', {name: 'Upload files'})
    .getByRole('button', {name: 'Replace file'})
    .click()

  await expect.poll(() => uploaded?.byteLength ?? 0).toBeGreaterThan(0)
  expect(uploaded!.byteLength).toBeLessThan(brochure.byteLength / 2)
  const compressed = await PDFDocument.load(uploaded!)
  expect(compressed.getPageCount()).toBe(1)
  await expect(app.title).toHaveText('brochure')
})
