import {expect, test} from '@playwright/experimental-ct-react'
import {Example, States} from './FoldIcon.stories.js'

test('rotates when expanded', async ({mount, page}) => {
  await mount(<States />)
  const collapsed = page.getByRole('img', {name: 'Collapsed'})
  const expanded = page.getByRole('img', {name: 'Expanded'})
  await expect(collapsed).not.toHaveAttribute('data-expanded')
  await expect(collapsed).toHaveCSS('rotate', '0deg')
  await expect(expanded).toHaveAttribute('data-expanded', 'true')
  await expect(expanded).toHaveCSS('rotate', '90deg')
})

test('follows the expanded state of its trigger', async ({mount, page}) => {
  await mount(<Example />)
  const trigger = page.getByRole('button', {name: 'Details'})
  const icon = trigger.locator('svg')
  await expect(icon).toHaveAttribute('aria-hidden', 'true')
  await expect(icon).not.toHaveAttribute('data-expanded')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(icon).toHaveAttribute('data-expanded', 'true')
})
