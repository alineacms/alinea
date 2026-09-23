import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example} from './Switch.stories.js'

test('toggles by click and keyboard', async ({mount, page}) => {
  await mount(<Controlled />)
  const control = page.getByRole('switch', {name: 'Airplane mode'})
  await expect(control).not.toBeChecked()
  await page.getByText('Airplane mode').click()
  await expect(control).toBeChecked()
  await expect(page.getByTestId('state')).toHaveText('On')
  await control.press('Space')
  await expect(page.getByTestId('state')).toHaveText('Off')
})

test('default, disabled and read-only states', async ({mount, page}) => {
  await mount(<Example />)
  await expect(page.getByRole('switch', {name: 'Bluetooth'})).toBeChecked()
  await expect(
    page.getByRole('switch', {name: 'Disabled', exact: true})
  ).toBeDisabled()
  const readOnly = page.getByRole('switch', {name: 'Read-only'})
  await readOnly.focus()
  await readOnly.press('Space')
  await expect(readOnly).toBeChecked()
})
