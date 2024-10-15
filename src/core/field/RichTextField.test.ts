import {RichTextEditor} from 'alinea/core'
import {TextDoc} from 'alinea/core/TextDoc'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('parse html nodes & marks', async () => {
  const editor = new RichTextEditor()
  const html =
    '<p><strong><i>bold</i></strong><em>italic</em><b></b><u>underline</u> <s>strike</s> <a href="https://example.com">link</a></p>'
  editor.addHtml(html)
  assert.equal(editor.value(), [
    {
      _type: 'paragraph',
      content: [
        {
          _type: 'text',
          text: 'bold',
          marks: [{_type: 'bold'}, {_type: 'italic'}]
        },
        {_type: 'text', text: 'italic', marks: [{_type: 'italic'}]},
        {_type: 'text', text: 'underline', marks: [{_type: 'underline'}]},
        {_type: 'text', text: ' '},
        {_type: 'text', text: 'strike', marks: [{_type: 'strike'}]},
        {_type: 'text', text: ' '},
        {
          _type: 'text',
          text: 'link',
          marks: [{_type: 'link', href: 'https://example.com'}]
        }
      ]
    }
  ] satisfies TextDoc)
})

test.run()
