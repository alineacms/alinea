import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example, States} from './Checkbox.stories.js'

test('toggles a checkbox by clicking its label', async ({mount, page}) => {
  await mount(<Controlled />)
  const checkbox = page.getByRole('checkbox', {name: 'Subscribe'})
  await expect(checkbox).not.toBeChecked()
  await page.getByText('Subscribe', {exact: true}).click()
  await expect(checkbox).toBeChecked()
  await expect(page.getByTestId('state')).toHaveText('Subscribed')
  await checkbox.press('Space')
  await expect(checkbox).not.toBeChecked()
})

test('renders default and indeterminate states', async ({mount, page}) => {
  await mount(<Example />)
  await expect(
    page.getByRole('checkbox', {name: 'Checked by default'})
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', {name: 'Indeterminate'})
  ).toHaveJSProperty('indeterminate', true)
  await expect(page.locator('[data-slot="checkbox"]').first()).toBeVisible()
})

test('disabled, read-only and invalid states', async ({mount, page}) => {
  await mount(<States />)
  await expect(
    page.getByRole('checkbox', {name: 'Disabled', exact: true})
  ).toBeDisabled()
  const invalid = page.getByRole('checkbox', {name: 'Invalid'})
  await expect(invalid).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toHaveText('You must accept the terms')
  const readOnly = page.getByRole('checkbox', {name: 'Read-only and checked'})
  await expect(readOnly).toBeChecked()
  await readOnly.focus()
  await readOnly.press('Space')
  await expect(readOnly).toBeChecked()
  await expect(page.getByRole('checkbox', {name: 'Required'})).toHaveAttribute(
    'required',
    ''
  )
})

test('shows no focus ring when toggled with the pointer', async ({
  mount,
  page
}) => {
  await mount(<Controlled />)
  await page.getByText('Subscribe', {exact: true}).click()
  const box = page.locator('[data-slot="checkbox-indicator"]').first()
  await expect(box).toHaveCSS('outline-style', 'none')
  await page.getByRole('checkbox', {name: 'Subscribe'}).press('Space')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(box).toHaveCSS('outline-style', 'solid')
})
