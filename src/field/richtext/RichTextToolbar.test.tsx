import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Editor} from '@tiptap/core'
import {defaultExtensionConfig} from './RichTextExtensions.js'
import {RichTextToolbar} from './RichTextToolbar.js'

afterEach(cleanup)

test('marks the heading and alignment menus only for non-default values', async () => {
  const editor = new Editor({
    extensions: Object.values(defaultExtensionConfig()),
    content: '<p>Text</p>'
  })
  try {
    render(
      <RichTextToolbar
        editor={editor}
        ownerId="body"
        getEntryAnchors={() => []}
        onFocusChange={() => {}}
      />
    )
    const headings = () =>
      screen.getByRole('button', {name: /Normal text|Heading 2/})
    const alignment = () => screen.getByRole('button', {name: 'Alignment'})
    expect(headings().hasAttribute('data-active')).toBe(false)
    expect(alignment().hasAttribute('data-active')).toBe(false)

    act(() => {
      editor.chain().setHeading({level: 2}).setTextAlign('center').run()
    })
    expect(headings().textContent).toContain('Heading 2')
    expect(headings().hasAttribute('data-active')).toBe(true)
    expect(alignment().hasAttribute('data-active')).toBe(true)

    await act(async () => fireEvent.click(headings()))
    const checked = screen
      .getAllByRole('menuitemcheckbox')
      .filter(item => item.getAttribute('aria-checked') === 'true')
    expect(checked.map(item => item.textContent)).toEqual(['Heading 2'])
    expect(screen.getByRole('menuitem', {name: 'Normal text'})).toBeDefined()
  } finally {
    editor.destroy()
  }
})
