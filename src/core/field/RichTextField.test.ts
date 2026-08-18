import {parseHTML, parseHTMLSync, RichTextEditor} from '#/core.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {Field} from '#/core/Field.js'
import type {TextDoc} from '#/core/TextDoc.js'
import {type as createType} from '#/core/Type.js'
import {workspace} from '#/core/Workspace.js'
import {richText} from '#/field/richtext/RichTextField.js'
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

test('resolves linked image data for queried rich text', async () => {
  const field = richText('Body')
  const value = [
    {
      _type: 'image',
      _id: 'image-1',
      _entry: 'media-1',
      _link: 'image',
      src: '/stale.jpg',
      alt: 'Stale alt text'
    }
  ] satisfies TextDoc
  const loader = {
    locale: 'fr',
    resolver: {
      config: {
        schema: {},
        workspaces: {
          main: workspace('Main', {
            source: 'content',
            mediaUrl: '/media',
            roots: {}
          })
        }
      }
    },
    async resolveLinks() {
      return [
        {
          id: 'media-1',
          url: '/image',
          workspace: 'main',
          location: 'image.jpg',
          alt: {en: 'English alt text', fr: 'Texte alternatif'}
        }
      ]
    }
  } as unknown as LinkResolver

  const queried = await Field.queryValue(field, value, loader)

  test.equal(queried, [
    {
      _type: 'image',
      _id: 'image-1',
      _entry: 'media-1',
      _link: 'image',
      src: '/media/image.jpg',
      alt: 'Texte alternatif'
    }
  ] satisfies TextDoc)
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

test('parses custom tags and marks synchronously', () => {
  const value = parseHTMLSync(
    '<p>Use <code data-language="ts">const value = 1</code>.</p><img src="cover.jpg" alt="Cover">',
    {
      tags: {
        img(attributes) {
          return {_type: 'image', ...attributes}
        }
      },
      marks: {
        code(attributes) {
          return {_type: 'code', language: attributes['data-language']}
        }
      }
    }
  )

  test.equal(value, [
    {
      _type: 'paragraph',
      content: [
        {_type: 'text', text: 'Use '},
        {
          _type: 'text',
          text: 'const value = 1',
          marks: [{_type: 'code', language: 'ts'}]
        },
        {_type: 'text', text: '.'}
      ]
    },
    {_type: 'image', src: 'cover.jpg', alt: 'Cover'}
  ] satisfies TextDoc)
})

test('awaits custom tag and mark handlers', async () => {
  const imported: Array<string> = []
  const value = await parseHTML(
    '<p><highlight>Async</highlight></p><img src="cover.jpg">',
    {
      tags: {
        async img(attributes) {
          await Promise.resolve()
          imported.push(attributes.src)
          return {_type: 'image', src: `/media/${attributes.src}`}
        }
      },
      marks: {
        async highlight() {
          await Promise.resolve()
          return {_type: 'highlight', color: 'yellow'}
        }
      }
    }
  )

  test.equal(imported, ['cover.jpg'])
  test.equal(value, [
    {
      _type: 'paragraph',
      content: [
        {
          _type: 'text',
          text: 'Async',
          marks: [{_type: 'highlight', color: 'yellow'}]
        }
      ]
    },
    {_type: 'image', src: '/media/cover.jpg'}
  ] satisfies TextDoc)
})

test('adds html asynchronously while keeping addHtml synchronous', async () => {
  const syncEditor = new RichTextEditor().addHtml('<kbd>Enter</kbd>', {
    marks: {kbd: () => ({_type: 'keyboard'})}
  })
  test.equal(syncEditor.value(), [
    {_type: 'text', text: 'Enter', marks: [{_type: 'keyboard'}]}
  ] satisfies TextDoc)

  const asyncEditor = new RichTextEditor()
  const returned = await asyncEditor.addHtmlAsync('<img src="cover.jpg">', {
    tags: {
      async img(attributes) {
        return {_type: 'image', src: `/media/${attributes.src}`}
      }
    }
  })
  test.is(returned, asyncEditor)
  test.equal(asyncEditor.value(), [
    {_type: 'image', src: '/media/cover.jpg'}
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
