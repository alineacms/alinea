import {expect, test} from '@playwright/experimental-ct-react'
import {
  RichTextBlockEditingStory,
  RichTextNestedBlockStory
} from './RichTextField.story.js'

test('rich text field edits a block', async ({mount, page}) => {
  const pageErrors: Array<string> = []
  page.on('pageerror', error => {
    pageErrors.push(error.stack ?? error.message)
  })

  await mount(<RichTextBlockEditingStory />)

  await expect(page.getByTestId('value')).toBeVisible()
  await expect(page.getByText('Call to action')).toBeVisible()

  await page
    .locator('.ProseMirror')
    .first()
    .getByText('After the block.')
    .click()
  await page.keyboard.type(' More text.')

  await expect(page.locator('.ProseMirror').first()).toContainText(
    'After the block. More text.'
  )
  expect(pageErrors).toEqual([])
})

test('rich text field deletes a block', async ({mount, page}) => {
  const pageErrors: Array<string> = []
  page.on('pageerror', error => {
    pageErrors.push(error.stack ?? error.message)
  })

  await mount(<RichTextBlockEditingStory />)

  await expect(page.getByTestId('value')).toBeVisible()
  await expect(page.getByText('Call to action')).toBeVisible()

  await page.getByRole('button', {name: 'Call to action actions'}).click()
  await page.getByRole('button', {name: 'Delete'}).click()

  await expect(page.getByText('Call to action')).toBeHidden()
  expect(pageErrors).toEqual([])
})

test('rich text field duplicates a block', async ({mount, page}) => {
  const pageErrors: Array<string> = []
  page.on('pageerror', error => {
    pageErrors.push(error.stack ?? error.message)
  })

  await mount(<RichTextBlockEditingStory />)

  await expect(page.getByTestId('value')).toBeVisible()
  await expect(page.getByText('Call to action')).toBeVisible()

  await page.getByRole('button', {name: 'Call to action actions'}).click()
  await page.getByRole('button', {name: 'Duplicate'}).click()

  await expect(page.getByText('Call to action')).toHaveCount(2)
  expect(pageErrors).toEqual([])
})

test('rich text field renders nested rich text inside a block', async ({
  mount,
  page
}) => {
  const pageErrors: Array<string> = []
  page.on('pageerror', error => {
    pageErrors.push(error.stack ?? error.message)
  })

  await mount(<RichTextNestedBlockStory />)

  await expect(page.getByTestId('value')).toBeVisible()
  await expect(page.getByText('Details', {exact: true})).toBeVisible()
  const nestedEditor = page.locator('.ProseMirror').nth(1)
  await expect(
    nestedEditor.getByText('Nested details before note.')
  ).toBeVisible()
  await expect(
    nestedEditor.getByText('Nested details after note.')
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})
