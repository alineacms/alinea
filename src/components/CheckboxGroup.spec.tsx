import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example, States} from './CheckboxGroup.stories.js'

test('labels the group and keeps the default value', async ({mount, page}) => {
  await mount(<Example />)
  const group = page.getByRole('group', {name: 'Favorite sports'})
  await expect(group).toBeVisible()
  await expect(group.getByRole('checkbox', {name: 'Soccer'})).toBeChecked()
  await expect(
    group.getByRole('checkbox', {name: 'Baseball'})
  ).not.toBeChecked()
})

test('reports the selected values', async ({mount, page}) => {
  await mount(<Controlled />)
  await page.getByRole('checkbox', {name: 'Orange'}).click()
  await expect(page.getByTestId('state')).toHaveText('apple,orange')
  await page.getByRole('checkbox', {name: 'Apple'}).click()
  await expect(page.getByTestId('state')).toHaveText('orange')
})

test('disabled and invalid groups', async ({mount, page}) => {
  await mount(<States />)
  const disabled = page.getByRole('group', {name: 'Disabled'})
  await expect(disabled.getByRole('checkbox', {name: 'Apple'})).toBeDisabled()
  const invalid = page.getByRole('group', {name: 'Invalid'})
  await expect(invalid.getByRole('checkbox', {name: 'Apple'})).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(page.getByRole('alert')).toHaveText('Pick at least one')
  await expect(page.getByText('Shared', {exact: true}).last()).toBeVisible()
})
