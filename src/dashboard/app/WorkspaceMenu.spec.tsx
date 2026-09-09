import {expect, test} from '@playwright/experimental-ct-react'
import {
  GlobalSearchStory,
  LocalizedGlobalSearchStory
} from './WorkspaceMenu.stories.js'

test('global search starts in the current workspace and can expand to everything', async ({
  mount,
  page
}) => {
  await mount(<GlobalSearchStory />)
  await page.getByRole('button', {name: 'Search entries'}).click()

  const search = page.getByRole('searchbox', {name: 'Search'})
  const everything = page.getByRole('switch', {name: 'All locations'})
  await expect(search).toBeFocused()
  await expect(everything).not.toBeChecked()
  await expect(everything).toBeEnabled()
  await expect
    .poll(async () => {
      const searchBox = await search.locator('..').boundingBox()
      const everythingBox = await everything.boundingBox()
      return Boolean(
        searchBox &&
        everythingBox &&
        everythingBox.x >= searchBox.x + searchBox.width
      )
    })
    .toBe(true)

  await search.fill('About')
  await expect(page.getByText('About', {exact: true})).toBeVisible()

  await everything.press('Space')
  await expect(everything).toBeChecked()
  await search.fill('Checklist')
  await expect(page.getByText('Checklist', {exact: true})).toBeVisible()
})

test('global search includes localized entries', async ({mount, page}) => {
  await mount(<LocalizedGlobalSearchStory />)
  await page.getByRole('button', {name: 'Search entries'}).click()

  const search = page.getByRole('searchbox', {name: 'Search'})
  await search.fill('A propos')

  const result = page.getByText('A propos', {exact: true})
  await expect(result).toBeVisible()
  await result.click()
  await expect.poll(() => new URL(page.url()).hash).toContain('/pages:fr/')
})
