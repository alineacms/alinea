import {expect, test} from '@playwright/experimental-ct-react'
import {Formats, Relative} from './Timestamp.stories.js'

test('formats dates with Intl in the given locale', async ({mount, page}) => {
  await mount(<Formats />)
  const times = page.locator('time[data-slot="timestamp"]')
  await expect(times).toHaveCount(4)
  for (const time of await times.all())
    await expect(time).toHaveAttribute('datetime', '2026-03-14T09:26:53.000Z')
  await expect(times.nth(1)).toHaveText('Mar 14, 2026')
  await expect(times.nth(0)).not.toHaveAttribute('title')
  // Shorter formats show the full date and time on hover
  await expect(times.nth(1)).toHaveAttribute('title', /Mar 14, 2026/)
  await expect(times.nth(2)).toHaveAttribute('title', /Mar 14, 2026/)
  await expect(times.nth(3)).toContainText('14 mrt 2026')
})

test('formats recent dates relative to now', async ({mount, page}) => {
  await mount(<Relative />)
  const times = page.locator('time[data-slot="timestamp"]')
  await expect(times.nth(0)).toHaveText('now')
  await expect(times.nth(1)).toHaveText(/^5\s?m(in\.)? ago$/)
  await expect(times.nth(2)).toHaveText(/^3\s?h(r\.)? ago$/)
  await expect(times.nth(3)).toHaveText('yesterday')
  await expect(times.nth(4)).toHaveText(/^May 3, \d{4}$/)
  await expect(times.nth(1)).toHaveAttribute('data-format', 'relative')
})
