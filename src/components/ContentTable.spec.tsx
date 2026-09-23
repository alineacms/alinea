import {expect, test} from '@playwright/experimental-ct-react'
import {CustomRootView, Empty, WithoutHeader} from './ContentTable.stories.js'

test('custom root view with image rows, custom columns and headers', async ({
  mount,
  page
}) => {
  await mount(<CustomRootView />)
  const table = page.getByRole('treegrid', {name: 'Products'})
  const rows = table.getByRole('row')
  await expect(rows).toHaveCount(4)
  await expect(rows.first()).toContainText('Ceramic vase')
  await expect(rows.first().locator('img')).toHaveCount(1)
  await expect(rows.first()).toContainText('€59.00')

  // Column headers are shown and sort the rows
  await page.getByRole('button', {name: 'Price'}).click()
  await expect(rows.first()).toContainText('Ceramic vase')
  await page.getByRole('button', {name: 'Price'}).click()
  await expect(rows.first()).toContainText('Lounge chair')

  // Nested rows
  await page.getByRole('button', {name: 'Expand Lounge chair'}).click()
  await expect(rows).toHaveCount(6)
  await expect(
    table.getByRole('row', {name: 'Lounge chair, walnut'})
  ).toBeVisible()

  // Row action, then selection: once rows are selected a click toggles
  await table.getByRole('row', {name: 'Wool rug'}).click()
  await expect(page.getByText('Opened rug')).toBeVisible()
  const lamp = table.getByRole('row', {name: 'Desk lamp'})
  await lamp.locator('label').click()
  await expect(
    page.getByRole('checkbox', {name: 'Select Desk lamp'})
  ).toBeChecked()
  await expect(page.getByRole('button', {name: /Archive 1/})).toBeEnabled()
})

test('header can be hidden', async ({mount, page}) => {
  await mount(<WithoutHeader />)
  await expect(page.getByRole('row')).toHaveCount(4)
  await expect(page.getByText('Category')).toHaveCount(0)
})

test('empty state', async ({mount, page}) => {
  await mount(<Empty />)
  await expect(page.getByText('No products yet')).toBeVisible()
})
