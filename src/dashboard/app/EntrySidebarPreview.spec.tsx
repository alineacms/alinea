import {expect, test} from '@playwright/experimental-ct-react'
import {build} from 'esbuild'
import {resolve} from 'node:path'
import {EntrySidebarPreviewStory} from './EntrySidebarPreview.story.js'

for (const previewUrl of [
  '/preview-frame',
  'http://preview.example/preview-frame'
]) {
  test(`streams edits to separate tabs and reconnects after reload: ${previewUrl}`, async ({
    mount,
    page,
    context
  }) => {
    const script = await build({
      absWorkingDir: process.cwd(),
      entryPoints: [resolve('src/preview/RegisterPreview.ts')],
      tsconfig: resolve('tsconfig.json'),
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'preview',
      conditions: ['alinea-src']
    })
    await context.route('**/preview-frame*', route =>
      route.fulfill({
        contentType: 'text/html',
        body: `
        <!doctype html>
        <body>Waiting for preview</body>
        <script>
          ${script.outputFiles[0].text}
          preview.registerPreview({
            async preview({payload}) { document.body.textContent = payload },
            setIsPreviewing(value) { document.body.dataset.connected = String(value) }
          })
        </script>
      `
      })
    )
    const component = await mount(
      <EntrySidebarPreviewStory previewUrl={previewUrl} />
    )
    const frame = page.frameLocator('iframe').locator('body')
    await expect(frame).toContainText('Original title')
    await page.getByRole('textbox', {name: 'Title'}).fill('Before opening')
    await expect(frame).toContainText('Before opening')

    const firstPopup = page.waitForEvent('popup')
    await page.getByRole('button', {name: 'Open preview in new tab'}).click()
    const first = await firstPopup
    await expect(first.locator('body')).toContainText('Before opening')
    await expect(first.locator('body')).toHaveAttribute(
      'data-connected',
      'true'
    )

    const secondPopup = page.waitForEvent('popup')
    await page.getByRole('button', {name: 'Open preview in new tab'}).click()
    const second = await secondPopup
    await page
      .getByRole('textbox', {name: 'Title'})
      .fill('Live in every preview')
    for (const body of [frame, first.locator('body'), second.locator('body')])
      await expect(body).toContainText('Live in every preview')

    await first.reload()
    await expect(first.locator('body')).toContainText('Live in every preview')
    await first.close()
    await page.getByRole('textbox', {name: 'Title'}).fill('After closing a tab')
    await expect(second.locator('body')).toContainText('After closing a tab')

    // Entries can share a preview URL; their identity still ends the session.
    await component.update(
      <EntrySidebarPreviewStory
        previewUrl={previewUrl}
        entryId="another-entry"
      />
    )
    await expect(second.locator('body')).toHaveAttribute(
      'data-connected',
      'false'
    )
    await page.getByRole('textbox', {name: 'Title'}).fill('Different entry')
    await expect(frame).toContainText('Different entry')
    await expect(second.locator('body')).toContainText('After closing a tab')

    const thirdPopup = page.waitForEvent('popup')
    await page.getByRole('button', {name: 'Open preview in new tab'}).click()
    const third = await thirdPopup
    await expect(third.locator('body')).toHaveAttribute(
      'data-connected',
      'true'
    )
    await component.update(
      <EntrySidebarPreviewStory
        previewUrl={`${previewUrl}?another`}
        entryId="another-entry"
      />
    )
    await expect(third.locator('body')).toHaveAttribute(
      'data-connected',
      'false'
    )

    const fourthPopup = page.waitForEvent('popup')
    await page.getByRole('button', {name: 'Open preview in new tab'}).click()
    const fourth = await fourthPopup
    await expect(fourth.locator('body')).toHaveAttribute(
      'data-connected',
      'true'
    )
    await expect(fourth.locator('body')).toContainText('Different entry')
    await component.unmount()
    await expect(fourth.locator('body')).toHaveAttribute(
      'data-connected',
      'false'
    )
  })
}

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
