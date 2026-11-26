import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './Sheet.stories.js'

test('focuses the first field and closes with escape', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const sheet = page.getByRole('dialog', {name: 'Landing page intro'})
  await expect(sheet).toHaveAttribute('data-slot', 'sheet-content')
  await expect(sheet).not.toHaveAttribute('aria-modal')
  await expect(sheet.getByRole('textbox', {name: 'Label'})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  const reopen = page.getByRole('button', {name: 'Reopen'})
  await reopen.click()
  await expect(sheet.getByRole('textbox', {name: 'Label'})).toBeFocused()
  await sheet.getByRole('button', {name: 'Close block settings'}).click()
  await expect(sheet).toBeHidden()
  await expect(reopen).toBeFocused()
})

test('renders sections and lists actions one per line', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const titles = page.locator('[data-slot="sheet-section-title"]')
  await expect(titles).toHaveText(['Block', 'Anchor'])
  await expect(titles.first()).toHaveCSS('text-transform', 'uppercase')
  const copyBox = (await page
    .getByRole('button', {name: 'Copy'})
    .boundingBox())!
  const deleteBox = (await page
    .getByRole('button', {name: 'Delete'})
    .boundingBox())!
  expect(deleteBox.x).toBeCloseTo(copyBox.x)
  expect(deleteBox.width).toBeCloseTo(copyBox.width)
  expect(deleteBox.y).toBeGreaterThan(copyBox.y + copyBox.height)
})
