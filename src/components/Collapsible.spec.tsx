import {expect, test} from '@playwright/experimental-ct-react'
import {AsChild, Controlled, Disabled, Example} from './Collapsible.stories.js'

test('expands and collapses the content', async ({mount, page}) => {
  await mount(<Example />)
  const trigger = page.getByRole('button', {name: 'Previous versions'})
  await expect(trigger).toHaveAttribute('data-slot', 'collapsible-trigger')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('Version 3')).toBeHidden()
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const content = page.getByText('Version 3').locator('..')
  await expect(content).toHaveAttribute('data-slot', 'collapsible-content')
  await expect(trigger).toHaveAttribute(
    'aria-controls',
    (await content.getAttribute('id'))!
  )
  await page.keyboard.press('Enter')
  await expect(page.getByText('Version 3')).toBeHidden()
})

test('controlled open state', async ({mount, page}) => {
  await mount(<Controlled />)
  await expect(page.getByText('Some details')).toBeVisible()
  await page.getByRole('button', {name: 'Details'}).click()
  await expect(page.getByText('Collapsed')).toBeVisible()
  await expect(page.getByText('Some details')).toBeHidden()
})

test('uses the child as trigger', async ({mount, page}) => {
  await mount(<AsChild />)
  const trigger = page.getByRole('button', {name: 'Show more'})
  await expect(trigger).toHaveAttribute('data-variant', 'outline')
  await trigger.click()
  await expect(page.getByText('More content')).toBeVisible()
})

test('disabled collapsible does not open', async ({mount, page}) => {
  await mount(<Disabled />)
  const trigger = page.getByRole('button', {name: 'Locked'})
  await expect(trigger).toBeDisabled()
  await expect(page.getByText('Hidden content')).toBeHidden()
})
