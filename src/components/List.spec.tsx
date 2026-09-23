import {expect, test} from '@playwright/experimental-ct-react'
import {EmptySmallLists, SmallLists} from './List.stories.js'

test('renders actionable items as buttons', async ({mount, page}) => {
  await mount(<SmallLists />)
  const references = page.getByRole('list', {name: 'References'})
  await expect(references.getByRole('listitem')).toHaveCount(3)
  await expect(references.getByRole('button', {name: /Home/})).toBeVisible()
  // Items without onClick render a plain header
  const queue = page.getByRole('list', {name: 'Mutation queue'})
  await expect(queue.getByRole('button')).toHaveCount(0)
})

test('colors item statuses', async ({mount, page}) => {
  await mount(<SmallLists />)
  const status = page
    .getByRole('list', {name: 'Mutation queue'})
    .locator('[data-slot="list-item-status"]')
  await expect(status.nth(0)).toHaveAttribute('data-color', 'primary')
  await expect(status.nth(1)).toHaveAttribute('data-color', 'warning')
  await expect(status.nth(2)).toHaveAttribute('data-color', 'destructive')
})

test('announces empty lists as a status', async ({mount, page}) => {
  await mount(<EmptySmallLists />)
  await expect(page.getByRole('status', {name: 'Empty history'})).toContainText(
    'No history'
  )
})
