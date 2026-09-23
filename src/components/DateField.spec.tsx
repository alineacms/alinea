import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example} from './DateField.stories.js'

test('renders label, description and error', async ({mount, page}) => {
  await mount(<Example />)
  await expect(page.getByText('The day the event starts')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('Date is required')
  const invalid = page.getByRole('group', {name: /With error/})
  await expect(invalid.getByRole('spinbutton').first()).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(
    page.getByRole('group', {name: 'Disabled'}).getByRole('spinbutton').first()
  ).toHaveAttribute('aria-disabled', 'true')
})

test('edits the ISO value', async ({mount, page}) => {
  await mount(<Controlled />)
  const segments = page
    .getByRole('group', {name: 'Start date'})
    .getByRole('spinbutton')
  await expect(segments).toHaveText(['9', '23', '2026'])
  await segments.nth(1).click()
  await page.keyboard.type('05')
  await expect(page.getByTestId('value')).toHaveText('2026-09-05')
  await segments.first().press('ArrowUp')
  await expect(page.getByTestId('value')).toHaveText('2026-10-05')
})
