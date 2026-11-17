import {expect, test} from '@playwright/experimental-ct-react'
import {
  GlobalSearchStory,
  LocalizedGlobalSearchStory
} from './WorkspaceMenu.stories.js'

test('global search starts in the current workspace and can pick another scope', async ({
  mount,
  page
}) => {
  await mount(<GlobalSearchStory />)
  await page.getByRole('button', {name: 'Search entries'}).click()

  const dialog = page.getByRole('dialog', {name: 'Search entries'})
  const search = dialog.getByRole('combobox', {name: 'Search'})
  const scope = dialog.getByRole('group', {name: 'Explorer scope'})
  await expect(search).toBeFocused()
  await expect(dialog.getByRole('switch')).toHaveCount(0)
  const [workspace, root] = [
    scope.getByRole('button').first(),
    scope.getByRole('button').last()
  ]
  await expect(workspace).toHaveText('Simple')
  await expect(root).toHaveText('All roots')

  await search.fill('About')
  await expect(dialog.getByText('About', {exact: true})).toBeVisible()

  // A root limits the matches to it
  await root.click()
  await page.getByRole('menuitemradio', {name: 'Media'}).click()
  await expect(root).toHaveText('Media')
  await expect(dialog.getByText('No results found')).toBeVisible()
  await root.click()
  await page.getByRole('menuitemradio', {name: 'All roots'}).click()
  await expect(dialog.getByText('About', {exact: true})).toBeVisible()

  await workspace.click()
  await page.getByRole('menuitemradio', {name: 'All workspaces'}).click()
  await expect(workspace).toHaveText('All workspaces')
  await search.fill('Checklist')
  await expect(dialog.getByText('Checklist', {exact: true})).toBeVisible()
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
  await expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K')

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
