import {expect, test} from '@playwright/experimental-ct-react'
import {Constraints, Disabled, Example, Range} from './Calendar.stories.js'

test('selects a date', async ({mount, page}) => {
  await mount(<Example />)
  const calendar = page.getByRole('application', {name: /Event date/})
  await expect(calendar.locator('[data-slot="calendar-heading"]')).toHaveText(
    'September 2026'
  )
  await page.getByRole('button', {name: /September 23, 2026/}).click()
  await page.getByRole('button', {name: /September 25, 2026/}).click()
  await expect(page.getByTestId('value')).toHaveText('2026-09-25')
})

test('navigates between months', async ({mount, page}) => {
  await mount(<Example />)
  await page.locator('[data-slot="calendar-next"]').click()
  await expect(page.locator('[data-slot="calendar-heading"]')).toHaveText(
    'October 2026'
  )
  await page.locator('[data-slot="calendar-previous"]').click()
  await page.locator('[data-slot="calendar-previous"]').click()
  await expect(page.locator('[data-slot="calendar-heading"]')).toHaveText(
    'August 2026'
  )
})

test('respects min, max and unavailable dates', async ({mount, page}) => {
  await mount(<Constraints />)
  await expect(
    page.getByRole('button', {name: /September 5, 2026/})
  ).toHaveAttribute('aria-disabled', 'true')
  await expect(
    page.getByRole('button', {name: /September 26, 2026/})
  ).toHaveAttribute('aria-disabled', 'true')
  await expect(
    page.getByRole('button', {name: /September 19, 2026/})
  ).toHaveAttribute('aria-disabled', 'true')
  await expect(
    page.getByRole('button', {name: /September 17, 2026/})
  ).not.toHaveAttribute('aria-disabled', 'true')
})

test('disabled calendar cannot change month', async ({mount, page}) => {
  await mount(<Disabled />)
  await expect(page.locator('[data-slot="calendar-next"]')).toBeDisabled()
})

test('selects a range', async ({mount, page}) => {
  await mount(<Range />)
  await expect(page.getByTestId('value')).toHaveText('2026-09-07 – 2026-09-11')
  await page.getByRole('button', {name: /September 14, 2026/}).click()
  await page.getByRole('button', {name: /September 18, 2026/}).click()
  await expect(page.getByTestId('value')).toHaveText('2026-09-14 – 2026-09-18')
})
