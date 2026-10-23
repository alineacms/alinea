import {expect, test} from '@playwright/experimental-ct-react'
import {Builder} from './FormField.stories.js'

test('names rows after their label and marks required ones', async ({
  mount,
  page
}) => {
  await mount(<Builder />)
  const inputs = page.getByRole('list', {name: 'Inputs'})
  const name = inputs.getByRole('listitem', {name: 'Text item 1'})
  await expect(name).toContainText('Name')
  await expect(name).toContainText('Required')
  // Inputs keep their settings in the sheet, there is nothing to fold
  await expect(name.getByRole('button', {name: 'Expand Text'})).toHaveCount(0)
  await expect(name.getByRole('button', {name: 'Collapse Text'})).toHaveCount(0)
})

test('edits an input in its sheet, without a label and anchor', async ({
  mount,
  page
}) => {
  await mount(<Builder />)
  await page.getByRole('button', {name: 'Textarea settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Description'})
  await expect(page.locator('[data-slot="sheet-section-title"]')).toHaveText([
    'Input',
    'Textarea'
  ])
  await expect(sheet.getByRole('textbox', {name: 'Anchor'})).toHaveCount(0)
  await expect(sheet.getByRole('textbox', {name: 'Key'})).toHaveValue(
    'description'
  )
})

test('marks a row whose key another input uses', async ({mount, page}) => {
  await mount(<Builder />)
  const phone = page.getByRole('listitem', {name: 'Phone item 3'})
  await phone.getByRole('button', {name: 'Phone settings'}).click()
  await page
    .getByRole('dialog', {name: 'Phone'})
    .getByRole('textbox', {name: 'Key'})
    .fill('email')
  await expect(phone).toContainText('Key: Another input uses the key "email"')
})

test('adds an input from a menu grouped by origin', async ({mount, page}) => {
  await mount(<Builder />)
  await page.getByRole('button', {name: 'Add input'}).last().click()
  const menu = page.getByRole('listbox', {name: 'Add input'})
  await expect(menu.getByRole('group')).toHaveCount(2)
  await expect(
    menu.getByRole('group', {name: 'This project'}).getByRole('option')
  ).toHaveText(['Rating'])
  await menu.getByRole('option', {name: 'Rating'}).click()
  // A new input opens its settings to be named
  const sheet = page.getByRole('dialog', {name: 'Rating'})
  const label = sheet.getByRole('textbox', {name: 'Label'})
  await expect(label).toBeFocused()
  await label.fill('Overall score')
  await expect(
    page.getByRole('dialog', {name: 'Overall score'}).getByRole('textbox', {
      name: 'Key'
    })
  ).toHaveValue('overall-score')
})

test('edits the options of a choice under its row', async ({mount, page}) => {
  await mount(<Builder />)
  const options = page.getByRole('list', {name: 'Options'})
  const labels = () =>
    options
      .getByRole('textbox')
      .evaluateAll(inputs =>
        inputs.map(input => (input as HTMLInputElement).value)
      )
  await expect.poll(labels).toEqual(['IT', 'Facilities'])
  const second = options.getByRole('listitem', {name: 'Option item 2'})
  await second.getByRole('textbox').press('Enter')
  const third = options.getByRole('listitem', {name: 'Option item 3'})
  await expect(third.getByRole('textbox')).toBeFocused()
  await page.keyboard.type('HR')
  await expect.poll(labels).toEqual(['IT', 'Facilities', 'HR'])
  // The value of an option is in its settings
  await third.getByRole('button', {name: 'Option settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'HR'})
  await expect(sheet.getByRole('textbox', {name: 'Value'})).toHaveValue('hr')
})
