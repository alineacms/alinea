import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example} from './Dialog.stories.js'

test('opens from the trigger and closes with DialogClose', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await page.getByRole('button', {name: 'Edit profile'}).click()
  const dialog = page.getByRole('dialog', {name: 'Edit profile'})
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('heading', {level: 2, name: 'Edit profile'})
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Save'}).click()
  await expect(dialog).toBeHidden()
})

test('closes with the close button and escape', async ({mount, page}) => {
  await mount(<Example />)
  const trigger = page.getByRole('button', {name: 'Edit profile'})
  await trigger.click()
  await page.getByRole('button', {name: 'Close'}).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('controlled alert dialog is not dismissed by clicking outside', async ({
  mount,
  page
}) => {
  await mount(<Controlled />)
  await page.getByRole('button', {name: 'Open from outside'}).click()
  const dialog = page.getByRole('alertdialog', {name: 'Discard changes?'})
  await expect(dialog).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', {name: 'Discard'}).click()
  await expect(dialog).toBeHidden()
})
