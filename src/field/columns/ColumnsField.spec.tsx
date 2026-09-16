import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './ColumnsField.stories.js'

test('adds anonymous rows and columns from the restricted schema', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  await expect(page.getByRole('listitem', {name: 'Field row'})).toHaveCount(2)
  await page.getByRole('button', {name: 'Email field', exact: true}).click()
  await expect(page.getByRole('listitem', {name: 'Field row'})).toHaveCount(3)

  const row = page.getByRole('listitem', {name: 'Field row'}).last()
  await row.getByRole('button', {name: 'Add column'}).click()
  await page.getByRole('option', {name: 'Select field'}).click()
  await expect(row.getByText('Select field')).toBeVisible()
})

test('collapses rows and resizes a column pair with the keyboard', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const firstRow = page.getByRole('listitem', {name: 'Field row'}).first()
  const postalCode = firstRow.getByRole('textbox', {name: 'Label'}).first()
  await expect(postalCode).toBeVisible()

  const resizer = firstRow.getByRole('slider', {
    name: 'Resize columns 1 and 2'
  })
  await resizer.focus()
  await resizer.press('ArrowRight')
  await expect(resizer).toHaveAttribute('aria-valuetext', /4 and 8/)

  await firstRow.getByRole('button', {name: 'Collapse field row'}).click()
  await expect(postalCode).toHaveCount(0)
  await firstRow.getByRole('button', {name: 'Expand field row'}).click()
  await expect(
    firstRow.getByRole('textbox', {name: 'Label'}).first()
  ).toBeVisible()
})

test('inserts rows from the shared row actions menu', async ({mount, page}) => {
  await mount(<Example />)

  const firstRow = page.getByRole('listitem', {name: 'Field row'}).first()
  await firstRow
    .getByRole('button', {name: 'Text field settings'})
    .first()
    .click()
  await page.getByRole('textbox', {name: 'Label'}).last().fill('Address row')
  await expect(page.getByRole('textbox', {name: 'Anchor'})).toHaveValue(
    'address-row'
  )
  await expect(firstRow).toContainText('Address row')
  await page.keyboard.press('Escape')
  await firstRow.getByRole('button', {name: 'Field row actions'}).click()
  await page.getByRole('button', {name: 'Insert before'}).click()
  await page.getByRole('option', {name: 'Email field'}).click()

  await expect(page.getByRole('listitem', {name: 'Field row'})).toHaveCount(3)
  await expect(
    page.getByRole('listitem', {name: 'Field row'}).first()
  ).toContainText('Email field')
})
