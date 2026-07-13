import {expect, test} from '@playwright/experimental-ct-react'
import {
  RichTextBlockEditingStory,
  RichTextFixtureBlocksStory,
  RichTextNestedBlockStory
} from './RichTextField.story.js'

/*
 * Investigation notes:
 *
 * This is the smallest reliable reproduction of the current failure:
 * a populated Tiptap block NodeView renders the dashboard NodeEditor /
 * FieldsEditor, then Enter is pressed in a paragraph outside that block.
 * React 19 throws from commitBeforeMutationEffects while ProseMirror is
 * synchronously replacing DOM nodes for the Enter transaction:
 * "Cannot read properties of null (reading 'parentNode')".
 *
 * The plain Tiptap editor, an empty block NodeView, and a populated block
 * with only a simple text field do not reproduce it. Removing NodeEditor
 * from the NodeView also removes it. Therefore the project-specific
 * boundary is the React dashboard field editor mounted inside the
 * ProseMirror-managed DOM; Select alone is not the cause.
 *
 * React is attempting to preserve the browser selection after ProseMirror
 * has detached the old selection node. The default Tiptap setup does not
 * mount this nested dashboard form inside its NodeView.
 */
test('rich text field inserts a block after a newline', async ({
  mount,
  page
}) => {
  const pageErrors: Array<string> = []
  page.on('pageerror', error => {
    pageErrors.push(error.stack ?? error.message)
  })
  await mount(<RichTextFixtureBlocksStory />)

  await expect(page.getByTestId('value')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Quote actions'})).toBeVisible()

  await page
    .locator('.ProseMirror')
    .first()
    .getByText('This fixture page includes rich text blocks so the v2 insert menu has something real to work with.')
    .click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', {name: 'Insert block'}).click()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  expect(pageErrors).toEqual([])
  await expect(page.getByText('Call to action')).toHaveCount(2)
})

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

test('rich text field creates a new paragraph on Enter', async ({
  mount,
  page
}) => {
  await mount(<RichTextBlockEditingStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('After the block.').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Following paragraph.')

  await expect(editor.locator(':scope > p')).toHaveCount(3)
  await expect(editor).toContainText('Following paragraph.')
})
