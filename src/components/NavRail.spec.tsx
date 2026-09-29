import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './NavRail.stories.js'

test('selects items and shows their labels in tooltips', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const rail = page.getByRole('complementary', {name: 'Sections'})
  await expect(rail).toHaveAttribute('data-slot', 'nav-rail')
  await expect(rail.getByRole('navigation')).toHaveAttribute(
    'data-slot',
    'nav-rail-content'
  )
  const pages = rail.getByRole('button', {name: 'Pages'})
  const media = rail.getByRole('button', {name: 'Media'})
  await expect(pages).toHaveAttribute('data-slot', 'nav-rail-item')
  await expect(pages).toHaveAttribute('aria-current', 'page')
  await expect(media).not.toHaveAttribute('aria-current')

  await media.click()
  await expect(media).toHaveAttribute('aria-current', 'page')
  await expect(pages).not.toHaveAttribute('aria-current')

  await page.mouse.move(1, 1)
  await pages.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveText('Pages')
  const item = await pages.boundingBox()
  const content = await tooltip.boundingBox()
  expect(content!.x).toBeGreaterThan(item!.x + item!.width)
})

test('renders links, badges and disabled items', async ({mount, page}) => {
  await mount(<Example />)
  const link = page.getByRole('link', {name: 'Documentation'})
  await expect(link).toHaveAttribute('href', '#docs')
  await expect(link).toHaveAttribute('data-slot', 'nav-rail-item')
  const media = page.getByRole('button', {name: 'Media'})
  await expect(media.locator('[data-slot="nav-rail-item-badge"]')).toHaveText(
    '3'
  )
  await expect(
    page
      .getByRole('button', {name: 'Settings'})
      .locator('[data-slot="nav-rail-item-badge"]')
  ).toHaveAttribute('data-dot', 'true')
  await expect(page.getByRole('button', {name: 'Archive'})).toBeDisabled()
})

test('turns horizontal on small screens', async ({mount, page}) => {
  await page.setViewportSize({width: 390, height: 700})
  await mount(<Example />)
  const rail = page.getByRole('complementary', {name: 'Sections'})
  const bounds = await rail.boundingBox()
  expect(bounds!.height).toBe(48)
  expect(bounds!.width).toBeGreaterThan(300)
})
