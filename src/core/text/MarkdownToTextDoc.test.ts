import {suite} from '@alinea/suite'
import type {Mark, Node, TextDoc} from '#/core/TextDoc.js'
import {markdownToTextDoc} from './MarkdownToTextDoc.js'
import {textDocToMarkdown} from './TextDocToMarkdown.js'

const test = suite(import.meta)

/** Link marks get a random id, replace it so documents can be compared */
function stripIds(doc: TextDoc): TextDoc {
  return JSON.parse(
    JSON.stringify(doc, (key, value) => (key === '_id' ? 'id' : value))
  )
}

function text(value: string, ...marks: Array<Mark>): Node {
  return marks.length
    ? {_type: 'text', text: value, marks}
    : {_type: 'text', text: value}
}

function paragraph(...content: Array<Node>): Node {
  return {_type: 'paragraph', content}
}

test('paragraphs and headings', () => {
  test.equal(
    markdownToTextDoc(
      '# Title\n\nFirst line\nsame paragraph\n\n###### Small ##'
    ),
    [
      {_type: 'heading', level: 1, content: [text('Title')]},
      paragraph(text('First line same paragraph')),
      {_type: 'heading', level: 6, content: [text('Small')]}
    ]
  )
})

test('inline marks', () => {
  test.equal(
    markdownToTextDoc(
      'Some **bold**, *italic*, _also_, ~~gone~~ and ***both***'
    ),
    [
      paragraph(
        text('Some '),
        text('bold', {_type: 'bold'}),
        text(', '),
        text('italic', {_type: 'italic'}),
        text(', '),
        text('also', {_type: 'italic'}),
        text(', '),
        text('gone', {_type: 'strike'}),
        text(' and '),
        text('both', {_type: 'bold'}, {_type: 'italic'})
      )
    ]
  )
})

test('nested marks and intraword underscores', () => {
  test.equal(markdownToTextDoc('**bold *and italic***'), [
    paragraph(
      text('bold ', {_type: 'bold'}),
      text('and italic', {_type: 'bold'}, {_type: 'italic'})
    )
  ])
  test.equal(markdownToTextDoc('snake_case_name and 2 * 3 * 4'), [
    paragraph(text('snake_case_name and 2 * 3 * 4'))
  ])
})

test('inline code is kept as plain text with its backticks', () => {
  test.equal(markdownToTextDoc('Run `bun **test**` now'), [
    paragraph(text('Run `bun **test**` now'))
  ])
  test.equal(markdownToTextDoc('A ``code with ` inside`` and \\` or ` alone'), [
    paragraph(text('A ``code with ` inside`` and ` or ` alone'))
  ])
})

test('escapes', () => {
  test.equal(markdownToTextDoc('\\*not italic\\* \\[x\\]'), [
    paragraph(text('*not italic* [x]'))
  ])
})

test('links', () => {
  test.equal(
    stripIds(
      markdownToTextDoc(
        'See [the **docs**](https://alinea.sh "Docs") or <https://example.com>'
      )
    ),
    [
      paragraph(
        text('See '),
        text('the ', {
          _type: 'link',
          _id: 'id',
          _link: 'url',
          href: 'https://alinea.sh',
          title: 'Docs'
        }),
        text(
          'docs',
          {
            _type: 'link',
            _id: 'id',
            _link: 'url',
            href: 'https://alinea.sh',
            title: 'Docs'
          },
          {_type: 'bold'}
        ),
        text(' or '),
        text('https://example.com', {
          _type: 'link',
          _id: 'id',
          _link: 'url',
          href: 'https://example.com'
        })
      )
    ]
  )
})

test('custom link marks', () => {
  const doc = markdownToTextDoc('[Home](entry:abc)', {
    link(href) {
      if (href.startsWith('entry:'))
        return {_type: 'link', _link: 'entry', _entry: href.slice(6)}
    }
  })
  test.equal(doc, [
    paragraph(text('Home', {_type: 'link', _link: 'entry', _entry: 'abc'}))
  ])
})

test('hard breaks', () => {
  test.equal(markdownToTextDoc('one  \ntwo\\\nthree<br>four'), [
    paragraph(
      text('one'),
      {_type: 'hardBreak'},
      text('two'),
      {_type: 'hardBreak'},
      text('three'),
      {_type: 'hardBreak'},
      text('four')
    )
  ])
})

test('lists', () => {
  const doc = markdownToTextDoc(
    '- one\n- two\n  - nested\n  - nested **2**\n- three\n\n3. c\n4. d'
  )
  test.equal(doc, [
    {
      _type: 'bulletList',
      content: [
        {_type: 'listItem', content: [paragraph(text('one'))]},
        {
          _type: 'listItem',
          content: [
            paragraph(text('two')),
            {
              _type: 'bulletList',
              content: [
                {_type: 'listItem', content: [paragraph(text('nested'))]},
                {
                  _type: 'listItem',
                  content: [
                    paragraph(text('nested '), text('2', {_type: 'bold'}))
                  ]
                }
              ]
            }
          ]
        },
        {_type: 'listItem', content: [paragraph(text('three'))]}
      ]
    },
    {
      _type: 'orderedList',
      start: 3,
      content: [
        {_type: 'listItem', content: [paragraph(text('c'))]},
        {_type: 'listItem', content: [paragraph(text('d'))]}
      ]
    }
  ])
})

test('loose lists stay one list', () => {
  const doc = markdownToTextDoc('1. a\n\n2. b\n\n   more b')
  test.equal(doc, [
    {
      _type: 'orderedList',
      content: [
        {_type: 'listItem', content: [paragraph(text('a'))]},
        {
          _type: 'listItem',
          content: [paragraph(text('b')), paragraph(text('more b'))]
        }
      ]
    }
  ])
})

test('blockquote and rule', () => {
  test.equal(markdownToTextDoc('> quoted\n> **text**\n\n---\n\n* * *'), [
    {
      _type: 'blockquote',
      content: [paragraph(text('quoted '), text('text', {_type: 'bold'}))]
    },
    {_type: 'horizontalRule'},
    {_type: 'horizontalRule'}
  ])
})

test('images', () => {
  test.equal(markdownToTextDoc('![A cat](/cat.png "Cat")'), [
    {_type: 'image', src: '/cat.png', alt: 'A cat', title: 'Cat'}
  ])
})

test('fenced code blocks', () => {
  test.equal(markdownToTextDoc('```ts\nconst a = 1\n\nconst b = 2\n```'), [
    paragraph(
      text('const a = 1'),
      {_type: 'hardBreak'},
      {_type: 'hardBreak'},
      text('const b = 2')
    )
  ])
  const doc = markdownToTextDoc('~~~js\nlet x\n~~~', {
    codeBlock(code, language) {
      return {_id: 'x', _type: 'CodeBlock', code, language}
    }
  })
  test.equal(doc, [
    {_id: 'x', _type: 'CodeBlock', code: 'let x', language: 'js'}
  ])
})

test('alinea blocks', () => {
  const doc = markdownToTextDoc(
    '```alinea-block\n{"_type": "Notice", "_id": "n1", "level": "info"}\n```'
  )
  test.equal(doc, [{_type: 'Notice', _id: 'n1', level: 'info'}])
})

test('tables', () => {
  test.equal(markdownToTextDoc('| A | B |\n| --- | :-: |\n| 1 | 2 \\| 3 |'), [
    {
      _type: 'table',
      content: [
        {
          _type: 'tableRow',
          content: [
            {_type: 'tableHeader', content: [paragraph(text('A'))]},
            {_type: 'tableHeader', content: [paragraph(text('B'))]}
          ]
        },
        {
          _type: 'tableRow',
          content: [
            {_type: 'tableCell', content: [paragraph(text('1'))]},
            {_type: 'tableCell', content: [paragraph(text('2 | 3'))]}
          ]
        }
      ]
    }
  ])
})

test('html marks', () => {
  test.equal(markdownToTextDoc('H<sub>2</sub>O <u>under</u>'), [
    paragraph(
      text('H'),
      text('2', {_type: 'subscript'}),
      text('O '),
      text('under', {_type: 'underline'})
    )
  ])
})

test('round trips through TextDoc', () => {
  const markdown = [
    '# Title',
    'Some **bold** and *italic* text with a [link](https://alinea.sh) and a\\\nhard break.',
    '- one\n- two\n  1. nested\n  2. list',
    '> quote',
    '---',
    '![Alt](entry:img1)',
    '| A | B |\n| --- | --- |\n| 1 | 2 |',
    '```ts id=c fileName=app.ts compact\nconst a = 1\n```'
  ].join('\n\n')
  const doc = markdownToTextDoc(markdown, {
    codeBlock(code, language, attributes) {
      return {
        _type: 'CodeBlock',
        _id: String(attributes.id),
        code,
        language,
        fileName: attributes.fileName,
        compact: attributes.compact === true
      }
    },
    image(src, alt) {
      return {_type: 'image', _link: 'image', _entry: src.slice(6), alt}
    }
  })
  test.is(textDocToMarkdown(doc), markdown)
})

test('code block info strings hold attributes', () => {
  const blocks: Array<unknown> = []
  markdownToTextDoc(
    '```tsx id=b1 fileName="my app.tsx" compact\nlet a\n```\n\n~~~ lines=3\nx\n~~~',
    {
      codeBlock(code, language, attributes) {
        blocks.push({code, language, attributes})
        return {_type: 'paragraph', content: []}
      }
    }
  )
  test.equal(blocks, [
    {
      code: 'let a',
      language: 'tsx',
      attributes: {id: 'b1', fileName: 'my app.tsx', compact: true}
    },
    {code: 'x', language: undefined, attributes: {lines: '3'}}
  ])
})
