import {expect, test} from '@playwright/experimental-ct-react'
import type {Page} from 'playwright'
import {
  RichTextLargeStory,
  RichTextPlainStory,
  RichTextStory
} from './RichTextField.story.js'

const pageErrors = new WeakMap<Page, Array<string>>()

test.beforeEach(async ({page}) => {
  const errors: Array<string> = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.stack ?? error.message))
})

test.afterEach(async ({page}) => {
  // Let state updates scheduled by the final interaction reach React's commit
  // phase before deciding that the scenario completed without a DOM error.
  await page.waitForTimeout(50)
  expect(pageErrors.get(page)).toEqual([])
})

async function expectNoPageErrors(page: Page) {
  await page.waitForTimeout(50)
  expect(pageErrors.get(page)).toEqual([])
}

test('renders a rich text field without an embedded block schema', async ({
  mount,
  page
}) => {
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(<RichTextPlainStory />)

  await expect(page.locator('.ProseMirror').first()).toContainText(
    'Select this text'
  )
  expect(errors).toEqual([])
})

test('edits the end of a large document', async ({mount, page}) => {
  await mount(<RichTextLargeStory />)

  const editor = page.locator('.ProseMirror').first()
  const lastParagraph = editor.getByText('Large document paragraph 500', {
    exact: true
  })
  await expect(lastParagraph).toBeVisible()
  await lastParagraph.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Edited')

  await expect(editor.locator('p').last()).toHaveText(
    'Large document paragraph 500 Edited'
  )
  await expect(page.getByTestId('value')).toContainText(
    'Large document paragraph 500 Edited'
  )
})

test('inserts, splits and joins ordinary text', async ({mount, page}) => {
  await mount(<RichTextPlainStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('Select this text', {exact: false}).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Added')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Temporary paragraph')
  await page.keyboard.press('Home')
  await page.keyboard.press('Backspace')

  await expect(editor).toContainText('AddedTemporary paragraph')
})

test('creates, edits and exits a list', async ({mount, page}) => {
  await mount(<RichTextPlainStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('Press Enter', {exact: false}).click()
  await page.getByRole('button', {name: 'Bullet list'}).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Second list item')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('After the list')

  await expect(editor.locator('li')).toHaveCount(2)
  await expect(editor.locator('li').last()).toContainText('Second list item')
  await expect(editor).toContainText('After the list')
})

test('moves text across an embedded block with cut and paste', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('Before the block.', {exact: true}).click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  await page.keyboard.press('Control+x')
  await editor.getByText('After the block.', {exact: true}).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ')
  await page.keyboard.press('Control+v')

  await expect(editor).toContainText('After the block. Before the block.')
  await expect(page.getByRole('button', {name: 'Callout actions'})).toHaveCount(
    1
  )
})

test('preserves rich formatting when copying and pasting', async ({
  mount,
  page
}) => {
  await mount(<RichTextPlainStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.evaluate(element => {
    const paragraph = element.querySelector('p')
    const text = paragraph?.firstChild
    if (!text) throw new Error('Paste target not found')
    const range = document.createRange()
    range.setStart(text, text.textContent?.length ?? 0)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', ' Pasted bold')
    clipboard.setData('text/html', '<strong> Pasted bold</strong>')
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard
      })
    )
  })

  await expect(editor.locator('strong')).toHaveText('Pasted bold')
})

test('edits text around a React-owned block without page errors', async ({
  mount,
  page
}) => {
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(error.stack ?? error.message))
  await mount(<RichTextStory />)

  const segments = page.locator('.ProseMirror')
  await segments.first().getByText('Before the block.').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('A new paragraph.')
  await page.waitForTimeout(100)

  expect(errors).toEqual([])
  await expect(segments.first()).toContainText('A new paragraph.')
  await expect(page.getByText('Important')).toBeVisible()
})

test('edits nested rich text inside an embedded block', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const block = page.locator('[data-richtext-block="true"]')
  await expect(block).toHaveCSS('border-radius', '8px')
  await expect(block).toHaveCSS('margin', '14px 0px')
  await expect(block.locator('[data-richtext-block-editor="true"]')).toHaveCSS(
    'padding',
    '8px 16px 16px'
  )
  await expect(page.getByText('Details', {exact: true})).toBeVisible()
  await expect(
    page.locator('.ProseMirror').getByText('Nested details.')
  ).toBeVisible()
})

test('selects text in block fields without dragging the block', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const block = page.locator('[data-richtext-block="true"]').first()
  const host = page.locator('[data-richtext-block-host]').first()
  const handle = page.getByLabel('Drag Callout block').first()
  const title = page.getByRole('textbox', {name: 'Title'})
  await expect(host).not.toHaveAttribute('draggable', 'true')
  await expect(handle).toHaveAttribute('draggable', 'true')

  const bounds = await title.boundingBox()
  if (!bounds) throw new Error('Block title bounds not found')
  await page.mouse.move(bounds.x + 8, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width - 8,
    bounds.y + bounds.height / 2,
    {steps: 8}
  )
  await page.mouse.up()

  const selected = await title.evaluate(input => {
    const element = input as HTMLInputElement
    return Math.abs((element.selectionEnd ?? 0) - (element.selectionStart ?? 0))
  })
  expect(selected).toBeGreaterThan(0)
  await expect(title).toHaveValue('Important')
  const value = await page.getByTestId('value').textContent()
  expect(value?.indexOf('Before the block.')).toBeLessThan(
    value?.indexOf('callout-1') ?? -1
  )
})

test('selects and edits nested rich text without dragging the block', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const fields = page.locator('[data-richtext-field]')
  const nestedField = fields.nth(1)
  const nestedEditor = nestedField.locator('.ProseMirror')
  const nestedText = nestedEditor.getByText('Nested details.', {exact: true})
  const bounds = await nestedText.boundingBox()
  if (!bounds) throw new Error('Nested rich text bounds not found')

  await page.mouse.move(bounds.x + 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height / 2,
    {
      steps: 8
    }
  )
  await page.mouse.up()

  const selected = await nestedEditor.evaluate(() =>
    window.getSelection()?.toString().trim()
  )
  expect(selected).toContain('Nested details')

  await nestedText.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Another nested paragraph.')
  await expect(nestedEditor).toContainText('Another nested paragraph.')

  const value = await page.getByTestId('value').textContent()
  expect(value?.indexOf('Before the block.')).toBeLessThan(
    value?.indexOf('callout-1') ?? -1
  )
  expect(value?.indexOf('callout-1')).toBeLessThan(
    value?.indexOf('After the block.') ?? -1
  )
})

test('keeps the owning rich text toolbar open while focus moves', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const fields = page.locator('[data-richtext-field]')
  const outerOwner = await fields.first().getAttribute('data-richtext-field')
  const nestedOwner = await fields.nth(1).getAttribute('data-richtext-field')
  if (!outerOwner || !nestedOwner) throw new Error('Rich text owners not found')
  await page
    .locator('.ProseMirror')
    .first()
    .getByText('Before the block.')
    .click()

  const toolbar = page.locator('[data-richtext-toolbar="true"]')
  await expect(toolbar).toBeVisible()
  await expect(toolbar).toHaveCSS('display', 'flex')
  await expect(toolbar).toHaveCSS('height', '40px')
  await expect(toolbar).toHaveCSS('padding', '4px 12px')
  const boldButton = page.getByRole('button', {name: 'Bold'})
  await expect(boldButton).toHaveCSS('border-radius', '8px')
  await expect(boldButton.locator('[data-slot="icon"]')).toHaveCSS(
    'font-size',
    '18px'
  )
  await expect(toolbar).toHaveAttribute(
    'data-richtext-toolbar-owner',
    outerOwner
  )

  await page.getByRole('textbox', {name: 'Title'}).fill('Inner field')
  await expect(fields.first()).not.toHaveAttribute('data-focused', 'true')

  await page.getByRole('textbox', {name: 'Title'}).fill('Still important')
  await expect(toolbar).toHaveAttribute(
    'data-richtext-toolbar-owner',
    outerOwner
  )

  await page.locator('.ProseMirror').getByText('Nested details.').click()
  await expect(fields.first()).not.toHaveAttribute('data-focused', 'true')
  await expect(toolbar).toHaveCount(1)
  await expect(toolbar).toHaveAttribute(
    'data-richtext-toolbar-owner',
    nestedOwner
  )
})

test('keeps toolbar popouts open', async ({mount, page}) => {
  await mount(<RichTextStory />)

  await page
    .locator('.ProseMirror')
    .first()
    .getByText('Before the block.')
    .click()
  await page.getByRole('button', {name: 'Normal text'}).click()

  await expect(page.getByRole('menuitem', {name: 'Heading 1'})).toBeVisible()
  await expect(page.locator('[data-richtext-toolbar="true"]')).toBeVisible()

  await page.getByRole('menuitem', {name: 'Heading 1'}).click()
  await expect(page.getByRole('menuitem', {name: 'Heading 1'})).toBeHidden()
  await expect(page.locator('[data-richtext-toolbar="true"]')).toBeVisible()
})

test('duplicates and deletes embedded blocks', async ({mount, page}) => {
  await mount(<RichTextStory />)

  await page.getByRole('button', {name: 'Callout actions'}).click()
  await page.getByRole('button', {name: 'Duplicate'}).click()
  await expect(page.getByRole('textbox', {name: 'Title'})).toHaveCount(2)

  await page.getByRole('button', {name: 'Callout actions'}).first().click()
  await page.getByRole('button', {name: 'Delete'}).click()
  await expect(page.getByRole('textbox', {name: 'Title'})).toHaveCount(1)
})

/**
 * Regression: a block form can look updated while the surrounding rich-text
 * value still contains its previous object. This must cross the real
 * NodeEditor -> ReactiveNode -> root field boundary; the unit-level atom test
 * alone cannot prove that dashboard field controls commit their values.
 */
test('persists embedded field and nested rich-text edits', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const title = page.getByRole('textbox', {name: 'Title'})
  await title.fill('Persisted title')
  await page
    .locator('.ProseMirror')
    .first()
    .getByText('After the block.')
    .click()
  await expect(
    page.locator('[data-richtext-block-host]').first()
  ).toHaveAttribute('data-debug-block-value', /Persisted title/)
  await expect(page.getByTestId('value')).toContainText(
    '"title":"Persisted title"'
  )

  const nested = page
    .locator('[data-richtext-field]')
    .nth(1)
    .locator('.ProseMirror')
  await nested.getByText('Nested details.').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Persisted details.')
  await page
    .locator('.ProseMirror')
    .first()
    .getByText('After the block.')
    .click()
  await expect(page.getByTestId('value')).toContainText('Persisted details.')
})

/**
 * ProseMirror history restores the deleted atom node after Jotai has removed
 * its live ReactiveNode. The node therefore carries a recovery snapshot. The
 * snapshot is not the rendering source; it is only used when no live block
 * with that id exists.
 */
test('undoes block deletion without losing edited field values', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const title = page.getByRole('textbox', {name: 'Title'})
  await title.fill('Keep this value')
  await page
    .locator('.ProseMirror')
    .first()
    .getByText('After the block.')
    .click()
  await expect(page.getByTestId('value')).toContainText('Keep this value')

  await page.getByRole('button', {name: 'Callout actions'}).click()
  await page.getByRole('button', {name: 'Delete'}).click()
  await expect(title).toHaveCount(0)

  const editor = page.locator('.ProseMirror').first()
  await editor.click()
  await page.keyboard.press('Control+z')

  await expect(page.getByRole('textbox', {name: 'Title'})).toHaveValue(
    'Keep this value'
  )
  await expect(page.getByTestId('value')).toContainText('Keep this value')
})

/**
 * Tiptap is intentionally uncontrolled while the user types, but dashboard
 * reset/reload operations update the Jotai field from outside ProseMirror.
 * Structural external changes must replace the editor document without
 * treating nested block-field keystrokes as whole-document replacements.
 */
test('synchronizes external replacements and resets', async ({mount, page}) => {
  await mount(<RichTextStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('Before the block.').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Changed')
  await expect(editor).toContainText('Changed')

  await page.getByRole('button', {name: 'Reset body'}).dispatchEvent('click')
  await expect(editor).not.toContainText('Changed')
  await expect(editor).toContainText('Before the block.')

  await page.getByRole('button', {name: 'Replace body'}).dispatchEvent('click')
  await expect(editor).toHaveText('Externally replaced.')
  await expect(page.getByRole('button', {name: 'Callout actions'})).toHaveCount(
    0
  )
})

test('inserts a block at the active text position', async ({mount, page}) => {
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(<RichTextStory />)

  await page
    .locator('.ProseMirror')
    .first()
    .getByText('Before the block.')
    .click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', {name: 'Insert block'}).click()
  await page.getByRole('menuitem', {name: 'Callout'}).click()

  await expect(page.getByRole('button', {name: 'Callout actions'})).toHaveCount(
    2
  )
  await expect(page.getByTestId('value')).not.toContainText(
    '{"_type":"paragraph"}'
  )
  expect(errors).toEqual([])
})

/**
 * Regression: inserting a field-heavy block used to throw twice with:
 *
 *   Cannot read properties of null (reading 'parentNode')
 *   at commitBeforeMutationEffects (react-dom-client)
 *
 * Reproduction before the fix:
 * 1. Put the caret in an empty paragraph of the outer ProseMirror editor.
 * 2. Open the floating insert menu. Focus moves from ProseMirror to its menu.
 * 3. Insert a CTA containing code, selects, nested rich text and a checkbox.
 * 4. `insertBlock` called `.focus()` before `insertContent()`, making the outer
 *    contenteditable active again while React mounted the CTA's portal tree.
 * 5. React's selection-preservation pass traversed the ProseMirror-owned DOM
 *    during that mount and followed a node which ProseMirror had detached.
 *
 * The insert menu does not destroy the ProseMirror selection when it receives
 * focus, so `insertBlock` can insert at that retained selection without calling
 * `.focus()`. Keeping focus on the menu until insertion finishes prevents the
 * overlapping selection traversal. This test deliberately uses the complex
 * field mix which exposed the timing issue and records every uncaught page
 * error; checking only that the block appears would miss the React exception.
 */
test('inserts a complex CTA block without a detached DOM error', async ({
  mount,
  page
}) => {
  const errors: Array<string> = []
  page.on('pageerror', error => errors.push(error.stack ?? error.message))
  await mount(<RichTextStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('Before the block.').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', {name: 'Insert block'}).click()
  await page.getByRole('menuitem', {name: 'Call to action'}).click()

  await expect(page.getByRole('textbox', {name: 'CTA title'})).toBeVisible()
  await expect(page.getByText('Action code', {exact: true})).toBeVisible()
  await expect(page.getByText('CTA details', {exact: true})).toBeVisible()
  await expect(page.getByText('Featured', {exact: true})).toBeVisible()

  await page.waitForTimeout(100)
  expect(errors).toEqual([])
})

/**
 * Regression: moving from a nested editor back to its outer editor and typing
 * used to throw from React's `commitBeforeMutationEffects` selection walk.
 *
 * React treats an active `contenteditable="true"` element as React-managed rich
 * text and traverses its complete DOM before every commit so it can restore the
 * selection afterwards. That assumption is invalid here: ProseMirror owns the
 * outer document and nested ProseMirror editors mutate their DOM independently,
 * while React owns only the block forms mounted into stable node-view hosts.
 * After editing nested rich text, React could therefore follow a ProseMirror
 * node which had already been detached and read `parentNode` from null.
 *
 * The editor host is marked `contenteditable="plaintext-only"`. It remains a
 * browser editing host, but React no longer mistakes it for React-managed rich
 * text. ProseMirror continues to own selection restoration, commands, rich
 * clipboard parsing, lists and drag/drop. This scenario crosses both editor
 * boundaries after editing every common block-control shape, and the global
 * page-error guard makes the original exception fail this test directly.
 */
test('edits complex block controls and moves between nested editors', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const outerEditor = page.locator('.ProseMirror').first()
  await expect(outerEditor).toHaveAttribute('contenteditable', 'plaintext-only')
  await outerEditor.getByText('Before the block.', {exact: true}).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.getByRole('button', {name: 'Insert block'}).click()
  await page.getByRole('menuitem', {name: 'Call to action'}).click()

  const title = page.getByRole('textbox', {name: 'CTA title'})
  await title.click()
  await page.keyboard.type('Ship it')
  await expect(title).toHaveValue('Ship it')
  await expectNoPageErrors(page)
  const text = page.getByRole('textbox', {name: 'CTA text'})
  await text.fill('Read the release')
  await expect(text).toHaveValue('Read the release')
  await expectNoPageErrors(page)
  const code = page.getByRole('textbox', {name: 'Action code'})
  await code.fill('console.log("cta")')
  await expect(code).toHaveValue('console.log("cta")')
  await expectNoPageErrors(page)
  await page.getByRole('checkbox', {name: 'Featured'}).check({force: true})
  await expectNoPageErrors(page)
  await page.getByRole('button', {name: 'Remove Header'}).click()
  await expectNoPageErrors(page)

  const nestedEditor = page.locator('[data-richtext-field]').last()
  await nestedEditor.locator('.ProseMirror').click()
  await page.keyboard.type('Nested CTA details')
  await expectNoPageErrors(page)
  await outerEditor.getByText('After the block.', {exact: true}).click()
  await page.keyboard.press('Home')
  await page.keyboard.type('Still editing. ')
  await expectNoPageErrors(page)

  await expect(outerEditor).toContainText('Still editing.')
})

test('survives a mixed editing session around several blocks', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('Before the block.', {exact: true}).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' One')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Two')
  await page.getByRole('button', {name: 'Bullet list'}).click()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Three')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.getByRole('button', {name: 'Insert block'}).click()
  await page.getByRole('menuitem', {name: 'Callout'}).click()

  await page.getByRole('textbox', {name: 'Title'}).last().fill('Second block')
  await editor.getByText('After the block.', {exact: true}).click()
  await page.keyboard.press('Control+a')
  await page.getByRole('button', {name: 'Italic'}).click()
  await page.getByRole('button', {name: 'Callout actions'}).first().click()
  await page.getByRole('button', {name: 'Duplicate'}).click()

  const blocks = page.locator('[data-richtext-block="true"]')
  await blocks.first().locator('[data-richtext-block-header="true"]').hover()
  await page.getByLabel('Drag Callout block').first().dragTo(blocks.last())

  await expect(page.getByRole('textbox', {name: 'Title'})).toHaveCount(3)
})

test('applies toolbar formatting to the active segment', async ({
  mount,
  page
}) => {
  await mount(<RichTextStory />)

  await page
    .locator('.ProseMirror')
    .first()
    .getByText('Before the block.')
    .click()
  await page.keyboard.press('Control+A')
  await page.getByRole('button', {name: 'Bold'}).click()

  const value = await page.getByTestId('value').textContent()
  expect(value?.match(/"_type":"bold"/g)).toHaveLength(2)
})

test('drags a single block to another text position', async ({mount, page}) => {
  await mount(<RichTextStory />)

  const block = page.locator('[data-richtext-block="true"]')
  await block.locator('[data-richtext-block-header="true"]').hover()
  await page
    .getByLabel('Drag Callout block')
    .dragTo(page.getByText('After the block.', {exact: true}))

  const value = await page.getByTestId('value').textContent()
  expect(value?.indexOf('After the block.')).toBeLessThan(
    value?.indexOf('callout-1') ?? -1
  )
})

test('disallows embedded blocks inside list items', async ({mount, page}) => {
  await mount(<RichTextStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('After the block.', {exact: true}).click()
  await page.getByRole('button', {name: 'Bullet list'}).click()
  await editor.getByText('After the block.', {exact: true}).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', {name: 'Insert block'})).toHaveCount(0)

  const block = page.locator('[data-richtext-block="true"]')
  await block.locator('[data-richtext-block-header="true"]').hover()
  await page
    .getByLabel('Drag Callout block')
    .dragTo(editor.locator('li').last())

  await expect(editor.locator('li [data-richtext-block-host]')).toHaveCount(0)
  await expect(
    editor.locator(':scope > [data-richtext-block-host]')
  ).toHaveCount(1)
})

test('disallows embedded blocks inside tables', async ({mount, page}) => {
  await mount(<RichTextStory />)

  const editor = page.locator('.ProseMirror').first()
  await editor.getByText('After the block.', {exact: true}).click()
  await page.getByRole('button', {name: 'Table'}).click()
  await page.getByRole('menuitem', {name: 'Insert table'}).click()

  const cell = editor.locator('td').first()
  await cell.click()
  await expect(page.getByRole('button', {name: 'Insert block'})).toHaveCount(0)

  const block = page.locator('[data-richtext-block="true"]')
  await block.locator('[data-richtext-block-header="true"]').hover()
  await page.getByLabel('Drag Callout block').dragTo(cell)

  await expect(cell.locator('[data-richtext-block-host]')).toHaveCount(0)
  await expect(
    editor.locator(':scope > [data-richtext-block-host]')
  ).toHaveCount(1)
})

test('reorders embedded blocks by dragging', async ({mount, page}) => {
  await mount(<RichTextStory />)

  await page.getByRole('button', {name: 'Callout actions'}).click()
  await page.getByRole('button', {name: 'Duplicate'}).click()
  const titles = page.getByRole('textbox', {name: 'Title'})
  await titles.nth(1).fill('Second')

  const blocks = page.locator('[data-richtext-block="true"]')
  const handles = page.getByLabel('Drag Callout block')
  await blocks.first().locator('[data-richtext-block-header="true"]').hover()
  await expect(handles.first()).toBeVisible()
  const targetBounds = await blocks.last().boundingBox()
  if (!targetBounds) throw new Error('Drop target not found')
  await handles.first().dragTo(blocks.last(), {
    targetPosition: {x: targetBounds.width / 2, y: targetBounds.height - 1}
  })

  await expect(titles.first()).toHaveValue('Second')
  await expect(titles.last()).toHaveValue('Important')
})

test('undoes and redoes text changes', async ({mount, page}) => {
  await mount(<RichTextStory />)

  const segment = page.locator('.ProseMirror').first()
  await segment.getByText('Before the block.').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Changed')
  await page.keyboard.press('Control+z')
  await expect(segment).not.toContainText('Changed')
  await page.keyboard.press('Control+Shift+z')
  await expect(segment).toContainText('Changed')
})
