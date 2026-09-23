import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Groups, States} from './Select.stories.js'

test('selects and clears a value', async ({mount, page}) => {
  await mount(<Example />)
  const trigger = page.getByRole('button', {name: /Design software/})
  await expect(trigger).toContainText('Select software')
  await trigger.click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  await page.getByRole('option', {name: 'Figma'}).click()
  await expect(listbox).toBeHidden()
  await expect(trigger).toContainText('Figma')
  await expect(page.getByTestId('value')).toHaveText('Value: figma')
  await page.getByRole('button', {name: 'Clear'}).click()
  await expect(page.getByTestId('value')).toHaveText('Value: none')
  await expect(trigger).toContainText('Select software')
})

test('supports keyboard selection', async ({mount, page}) => {
  await mount(<Example />)
  const trigger = page.getByRole('button', {name: /Design software/})
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('value')).not.toHaveText('Value: none')
})

test('renders groups, separators and disabled items', async ({mount, page}) => {
  await mount(<Groups />)
  await page.getByRole('button', {name: /Setting/}).click()
  await expect(page.locator('[data-slot="select-label"]')).toHaveText([
    'Appearance',
    'System'
  ])
  await expect(page.locator('[data-slot="select-separator"]')).toHaveCount(1)
  await expect(page.getByRole('option', {name: 'Unavailable'})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  await expect(
    page.locator('[data-slot="select-item-description"]')
  ).toHaveText('Configure the workspace')
})

test('required, disabled and invalid states', async ({mount, page}) => {
  await mount(<States />)
  await expect(page.getByRole('button', {name: 'Clear'})).toHaveCount(0)
  await expect(page.getByRole('button', {name: /Disabled/})).toBeDisabled()
  await expect(
    page.getByText('Please select an item in the list.')
  ).toBeVisible()
  await expect(
    page.locator('[data-slot="select-trigger"][data-invalid]')
  ).toHaveCount(1)
})

test('the list is as wide as the trigger with its clear button', async ({
  mount,
  page
}) => {
  await mount(
    <div style={{width: 280}}>
      <Example />
    </div>
  )
  const trigger = page.getByRole('button', {name: /Design software/})
  await trigger.click()
  await page.getByRole('option', {name: 'Figma'}).click()
  await expect(page.getByRole('button', {name: 'Clear'})).toBeVisible()
  await trigger.click()
  const content = page.locator('[data-slot="select-content"]')
  await expect(content).toBeVisible()
  const triggerBox = await page
    .locator('[data-slot="select-trigger"]')
    .boundingBox()
  const contentBox = await content.boundingBox()
  // The list is clamped between 240 and 320 pixels
  const expected = Math.min(320, Math.max(240, triggerBox!.width))
  expect(Math.abs(contentBox!.width - expected)).toBeLessThanOrEqual(1)
})
