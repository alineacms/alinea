import {expect, test} from '@playwright/experimental-ct-react'
import {CustomValue, Example, States} from './ComboBox.stories.js'

test('filters options and selects one', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('combobox', {name: 'Design software'})
  await input.fill('ado')
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  await expect(page.getByRole('option')).toHaveCount(2)
  await page.getByRole('option', {name: 'Adobe XD'}).click()
  await expect(input).toHaveValue('Adobe XD')
  await expect(page.getByTestId('value')).toHaveText('Value: xd')
})

test('shows the empty message', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('combobox', {name: 'Design software'})
  await input.fill('zzz')
  await expect(page.getByText('No software found')).toBeVisible()
})

test('clears the selected value', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('combobox', {name: 'Design software'})
  await input.fill('fig')
  await page.getByRole('option', {name: 'Figma'}).click()
  await expect(page.getByTestId('value')).toHaveText('Value: figma')
  await page.getByRole('button', {name: 'Clear'}).click()
  await expect(input).toHaveValue('')
  await expect(page.getByTestId('value')).toHaveText('Value: none')
})

test('keeps a custom value', async ({mount, page}) => {
  await mount(<CustomValue />)
  const input = page.getByRole('combobox', {name: 'Tag'})
  await input.fill('Custom tag')
  await input.blur()
  await expect(input).toHaveValue('Custom tag')
  await expect(page.getByTestId('input')).toHaveText('Input: Custom tag')
})

test('default, disabled and invalid states', async ({mount, page}) => {
  await mount(<States />)
  await expect(page.getByRole('combobox', {name: 'Default value'})).toHaveValue(
    'Figma'
  )
  await expect(
    page.getByRole('combobox', {name: 'Disabled', exact: true})
  ).toBeDisabled()
  await page.getByRole('combobox', {name: 'Disabled items'}).click()
  await page.getByRole('combobox', {name: 'Disabled items'}).press('ArrowDown')
  await expect(page.getByRole('option', {name: 'Adobe XD'})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  await expect(page.getByText('Please select an item.')).toBeVisible()
})
