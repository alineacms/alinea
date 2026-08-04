import {suite} from '@alinea/suite'
import {Editor} from '@tiptap/core'
import '#test/react.js'
import {defaultExtensions} from './RichTextExtensions.js'

const test = suite(import.meta)

test('keeps a custom heading anchor when its text changes', () => {
  const editor = headingEditor('Original heading')
  editor.commands.setTextSelection(2)
  editor.commands.setAnchor({id: 'stable-anchor'})
  editor.commands.insertContent(' changed')

  const heading = editor.getJSON().content?.[0]
  test.is(heading?.attrs?._anchor, 'stable-anchor')
  test.is(heading?.content?.[0]?.marks, undefined)
  test.is(editor.getHTML().includes('id="stable-anchor"'), true)
  test.is(editor.getHTML().includes('data-anchor="stable-anchor"'), true)
  test.is(editor.getHTML().includes('_anchor'), false)
  editor.destroy()
})

test('updates a generated heading anchor when its text changes', () => {
  const editor = headingEditor('Original heading')
  editor.commands.setTextSelection(2)
  editor.commands.insertContent(' changed')

  const heading = editor.getJSON().content?.[0]
  test.is(heading?.attrs?._anchor, 'o-changedriginal-heading')
  test.is(heading?.content?.[0]?.marks, undefined)
  editor.destroy()
})

test('updates a suffixed generated anchor when its text changes', () => {
  const editor = headingEditor('Original heading', [], 'original-heading-2')
  editor.commands.setTextSelection(2)
  editor.commands.insertContent(' changed')

  const heading = editor.getJSON().content?.[0]
  test.is(heading?.attrs?._anchor, 'o-changedriginal-heading')
  test.is(heading?.content?.[0]?.marks, undefined)
  editor.destroy()
})

test('avoids anchors used by another field in the entry', () => {
  const editor = headingEditor('Original heading', ['o-changedriginal-heading'])
  editor.commands.setTextSelection(2)
  editor.commands.insertContent(' changed')

  const heading = editor.getJSON().content?.[0]
  test.is(heading?.attrs?._anchor, 'o-changedriginal-heading-2')
  test.is(heading?.content?.[0]?.marks, undefined)
  editor.destroy()
})

test('drops the anchor when converting a heading to a paragraph', () => {
  const editor = headingEditor('Original heading')
  editor.commands.setTextSelection(2)
  editor.commands.setAnchor({id: 'stable-anchor'})
  editor.commands.setParagraph()

  const paragraph = editor.getJSON().content?.[0]
  test.is(paragraph?.type, 'paragraph')
  test.is(paragraph?.attrs?._anchor, undefined)
  test.is(paragraph?.content?.[0]?.marks, undefined)
  test.is(editor.getHTML().includes('stable-anchor'), false)
  editor.destroy()
})

test('generates an anchor when inserting before a custom heading', () => {
  const editor = headingEditor('Original heading')
  editor.commands.setTextSelection(2)
  editor.commands.setAnchor({id: 'stable-anchor'})
  editor.commands.insertContentAt(0, {
    type: 'heading',
    attrs: {level: 2},
    content: [{type: 'text', text: 'New heading'}]
  })

  const [inserted, original] = editor.getJSON().content ?? []
  test.is(inserted?.attrs?._anchor, 'new-heading')
  test.is(original?.attrs?._anchor, 'stable-anchor')
  editor.destroy()
})

function headingEditor(
  text: string,
  entryAnchors: Array<string> = [],
  anchor?: string
) {
  return new Editor({
    extensions: defaultExtensions(() => entryAnchors),
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: {level: 2, _anchor: anchor},
          content: [
            {
              type: 'text',
              text,
              marks: anchor
                ? [{type: 'anchor', attrs: {id: anchor}}]
                : undefined
            }
          ]
        }
      ]
    }
  })
}
