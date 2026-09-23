import {expect, test} from '@playwright/experimental-ct-react'
import {
  Compact,
  CustomRootView,
  DragAndDrop,
  Empty,
  ExplorerStyle,
  IterableItems,
  NestedRows,
  RowActions
} from './Table.stories.js'

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

test('renders rows from a one-shot iterable', async ({mount, page}) => {
  await mount(<IterableItems />)
  await expect(
    page.getByRole('treegrid', {name: 'Members'}).getByRole('row')
  ).toHaveCount(2)
  await expect(page.getByText('No members')).toHaveCount(0)
})

test('drags rows onto rows and marks row states', async ({mount, page}) => {
  await mount(<DragAndDrop />)
  const table = page.getByRole('treegrid', {name: 'Pages'})
  const legal = table.getByRole('row', {name: 'Legal'})
  await expect(legal).toHaveAttribute('data-unselectable', 'true')
  await expect(legal.getByRole('checkbox')).toHaveCount(0)
  await expect(table.getByRole('row', {name: 'Home'})).toContainText(
    'Main / Pages'
  )
  await table.getByRole('row', {name: 'News'}).dblclick()
  await expect(page.getByTestId('log')).toHaveText('Opened News')
  await table
    .getByRole('button', {name: 'Drag About us'})
    .dragTo(table.getByRole('row', {name: 'Home'}), {force: true})
  await expect(page.getByTestId('log')).toContainText(
    'Moved About us into Home'
  )
  await expect(table.getByRole('row', {name: 'About us'})).toHaveCount(0)
})

test('collapses columns on narrow screens', async ({mount, page}) => {
  await page.setViewportSize({width: 600, height: 600})
  await mount(<DragAndDrop />)
  const row = page.getByRole('row', {name: 'Home'})
  await expect(row.getByText('/', {exact: true})).toBeHidden()
})

test('rows fill their row height whatever the cells contain', async ({
  mount,
  page
}) => {
  const heights = async () =>
    page
      .getByRole('row')
      .evaluateAll(rows =>
        rows.map(row => Math.round(row.getBoundingClientRect().height))
      )
  const compact = await mount(<Compact />)
  expect(new Set(await heights())).toEqual(new Set([44]))
  await compact.unmount()
  await mount(<CustomRootView />)
  expect(new Set(await heights())).toEqual(new Set([64]))
})

test('selecting a row with the pointer shows no focus ring', async ({
  mount,
  page
}) => {
  await mount(<ExplorerStyle />)
  const row = page.getByRole('row').first()
  await row.hover()
  const indicator = row.locator('[data-slot="selection-checkbox-indicator"]')
  await indicator.click()
  await expect(row.getByRole('checkbox')).toBeChecked()
  await expect(indicator).toHaveCSS('outline-style', 'none')
})

test('narrow tables keep fixed columns in view', async ({mount, page}) => {
  await page.setViewportSize({width: 390, height: 700})
  await mount(<RowActions />)
  const table = page.locator('[data-slot="table"]')
  const action = page.getByRole('button', {name: 'Actions for Alice Editor'})
  const tableBox = await table.boundingBox()
  const actionBox = await action.boundingBox()
  expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(
    tableBox!.x + tableBox!.width
  )
})
