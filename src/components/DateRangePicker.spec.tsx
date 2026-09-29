import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example} from './DateRangePicker.stories.js'

test('picks a range from the calendar', async ({mount, page}) => {
  await mount(<Controlled />)
  await page.locator('[data-slot="date-range-picker-trigger"]').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', {name: /September 14, 2026/}).click()
  await dialog.getByRole('button', {name: /September 16, 2026/}).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('value')).toHaveText('2026-09-14 – 2026-09-16')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('shows a custom validation error', async ({mount, page}) => {
  await mount(<Controlled />)
  await page.locator('[data-slot="date-range-picker-trigger"]').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', {name: /September 1, 2026/}).click()
  await dialog.getByRole('button', {name: /September 20, 2026/}).click()
  await expect(page.getByTestId('value')).toHaveText('2026-09-01 – 2026-09-20')
  await expect(page.getByRole('alert')).toHaveText(
    'Maximum booking duration is 1 week.'
  )
})

test('disables the trigger', async ({mount, page}) => {
  await mount(<Example />)
  const group = page.getByRole('group', {name: 'Disabled'})
  await expect(
    group.locator('[data-slot="date-range-picker-trigger"]')
  ).toBeDisabled()
})
