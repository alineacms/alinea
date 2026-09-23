import {suite} from '@alinea/suite'
import type {TextDoc} from '#/core/TextDoc.js'
import {markdownToTextDoc} from './MarkdownToTextDoc.js'
import {textDocToMarkdown} from './TextDocToMarkdown.js'

const test = suite(import.meta)

test('renders stored rich text', () => {
  const doc: TextDoc = [
    {_type: 'heading', level: 2, content: [{_type: 'text', text: 'Setup'}]},
    {
      _type: 'paragraph',
      textAlign: 'left',
      content: [
        {_type: 'text', text: 'Read the '},
        {
          _type: 'text',
          text: 'guide',
          marks: [
            {_type: 'link', _id: 'l1', _entry: 'e1', _link: 'entry'},
            {_type: 'bold'}
          ]
        },
        {
          _type: 'text',
          text: ' now',
          marks: [{_type: 'link', _id: 'l1', _entry: 'e1', _link: 'entry'}]
        },
        {_type: 'text', text: ' or '},
        {
          _type: 'text',
          text: 'GitHub',
          marks: [
            {
              _type: 'link',
              _id: 'l2',
              href: 'https://github.com',
              target: '_blank'
            }
          ]
        }
      ]
    },
    {
      _type: 'bulletList',
      content: [
        {
          _type: 'listItem',
          content: [
            {_type: 'paragraph', content: [{_type: 'text', text: 'first'}]},
            {_type: 'paragraph', content: [{_type: 'text', text: 'second'}]}
          ]
        }
      ]
    },
    {
      _type: 'Notice',
      _id: 'n1',
      level: 'warning',
      body: [{_type: 'paragraph', content: [{_type: 'text', text: 'Careful'}]}]
    }
  ]
  test.is(
    textDocToMarkdown(doc),
    [
      '## Setup',
      'Read the [**guide** now](entry:e1) or [GitHub](https://github.com)',
      '- first\n\n  second',
      '```alinea-block\n' + JSON.stringify(doc[3], null, 2) + '\n```'
    ].join('\n\n')
  )
})

test('escapes markdown syntax in text', () => {
  const doc: TextDoc = [
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'content/main/** uses *globs* and [x]'}]
    },
    {_type: 'paragraph', content: [{_type: 'text', text: '1. not a list'}]},
    {_type: 'paragraph', content: [{_type: 'text', text: '- not a list'}]}
  ]
  const markdown = textDocToMarkdown(doc)
  test.is(
    markdown,
    'content/main/\\*\\* uses \\*globs\\* and \\[x\\]\n\n1\\. not a list\n\n\\- not a list'
  )
  test.equal(markdownToTextDoc(markdown), doc)
})

test('keeps underscores inside words readable', () => {
  const doc: TextDoc = [
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'node_modules and _emphasis_'}]
    }
  ]
  const markdown = textDocToMarkdown(doc)
  test.is(markdown, 'node_modules and \\_emphasis\\_')
  test.equal(markdownToTextDoc(markdown), doc)
})

test('keeps whitespace outside of marks', () => {
  const doc: TextDoc = [
    {
      _type: 'paragraph',
      content: [
        {_type: 'text', text: 'a'},
        {_type: 'text', text: ' bold ', marks: [{_type: 'bold'}]},
        {_type: 'text', text: 'b'}
      ]
    }
  ]
  test.is(textDocToMarkdown(doc), 'a **bold** b')
})

test('renders code blocks as fences', () => {
  const doc: TextDoc = [
    {_type: 'CodeBlock', _id: 'c1', code: 'let a', language: 'ts', fileName: ''}
  ]
  test.is(textDocToMarkdown(doc), '```ts id=c1\nlet a\n```')
})

test('keeps other code block fields in the info string', () => {
  const doc: TextDoc = [
    {
      _type: 'CodeBlock',
      _id: 'c1',
      code: 'let a = ```',
      language: 'ts',
      fileName: 'my app.ts',
      compact: true
    }
  ]
  test.is(
    textDocToMarkdown(doc),
    '````ts id=c1 fileName="my app.ts" compact\nlet a = ```\n````'
  )
  const nested: TextDoc = [
    {_type: 'CodeBlock', _id: 'c2', code: 'x', meta: {a: 1}}
  ]
  test.ok(textDocToMarkdown(nested).startsWith('```alinea-block\n'))
})

test('writes code spans in text as they are', () => {
  const doc: TextDoc = [
    {
      _type: 'paragraph',
      content: [
        {_type: 'text', text: 'Run `bun *test*` and ``a ` b``, then the ` key'}
      ]
    },
    {
      _type: 'paragraph',
      content: [
        {_type: 'text', text: 'Bold `x', marks: [{_type: 'bold'}]},
        {_type: 'text', text: ' and y`'}
      ]
    },
    {_type: 'paragraph', content: [{_type: 'text', text: 'A `[link]` span'}]}
  ]
  const markdown = textDocToMarkdown(doc)
  test.is(
    markdown,
    [
      'Run `bun *test*` and ``a ` b``, then the \\` key',
      '**Bold \\`x** and y\\`',
      'A \\`\\[link\\]\\` span'
    ].join('\n\n')
  )
  test.equal(markdownToTextDoc(markdown), doc)
})

test('leaves backticks and angle brackets in prose alone', () => {
  const doc: TextDoc = [
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'Use a <div> or the ` key, a < b'}]
    },
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'Run `npm i` or <u>x</u>'}]
    },
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'See <https://alinea.sh> and a<br>b'}]
    }
  ]
  const markdown = textDocToMarkdown(doc)
  test.is(
    markdown,
    [
      'Use a <div> or the ` key, a < b',
      'Run `npm i` or \\<u>x</u>',
      'See \\<https://alinea.sh> and a\\<br>b'
    ].join('\n\n')
  )
  test.equal(markdownToTextDoc(markdown), doc)
})
