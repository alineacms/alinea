import {expect, test} from '@playwright/experimental-ct-react'
import {EntrySidebarPreviewStory} from './EntrySidebarPreview.story.js'

test('renders the prepared preview without an intermediate loader', async ({
  mount,
  page
}) => {
  await mount(<EntrySidebarPreviewStory />)

  await expect(page.getByRole('textbox', {name: 'Title'})).toBeVisible()
  await expect(
    page.getByRole('button', {name: 'Go back in preview'})
  ).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(1)
})

test('sends edited field values to the preview iframe', async ({
  mount,
  page
}) => {
  const pageErrors: Array<Error> = []
  page.on('pageerror', error => pageErrors.push(error))
  await page.route('**/preview-frame', route =>
    route.fulfill({
      contentType: 'text/html',
      body: `
        <!doctype html>
        <body>Waiting for preview</body>
        <script>
          parent.postMessage(null, '*')
          const ping = setInterval(() => {
            parent.postMessage({action: '[alinea-ping]'}, '*')
          }, 20)
          addEventListener('message', event => {
            if (event.data?.action === '[alinea-pong]') clearInterval(ping)
            if (event.data?.action === '[alinea-preview]') {
              document.body.textContent = event.data.payload
            }
          })
        </script>
      `
    })
  )
  await mount(<EntrySidebarPreviewStory />)

  const preview = page.frameLocator('iframe').locator('body')
  await expect(preview).toContainText('Original title')
  await expect(preview).toContainText('preview-content-sha')

  await page.getByRole('textbox', {name: 'Title'}).fill('Edited title')

  await expect(preview).toContainText('Edited title')
  expect(pageErrors).toEqual([])
})

test('ignores a stale preview payload request', async ({mount, page}) => {
  await page.route('**/preview-frame', route =>
    route.fulfill({
      contentType: 'text/html',
      body: `
        <!doctype html>
        <body>Waiting for preview</body>
        <script>
          const ping = setInterval(() => {
            parent.postMessage({action: '[alinea-ping]'}, '*')
          }, 20)
          addEventListener('message', event => {
            if (event.data?.action === '[alinea-pong]') clearInterval(ping)
            if (event.data?.action === '[alinea-preview]') {
              document.body.textContent = event.data.payload
            }
          })
        </script>
      `
    })
  )
  await mount(<EntrySidebarPreviewStory />)

  const title = page.getByRole('textbox', {name: 'Title'})
  const preview = page.frameLocator('iframe').locator('body')
  await expect(preview).toContainText('Original title')

  await title.fill('Slow title')
  await page.waitForTimeout(300)
  await title.fill('Fast title')
  await expect(preview).toContainText('Fast title')
  await page.waitForTimeout(500)
  await expect(preview).toContainText('Fast title')
})

test('keeps the preview mounted while its URL refreshes', async ({
  mount,
  page
}) => {
  await page.route('**/preview-frame', route =>
    route.fulfill({contentType: 'text/html', body: '<body>Preview</body>'})
  )
  await mount(<EntrySidebarPreviewStory />)

  const iframe = page.locator('iframe')
  await expect(iframe).toHaveCount(1)
  await page.getByRole('button', {name: 'Refresh preview URL'}).click()

  await expect(
    page.getByRole('button', {name: 'Go back in preview'})
  ).toBeVisible()
  await expect(iframe).toHaveCount(1)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await page.waitForTimeout(600)
  await expect(iframe).toHaveCount(1)
})
