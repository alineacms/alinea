import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example, States} from './RadioGroup.stories.js'

test('labels the group and selects the default item', async ({mount, page}) => {
  await mount(<Example />)
  const group = page.getByRole('radiogroup', {name: 'Favorite sport'})
  await expect(group.getByRole('radio', {name: 'Soccer'})).toBeChecked()
  await expect(group.getByRole('radio', {name: 'Basketball'})).toBeDisabled()
  await expect(
    page.getByRole('radiogroup', {name: 'Horizontal'})
  ).toHaveAttribute('aria-orientation', 'horizontal')
})

test('changes the value by click and keyboard', async ({mount, page}) => {
  await mount(<Controlled />)
  await page.getByText('Orange', {exact: true}).click()
  await expect(page.getByTestId('state')).toHaveText('orange')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('state')).toHaveText('grape')
  await expect(page.getByRole('radio', {name: 'Grape'})).toBeChecked()
})

test('disabled, read-only and invalid groups', async ({mount, page}) => {
  await mount(<States />)
  const disabled = page.getByRole('radiogroup', {name: 'Disabled'})
  await expect(disabled.getByRole('radio', {name: 'Orange'})).toBeDisabled()
  const readOnly = page.getByRole('radiogroup', {name: 'Read-only'})
  await expect(readOnly).toHaveAttribute('aria-readonly', 'true')
  await readOnly.getByRole('radio', {name: 'Orange'}).click({force: true})
  await expect(readOnly.getByRole('radio', {name: 'Apple'})).toBeChecked()
  const invalid = page.getByRole('radiogroup', {name: 'Invalid'})
  await expect(invalid).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toHaveText('Pick one')
})
