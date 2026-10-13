import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

const origin = 'http://preview.example'

// Stands in for a site page with cms.previews: it connects to the dashboard
// and reports the preview payloads it receives
const sitePage = `<body><p>Site page</p><script>
  addEventListener('message', event => {
    if (event.data?.action === '[alinea-preview]') fetch('/received')
  })
  parent.postMessage({action: '[alinea-ping]'}, '*')
</script></body>`

test('navigates the preview frame once per opened entry', async ({
  dashboard,
  mount,
  page
}) => {
  const requests: Array<string> = []
  await page.context().route(`${origin}/**`, route => {
    const url = new URL(route.request().url())
    requests.push(url.pathname + url.search)
    if (url.pathname === '/received') return route.fulfill({body: ''})
    return route.fulfill({contentType: 'text/html', body: sitePage})
  })
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount browserPreview />)
  )
  const frame = app.page.frameLocator('iframe[title="Preview"]')
  await expect(frame.getByText('Site page')).toBeVisible()
  await expect.poll(() => requests).toContain('/received')

  await app.entry('Beta').click()
  await expect(app.title).toHaveText('Beta')
  await expect.poll(() => requests).toHaveLength(4)
  await app.page.waitForTimeout(500)
  expect(requests).toEqual([
    '/api/cms?preview=dev-preview-token&returnTo=%2Falpha',
    '/received',
    '/api/cms?preview=dev-preview-token&returnTo=%2Fbeta',
    '/received'
  ])
})
