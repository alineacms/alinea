import {expect, test} from '@playwright/experimental-ct-react'
import {Builder, Notifications} from './FormField.stories.js'

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
    'Textarea',
    'Logic'
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

test('adds an input from one menu with the inputs of the project', async ({
  mount,
  page
}) => {
  await mount(<Builder />)
  await page.getByRole('button', {name: 'Add input'}).last().click()
  const menu = page.getByRole('listbox', {name: 'Add input'})
  // Inputs of the project are listed with the built-in ones
  await expect(menu.getByRole('group')).toHaveCount(0)
  await expect(menu.getByRole('option', {name: 'Rating'})).toBeVisible()
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
  // The key follows the label and shows in its input, it opens its settings
  const suffix = third.getByTitle('Key: hr')
  await expect(suffix).toHaveText('hr')
  await suffix.click()
  const key = page.getByRole('dialog', {name: 'HR'}).getByRole('textbox', {
    name: 'Key'
  })
  await expect(key).toHaveValue('hr')
  await key.fill('human-resources-and-facility-management')
  await expect(
    third.getByTitle('Key: human-resources-and-facility-management')
  ).toBeVisible()
})

test('lines up the options whatever the length of their key', async ({
  mount,
  page
}) => {
  await mount(<Builder />)
  const options = page.getByRole('list', {name: 'Options'})
  const second = options.getByRole('listitem', {name: 'Option item 2'})
  await second.getByRole('textbox').press('Enter')
  await page.keyboard.type('Facility services and building maintenance')
  const widths = () =>
    options
      .getByRole('textbox')
      .evaluateAll(inputs =>
        inputs.map(input => Math.round(input.getBoundingClientRect().width))
      )
  await expect.poll(async () => new Set(await widths()).size).toBe(1)
  // The text of the input stops before the key laid over its end
  const third = options.getByRole('listitem', {name: 'Option item 3'})
  const input = third.getByRole('textbox')
  const suffix = third.getByTitle(
    'Key: facility-services-and-building-maintenance'
  )
  const inputBox = (await input.boundingBox())!
  const suffixBox = (await suffix.boundingBox())!
  const padding = await input.evaluate(input =>
    parseFloat(getComputedStyle(input).paddingRight)
  )
  expect(inputBox.x + inputBox.width - padding).toBeLessThan(suffixBox.x)
})

test('rules of an input use the inputs above it', async ({mount, page}) => {
  await mount(<Builder />)
  const screenshots = page.getByRole('listitem', {name: 'File item 3'})
  await expect(screenshots).toContainText('Shown if Service is IT')
  await expect(
    page.getByRole('listitem', {name: 'Radio item 1'})
  ).toContainText('Controls 1 input')
  await screenshots.getByRole('button', {name: 'File settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Screenshots'})
  await sheet
    .getByRole('radiogroup', {name: 'Disable this input'})
    .getByRole('radio', {name: 'When…'})
    .click()
  // A new rule starts on the closest input above
  const input = sheet.getByRole('button', {name: /Input of rule 1/}).last()
  await expect(input).toContainText('Description')
  await expect(screenshots).toContainText('Disabled if Description is')
  await expect(screenshots).toContainText(
    'Its rule on Description has no value'
  )
})

test('asks before deleting an input that rules use', async ({mount, page}) => {
  await mount(<Builder />)
  await page
    .getByRole('listitem', {name: 'Radio item 1'})
    .getByRole('button', {name: 'Remove Radio'})
    .click()
  const dialog = page.getByRole('dialog', {name: 'Delete Service?'})
  await expect(dialog).toContainText('Screenshots depends on Service.')
  await dialog.getByRole('button', {name: 'Delete and remove rules'}).click()
  await expect(page.getByRole('listitem', {name: 'Radio item 1'})).toHaveCount(
    0
  )
  await expect(
    page.getByRole('listitem', {name: 'File item 2'})
  ).not.toContainText('Shown if')
})

test('mails pick their recipient and rules from the form', async ({
  mount,
  page
}) => {
  await mount(<Notifications />)
  await page.getByRole('tab', {name: 'Notifications'}).click()
  const helpdesk = page.getByRole('listitem', {name: 'Mail item 1'})
  await expect(helpdesk).toContainText('it-helpdesk@example.com')
  await expect(helpdesk).toContainText('When Service is IT')
  await expect(page.getByRole('listitem', {name: 'Mail item 2'})).toContainText(
    'To the Email input'
  )
  await helpdesk.getByRole('button', {name: 'Mail settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'IT helpdesk'})
  // Rules of a mail can use every input of the form
  await sheet
    .getByRole('button', {name: /Input of rule 1/})
    .last()
    .click()
  await expect(page.getByRole('option')).toHaveText([
    'Name',
    'Email',
    'Phone',
    'Service',
    'Description',
    'Screenshots',
    'How did we do last time?',
    'I agree to the privacy policy'
  ])
})

type Page = Parameters<Parameters<typeof test>[2]>[0]['page']

/** Drags a row by its header onto the top or bottom edge of another row */
async function dragOnto(
  page: Page,
  from: string,
  to: string,
  edge: 'top' | 'bottom'
) {
  const header = (name: string) =>
    page
      .getByRole('listitem', {name})
      .locator('[data-slot="sortable-list-item-header"]')
      .first()
  const start = (await header(from).boundingBox())!
  const end = (await header(to).boundingBox())!
  const x = start.x + 40
  const y = start.y + start.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 10, {steps: 3})
  const top = edge === 'top' ? end.y + 4 : end.y + end.height - 4
  await page.mouse.move(end.x + 60, top, {steps: 12})
  await page.mouse.up()
}

test('moves inputs into, out of and between sections', async ({
  mount,
  page
}) => {
  await mount(<Builder />)
  const form = page.getByRole('list', {name: 'Inputs'})
  const section = (label: string) =>
    form
      .getByRole('listitem', {name: /^Section/})
      .filter({hasText: label})
      .getByRole('list')
  const about = section('About you')
  const request = section('Your request')
  const names = (list: typeof form) =>
    list
      .locator('[data-slot="sortable-list-item-description"]')
      .allTextContents()

  // Into a section, before Phone
  await dragOnto(page, 'Check item 3', 'Phone item 3', 'top')
  await expect
    .poll(() => names(about))
    .toEqual(['Name', 'Email', 'I agree to the privacy policy', 'Phone'])
  await expect(form.getByRole('listitem', {name: /^Check/})).toHaveCount(1)

  // Out of a section into the form, its rule still uses Service
  await dragOnto(page, 'File item 3', 'Section item 2', 'top')
  const screenshots = form.getByRole('listitem', {name: 'File item 2'})
  await expect(screenshots).toContainText('Screenshots')
  await expect(screenshots).toContainText(
    'Its rule uses Service, which is below it'
  )

  // Between sections, before Description
  await dragOnto(page, 'Email item 2', 'Textarea item 2', 'top')
  await expect
    .poll(() => names(request))
    .toEqual(['Service', 'Email', 'Description', 'How did we do last time?'])

  // Sections stay in the form
  await dragOnto(page, 'Section item 1', 'Textarea item 3', 'top')
  await expect(form.getByRole('listitem', {name: /^Section/})).toHaveCount(2)
  await expect
    .poll(() => names(request))
    .toEqual(['Service', 'Email', 'Description', 'How did we do last time?'])
})

test('picks the options of a rule without closing the sheet', async ({
  mount,
  page
}) => {
  await mount(<Builder />)
  const screenshots = page.getByRole('listitem', {name: 'File item 3'})
  await screenshots.getByRole('button', {name: 'File settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Screenshots'})
  await sheet
    .getByRole('radiogroup', {name: 'Disable this input'})
    .getByRole('radio', {name: 'When…'})
    .click()
  await sheet
    .getByRole('button', {name: /Input of rule 1/})
    .last()
    .click()
  await page.getByRole('option', {name: 'Service'}).click()
  // The list focuses its first option as focus moves to its search field
  await sheet.locator('[data-slot="multiple-select-trigger"]').last().click()
  await expect(screenshots).toHaveAttribute('aria-current', 'true')
  await page.getByRole('option', {name: 'Facilities'}).click()
  await expect(screenshots).toHaveAttribute('aria-current', 'true')
  await expect(screenshots).toContainText('Disabled if Service is Facilities')
})
