import {expect, test} from '@playwright/experimental-ct-react'
import {
  CustomRootView,
  Empty,
  ExplorerStyle,
  NestedRows
} from './ContentTable.stories.js'

test('custom root view with thumbnails, custom columns and headers', async ({
  mount,
  page
}) => {
  await mount(<CustomRootView />)
  const table = page.getByRole('treegrid', {name: 'Articles'})
  const rows = table.getByRole('row')
  await expect(rows).toHaveCount(12)
  await expect(rows.first().locator('img')).toHaveCount(1)
  await expect(rows.first()).toContainText('2026-09-28')

  // Sortable column headers
  await page.getByRole('button', {name: 'Publication date'}).click()
  await expect(rows.first()).toContainText('2026-01-12')
  await page.getByRole('button', {name: 'Title'}).click()
  await expect(rows.first()).toContainText('2025 in twelve highlights')

  // Row action, then selection: once rows are selected a click toggles
  await table.getByRole('row', {name: 'Photonics on a chip, explained'}).click()
  await expect(
    page.getByText(/Opened Photonics on a chip, explained/)
  ).toBeVisible()
  const row = table.getByRole('row', {
    name: 'A flexible sensor that repairs itself'
  })
  await row.locator('label').click()
  await expect(row).toHaveAttribute('aria-selected', 'true')

  // Filtering
  await page.getByRole('button', {name: /All owner regions/}).click()
  await page.getByRole('option', {name: 'Netherlands'}).click()
  await expect(rows).toHaveCount(4)
  await expect(page.getByText(/4 articles/)).toBeVisible()
})

test('explorer style hides the header and labels each cell', async ({
  mount,
  page
}) => {
  await mount(<ExplorerStyle />)
  const first = page.getByRole('row').first()
  await expect(first).toContainText('Path')
  await expect(page.getByRole('button', {name: 'Path'})).toHaveCount(0)
})

test('nested rows', async ({mount, page}) => {
  await mount(<NestedRows />)
  await expect(page.getByRole('row')).toHaveCount(2)
  await page.getByRole('button', {name: 'Expand News'}).click()
  await expect(page.getByRole('row')).toHaveCount(4)
})

test('empty state', async ({mount, page}) => {
  await mount(<Empty />)
  await expect(page.getByText('No articles yet')).toBeVisible()
})
