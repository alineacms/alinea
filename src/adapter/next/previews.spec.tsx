import {expect, test} from '@playwright/experimental-ct-react'
import {build} from 'esbuild'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const projectDir = fileURLToPath(new URL('../../../', import.meta.url))

test('shows the full-page widget after disconnecting or closing the CMS', async ({
  page,
  context
}) => {
  const script = await buildPreviewScript('/admin')
  await context.route('http://preview.example/**', route =>
    route.fulfill({
      contentType: 'text/html',
      body: route.request().url().endsWith('/admin')
        ? '<body>CMS</body>'
        : `<body><div id="root"></div><script>${script}</script></body>`
    })
  )
  await page.goto('http://preview.example/admin')
  await page.evaluate(() => {
    window.addEventListener('message', event => {
      if (event.data?.action === '[alinea-ping]') {
        document.body.dataset.connections = String(
          Number(document.body.dataset.connections ?? 0) + 1
        )
        const source = event.source as Window
        source.postMessage({action: '[alinea-pong]'}, event.origin)
      }
    })
  })
  const popup = page.waitForEvent('popup')
  await page.evaluate(() => window.open('/preview', '_blank'))
  const preview = await popup
  await expect(page.locator('body')).toHaveAttribute('data-connections', '1')
  await expect(preview.getByTitle('Edit content')).toHaveCount(0)
  await page.evaluate(() => {
    window.addEventListener('message', event => {
      if (event.data === 'oversized-payload') {
        const source = event.source as Window
        source.postMessage(
          {action: '[alinea-preview]', payload: 'x'.repeat(20_000)},
          event.origin
        )
      }
      if (event.data === 'disconnect')
        (event.source as Window).postMessage(
          {action: '[alinea-disconnect]'},
          event.origin
        )
    })
  })
  await preview.evaluate(() =>
    window.opener.postMessage('oversized-payload', location.origin)
  )
  await expect(preview.getByTitle('Edit content')).toBeVisible()
  await expect(preview.locator('alinea-preview .is-warning')).toHaveCount(1)
  await expect(preview.getByTitle('Admin panel')).toHaveAttribute(
    'href',
    'http://preview.example/admin'
  )
  await expect(preview.getByTitle('Edit content')).toHaveAttribute(
    'href',
    'http://preview.example/admin#/edit?url=%2Fpreview'
  )
  await preview.evaluate(() =>
    window.opener.postMessage('disconnect', location.origin)
  )
  await expect(preview.getByTitle('Edit content')).toBeVisible()
  await expect(preview.locator('alinea-preview .is-warning')).toHaveCount(0)

  await preview.reload()
  await expect(page.locator('body')).toHaveAttribute('data-connections', '2')
  await expect(preview.getByTitle('Edit content')).toHaveCount(0)
  await page.close()
  await expect(preview.getByTitle('Edit content')).toBeVisible()
})

test('rejects preview messages from an untrusted opener origin', async ({
  page,
  context
}) => {
  const script = await buildPreviewScript('http://preview.example/admin')
  await context.route('http://preview.example/**', route =>
    route.fulfill({
      contentType: 'text/html',
      body: `<body><div id="root"></div><script>${script}</script></body>`
    })
  )
  await context.route('http://attacker.example/**', route =>
    route.fulfill({contentType: 'text/html', body: '<body>Attacker</body>'})
  )
  await page.goto('http://attacker.example')

  const popup = page.waitForEvent('popup')
  await page.evaluate(() => {
    Object.assign(window, {
      previewPopup: window.open('http://preview.example/page', '_blank')
    })
  })
  const preview = await popup
  await preview.waitForLoadState('domcontentloaded')
  await page.evaluate(() => {
    const previewPopup = Reflect.get(window, 'previewPopup') as Window
    previewPopup.postMessage(
      {action: '[alinea-pong]'},
      'http://preview.example'
    )
    previewPopup.postMessage(
      {action: '[alinea-preview]', payload: 'untrusted'},
      'http://preview.example'
    )
  })

  await expect(preview.getByTitle('Edit content')).toBeVisible()
  await expect(preview.locator('alinea-preview .is-connected')).toHaveCount(0)
})

async function buildPreviewScript(dashboardUrl: string): Promise<string> {
  const result = await build({
    absWorkingDir: projectDir,
    stdin: {
      contents: `
        import React from 'react'
        import {createRoot} from 'react-dom/client'
        import NextPreviews from './src/adapter/next/previews.tsx'
        createRoot(document.getElementById('root')).render(
          React.createElement(NextPreviews, {dashboardUrl: ${JSON.stringify(dashboardUrl)}, widget: true})
        )
      `,
      resolveDir: projectDir
    },
    tsconfig: resolve(projectDir, 'tsconfig.json'),
    bundle: true,
    write: false,
    format: 'iife',
    conditions: ['alinea-src'],
    plugins: [
      {
        name: 'preview-router-fixture',
        setup(builder) {
          builder.onResolve({filter: /^next\/navigation\.js$/}, () => ({
            path: 'navigation',
            namespace: 'fixture'
          }))
          builder.onLoad({filter: /.*/, namespace: 'fixture'}, () => ({
            contents: `export function usePathname() { return '/preview' }
            export function useRouter() { return {refresh() {}} }`
          }))
        }
      }
    ]
  })
  return result.outputFiles[0].text
}
