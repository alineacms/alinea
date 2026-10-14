import {expect, test} from '@playwright/experimental-ct-react'
import {Example, InDialog} from './Form.stories.js'

test('shows native and returned errors on fields', async ({mount, page}) => {
  await mount(<Example />)
  const title = page.getByRole('textbox', {name: 'Title'})
  const path = page.getByRole('textbox', {name: 'Path'})
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(title).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('[data-slot="field-error"]')).toHaveCount(1)
  await title.fill('About us')
  // Native errors update on blur, do that before the error moves the button
  await title.blur()
  await expect(page.locator('[data-slot="field-error"]')).toHaveCount(0)
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page.getByText('This path is taken')).toBeVisible()
  await expect(path).toHaveAttribute('aria-invalid', 'true')
  await path.fill('/about-us')
  await path.blur()
  await expect(page.getByText('This path is taken')).toHaveCount(0)
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page.getByTestId('saved')).toHaveText('Saved /about-us')
})

test('a dialog form closes once it is saved', async ({mount, page}) => {
  await mount(<InDialog />)
  await page.getByRole('button', {name: 'Rename page'}).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', {name: 'Rename'}).click()
  await expect(dialog.getByText('This path is taken')).toBeVisible()
  await dialog.getByRole('textbox', {name: 'Path'}).fill('/contact')
  await dialog.getByRole('button', {name: 'Rename'}).click()
  await expect(dialog).toHaveCount(0)
})
