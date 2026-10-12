import {expect, test} from '@playwright/experimental-ct-react'
import {
  Basic,
  Empty,
  Reorderable,
  ToggleReorder
} from './SortableList.stories.js'
import {ListLabel} from './List.js'

type Page = Parameters<Parameters<typeof test>[2]>[0]['page']

/** Drags a row by the middle of its header to `y`, in steps */
async function dragRow(page: Page, row: string, y: number) {
  const header = page
    .getByRole('listitem', {name: row})
    .locator('[data-slot="sortable-list-item-header"]')
  const box = (await header.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, y, {steps: 8})
}

test('reorders items by dragging their header', async ({mount, page}) => {
  await mount(<Reorderable />)
  const order = page.getByTestId('order')
  const list = page.getByRole('list', {name: 'Sections'})
  const hero = list.getByRole('listitem', {name: 'Hero'})
  const image = list.getByRole('listitem', {name: 'Image'})

  // Past the middle of Image the rows above move up to make room
  const imageBox = (await image.boundingBox())!
  await dragRow(page, 'Hero', imageBox.y + imageBox.height * 0.75)
  await expect(hero).toHaveAttribute('data-dragging')
  await expect(list).toHaveAttribute('data-dragging')
  await expect(list.getByRole('listitem', {name: 'Text'})).not.toHaveCSS(
    'transform',
    'none'
  )
  await expect(list.getByRole('listitem', {name: 'Links'})).toHaveCSS(
    'transform',
    'none'
  )
  await page.mouse.up()
  await expect(order).toHaveText('Text, Image, Hero, Links')
  await expect(list).not.toHaveAttribute('data-dragging')
  // The release does not click the title the drag started on
  await expect(page.getByTestId('opened')).toHaveText('None')

  // Above the middle of the first row places it first
  const text = list.getByRole('listitem', {name: 'Text'})
  const textBox = (await text.boundingBox())!
  await dragRow(page, 'Links', textBox.y + textBox.height * 0.25)
  await page.mouse.up()
  await expect(order).toHaveText('Links, Text, Image, Hero')
})

test('a press without moving clicks the header', async ({mount, page}) => {
  await mount(<Reorderable />)
  await page.getByRole('button', {name: 'Image settings'}).click()
  await expect(page.getByTestId('opened')).toHaveText('Image')
  await expect(page.getByTestId('order')).toHaveText('Hero, Text, Image, Links')
})

test('Escape cancels a drag', async ({mount, page}) => {
  await mount(<Reorderable />)
  const list = page.getByRole('list', {name: 'Sections'})
  const links = list.getByRole('listitem', {name: 'Links'})
  const linksBox = (await links.boundingBox())!
  await dragRow(page, 'Hero', linksBox.y + linksBox.height / 2)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.getByTestId('order')).toHaveText('Hero, Text, Image, Links')
  await expect(list).not.toHaveAttribute('data-dragging')
})

test('reorders items with the keyboard', async ({mount, page}) => {
  await mount(<Reorderable />)
  const order = page.getByTestId('order')
  const hero = page.getByRole('button', {name: 'Hero settings'})
  await hero.focus()
  await page.keyboard.press('Alt+ArrowDown')
  await page.keyboard.press('Alt+ArrowDown')
  await expect(order).toHaveText('Text, Image, Hero, Links')
  await expect(hero).toBeFocused()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(order).toHaveText('Text, Hero, Image, Links')
  await expect(hero).toBeFocused()
  // The first row can not move further up
  await page.keyboard.press('Alt+ArrowUp')
  await page.keyboard.press('Alt+ArrowUp')
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

test('separates items and the add row with borders', async ({mount, page}) => {
  await mount(<Basic />)
  const list = page.getByRole('list', {name: 'Sections'})
  const items = list.getByRole('listitem')
  await expect(items.first()).toHaveCSS('border-top-width', '0px')
  await expect(items.nth(1)).toHaveCSS('border-top-width', '1px')
  const add = list.locator('[data-slot="sortable-list-add"] > div')
  await expect(add).toHaveCSS('border-top-width', '1px')
})

test('drops the add row border in an empty list', async ({mount, page}) => {
  await mount(<Empty />)
  const add = page.locator('[data-slot="sortable-list-add"] > div')
  await expect(add).toHaveCSS('border-top-width', '0px')
  await expect(page.getByRole('button', {name: 'Add Hero'})).toBeVisible()
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
  const list = page.getByRole('list', {name: 'Sections'})
  const title = page.getByRole('textbox', {name: 'Hero title'})
  await title.fill('Welcome')
  await expect(list).toHaveAttribute('data-reorderable', 'true')
  await page.getByRole('button', {name: 'Lock'}).click()
  await expect(list).not.toHaveAttribute('data-reorderable')
  await expect(title).toHaveValue('Welcome')
  await page.getByRole('button', {name: 'Edit'}).click()
  await expect(title).toHaveValue('Welcome')
  await expect(list).toHaveAttribute('data-reorderable', 'true')
})
