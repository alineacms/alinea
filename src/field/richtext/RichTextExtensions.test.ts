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
  test.is(heading?.content?.[0]?.marks?.[0]?.attrs?.id, 'stable-anchor')
  editor.destroy()
})

test('updates a generated heading anchor when its text changes', () => {
  const editor = headingEditor('Original heading')
  editor.commands.setTextSelection(2)
  editor.commands.insertContent(' changed')

  const heading = editor.getJSON().content?.[0]
  test.is(heading?.attrs?._anchor, 'o-changedriginal-heading')
  test.is(
    heading?.content?.[0]?.marks?.[0]?.attrs?.id,
    'o-changedriginal-heading'
  )
  editor.destroy()
})

function headingEditor(text: string) {
  return new Editor({
    extensions: defaultExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: {level: 2},
          content: [{type: 'text', text}]
        }
      ]
    }
  })
}
