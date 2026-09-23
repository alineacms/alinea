import {expect, test} from '@playwright/experimental-ct-react'
import {Example, ReadOnly} from './MediaPreview.stories.js'

test('moves the focal point with the pointer', async ({mount, page}) => {
  await mount(<Example />)
  const image = page.getByRole('img', {name: 'A gradient with a sun'})
  await expect(image).toHaveAttribute('data-visible', 'true')
  const box = (await image.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.75)
  await expect(page.getByText('Hover: 0.25, 0.75')).toBeVisible()
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2, {
    steps: 4
  })
  await expect(page.getByText('Focus: 0.50, 0.50')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByText('Focus: 0.20, 0.20')).toBeVisible()

  // The marker is placed on the image
  const marker = page.getByRole('slider', {name: 'Focus point'})
  const markerBox = (await marker.boundingBox())!
  expect(
    Math.abs(markerBox.x + markerBox.width / 2 - (box.x + box.width * 0.2))
  ).toBeLessThan(2)

  await page.mouse.move(0, 0)
  await expect(page.getByText('Hover: none')).toBeVisible()
})

test('moves the focal point with the arrow keys', async ({mount, page}) => {
  await mount(<Example />)
  const marker = page.getByRole('slider', {name: 'Focus point'})
  await expect(marker).toHaveAttribute('data-slot', 'media-preview-focus')
  await marker.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowUp')
  await expect(page.getByText('Focus: 0.52, 0.40')).toBeVisible()
  await expect(marker).toHaveAttribute(
    'aria-valuetext',
    '52% from the left, 40% from the top'
  )
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowUp')
  await expect(page.getByText('Focus: 0.52, 0.00')).toBeVisible()
})

test('a read-only preview shows the focal point', async ({mount, page}) => {
  await mount(<ReadOnly />)
  await expect(page.locator('[data-slot="media-preview-focus"]')).toBeVisible()
  await expect(page.getByRole('slider')).toHaveCount(0)
  await expect(
    page.locator('[data-slot="media-preview-area"]')
  ).not.toHaveAttribute('data-editable')
})
