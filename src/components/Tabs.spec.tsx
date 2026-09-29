import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example, Overflow, Vertical} from './Tabs.stories.js'

test('switches panels with the mouse and keyboard', async ({mount, page}) => {
  await mount(<Example />)
  const list = page.getByRole('tablist', {name: 'Settings'})
  await expect(list).toHaveAttribute('data-orientation', 'horizontal')
  const account = page.getByRole('tab', {name: 'Account'})
  await expect(account).toHaveAttribute('aria-selected', 'true')
  await expect(account).toHaveAttribute('data-slot', 'tabs-trigger')
  await expect(page.getByRole('tabpanel')).toHaveText(
    'Make changes to your account.'
  )
  await page.getByRole('tab', {name: 'Password'}).click()
  await expect(page.getByRole('tabpanel')).toHaveText(
    'Change your password here.'
  )
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', {name: 'Billing'})).toBeFocused()
  await expect(page.getByRole('tabpanel')).toHaveText(
    'Manage your subscription.'
  )
  await expect(page.getByRole('tab', {name: 'Disabled'})).toHaveAttribute(
    'aria-disabled',
    'true'
  )
})

test('controlled value', async ({mount, page}) => {
  await mount(<Controlled />)
  await expect(page.getByText('Selected: password')).toBeVisible()
  await page.getByRole('tab', {name: 'Billing'}).click()
  await expect(page.getByText('Selected: billing')).toBeVisible()
  await expect(page.getByRole('tabpanel')).toHaveText(
    'Manage your subscription.'
  )
})

test('vertical orientation uses up and down arrows', async ({mount, page}) => {
  await mount(<Vertical />)
  await expect(page.getByRole('tablist')).toHaveAttribute(
    'aria-orientation',
    'vertical'
  )
  await page.getByRole('tab', {name: 'Account'}).click()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('tab', {name: 'Password'})).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

test('scrolls the list when the triggers overflow', async ({mount, page}) => {
  await mount(<Overflow />)
  const scroller = page.locator('[data-slot="tabs-list"]')
  const overflows = await scroller.evaluate(
    element => element.scrollWidth > element.clientWidth
  )
  expect(overflows).toBe(true)
  const last = page.getByRole('tab', {name: 'Tab 20'})
  await last.click()
  await expect(page.getByRole('tabpanel')).toHaveText('Content of Tab 20')
})
