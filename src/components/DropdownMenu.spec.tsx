import {expect, test} from '@playwright/experimental-ct-react'
import {
  AsChild,
  Example,
  Selection,
  SharedValues,
  Submenu
} from './DropdownMenu.stories.js'

test('opens a menu and closes it when an item is selected', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await page.getByRole('button', {name: 'More actions'}).click()
  const menu = page.getByRole('menu', {name: 'Actions'})
  await expect(menu).toBeVisible()
  await expect(page.getByRole('menuitem', {name: 'Archive'})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  await expect(page.getByRole('menuitem', {name: 'Delete'})).toHaveAttribute(
    'data-variant',
    'destructive'
  )
  await page.getByRole('menuitem', {name: /Rename/}).click()
  await expect(menu).toBeHidden()
})

test('rings the item focused with the keyboard, not the hovered one', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await page.getByRole('button', {name: 'More actions'}).click()
  const rename = page.getByRole('menuitem', {name: /Rename/})
  const duplicate = page.getByRole('menuitem', {name: /Duplicate/})
  // Hovering focuses the item and marks it with a background only
  await rename.hover()
  await expect(rename).toBeFocused()
  await expect(rename).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(rename).toHaveCSS('outline-style', 'none')
  await page.keyboard.press('ArrowDown')
  await expect(duplicate).toBeFocused()
  await expect(duplicate).toHaveCSS('outline-style', 'solid')
  await expect(rename).toHaveCSS('outline-style', 'none')
})

test('uses the child as trigger', async ({mount, page}) => {
  await mount(<AsChild />)
  const trigger = page.getByRole('button', {name: 'Custom trigger'})
  await expect(trigger).toHaveAttribute('data-variant', 'outline')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('menuitem', {name: 'First'})).toBeVisible()
})

test('checkbox and radio items', async ({mount, page}) => {
  await mount(<Selection />)
  const trigger = page.getByRole('button', {name: 'Format'})
  await trigger.click()
  const bold = page.getByRole('menuitemcheckbox', {name: 'Bold'})
  const italic = page.getByRole('menuitemcheckbox', {name: 'Italic'})
  await expect(bold).toHaveAttribute('aria-checked', 'true')
  await expect(bold).toHaveAttribute('data-slot', 'dropdown-menu-checkbox-item')
  // Each checkbox item is its own labelled group
  await expect(page.getByRole('group', {name: 'Bold'})).toHaveCount(1)
  await expect(italic).toHaveAttribute('aria-checked', 'false')
  await italic.click()
  await expect(italic).toHaveAttribute('aria-checked', 'true')
  await bold.click()
  await expect(bold).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('menuitemradio', {name: 'Center'}).click()
  await expect(page.getByRole('menu')).toBeHidden()
  await trigger.click()
  await expect(
    page.getByRole('menuitemradio', {name: 'Center'})
  ).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitemradio', {name: 'Left'})).toHaveAttribute(
    'aria-checked',
    'false'
  )
})

test('radio groups may share values', async ({mount, page}) => {
  await mount(<SharedValues />)
  const trigger = page.getByRole('button', {name: 'Size'})
  await trigger.click()
  const radios = page.getByRole('menuitemradio')
  await expect(radios).toHaveText(['Narrow', 'Wide', 'Short', 'Tall'])
  const checked = page.locator('[role="menuitemradio"][aria-checked="true"]')
  await expect(checked).toHaveText(['Narrow', 'Tall'])
  await page.getByRole('menuitemradio', {name: 'Short'}).click()
  await trigger.click()
  await expect(checked).toHaveText(['Narrow', 'Short'])
  await expect(page.getByRole('group', {name: 'Width'})).toHaveAttribute(
    'data-slot',
    'dropdown-menu-radio-group'
  )
})

test('opens a submenu', async ({mount, page}) => {
  await mount(<Submenu />)
  await page.getByRole('button', {name: 'Share'}).click()
  await page.getByRole('menuitem', {name: 'Send to'}).click()
  await expect(page.getByRole('menu', {name: 'Send to'})).toBeVisible()
  await page.getByRole('menuitem', {name: 'Slack'}).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
})
