import {expect, test} from '@playwright/experimental-ct-react'
import {EntrySidebarPreviewStory} from './EntrySidebarPreview.story.js'

test('sends edited field values to the preview iframe', async ({
  mount,
  page
}) => {
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

  const preview = page.frameLocator('iframe').locator('body')
  await expect(preview).toContainText('Original title')
  await expect(preview).toContainText('preview-content-sha')

  await page.getByRole('textbox', {name: 'Title'}).fill('Edited title')

  await expect(preview).toContainText('Edited title')
})
