import {suite} from '@alinea/suite'
import {RichTextEditor} from 'alinea/core'
import type {TextDoc} from 'alinea/core/TextDoc'

const test = suite(import.meta)

test('parse html nodes & marks', () => {
  const editor = new RichTextEditor()
  const html =
    '<p><strong><i>bold</i></strong><em>italic</em><b></b><u>underline</u> <s>strike</s> <a href="https://example.com">link</a></p>'
  editor.addHtml(html)
  test.equal(editor.value(), [
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

test('parses strong', () => {
  const htmlExample = `
    <p><strong>Lorem&rsquo;s Ipsum&nbsp;</strong></p>
    <p>Normal text.</p>
  `
  const value = new RichTextEditor().addHtml(htmlExample).value()
  const expectedDoc = [
    {
      _type: 'paragraph',
      content: [
        {
          _type: 'text',
          text: 'Lorem’s Ipsum\u00a0',
          marks: [
            {
              _type: 'bold'
            }
          ]
        }
      ]
    },
    {
      _type: 'text',
      text: '\n    '
    },
    {
      _type: 'paragraph',
      content: [
        {
          _type: 'text',
          text: 'Normal text.'
        }
      ]
    }
  ]

  test.equal(value, expectedDoc)
})

