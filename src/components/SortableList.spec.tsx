import {expect, test} from '@playwright/experimental-ct-react'
import {
  Basic,
  Current,
  Empty,
  Reorderable,
  ToggleReorder
} from './SortableList.stories.js'
import {Button} from './Button.js'
import {ListLabel} from './List.js'
import {SortableList, SortableListAdd} from './SortableList.js'

test('reorders items by dragging the handle', async ({mount, page}) => {
  await mount(<Reorderable />)
  const order = page.getByTestId('order')
  const list = page.getByRole('list', {name: 'Sections'})
  const handle = page.getByRole('button', {name: 'Drag Hero'})
  await expect(handle).toHaveAttribute('data-slot', 'sortable-list-handle')

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
    '[data-slot="sortable-list-drop-indicator"][data-active]'
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

test('reorders items with the keyboard', async ({mount, page}) => {
  await mount(<Reorderable />)
  const order = page.getByTestId('order')
  const handle = page.getByRole('button', {name: 'Drag Hero'})
  const list = page.getByRole('list', {name: 'Sections'})
  const indicator = list.locator(
    '[data-slot="sortable-list-drop-indicator"][data-active]'
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

test('folds item content with the toggle', async ({mount, page}) => {
  await mount(<Basic />)
  const list = page.getByRole('list', {name: 'Sections'})
  const hero = list.getByRole('listitem', {name: 'Hero item 1'})
  const toggle = hero.getByRole('button', {name: 'Collapse hero'})
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(hero.getByLabel('Heading', {exact: true})).toBeVisible()
  await toggle.click()
  const expand = hero.getByRole('button', {name: 'Expand hero'})
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expect(hero.getByLabel('Heading', {exact: true})).toHaveCount(0)

  const quote = list.getByRole('listitem', {name: 'Quote item 2'})
  await expect(quote).toContainText('Content editing should stay close...')
  await quote.getByRole('button', {name: 'Expand quote'}).click()
  await expect(quote.getByLabel('Quote', {exact: true})).toBeVisible()
})

test('folded items are as tall as a text field', async ({mount, page}) => {
  await mount(<Basic />)
  const hero = page.getByRole('listitem', {name: 'Hero item 1'})
  await hero.getByRole('button', {name: 'Collapse hero'}).click()
  // The list draws its edge inside, over the row's top border
  expect((await hero.boundingBox())!.height).toBe(36)
})

test('joins the title and its "…" in one button', async ({mount, page}) => {
  await mount(<Basic />)
  const quote = page.getByRole('listitem', {name: 'Quote item 2'})
  const trigger = quote.getByRole('button', {name: 'Quote settings'})
  await expect(trigger).toHaveAttribute(
    'data-slot',
    'sortable-list-item-trigger'
  )
  await expect(trigger).toContainText('Editorial quote')
  await expect(trigger.locator('svg')).toHaveCount(1)
})

test('hovering the trigger only fills its "…"', async ({mount, page}) => {
  await mount(<Basic />)
  const quote = page.getByRole('listitem', {name: 'Quote item 2'})
  const trigger = quote.getByRole('button', {name: 'Quote settings'})
  const more = trigger.locator('[data-slot="sortable-list-item-more"]')
  await trigger.getByText('Editorial quote').hover()
  const background = (element: Element) =>
    getComputedStyle(element).backgroundColor
  await expect.poll(() => trigger.evaluate(background)).toBe('rgba(0, 0, 0, 0)')
  await expect
    .poll(() => more.evaluate(background))
    .not.toBe('rgba(0, 0, 0, 0)')
  const box = await more.boundingBox()
  expect([box?.width, box?.height]).toEqual([28, 28])
})

test('separates items with borders and adds below the list', async ({
  mount,
  page
}) => {
  await mount(<Basic />)
  const list = page.getByRole('list', {name: 'Sections'})
  const items = list.getByRole('listitem')
  await expect(items.nth(1)).toHaveCSS('border-top-width', '1px')
  // The list edge is drawn inside, over the first row's border
  await expect(items.first()).toHaveCSS('border-top-width', '1px')
  await expect(list).toHaveCSS('outline-offset', '-1px')
  await expect(list.locator('[data-slot="sortable-list-add"]')).toHaveCount(0)
  const add = page.locator('[data-slot="sortable-list-add"]')
  const listBox = (await list.boundingBox())!
  const addBox = (await add.boundingBox())!
  expect(addBox.y).toBeGreaterThanOrEqual(listBox.y + listBox.height)
  expect(addBox.x).toBe(listBox.x)
})

test('drops the add row border in an empty list', async ({mount, page}) => {
  await mount(<Empty />)
  const add = page.locator('[data-slot="sortable-list-add"] > div')
  await expect(add).toHaveCSS('border-top-width', '0px')
  await expect(page.getByRole('button', {name: 'Add Hero'})).toBeVisible()
})

test('renders no surface without items', async ({mount, page}) => {
  const empty = null
  await mount(
    <SortableList aria-label="Sections">
      {empty}
      <SortableListAdd>
        <Button variant="outline">Add Hero</Button>
      </SortableListAdd>
    </SortableList>
  )
  await expect(page.getByRole('button', {name: 'Add Hero'})).toBeVisible()
  await expect(page.getByRole('list', {name: 'Sections'})).toHaveCount(0)
})

test('a list label without rows to fold keeps its full color', async ({
  mount,
  page
}) => {
  await mount(
    <ListLabel aria-label="No list items to fold" expanded hasRows={false}>
      Sections
    </ListLabel>
  )
  const toggle = page.getByRole('button', {name: 'No list items to fold'})
  await expect(toggle).toBeDisabled()
  await expect(toggle).toHaveCSS('opacity', '1')
})

test('keeps item state when reordering is switched off', async ({
  mount,
  page
}) => {
  await mount(<ToggleReorder />)
  const title = page.getByRole('textbox', {name: 'Hero title'})
  await title.fill('Welcome')
  await expect(page.getByRole('button', {name: 'Drag Hero'})).toHaveCount(1)
  await page.getByRole('button', {name: 'Lock'}).click()
  await expect(page.getByRole('button', {name: 'Drag Hero'})).toHaveCount(0)
  await expect(title).toHaveValue('Welcome')
  await page.getByRole('button', {name: 'Edit'}).click()
  await expect(title).toHaveValue('Welcome')
  await expect(page.getByRole('button', {name: 'Drag Hero'})).toHaveCount(1)
})

test('highlights the current item', async ({mount, page}) => {
  await mount(<Current />)
  const list = page.getByRole('list', {name: 'Sections'})
  const text = list.getByRole('listitem', {name: 'Text'})
  const hero = list.getByRole('listitem', {name: 'Hero'})
  await expect(text).toHaveAttribute('aria-current', 'true')
  await expect(hero).not.toHaveAttribute('aria-current')
  const background = (item: typeof text) =>
    item.evaluate(element => getComputedStyle(element).backgroundColor)
  expect(await background(text)).not.toBe(await background(hero))
})
