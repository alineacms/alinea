import {expect, test} from '@playwright/experimental-ct-react'
import {CustomRootView, Empty, ExplorerStyle} from './ContentGrid.stories.js'

test('image cards with selection and actions', async ({mount, page}) => {
  await mount(<CustomRootView />)
  const grid = page.getByRole('grid', {name: 'Photos'})
  const harbour = grid.getByRole('row', {name: 'Harbour at dawn'})
  await expect(harbour.locator('img')).toHaveCount(1)
  await expect(harbour).toContainText('1600×1067 - 24 kB')
  await expect(harbour).toContainText(/Media.*Photos/)
  await harbour.click()
  await expect(page.getByTestId('status')).toContainText(
    'Opened Harbour at dawn'
  )
  await grid
    .getByRole('checkbox', {name: 'Select Forest trail'})
    .locator('xpath=ancestor::label')
    .click()
  await expect(grid.getByRole('row', {name: 'Forest trail'})).toHaveAttribute(
    'aria-selected',
    'true'
  )
  // Once cards are selected a click toggles
  await grid.getByRole('row', {name: 'City lights'}).click()
  await expect(page.getByTestId('status')).toContainText('2 selected')
})

test('explorer style cards with skeletons and drag and drop', async ({
  mount,
  page
}) => {
  await mount(<ExplorerStyle />)
  const grid = page.getByRole('grid', {name: 'Entries'})
  await expect(grid.getByRole('row', {name: 'Legal'})).toHaveAttribute(
    'data-unselectable',
    'true'
  )
  await expect(grid.getByRole('checkbox', {name: 'Select Legal'})).toHaveCount(
    0
  )
  await expect(page.locator('[data-slot="content-card-skeleton"]')).toHaveCount(
    1
  )
  await grid
    .getByRole('button', {name: 'Drag About us'})
    .dragTo(grid.getByRole('row', {name: 'News'}), {force: true})
  await expect(page.getByTestId('moved')).toHaveText('Moved about into news')
})

test('empty state', async ({mount, page}) => {
  await mount(<Empty />)
  await expect(page.getByText('No photos yet')).toBeVisible()
})
