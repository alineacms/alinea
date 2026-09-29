import {expect, test} from '@playwright/experimental-ct-react'
import type {Locator, Page} from 'playwright'
import {
  Controlled,
  HiddenPanel,
  Horizontal,
  Vertical
} from './Resizable.stories.js'

async function drag(page: Page, handle: Locator, x: number, y = 0) {
  const bounds = await handle.boundingBox()
  if (!bounds) throw new Error('Handle is not visible')
  const startX = bounds.x + bounds.width / 2
  const startY = bounds.y + bounds.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + x, startY + y, {steps: 10})
  await page.mouse.up()
}

function size(element: Locator, axis: 'width' | 'height' = 'width') {
  return element.evaluate(
    (element, axis) => element.getBoundingClientRect()[axis],
    axis
  )
}

test('resizes panels by dragging a handle and reports the layout', async ({
  mount,
  page
}) => {
  await mount(<Horizontal />)
  const navigation = page.getByTestId('navigation')
  const details = page.getByTestId('details')
  const handles = page.locator('[data-slot="resizable-handle"]')
  await expect(handles).toHaveCount(2)
  await expect(handles.first()).toHaveAttribute('data-with-handle', '')
  await expect(page.getByTestId('content')).toHaveAttribute(
    'data-slot',
    'resizable-panel'
  )
  await expect.poll(() => size(navigation)).toBe(200)
  await expect.poll(() => size(details)).toBe(240)

  await drag(page, handles.first(), 60)
  await expect.poll(() => size(navigation)).toBe(260)
  await expect(page.getByLabel('Layout')).toHaveText(/^260 \/ \d+ \/ 240$/)
  await expect.poll(() => size(details)).toBe(240)

  await drag(page, handles.last(), -40)
  await expect.poll(() => size(details)).toBe(280)
})

test('clamps panels to their minimum and maximum size', async ({
  mount,
  page
}) => {
  await mount(<Horizontal />)
  const navigation = page.getByTestId('navigation')
  const handle = page.locator('[data-slot="resizable-handle"]').first()
  await expect.poll(() => size(navigation)).toBe(200)
  await drag(page, handle, 400)
  await expect.poll(() => size(navigation)).toBe(300)
  await drag(page, handle, -400)
  await expect.poll(() => size(navigation)).toBe(150)
})

test('restores default sizes on double click', async ({mount, page}) => {
  await mount(<Horizontal />)
  const navigation = page.getByTestId('navigation')
  const handle = page.locator('[data-slot="resizable-handle"]').first()
  await expect.poll(() => size(navigation)).toBe(200)
  await drag(page, handle, 80)
  await expect.poll(() => size(navigation)).toBe(280)
  await handle.dblclick()
  await expect.poll(() => size(navigation)).toBe(200)
  await expect(page.getByLabel('Layout')).toHaveText(/^200 \/ \d+ \/ 240$/)
})

test('lays out panels vertically', async ({mount, page}) => {
  await mount(<Vertical />)
  const bottom = page.getByTestId('bottom')
  await expect.poll(() => size(bottom, 'height')).toBe(160)
  const handle = page.locator('[data-slot="resizable-handle"]')
  await drag(page, handle, 0, -60)
  await expect.poll(() => size(bottom, 'height')).toBe(220)
})

test('hides a panel without unmounting it', async ({mount, page}) => {
  await mount(<HiddenPanel />)
  const sidebar = page.getByTestId('sidebar')
  const content = page.getByTestId('content')
  await page.getByLabel('Sidebar note').fill('Kept')
  await expect.poll(() => size(sidebar)).toBe(240)
  const contentWidth = await size(content)

  await page.getByText('Show sidebar').click()
  await expect(sidebar).toBeHidden()
  await expect.poll(() => size(content)).toBeGreaterThan(contentWidth)

  await page.getByText('Show sidebar').click()
  await expect.poll(() => size(sidebar)).toBe(240)
  await expect(page.getByLabel('Sidebar note')).toHaveValue('Kept')
})

test('follows and reports a controlled size', async ({mount, page}) => {
  await mount(<Controlled />)
  const sidebar = page.getByTestId('sidebar')
  const stored = page.getByLabel('Stored width')
  const handle = page.locator('[data-slot="resizable-handle"]')
  await expect.poll(() => size(sidebar)).toBe(280)

  await drag(page, handle, 50)
  await expect.poll(() => size(sidebar)).toBe(330)
  await expect(stored).toHaveText('330')

  await page.getByRole('button', {name: 'Set to 360'}).click()
  await expect.poll(() => size(sidebar)).toBe(360)

  await handle.dblclick()
  await expect.poll(() => size(sidebar)).toBe(240)
  await expect(stored).toHaveText('240')
})
