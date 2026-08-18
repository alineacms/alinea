import {RichTextEditor} from '#/core.js'
import type {TextDoc} from '#/core/TextDoc.js'
import {type as createType} from '#/core/Type.js'
import {text} from '#/field/text/TextField.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

test('appends typed blocks with an id', () => {
  const blocks = {
    Callout: createType('Callout', {
      fields: {title: text('Title')}
    })
  }
  const initial = [
    {_type: 'paragraph', content: [{_type: 'text', text: 'Before'}]}
  ] satisfies TextDoc
  const editor = new RichTextEditor<typeof blocks>(initial)

  const returned = editor.add('Callout', {title: 'Hello'})
  const block = editor.value()[1] as {
    _id: string
    _type: 'Callout'
    title: string
  }

  test.is(returned, editor)
  test.is(editor.value()[0], initial[0])
  test.equal(block, {
    _id: block._id,
    _type: 'Callout',
    title: 'Hello'
  })
  test.is(typeof block._id, 'string')
})

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

test('concatenates adjacent plain text segments', () => {
  const value = new RichTextEditor().addHtml('<p>a<!-- split -->b</p>').value()
  test.equal(value, [
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'ab'}]
    }
  ] satisfies TextDoc)
})

test('concatenates adjacent text segments with identical marks', () => {
  const value = new RichTextEditor()
    .addHtml('<p><strong>a</strong><strong>b</strong></p>')
    .value()
  test.equal(value, [
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'ab', marks: [{_type: 'bold'}]}]
    }
  ] satisfies TextDoc)
})

test('keeps spaces between marked text segments', () => {
  const value = new RichTextEditor().addHtml('<p><b>a</b> <b>c</b></p>').value()
  test.equal(value, [
    {
      _type: 'paragraph',
      content: [
        {_type: 'text', text: 'a', marks: [{_type: 'bold'}]},
        {_type: 'text', text: ' '},
        {_type: 'text', text: 'c', marks: [{_type: 'bold'}]}
      ]
    }
  ] satisfies TextDoc)
})

test('applies outer marks on close tag for nested marks', () => {
  const value = new RichTextEditor()
    .addHtml('<p><strong>a<i>b</i>c</strong></p>')
    .value()
  test.equal(value, [
    {
      _type: 'paragraph',
      content: [
        {_type: 'text', text: 'a', marks: [{_type: 'bold'}]},
        {
          _type: 'text',
          text: 'b',
          marks: [{_type: 'bold'}, {_type: 'italic'}]
        },
        {_type: 'text', text: 'c', marks: [{_type: 'bold'}]}
      ]
    }
  ] satisfies TextDoc)
})
