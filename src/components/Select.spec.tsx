import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Groups, ReadOnly, Small, States} from './Select.stories.js'

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
  await expect(trigger).toBeFocused()
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

test('rings the option focused with the keyboard, not the hovered one', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await page.getByRole('button', {name: /Design software/}).click()
  const options = page.getByRole('option')
  const first = options.nth(0)
  const second = options.nth(1)
  // Hovering focuses the option and marks it with a background only
  await first.hover()
  await expect(first).toBeFocused()
  await expect(first).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(first).toHaveCSS('outline-style', 'none')
  await page.keyboard.press('ArrowDown')
  await expect(second).toBeFocused()
  await expect(second).toHaveCSS('outline-style', 'solid')
  await expect(first).toHaveCSS('outline-style', 'none')
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
  // The trigger shows the selected option without its description
  await page.getByRole('option', {name: /Settings/}).click()
  const trigger = page.locator('[data-slot="select-trigger"]')
  await expect(trigger).toContainText('Settings')
  await expect(
    trigger.locator('[data-slot="select-item-description"]')
  ).toBeHidden()
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

test('a small select is as tall as a button', async ({mount, page}) => {
  await mount(<Small />)
  const trigger = page.locator('[data-slot="select-trigger"]')
  await expect(trigger).toHaveAttribute('data-size', 'sm')
  const button = page.getByRole('button', {name: 'Button', exact: true})
  const [select, sibling] = await Promise.all([
    trigger.boundingBox(),
    button.boundingBox()
  ])
  expect(select?.height).toBe(sibling?.height)
})

test('the list is as wide as the trigger with its clear button', async ({
  mount,
  page
}) => {
  await mount(
    <div style={{width: 600}}>
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
  // The list follows wide fields, narrow ones get at least 240 pixels
  const expected = Math.max(240, triggerBox!.width)
  expect(Math.abs(contentBox!.width - expected)).toBeLessThanOrEqual(1)
})

test('a read only select can be focused and submits its value', async ({
  mount,
  page
}) => {
  await mount(<ReadOnly />)
  const trigger = page.getByRole('button', {name: /Read only/})
  await expect(trigger).toBeEnabled()
  await expect(trigger).toHaveAttribute('aria-readonly', 'true')
  await trigger.click()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('f')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(trigger).toContainText('Sketch')
  const data = await page
    .getByTestId('form')
    .evaluate(form => [...new FormData(form as HTMLFormElement)])
  expect(data).toEqual([['software', 'sketch']])
})
