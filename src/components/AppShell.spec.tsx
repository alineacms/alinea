import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './AppShell.stories.js'

function width(page: import('playwright').Page, testId: string) {
  return page
    .getByTestId(testId)
    .evaluate(element => element.getBoundingClientRect().width)
}

test('composes the application layout', async ({mount, page}) => {
  await mount(<Example />)
  await expect(page.locator('[data-slot="app-shell"]')).toBeVisible()
  await expect(page.getByRole('main')).toHaveAttribute(
    'data-slot',
    'app-shell-content'
  )
  const rail = page.getByRole('complementary', {name: 'Roots'})
  await rail.getByRole('button', {name: 'Media'}).click()
  await expect(rail.getByRole('button', {name: 'Media'})).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(page.getByRole('group', {name: 'Media'})).toBeVisible()
  await expect(page.locator('[data-slot="sidebar-inset"]')).toBeVisible()
  await expect(
    page.getByRole('heading', {level: 1, name: 'Launch'})
  ).toBeVisible()
})

test('resizes the sidebar and toggles the details panel', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await expect.poll(() => width(page, 'navigation')).toBe(280)
  await expect.poll(() => width(page, 'details')).toBe(300)

  const handle = page
    .getByTestId('layout')
    .locator(
      ':scope > .split-view > .sash-container > [data-slot="resizable-handle"]'
    )
  const bounds = await handle.boundingBox()
  const x = bounds!.x + bounds!.width / 2
  const y = bounds!.y + bounds!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 50, y, {steps: 8})
  await page.mouse.up()
  await expect.poll(() => width(page, 'navigation')).toBe(330)

  await page.getByRole('button', {name: 'Close details'}).click()
  await expect(page.getByTestId('details')).toHaveCount(0)
  await page.getByRole('button', {name: 'Open details'}).click()
  await expect.poll(() => width(page, 'details')).toBe(300)
  await expect.poll(() => width(page, 'navigation')).toBe(330)
})
