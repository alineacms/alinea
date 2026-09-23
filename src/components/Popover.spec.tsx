import {expect, test} from '@playwright/experimental-ct-react'
import {Example, NonModal} from './Popover.stories.js'

test('opens a popover dialog and closes it on outside click', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const trigger = page.getByRole('button', {name: 'Help'})
  await expect(trigger).toHaveAttribute('data-slot', 'popover-trigger')
  await trigger.click()
  const popover = page.getByRole('dialog', {name: 'Help'})
  await expect(popover).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(popover).toBeHidden()
})

test('non modal popover', async ({mount, page}) => {
  await mount(<NonModal />)
  await page.getByRole('button', {name: /Open without blocking/}).click()
  await expect(page.getByRole('dialog', {name: 'Details'})).toBeVisible()
})
