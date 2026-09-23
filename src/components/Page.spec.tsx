import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './Page.stories.js'

test('renders a header, a scrolling contained body and a footer', async ({
  mount,
  page
}) => {
  await page.setViewportSize({width: 1400, height: 800})
  await mount(<Example />)
  const root = page.locator('[data-slot="page"]')
  const title = page.getByRole('heading', {
    level: 1,
    name: 'Launching the new platform'
  })
  await expect(title).toHaveAttribute('data-slot', 'page-title')
  await expect(root.locator('[data-slot="page-header"]')).toContainText(
    'Launching the new platform'
  )
  await expect(root.locator('[data-slot="page-actions"]')).toContainText(
    'Publish'
  )

  const content = root.locator('[data-slot="page-content"]')
  const container = content.locator('[data-slot="page-content-container"]')
  await expect.poll(() => container.evaluate(el => el.clientWidth)).toBe(960)
  const scrolls = await content.evaluate(
    element => element.scrollHeight > element.clientHeight
  )
  expect(scrolls).toBe(true)

  // The footer stays visible below the scrolling content
  const footer = root.locator('[data-slot="page-footer"]')
  await expect(footer).toBeInViewport()
  const bounds = await footer.boundingBox()
  expect(bounds!.height).toBe(56)
})
