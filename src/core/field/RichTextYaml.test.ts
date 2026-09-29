import {suite} from '@alinea/suite'
import {YamlLoader} from '../loader/YamlLoader.js'
import type {EntryRecord} from '#/core/EntryRecord.js'
import {Config, Field} from '#/index.js'
import {richTextFromYaml, richTextToYaml} from './RichTextYaml.js'

const test = suite(import.meta)

const Custom = Config.type('Custom', {
  fields: {title: Field.text('Title'), body: Field.richText('Body')}
})
const schema = {Custom}

const text = (value: string) => ({_type: 'text', text: value})
const p = (value: string) => ({_type: 'paragraph', content: [text(value)]})

function withoutIds(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (key, child) => (key === '_id' ? undefined : child))
  )
}

// Encode, check the YAML form, then read back the same nodes (without ids)
// through both the codec and the YAML loader
function check(doc: Array<object>, encoded: Array<unknown>, expected = doc) {
  test.equal(richTextToYaml(schema, doc), encoded)
  test.equal(withoutIds(richTextFromYaml(schema, encoded, ['e'])), expected)
  const Entry = Config.type('Entry', {
    fields: {body: Field.richText('Body', {schema})}
  })
  const record = {_id: 'e', _type: 'Entry', _index: 'a0', body: doc}
  const yaml = YamlLoader.format({Entry}, record as EntryRecord)
  const parsed = YamlLoader.parse({Entry}, yaml)
  test.equal(withoutIds(parsed.body), expected)
}

test('paragraphs and headings', () => {
  check(
    [
      {...p('x'), textAlign: 'center'},
      {_type: 'paragraph', textAlign: 'left'},
      {_type: 'heading', level: 2, _anchor: 'custom', content: [text('Title')]},
      {
        _type: 'heading',
        level: 3,
        _anchor: 'title',
        content: [{...text('Title'), marks: [{_type: 'anchor', id: 'title'}]}]
      },
      {_type: 'heading', level: 7, content: [text('x')]}
    ],
    [
      {p: {align: 'center', text: 'x'}},
      {p: null},
      {h2: {anchor: 'custom', text: 'Title'}},
      {h3: 'Title'},
      {heading: {level: 7, content: ['x']}}
    ],
    [
      {...p('x'), textAlign: 'center'},
      {_type: 'paragraph'},
      {_type: 'heading', level: 2, _anchor: 'custom', content: [text('Title')]},
      {_type: 'heading', level: 3, _anchor: 'title', content: [text('Title')]},
      {_type: 'heading', level: 7, content: [text('x')]}
    ]
  )
})

test('lists and quotes', () => {
  const item = (...content: Array<object>) => ({_type: 'listItem', content})
  check(
    [
      {
        _type: 'bulletList',
        content: [
          item(p('a')),
          item(p('b'), {_type: 'bulletList', content: [item(p('c'))]}),
          {_type: 'listItem', checked: true, content: [p('d')]}
        ]
      },
      {_type: 'orderedList', start: 1, content: [item(p('a'))]},
      {_type: 'orderedList', start: 3, content: [item(p('a'))]},
      {_type: 'blockquote', content: [p('q')]},
      {_type: 'blockquote', content: [p('q'), p('r')]}
    ],
    [
      {ul: ['a', [{p: 'b'}, {ul: ['c']}], {li: {checked: true, content: 'd'}}]},
      {ol: ['a']},
      {ol: {start: 3, items: ['a']}},
      {blockquote: 'q'},
      {blockquote: [{p: 'q'}, {p: 'r'}]}
    ],
    [
      {
        _type: 'bulletList',
        content: [
          item(p('a')),
          item(p('b'), {_type: 'bulletList', content: [item(p('c'))]}),
          {_type: 'listItem', checked: true, content: [p('d')]}
        ]
      },
      {_type: 'orderedList', content: [item(p('a'))]},
      {_type: 'orderedList', start: 3, content: [item(p('a'))]},
      {_type: 'blockquote', content: [p('q')]},
      {_type: 'blockquote', content: [p('q'), p('r')]}
    ]
  )
})

test('wraps long paragraphs but not headings or cells', () => {
  const long = Array.from({length: 20}, (_, i) => `word${i}`).join(' ')
  const wrapped = `${long.slice(0, 80)}\n${long.slice(81)}\n`
  const cell = (type: string) => ({_type: type, content: [p(long)]})
  check(
    [
      p(long),
      {_type: 'heading', level: 2, _anchor: 'x', content: [text(long)]},
      {
        _type: 'table',
        content: [{_type: 'tableRow', content: [cell('tableCell')]}]
      },
      {_type: 'bulletList', content: [{_type: 'listItem', content: [p(long)]}]}
    ],
    [
      {p: wrapped},
      {h2: {anchor: 'x', text: long}},
      {table: [{td: [long]}]},
      {ul: [wrapped]}
    ]
  )
})

test('wraps inline content of list items in paragraphs', () => {
  const br = {_type: 'hardBreak'}
  const item = (...content: Array<object>) => ({_type: 'listItem', content})
  const nested = {_type: 'bulletList', content: [item(p('c'))]}
  check(
    [
      {
        _type: 'bulletList',
        content: [
          item(text('a')),
          item(text('b'), br, text('c')),
          item(text('d'), nested),
          item(text('e'), nested, text('f')),
          {_type: 'listItem', checked: true, content: [text('g')]}
        ]
      }
    ],
    [
      {
        ul: [
          'a',
          'b\\\nc\n',
          [{p: 'd'}, {ul: ['c']}],
          [{p: 'e'}, {ul: ['c']}, {p: 'f'}],
          {li: {checked: true, content: 'g'}}
        ]
      }
    ],
    [
      {
        _type: 'bulletList',
        content: [
          item(p('a')),
          item({_type: 'paragraph', content: [text('b'), br, text('c')]}),
          item(p('d'), nested),
          item(p('e'), nested, p('f')),
          {_type: 'listItem', checked: true, content: [p('g')]}
        ]
      }
    ]
  )
})

test('tables', () => {
  const cell = (type: string, value: string, extra = {}) => ({
    _type: type,
    colspan: 1,
    rowspan: 1,
    ...extra,
    content: [p(value)]
  })
  check(
    [
      {
        _type: 'table',
        content: [
          {_type: 'tableRow', content: [cell('tableHeader', 'a')]},
          {
            _type: 'tableRow',
            content: [
              cell('tableHeader', 'b'),
              cell('tableCell', 'c', {colspan: 2})
            ]
          }
        ]
      }
    ],
    [
      {
        table: [
          {th: ['a']},
          {tr: [{th: 'b'}, {td: {colspan: 2, content: 'c'}}]}
        ]
      }
    ],
    [
      {
        _type: 'table',
        content: [
          {
            _type: 'tableRow',
            content: [{_type: 'tableHeader', content: [p('a')]}]
          },
          {
            _type: 'tableRow',
            content: [
              {_type: 'tableHeader', content: [p('b')]},
              {_type: 'tableCell', colspan: 2, content: [p('c')]}
            ]
          }
        ]
      }
    ]
  )
})

test('images, blocks and unknown nodes', () => {
  check(
    [
      {_type: 'image', _id: 'x', _link: 'image', _entry: 'e1', alt: 'A'},
      {_type: 'image', src: 'x.png', width: 100},
      {_type: 'Custom', _id: 'b', title: 'T', body: [p('x')]},
      {_type: 'Unknown', _id: 'u', value: 1},
      {_type: 'codeBlock', language: 'js', content: [text('let x = 1')]},
      {
        _type: 'paragraph',
        content: [text('a '), {...text('u'), marks: [{_type: 'custom'}]}]
      },
      text('stray')
    ],
    [
      {img: {entry: 'e1', alt: 'A'}},
      {img: {src: 'x.png', width: 100}},
      {Custom: {title: 'T', body: [{p: 'x'}]}},
      {Unknown: {value: 1}},
      {codeBlock: {language: 'js', content: ['let x = 1']}},
      {
        p: {content: ['a ', {text: {text: 'u', marks: [{_type: 'custom'}]}}]}
      },
      'stray'
    ],
    [
      {_type: 'image', _link: 'image', _entry: 'e1', alt: 'A'},
      {_type: 'image', src: 'x.png', width: 100},
      {_type: 'Custom', title: 'T', body: [p('x')]},
      {_type: 'Unknown', value: 1},
      {_type: 'codeBlock', language: 'js', content: [text('let x = 1')]},
      {
        _type: 'paragraph',
        content: [text('a '), {...text('u'), marks: [{_type: 'custom'}]}]
      },
      text('stray')
    ]
  )
})

test('generates ids from the position in the entry', () => {
  const encoded = [{Custom: {body: [{Custom: {}}]}}, {img: {entry: 'e1'}}]
  const doc = richTextFromYaml(schema, encoded, ['entry', 'body'])
  test.equal(richTextFromYaml(schema, encoded, ['entry', 'body']), doc)
  interface Row {
    _id: string
    body: Array<Row>
  }
  const [block, image] = doc as Array<Row>
  const ids = [block._id, block.body[0]._id, image._id]
  test.is(new Set(ids).size, 3)
  test.not.equal(richTextFromYaml(schema, encoded, ['other', 'body']), doc)
})

test('keeps values of another shape', () => {
  test.is(richTextToYaml(schema, 'x'), 'x')
  test.equal(richTextToYaml(schema, [1, null]), [1, null])
  test.equal(richTextFromYaml(schema, [null, {a: 1, b: 2}], []), [
    null,
    {a: 1, b: 2}
  ])
  test.equal(richTextFromYaml(schema, [{_type: 'paragraph'}], []), [
    {_type: 'paragraph'}
  ])
})
