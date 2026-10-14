import {expect, test} from '@playwright/experimental-ct-react'
import {TabsWithHeader} from './ExplorerTabs.stories.js'

test('tabs list the products of their filter below the header', async ({
  mount,
  page
}) => {
  await mount(<TabsWithHeader />)
  const all = page.getByRole('tab', {name: 'All'})
  await expect(all).toHaveAttribute('aria-selected', 'true')
  const rows = page.getByRole('tabpanel').getByRole('row')
  await expect(page.getByText('5 products')).toBeVisible()
  await page.getByRole('tab', {name: 'Archived'}).click()
  await expect(page.getByText('2 products')).toBeVisible()
  await expect(rows.filter({hasText: 'Stool'})).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', {name: 'Active'})).toBeFocused()
  await expect(page.getByText('3 products')).toBeVisible()
  // The header stays above the list, which fills the rest of the page
  const header = await page
    .locator('[data-slot="overview-header"]')
    .boundingBox()
  const table = await page
    .getByRole('treegrid', {name: 'Products'})
    .boundingBox()
  expect(header && table && table.y >= header.y + header.height).toBe(true)
  expect(table!.height).toBeGreaterThan(200)
})
