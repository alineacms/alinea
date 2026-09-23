import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './ColorSwatch.stories.js'

test('renders swatches with an accessible color name', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const swatches = page.locator('[data-slot="color-swatch"]')
  await expect(swatches).toHaveCount(3)
  await expect(swatches.nth(0)).toHaveAttribute('role', 'img')
  await expect(swatches.nth(2)).toHaveAttribute('aria-label', /Translucent red/)
})
