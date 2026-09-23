import {expect, test} from '@playwright/experimental-ct-react'
import {
  DragAndDrop,
  Empty,
  Example,
  MultipleSelection,
  Virtualized,
  WithStatus
} from './Tree.stories.js'

test('expands and collapses items', async ({mount, page}) => {
  await mount(<Example />)
  const tree = page.getByRole('treegrid', {name: 'Files'})
  await expect(tree).toHaveAttribute('data-slot', 'tree')
  const docs = tree.getByRole('row', {name: 'Documents'})
  await expect(docs).toHaveAttribute('aria-expanded', 'true')
  await expect(tree.getByRole('row', {name: 'Project'})).toBeVisible()
  await expect(tree.getByRole('row', {name: 'Weekly report'})).toHaveCount(0)
  await tree
    .getByRole('row', {name: 'Project'})
    .locator('[slot="chevron"]')
    .click()
  await expect(tree.getByRole('row', {name: 'Weekly report'})).toBeVisible()
  await docs.locator('[slot="chevron"]').click()
  await expect(docs).toHaveAttribute('aria-expanded', 'false')
  await expect(tree.getByRole('row', {name: 'Project'})).toHaveCount(0)
  await tree.getByRole('row', {name: 'Photos'}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tree.getByRole('row', {name: 'Image 1'})).toBeVisible()
})

test('single selection, links, actions and disabled items', async ({
  mount,
  page
}) => {
  await mount(<WithStatus />)
  const tree = page.getByRole('treegrid', {name: 'Pages'})
  const published = tree.getByRole('row', {name: /Published/})
  await expect(published).toHaveAttribute('aria-selected', 'true')
  await expect(
    published.getByRole('link', {name: 'Published'})
  ).toHaveAttribute('href', '#published')
  await expect(published.locator('[data-slot="tree-item-suffix"]')).toHaveCount(
    1
  )
  const unpublished = tree.getByRole('row', {name: /Unpublished/})
  await unpublished.click()
  await expect(unpublished).toHaveAttribute('aria-selected', 'true')
  await expect(published).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByTestId('selected')).toHaveText('unpublished')
  await expect(tree.getByRole('row', {name: /Draft/})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
})

test('multiple selection with checkboxes', async ({mount, page}) => {
  await mount(<MultipleSelection />)
  const tree = page.getByRole('treegrid', {name: 'Photos'})
  await tree.getByRole('row', {name: 'Image 1'}).getByRole('checkbox').click()
  await tree.getByRole('row', {name: 'Image 3'}).getByRole('checkbox').click()
  await expect(page.getByTestId('selected')).toHaveText('image-1,image-3')
})

test('reorders and moves items with the keyboard', async ({mount, page}) => {
  await mount(<DragAndDrop />)
  const tree = page.getByRole('treegrid', {name: 'Groceries'})
  const rows = tree.getByRole('row')
  await expect(rows).toHaveText(
    ['Fruit', 'Apple', 'Banana', 'Vegetables', 'Bread'].map(
      name => new RegExp(name)
    )
  )
  // Drag Bread before Fruit with the mouse
  await tree
    .getByRole('row', {name: /Bread/})
    .dragTo(tree.getByRole('row', {name: /Fruit/}), {
      targetPosition: {x: 60, y: 2}
    })
  await expect(rows.first()).toHaveText(/Bread/)
  // Drop Vegetables on Fruit
  await tree
    .getByRole('row', {name: /Vegetables/})
    .dragTo(tree.getByRole('row', {name: /Fruit/}))
  await expect(tree.getByRole('row', {name: /Vegetables/})).toHaveAttribute(
    'aria-level',
    '2'
  )
})

test('virtualizes large trees', async ({mount, page}) => {
  await mount(<Virtualized />)
  const tree = page.getByRole('treegrid', {name: '1000 items'})
  await expect(
    tree.getByRole('row', {name: 'Item 1', exact: true})
  ).toBeVisible()
  expect(await tree.getByRole('row').count()).toBeLessThan(40)
})

test('renders the empty state', async ({mount, page}) => {
  await mount(<Empty />)
  await expect(page.locator('[data-slot="tree-empty"]')).toHaveText('No items')
})
