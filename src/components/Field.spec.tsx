import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Invalid} from './Field.stories.js'

test('labels the control and marks required and disabled fields', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const fields = page.locator('[data-slot="field"]')
  const title = page.getByLabel('Title')
  await expect(title).toBeVisible()
  await expect(
    fields.first().locator('[data-slot="field-description"]')
  ).toHaveText('Shown in search results.')
  await expect(fields.first().locator('[data-slot="field-icon"]')).toBeVisible()
  await expect(page.getByText('Shared', {exact: true})).toBeVisible()
  await page.getByText('Title', {exact: true}).click()
  await expect(title).toBeFocused()
  await expect(page.locator('[data-slot="field-required"]')).toHaveCount(1)
  await expect(page.getByLabel('Slug')).toBeVisible()
  const header = (label: string) =>
    fields.filter({hasText: label}).locator('[data-slot="field-header"]')
  await expect(header('Summary')).toHaveCSS('opacity', '0.45')
  await expect(header('Slug')).toHaveCSS('opacity', '1')
  await expect(fields.filter({hasText: 'Title'})).not.toHaveAttribute(
    'data-invalid'
  )
})

test('links the description and error to the control of a react-aria field', async ({
  mount,
  page
}) => {
  await mount(<Invalid />)
  const input = page.getByRole('textbox', {name: 'Email'})
  await expect(input).toHaveAccessibleDescription(
    /Used to sign in\..*Enter a valid email address/
  )
  await expect(page.getByRole('alert')).toHaveText(
    'Enter a valid email address'
  )
  // The dashboard focuses the first invalid field when publishing fails
  await expect(page.locator('[data-slot="field"][data-invalid]')).toHaveCount(1)
})
