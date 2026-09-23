import {expect, test} from '@playwright/experimental-ct-react'
import {Card, Example} from './Empty.stories.js'

test('renders media, title, description and actions', async ({mount, page}) => {
  await mount(<Example />)
  const empty = page.locator('[data-slot="empty"]').first()
  await expect(empty).toHaveAttribute('data-variant', 'default')
  await expect(empty.locator('[data-slot="empty-title"]')).toHaveText(
    'No pages yet'
  )
  await expect(empty.locator('[data-slot="empty-description"]')).toHaveText(
    'Pages you create in this root show up here.'
  )
  const media = empty.locator('[data-slot="empty-media"]')
  await expect(media).toHaveAttribute('data-variant', 'icon')
  await expect(media).toHaveAttribute('aria-hidden', 'true')
  await expect(
    empty
      .locator('[data-slot="empty-content"]')
      .getByRole('button', {name: 'Create page'})
  ).toBeVisible()
})

test('centers its content in the available space', async ({mount, page}) => {
  await mount(<Example />)
  const empty = page.locator('[data-slot="empty"]').last()
  const frame = await empty.evaluate(element => {
    const parent = element.parentElement!.getBoundingClientRect()
    const header = element
      .querySelector('[data-slot="empty-header"]')!
      .getBoundingClientRect()
    return {
      parent: parent.top + parent.height / 2,
      header: header.top + header.height / 2
    }
  })
  expect(Math.abs(frame.parent - frame.header)).toBeLessThan(2)
})

test('a card empty state can title the page', async ({mount, page}) => {
  await mount(<Card />)
  await expect(
    page.getByRole('heading', {level: 1, name: 'Entry not found'})
  ).toBeVisible()
  await expect(page.locator('[data-slot="empty"]')).toHaveAttribute(
    'data-variant',
    'card'
  )
})
