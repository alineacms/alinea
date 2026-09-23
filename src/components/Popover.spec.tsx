import {expect, test} from '@playwright/experimental-ct-react'
import {
  Anchored,
  Example,
  KeepOpen,
  NonModal,
  VirtualAnchor
} from './Popover.stories.js'

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
  const popover = page.getByRole('dialog', {name: 'Details'})
  await expect(popover).toBeVisible()
  await page.mouse.click(600, 700)
  await expect(popover).toBeHidden()
  // The trigger toggles instead of reopening after an outside interaction
  const trigger = page.getByRole('button', {name: /Open without blocking/})
  await trigger.click()
  await expect(popover).toBeVisible()
  await trigger.click()
  await expect(popover).toBeHidden()
})

test('positions against the anchor', async ({mount, page}) => {
  await mount(<Anchored />)
  await page.getByRole('button', {name: 'Open below the box'}).click()
  const popover = page.getByRole('dialog', {name: 'Anchored'})
  await expect(popover).toBeVisible()
  const anchor = (await page.getByTestId('anchor').boundingBox())!
  const box = (await page
    .locator('[data-slot="popover-content"]')
    .boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(anchor.y + anchor.height)
  expect(Math.round(box.x)).toBe(Math.round(anchor.x))
})

test('positions against a virtual anchor', async ({mount, page}) => {
  await mount(<VirtualAnchor />)
  await page.getByRole('button', {name: 'Open elsewhere'}).click()
  await expect(page.getByRole('dialog', {name: 'Virtual'})).toBeVisible()
  const anchor = (await page.getByTestId('anchor').boundingBox())!
  const box = (await page
    .locator('[data-slot="popover-content"]')
    .boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(anchor.y + anchor.height)
})

test('onInteractOutside can keep the popover open', async ({mount, page}) => {
  await mount(<KeepOpen />)
  await page.getByRole('button', {name: 'Stays open'}).click()
  const popover = page.getByRole('dialog', {name: 'Sticky'})
  await expect(popover).toBeVisible()
  await page.getByTestId('outside').click()
  await expect(page.getByTestId('outside')).toHaveText('1')
  await expect(popover).toBeVisible()
  await page.getByRole('button', {name: 'Stays open'}).click()
  await expect(popover).toBeHidden()
})
