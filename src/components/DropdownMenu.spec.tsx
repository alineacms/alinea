import {expect, test} from '@playwright/experimental-ct-react'
import {AsChild, Example, Selection, Submenu} from './DropdownMenu.stories.js'

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

test('opens a submenu', async ({mount, page}) => {
  await mount(<Submenu />)
  await page.getByRole('button', {name: 'Share'}).click()
  await page.getByRole('menuitem', {name: 'Send to'}).click()
  await expect(page.getByRole('menu', {name: 'Send to'})).toBeVisible()
  await page.getByRole('menuitem', {name: 'Slack'}).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
})
