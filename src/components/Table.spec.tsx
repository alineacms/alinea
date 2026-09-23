import {expect, test} from '@playwright/experimental-ct-react'
import {Empty, Example, Selection, Sorting, Striped} from './Table.stories.js'

test('renders rows and columns', async ({mount, page}) => {
  await mount(<Example />)
  const table = page.getByRole('grid', {name: 'Files'})
  await expect(table).toHaveAttribute('data-slot', 'table')
  await expect(table.getByRole('columnheader')).toHaveText([
    'Name',
    'Type',
    'Date modified'
  ])
  await expect(table.getByRole('row')).toHaveCount(6)
  await expect(table.getByRole('rowheader', {name: 'Games'})).toBeVisible()
})

test('striped rows', async ({mount, page}) => {
  await mount(<Striped />)
  await expect(
    page.locator('[data-slot="table-container"][data-striped]')
  ).toHaveCount(1)
})

test('renders the empty state', async ({mount, page}) => {
  await mount(<Empty />)
  await expect(page.locator('[data-slot="table-empty"]')).toHaveText(
    'No files found.'
  )
})

test('single and multiple selection', async ({mount, page}) => {
  await mount(<Selection />)
  const single = page.getByRole('grid', {name: 'Single selection'})
  const games = single.getByRole('row', {name: /Games/})
  const users = single.getByRole('row', {name: /Users/})
  await expect(games).toHaveAttribute('aria-selected', 'true')
  await users.click()
  await expect(users).toHaveAttribute('aria-selected', 'true')
  await expect(games).toHaveAttribute('aria-selected', 'false')
  await expect(single.getByRole('row', {name: /bootmgr/})).toHaveAttribute(
    'aria-disabled',
    'true'
  )

  const multiple = page.getByRole('grid', {name: 'Multiple selection'})
  // Rows trigger their action while nothing is selected
  await multiple.getByRole('rowheader', {name: 'Windows'}).click()
  await expect(page.getByTestId('action')).toHaveText('windows')
  // The checkbox input is visually hidden, click its label instead
  const checkboxes = multiple
    .getByRole('checkbox')
    .locator('xpath=ancestor::label')
  await checkboxes.nth(1).click()
  await checkboxes.nth(2).click()
  await expect(page.getByTestId('selected')).toHaveText('games,program-files')
  await checkboxes.first().click()
  await expect(page.getByTestId('selected')).toHaveText('all')
})

test('sorts by column', async ({mount, page}) => {
  await mount(<Sorting />)
  const table = page.getByRole('grid', {name: 'Sorted files'})
  const name = table.getByRole('columnheader', {name: 'Name'})
  await expect(name).toHaveAttribute('aria-sort', 'ascending')
  await expect(table.getByRole('rowheader').first()).toHaveText('bootmgr')
  await name.click()
  await expect(name).toHaveAttribute('aria-sort', 'descending')
  await expect(table.getByRole('rowheader').first()).toHaveText('Windows')
  await table.getByRole('columnheader', {name: 'Type'}).click()
  await expect(table.getByRole('columnheader', {name: 'Type'})).toHaveAttribute(
    'aria-sort',
    'ascending'
  )
  await expect(table.getByRole('rowheader').first()).toHaveText('Games')
})
