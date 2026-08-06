import {expect, test} from '../support/DashboardTest.js'
import {dashboardLinkScenarioIds} from '../support/DashboardScenarioData.js'
import {LinkFieldScenarioMount} from '../support/LinkFieldScenarioMount.js'

test('replaces a media file from the entry actions', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<LinkFieldScenarioMount />), {
    routeEntry: dashboardLinkScenarioIds.existingImage,
    routeRoot: 'media',
    title: 'Existing image'
  })
  let uploadedBytes = 0
  await app.page.route('**/__dashboard-scenario-upload', async route => {
    uploadedBytes = route.request().postDataBuffer()?.byteLength ?? 0
    await route.fulfill({status: 200})
  })
  await expect(app.page.getByText('1.02 kB', {exact: true})).toBeVisible()

  const fileChooser = app.page.waitForEvent('filechooser')
  await app.runEntryAction('Replace')
  await (await fileChooser).setFiles('test/fixtures/example.jpg')

  await expect.poll(() => uploadedBytes).toBe(21_005)
  await expect(app.title).toHaveText('example')
  await expect(app.page.getByText('21 kB', {exact: true})).toBeVisible()
})
