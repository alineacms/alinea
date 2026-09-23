import {expect, test} from '@playwright/experimental-ct-react'
import {Reorderable} from './List.stories.js'

test('reorders rows by dragging the handle', async ({mount, page}) => {
  await mount(<Reorderable />)
  const order = page.getByTestId('order')
  const list = page.getByRole('list', {name: 'Sections'})
  const handle = page.getByRole('button', {name: 'Drag Hero'})
  await expect(handle).toHaveAttribute('data-slot', 'list-row-drag-handle')

  // Drop on the lower half of a row to place it after that row
  await list.getByRole('listitem', {name: 'Hero'}).hover()
  const image = list.getByRole('listitem', {name: 'Image'})
  const imageBox = (await image.boundingBox())!
  // Grab the handle off-center, react-aria treats exact center presses as
  // screen reader (virtual) drags
  await handle.dragTo(image, {
    sourcePosition: {x: 10, y: 6},
    targetPosition: {x: imageBox.width / 2, y: imageBox.height - 4}
  })
  await expect(order).toHaveText('Text, Image, Hero, Links')

  // Drop on the upper half of a row to place it before that row
  const text = list.getByRole('listitem', {name: 'Text'})
  await list.getByRole('listitem', {name: 'Links'}).hover()
  await page.getByRole('button', {name: 'Drag Links'}).dragTo(text, {
    sourcePosition: {x: 10, y: 6},
    targetPosition: {x: 20, y: 4}
  })
  await expect(order).toHaveText('Links, Text, Image, Hero')
})

test('shows a drop indicator while dragging', async ({mount, page}) => {
  await mount(<Reorderable />)
  const list = page.getByRole('list', {name: 'Sections'})
  await list.getByRole('listitem', {name: 'Hero'}).hover()
  const handle = page.getByRole('button', {name: 'Drag Hero'})
  const handleBox = (await handle.boundingBox())!
  const text = list.getByRole('listitem', {name: 'Text'})
  const textBox = (await text.boundingBox())!
  await page.mouse.move(handleBox.x + 10, handleBox.y + 6)
  await page.mouse.down()
  // The first move starts the drag, the next ones move over the target
  await page.mouse.move(handleBox.x + 20, handleBox.y + 20)
  await page.mouse.move(textBox.x + 20, textBox.y + textBox.height - 4, {
    steps: 5
  })
  const indicator = list.locator(
    '[data-slot="list-row-drop-indicator"][data-active]'
  )
  await expect(indicator).toHaveCount(1)
  await expect(indicator).toHaveAttribute('data-position', 'after')
  await expect(list.getByRole('listitem', {name: 'Hero'})).toHaveAttribute(
    'data-dragging',
    'true'
  )
  await page.mouse.up()
  await expect(indicator).toHaveCount(0)
  await expect(page.getByTestId('order')).toHaveText('Text, Hero, Image, Links')
})

test('reorders rows with the keyboard', async ({mount, page}) => {
  await mount(<Reorderable />)
  const order = page.getByTestId('order')
  const handle = page.getByRole('button', {name: 'Drag Hero'})
  const list = page.getByRole('list', {name: 'Sections'})
  const indicator = list.locator(
    '[data-slot="list-row-drop-indicator"][data-active]'
  )
  await handle.focus()
  await page.keyboard.press('Enter')
  // Drop targets start at the dragged row, Tab moves to the rows below it
  await expect(handle).not.toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(indicator).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(order).toHaveText('Text, Image, Hero, Links')
  await expect(handle).toBeFocused()

  // Shift+Tab passes the drag handle, then moves up from the dragged row
  await page.keyboard.press('Enter')
  await expect(handle).not.toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Enter')
  await expect(order).toHaveText('Hero, Text, Image, Links')
  await expect(handle).toBeFocused()

  // Escape cancels the drag
  await page.keyboard.press('Enter')
  await expect(handle).not.toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await expect(handle).toBeFocused()
  await expect(indicator).toHaveCount(0)
  await expect(order).toHaveText('Hero, Text, Image, Links')
})
