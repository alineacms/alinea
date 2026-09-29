import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './Sidebar.stories.js'

test('renders the sidebar parts', async ({mount, page}) => {
  await mount(<Example />)
  const sidebar = page.locator('[data-slot="sidebar"]')
  await expect(sidebar).toHaveAttribute('data-side', 'left')
  for (const slot of [
    'sidebar-header',
    'sidebar-content',
    'sidebar-footer',
    'sidebar-group-label',
    'sidebar-group-action'
  ])
    await expect(sidebar.locator(`[data-slot="${slot}"]`)).toHaveCount(1)
  const group = page.getByRole('group', {name: 'Pages'})
  await expect(group).toHaveAttribute('data-slot', 'sidebar-group')

  // The group action sits on the label row
  const label = await page.getByText('Pages', {exact: true}).boundingBox()
  const action = page.getByRole('button', {name: 'EN'})
  const bounds = await action.boundingBox()
  expect(
    Math.abs(bounds!.y + bounds!.height / 2 - (label!.y + label!.height / 2))
  ).toBeLessThan(2)
  await action.click()
  await page.getByRole('menuitemradio', {name: 'Nederlands'}).click()
  await expect(page.getByRole('button', {name: 'NL'})).toBeVisible()

  // The footer stays at the bottom
  const footer = await sidebar
    .locator('[data-slot="sidebar-footer"]')
    .boundingBox()
  const box = await sidebar.boundingBox()
  expect(footer!.y + footer!.height).toBeCloseTo(box!.y + box!.height, 0)
})
