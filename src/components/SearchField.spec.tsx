import {expect, test} from '@playwright/experimental-ct-react'
import {Example, States} from './SearchField.stories.js'

test('types, submits and clears a query', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('searchbox', {name: 'Search'})
  const clear = page.locator('[data-slot="search-field-clear"]')
  await expect(clear).toBeHidden()
  await input.fill('alinea')
  await expect(page.getByTestId('query')).toHaveText('alinea')
  await input.press('Enter')
  await expect(page.getByTestId('submitted')).toHaveText('alinea')
  await expect(clear).toBeVisible()
  await clear.click()
  await expect(input).toHaveValue('')
  await expect(page.getByTestId('submitted')).toHaveText('cleared')
  await input.fill('again')
  await input.press('Escape')
  await expect(page.getByTestId('query')).toHaveText('')
})

test('shows loading, invalid, disabled and read-only', async ({
  mount,
  page
}) => {
  await mount(<States />)
  await expect(
    page.getByRole('progressbar', {name: 'Loading results'})
  ).toBeVisible()
  await expect(page.getByRole('searchbox', {name: 'Invalid'})).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(page.getByRole('searchbox', {name: 'Disabled'})).toBeDisabled()
  await expect(
    page.getByRole('searchbox', {name: 'Read-only'})
  ).toHaveAttribute('readonly', '')
})
