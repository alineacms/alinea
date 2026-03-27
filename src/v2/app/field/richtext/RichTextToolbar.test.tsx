import {act, fireEvent, render} from '@testing-library/react'
import {Editor} from '@tiptap/react'
import {values} from 'alinea/core/util/Objects'
import {extensions as baseExtensions} from 'alinea/field/richtext/Extensions'
import 'alinea/v2/dom'
import {afterEach, expect, test} from 'bun:test'
import {RichTextToolbar} from './RichTextToolbar.js'

const editors = Array<Editor>()

afterEach(function cleanupEditors() {
  while (editors.length > 0) {
    editors.pop()?.destroy()
  }
})

test('renders the v2 rich text toolbar with v1 controls', () => {
  const editor = createEditor()
  const view = render(<RichTextToolbar editor={editor} enableTables />)

  expect(view.getByRole('button', {name: 'Normal text'})).toBeTruthy()
  expect(view.getByRole('button', {name: 'Bold'})).toBeTruthy()
  expect(view.getByRole('button', {name: 'Italic'})).toBeTruthy()
  expect(view.getByRole('button', {name: 'Table'})).toBeTruthy()
})

test('applies toolbar formatting commands to the editor', async () => {
  const editor = createEditor()
  editor.commands.setTextSelection({from: 1, to: 6})
  const view = render(<RichTextToolbar editor={editor} />)

  await act(async function toggleBold() {
    fireEvent.click(view.getByRole('button', {name: 'Bold'}))
  })

  expect(editor.isActive('bold')).toBe(true)
})

function createEditor() {
  const editor = new Editor({
    content: '<p>Hello world</p>',
    extensions: values(baseExtensions)
  })
  editors.push(editor)
  return editor
}
