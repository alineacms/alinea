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
