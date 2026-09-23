import {
  expect,
  test as base,
  type MountResult
} from '@playwright/experimental-ct-react'
import {readFile} from 'node:fs/promises'
import {extname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import type {Locator, Page} from 'playwright'

export type ColorScheme = 'light' | 'dark'

const publicDir = fileURLToPath(
  new URL('../../../apps/dev/public', import.meta.url)
)

// All relative times are rendered against this moment
const fixedTime = new Date('2026-03-16T10:00:00Z')

const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf'
}

interface OpenOptions {
  /** Dashboard hash route, eg `#/entry/simple/pages` */
  hash?: string
  /** Wait for this heading before taking screenshots */
  title?: string | RegExp
  /** Wait for this element before taking screenshots */
  ready?: (page: Page) => Locator
}

interface ShotOptions {
  mask?: Array<Locator>
  fullPage?: boolean
}

export interface VisualDriver {
  page: Page
  component: MountResult
  /** Wait for fonts, images and pending navigation to settle */
  settle(): Promise<void>
  /** Screenshot the page, or the given element, suffixed with the scheme */
  shot(name: string, target?: Locator, options?: ShotOptions): Promise<void>
}

interface VisualFixture {
  open(
    render: () => Promise<MountResult>,
    options?: OpenOptions
  ): Promise<VisualDriver>
}

interface VisualOptions {
  scheme: ColorScheme
}

export const test = base.extend<{visual: VisualFixture} & VisualOptions>({
  scheme: ['light', {option: true}],
  visual: async ({page, scheme, viewport}, provide, testInfo) => {
    const pageErrors: Array<Error> = []
    page.on('pageerror', error => pageErrors.push(error))
    await page.clock.setFixedTime(fixedTime)
    await page.emulateMedia({colorScheme: scheme, reducedMotion: 'reduce'})
    // Serve the fixture media files from the dev app
    await page.route(/\/[\w-]+\.[\w]{27}\.(jpg|png|svg|pdf)$/, async route => {
      const name = new URL(route.request().url()).pathname.slice(1)
      try {
        const body = await readFile(resolve(publicDir, name))
        await route.fulfill({
          body,
          contentType: contentTypes[extname(name)]
        })
      } catch {
        await route.fulfill({status: 404})
      }
    })
    const mobile = (viewport?.width ?? 1280) < 600
    const suffix = `${mobile ? '-mobile' : ''}-${scheme}`
    await provide({
      async open(render, options = {}) {
        await page.evaluate(hash => {
          localStorage.clear()
          document.documentElement.removeAttribute('data-theme')
          window.history.replaceState(null, '', hash)
        }, options.hash ?? '#/')
        const component = await render()
        async function settle() {
          await expect(
            page.locator('main[data-navigation-pending]')
          ).toHaveCount(0)
          await page.evaluate(async () => {
            await document.fonts.ready
            const images = Array.from(document.images)
            await Promise.all(
              images.map(image =>
                image.complete
                  ? undefined
                  : new Promise(resolve => {
                      image.addEventListener('load', resolve, {once: true})
                      image.addEventListener('error', resolve, {once: true})
                    })
              )
            )
            // Wait until layout (virtualizers, measured popovers) and scroll
            // positions stop changing between frames
            function snapshot() {
              const state: Array<number> = []
              for (const element of document.querySelectorAll('*')) {
                if (element.scrollTop || element.scrollLeft)
                  state.push(element.scrollTop, element.scrollLeft)
              }
              state.push(document.body.getBoundingClientRect().height)
              return state.join(',')
            }
            let previous = ''
            for (let attempt = 0; attempt < 20; attempt++) {
              await new Promise(requestAnimationFrame)
              await new Promise(resolve => setTimeout(resolve, 50))
              const current = snapshot()
              if (current === previous) break
              previous = current
            }
          })
        }
        if (options.title)
          await expect(page.getByRole('heading', {level: 1})).toHaveText(
            options.title
          )
        if (options.ready) await expect(options.ready(page)).toBeVisible()
        await settle()
        return {
          page,
          component,
          settle,
          async shot(name, target, shotOptions = {}) {
            await settle()
            const mask = shotOptions.mask ?? []
            if (target)
              await expect
                .soft(target)
                .toHaveScreenshot(`${name}${suffix}.png`, {
                  mask
                })
            else
              await expect.soft(page).toHaveScreenshot(`${name}${suffix}.png`, {
                mask,
                fullPage: shotOptions.fullPage
              })
          }
        }
      }
    })
    if (testInfo.status === testInfo.expectedStatus)
      expect(
        pageErrors.map(error => error.stack ?? error.message),
        'Dashboard emitted an uncaught page error'
      ).toEqual([])
  }
})

/** Define the tests in `body` once for each color scheme */
export function themed(body: () => void) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(scheme, () => {
      test.use({scheme})
      body()
    })
  }
}

export {expect}
