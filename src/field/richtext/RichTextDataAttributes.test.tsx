import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Editor} from '@tiptap/core'
import {BulletList} from '@tiptap/extension-list'
import {defaultExtensionConfig} from './RichTextExtensions.js'
import {editorContent, editorDocument, editorNodes} from './RichTextDocument.js'
import {RichText} from '#/ui/RichText.js'

afterEach(cleanup)

test('custom extension data attributes survive saving and reach rendered views', () => {
  const extensions = defaultExtensionConfig()
  extensions.BulletList = BulletList.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        checklist: {
          default: null,
          renderHTML: attributes =>
            attributes.checklist ? {'data-checklist': 'true'} : {}
        }
      }
    }
  })
  const editor = new Editor({
    extensions: Object.values(extensions),
    content: '<ul><li>Checklist item</li></ul>'
  })
  try {
    editor.commands.setTextSelection(3)
    editor.commands.updateAttributes('bulletList', {checklist: true})
    const doc = editorNodes(editorDocument(editor))
    expect(doc[0]).toMatchObject({checklist: true, 'data-checklist': 'true'})
    render(<RichText doc={doc} />)
    expect(screen.getByRole('list').getAttribute('data-checklist')).toBe('true')
    editor.commands.setContent(editorContent(doc))
    expect(editorNodes(editorDocument(editor))).toEqual(doc)
    editor.commands.updateAttributes('bulletList', {checklist: null})
    expect(editorNodes(editorDocument(editor))[0]).not.toHaveProperty(
      'data-checklist'
    )
  } finally {
    editor.destroy()
  }
})
