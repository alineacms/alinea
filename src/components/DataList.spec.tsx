import {expect, test} from '@playwright/experimental-ct-react'
import {Horizontal, Vertical} from './DataList.stories.js'

test('lines horizontal labels up in a column', async ({mount, page}) => {
  await mount(<Horizontal />)
  const list = page.locator('dl[data-slot="data-list"]')
  await expect(list).toHaveAttribute('data-orientation', 'horizontal')
  await expect(list.getByRole('term')).toHaveText([
    'Status',
    'Created by',
    'Last modified'
  ])
  await expect(list.getByRole('definition').first()).toHaveText('Published')
  const values = list.getByRole('definition')
  const first = await values.nth(0).boundingBox()
  const last = await values.nth(2).boundingBox()
  expect(first!.x).toBe(last!.x)
  const label = await list.getByRole('term').nth(2).boundingBox()
  expect(label!.x + label!.width).toBeLessThanOrEqual(first!.x)
})

test('stacks vertical items and spans full items', async ({mount, page}) => {
  await page.setViewportSize({width: 700, height: 500})
  await mount(<Vertical />)
  const list = page.locator('[data-slot="data-list"]')
  const items = list.locator('[data-slot="data-list-item"]')
  const first = await items.nth(0).boundingBox()
  const second = await items.nth(1).boundingBox()
  expect(second!.y).toBe(first!.y)
  const label = await items.nth(0).getByRole('term').boundingBox()
  const value = await items.nth(0).getByRole('definition').boundingBox()
  expect(value!.y).toBeGreaterThan(label!.y)
  const full = items.last()
  await expect(full).toHaveAttribute('data-full', 'true')
  const listBox = await list.boundingBox()
  const fullBox = await full.boundingBox()
  expect(fullBox!.width).toBe(listBox!.width)
})
