import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example, Locale} from './DatePicker.stories.js'

test('picks a date from the calendar', async ({mount, page}) => {
  await mount(<Controlled />)
  const trigger = page.locator('[data-slot="date-picker-trigger"]')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', {name: /September 12, 2026/}).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('value')).toHaveText('2026-09-12')
  await expect(
    page.getByRole('group', {name: 'Event date'}).getByRole('spinbutton')
  ).toHaveText(['9', '12', '2026'])
})

test('types a date', async ({mount, page}) => {
  await mount(<Controlled />)
  const segments = page
    .getByRole('group', {name: 'Event date'})
    .getByRole('spinbutton')
  await segments.first().click()
  await page.keyboard.type('12')
  await expect(page.getByTestId('value')).toHaveText('2026-12-23')
})

test('limits the calendar to min and max', async ({mount, page}) => {
  await mount(<Example />)
  const group = page.getByRole('group', {name: 'Only September 2026'})
  await group.locator('[data-slot="date-picker-trigger"]').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('[data-slot="calendar-next"]')).toBeDisabled()
})

test('shows the error', async ({mount, page}) => {
  await mount(<Example />)
  await expect(page.getByRole('alert')).toHaveText('Date is required')
})

test('formats the date in the given locale', async ({mount, page}) => {
  await mount(<Locale />)
  await expect(
    page.getByRole('group', {name: 'British date'}).getByRole('spinbutton')
  ).toHaveText(['23', '09', '2026'])
})
