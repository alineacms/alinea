import {expect, test} from '@playwright/experimental-ct-react'
import {AsChild, Controlled, Example, Sides} from './Tooltip.stories.js'

test('shows the tooltip on hover and focus', async ({mount, page}) => {
  await mount(<Example />)
  // React Aria only opens tooltips on hover once it saw pointer movement
  await page.mouse.move(1, 1)
  const trigger = page.getByRole('button', {name: 'Hover me'})
  await expect(trigger).toHaveAttribute('data-slot', 'tooltip-trigger')
  await trigger.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveText('Add to library')
  await expect(tooltip).toHaveAttribute('data-slot', 'tooltip-content')
  await expect(trigger).toHaveAttribute('aria-describedby', /.+/)
  await page.mouse.move(0, 0)
  await expect(tooltip).toBeHidden()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('tooltip')).toHaveText('Add to library')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toBeHidden()
})

test('uses the child as trigger', async ({mount, page}) => {
  await mount(<AsChild />)
  await page.mouse.move(1, 1)
  await page.getByRole('button', {name: 'Save'}).hover()
  await expect(page.getByRole('tooltip')).toHaveText('Save')
  await page.getByRole('button', {name: 'Native button'}).hover()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Describes the native button'
  )
})

test('places the tooltip on the requested side', async ({mount, page}) => {
  await mount(<Sides />)
  await page.mouse.move(1, 1)
  const trigger = page.getByRole('button', {name: 'right'})
  await trigger.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveText('Tooltip on the right')
  const triggerBox = (await trigger.boundingBox())!
  const tooltipBox = (await tooltip.boundingBox())!
  expect(tooltipBox.x).toBeGreaterThan(triggerBox.x + triggerBox.width)
})

test('controlled open state', async ({mount, page}) => {
  await mount(<Controlled />)
  await expect(page.getByRole('tooltip')).toHaveText('Cannot be undone')
  await page.getByRole('button', {name: 'Hide tooltip'}).click()
  await expect(page.getByRole('tooltip')).toBeHidden()
  await page.getByRole('button', {name: 'Show tooltip'}).click()
  await expect(page.getByRole('tooltip')).toBeVisible()
})
