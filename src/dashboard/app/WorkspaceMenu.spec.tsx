import {expect, test} from '@playwright/experimental-ct-react'
import {
  GlobalSearchStory,
  LocalizedGlobalSearchStory,
  SingleWorkspaceAvatarStory
} from './WorkspaceMenu.stories.js'

test('single workspace avatar is not interactive', async ({mount, page}) => {
  await mount(<SingleWorkspaceAvatarStory />)

  await expect(
    page.getByRole('button', {name: 'Back to workspaces'})
  ).toHaveCount(0)
  await expect(page.getByLabel('Simple')).toBeVisible()
})

test('global search starts in the current workspace and can expand to everything', async ({
  mount,
  page
}) => {
  await mount(<GlobalSearchStory />)
  await page.getByRole('button', {name: 'Search entries'}).click()

  const search = page.getByRole('combobox', {name: 'Search'})
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

  const search = page.getByRole('combobox', {name: 'Search'})
  await search.fill('A propos')

  const result = page.getByText('A propos', {exact: true})
  await expect(result).toBeVisible()
  await result.click()
  await expect.poll(() => new URL(page.url()).hash).toContain('/pages:fr/')
})

test('global search opens with the keyboard shortcut and navigates results', async ({
  mount,
  page
}) => {
  await mount(<GlobalSearchStory />)
  const trigger = page.getByRole('button', {name: 'Search entries'})
  await expect(trigger.locator('kbd')).toHaveText(/K$/)

  await trigger.focus()
  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', {name: 'Search entries'})
  const search = dialog.getByRole('combobox', {name: 'Search'})
  await expect(search).toBeFocused()
  await expect(search).toHaveAttribute('aria-expanded', 'false')

  await search.fill('b')
  await expect(search).toHaveAttribute('aria-expanded', 'true')
  const results = dialog.getByRole('treegrid', {name: 'Explorer entries'})
  const rows = results.getByRole('row')
  await expect.poll(() => rows.count()).toBeGreaterThan(1)
  await expect(search).toHaveAttribute(
    'aria-controls',
    (await results.getAttribute('id'))!
  )

  function active() {
    return search.evaluate(input => {
      const id = input.getAttribute('aria-activedescendant')
      const row = id ? document.getElementById(id) : null
      return row ? Number(row.getAttribute('aria-posinset')) : undefined
    })
  }
  await expect.poll(active).toBe(1)
  await page.keyboard.press('ArrowDown')
  await expect.poll(active).toBe(2)
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowUp')
  await expect.poll(active).toBe(1)
  await expect(search).toBeFocused()

  // Focus stays within the dialog
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]'))
      )
    ).toBe(true)
  }

  // Escape closes the dialog, even with a query, and focus returns
  await search.focus()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()

  // The shortcut toggles the dialog
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toHaveCount(0)
})

test('enter opens the active search result', async ({mount, page}) => {
  await mount(<GlobalSearchStory />)
  await expect(page.getByRole('button', {name: 'Search entries'})).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  const search = page.getByRole('combobox', {name: 'Search'})
  await search.fill('About')
  await expect(page.getByText('About', {exact: true})).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).hash).toContain('/entry/')
})
