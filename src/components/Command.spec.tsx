import {expect, test} from '@playwright/experimental-ct-react'
import {CustomFilter, Example, InPopover} from './Command.stories.js'

test('filters items by text and keywords', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('searchbox', {name: 'Search blocks'})
  const list = page.getByRole('listbox', {name: 'Blocks'})
  await expect(page.locator('[data-slot="command"]')).toHaveCount(1)
  await expect(list.getByRole('option')).toHaveCount(5)
  await expect(page.getByText('Content', {exact: true})).toBeVisible()

  await input.fill('QUO')
  await expect(list.getByRole('option')).toHaveCount(1)
  await expect(list.getByRole('option', {name: 'Quote'})).toBeVisible()

  // Keywords match too
  await input.fill('photo')
  await expect(list.getByRole('option')).toHaveCount(1)
  await expect(list.getByRole('option', {name: 'Image'})).toBeVisible()

  await input.fill('nothing like this')
  await expect(page.getByText('No matching blocks')).toBeVisible()
  await expect(list.locator('[data-slot="command-item"]')).toHaveCount(0)
})

test('selects items with the keyboard and pointer', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('searchbox', {name: 'Search blocks'})
  const selected = page.getByTestId('selected')
  await input.fill('co')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(selected).toHaveText('code')

  await input.fill('')
  await page.getByRole('option', {name: 'Image'}).click()
  await expect(selected).toHaveText('image')

  // Disabled items can not be chosen
  await expect(page.getByRole('option', {name: 'Embed'})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
})

test('picks from a popover and closes it', async ({mount, page}) => {
  await mount(<InPopover />)
  await page.getByRole('button', {name: 'Add block'}).click()
  const dialog = page.getByRole('dialog', {name: 'Add block'})
  const input = dialog.getByRole('searchbox', {name: 'Search types'})
  await expect(input).toBeFocused()
  await input.fill('ima')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('added')).toHaveText('image')

  await page.getByRole('button', {name: 'Add block'}).click()
  await page.getByRole('option', {name: 'Quote'}).click()
  await expect(page.getByRole('dialog', {name: 'Add block'})).toBeHidden()
  await expect(page.getByTestId('added')).toHaveText('image, quote')
})

test('supports a custom filter', async ({mount, page}) => {
  await mount(<CustomFilter />)
  const input = page.getByRole('searchbox', {name: 'Search by id'})
  const list = page.getByRole('listbox', {name: 'Blocks by id'})
  await input.fill('co')
  await expect(list.getByRole('option')).toHaveCount(1)
  await expect(list.getByRole('option', {name: 'Code (code)'})).toBeVisible()
  // Text matches are ignored by this filter
  await input.fill('ode')
  await expect(page.getByText('No block ids start with this')).toBeVisible()
})
