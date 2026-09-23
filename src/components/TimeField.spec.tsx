import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example} from './TimeField.stories.js'

test('edits the ISO time value', async ({mount, page}) => {
  await mount(<Controlled />)
  const segments = page
    .getByRole('group', {name: 'Start time'})
    .getByRole('spinbutton')
  await expect(segments).toHaveText(['14', '30'])
  await segments.first().click()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('value')).toHaveText('15:30')
  await segments.nth(1).click()
  await page.keyboard.type('05')
  await expect(page.getByTestId('value')).toHaveText('15:05')
})

test('shows seconds with second granularity', async ({mount, page}) => {
  await mount(<Controlled />)
  await expect(
    page.getByRole('group', {name: 'With seconds'}).getByRole('spinbutton')
  ).toHaveText(['08', '15', '30'])
})

test('renders error and disabled state', async ({mount, page}) => {
  await mount(<Example />)
  await expect(page.getByRole('alert')).toHaveText('Time is required')
  await expect(
    page
      .getByRole('group', {name: /With error/})
      .getByRole('spinbutton')
      .first()
  ).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('group', {name: 'Disabled'})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
})
