import {suite} from '@alinea/suite'
import * as devSchema from '../../../apps/dev/src/schema/index.js'
import type {EntryRecord} from '../EntryRecord.js'
import {MediaFile, MediaLibrary} from '../media/MediaTypes.js'
import type {Schema} from '../Schema.js'
import {isRecord} from '../util/Objects.js'
import {slugify} from '../util/Slugs.js'
import {cms as fixture} from '#/dashboard/fixture/cms.js'
import {Config, Field} from '#/index.js'
import {localiser} from '#/field/localiser/Localiser.js'
import {Glob} from 'bun'
import {CORE_SCHEMA, dump, load} from 'js-yaml'
import {isPlainString, mayDoubleQuote, YamlLoader} from './YamlLoader.js'

const test = suite(import.meta)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const corpora: Array<[string, Schema]> = [
  [
    'apps/dev/content',
    {...devSchema, MediaFile, MediaLibrary} as unknown as Schema
  ],
  ['src/dashboard/fixture/content', fixture.config.schema]
]

function format(schema: Schema, record: EntryRecord): string {
  return decoder.decode(YamlLoader.format(schema, record))
}

function parse(schema: Schema, yaml: string): EntryRecord {
  return YamlLoader.parse(schema, encoder.encode(yaml))
}

test('round trips every entry in the dev and fixture content', async () => {
  let count = 0
  for (const [dir, schema] of corpora) {
    for await (const file of new Glob('**/*.json').scan(dir)) {
      const record = (await Bun.file(`${dir}/${file}`).json()) as EntryRecord
      const yaml = format(schema, record)
      const parsed = parse(schema, yaml)
      test.equal(normalise(parsed), normalise(record))
      // Deterministic ids, identical on every parse
      test.equal(parse(schema, yaml), parsed)
      const ids = generatedIds(parsed)
      test.is(new Set(ids).size, ids.length)
      // Idempotent output
      test.is(format(schema, parsed), yaml)
      test.ok(yaml.endsWith('\n') && !yaml.endsWith('\n\n'))
      count++
    }
  }
  test.ok(count > 100)
})

test('writes rich text as tagged inline markdown', async () => {
  const [[dir, schema]] = corpora
  const record = await Bun.file(
    `${dir}/primary/fields/examples/rich-text-fields.json`
  ).json()
  const yaml = format(schema, record)
  test.ok(
    yaml.startsWith(`_id: 2dgg9AopqPd4gasFaAefPYSS4tf
_type: RichTextFields
_index: a0V
title: Rich text fields

richText:
  - p: |
      Normal text | **bold** | *italic* | ***bold italic*** | [inline
      link](https://alineacms.com)

  - h1: Heading 2

  - h1: Heading 3

  - p:

  - h3: heading met effectief tekst

  - p:

  - p: |
      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      Nulla magna nulla, commodo vitae pulvinar ut, mattis id arcu.
      Integer dapibus dui et dolor interdum ullamcorper.
      Nullam sed felis ac sem pretium convallis in sit amet nunc.
      Nam consequat quam id nisl dictum imperdiet.
`)
  )
  test.ok(
    yaml.includes(`
nested:
  - Inner:
      title: ''
      content:
        - h3: new nested heading

  - Inner:
      title: ''
      content:
        - h2: Nested heading

table:
  - table:
      - th:
          - Header 1
          - Header 2
          - Header 3

      - td:
          - Row 1 - Cell 1
          - Row 1 - Cell 2
          - Row 1 - Cell 3
`)
  )
})

test('encodes lists, unions and localised fields', () => {
  const localise = localiser({locales: ['en', 'nl']})
  const Block = Config.type('Block', {
    fields: {title: Field.text('Title'), body: Field.richText('Body')}
  })
  const Page = Config.type('Page', {
    fields: {
      title: Field.text('Title'),
      blocks: Field.list('Blocks', {schema: {Block}}),
      link: Field.link('Link'),
      body: localise(Field.richText('Body'))
    }
  })
  const schema = {Page}
  const record = {
    _id: 'page',
    _type: 'Page',
    _index: 'a0',
    extra: 'kept',
    body: {
      en: [{_type: 'paragraph', content: [{_type: 'text', text: 'Hello'}]}],
      nl: [{_type: 'paragraph', content: [{_type: 'text', text: 'Hallo'}]}]
    },
    link: {_id: 'x', _type: 'url', _url: 'https://a.b', _target: '_blank'},
    blocks: [
      {_id: 'a', _index: 'a0', _type: 'Block', title: 'One', body: []},
      {_id: 'b', _index: 'a1', _type: 'Block', title: 'no'}
    ],
    title: '2024-05-01'
  } as EntryRecord
  const yaml = format(schema, record)
  test.is(
    yaml,
    `_id: page
_type: Page
_index: a0
title: '2024-05-01'

blocks:
  - Block:
      title: One
      body: []

  - Block:
      title: 'no'

link:
  url:
    _url: https://a.b
    _target: _blank

body:
  en:
    - p: Hello
  nl:
    - p: Hallo

extra: kept
`
  )
  const parsed = parse(schema, yaml)
  test.equal(normalise(parsed), normalise(record))
  const blocks = parsed.blocks as Array<Record<string, unknown>>
  test.is(blocks[0]._index, 'a0')
  test.is(blocks[1]._index, 'a1')
  test.ok(typeof blocks[0]._id === 'string' && blocks[0]._id !== blocks[1]._id)
  test.ok(typeof (parsed.link as Record<string, unknown>)._id === 'string')
})

test('emits block scalars only when they are exact', () => {
  const schema = {}
  const values = [
    'one\ntwo',
    'one\ntwo\n',
    'one\ntwo\n\n',
    '  indented\nline',
    '\n  after empty line',
    'trailing \nspace',
    'tab\there\nx',
    'crlf\r\nx',
    'empty\n\nline\n',
    '\n',
    'no',
    '~',
    '012',
    ''
  ]
  const record = {_id: 'a', _type: 'Unknown', _index: 'a0', values}
  const yaml = format(schema, record as EntryRecord)
  test.equal(parse(schema, yaml), record)
  test.ok(yaml.includes('  - |-\n    one\n    two\n'))
  test.ok(yaml.includes('  - |2-\n      indented\n    line\n'))
})

test('writes plain strings exactly like dump', async () => {
  const strings = new Set([
    'a',
    'Hello world',
    'Hello  world',
    'Hello world ',
    ' Hello',
    'a: b',
    'a:b',
    'a #b',
    'a#b',
    'a - b',
    'a, b [c] {d} "e" \'f\' *g &h !i |j >k %l @m `n',
    'a\tb',
    'a\u00a0b',
    'a\u0085b',
    'a\u2028b',
    'a\ufeffb',
    'a\u3000b',
    'é',
    'Été',
    '日本語',
    'Ωmega 😀',
    'a\ud800b',
    'a\n',
    'ab\\c',
    'y',
    'Y',
    'n',
    'yes',
    'Yes',
    'YES',
    'yEs',
    'no',
    'No',
    'on',
    'On',
    'off',
    'OFF',
    'true',
    'True',
    'tRue',
    'false',
    'null',
    'Null',
    'NULL',
    'nulL',
    'inf',
    'nan',
    'NaN',
    'e',
    'E5',
    'x1',
    'a=b',
    'a<<b',
    '',
    ' ',
    '\u3000',
    '=',
    '==',
    '<<',
    '~',
    '_id',
    '/path/to/file.json',
    '(a) b',
    '\\a',
    '$a',
    '3JPoXiQd8dsdZqhFoShqsmP5A4V',
    '0',
    '1',
    '-1',
    '+1',
    '01',
    '0o17',
    '0x1F',
    '0b11',
    '1_000',
    '1:30',
    '190:20:30',
    '1e5',
    '1E5',
    '1.5',
    '1.',
    '.5',
    '.inf',
    '-.inf',
    '.NaN',
    '.',
    '..',
    '...',
    '... a',
    '...a',
    '---',
    '--- a',
    '2020-01-01',
    '2020-01-01 10:00:00',
    '2020-1-1',
    '12:30:00',
    'https://example.com/a?b=c#d',
    'mailto:a@b.c',
    'a:',
    'a::b',
    'a :b',
    ':a',
    '?a',
    '-a',
    '#a',
    'a#',
    'a #',
    '\u00a0',
    '\u00a0a',
    'a\u00a0'
  ])
  for (const [dir] of corpora)
    for await (const file of new Glob('**/*.json').scan(dir))
      collectStrings(await Bun.file(`${dir}/${file}`).json(), strings)
  // Non-breaking spaces are written as is, dump escapes them
  const withoutNbsp = (value: string) => value.replaceAll('\xa0', '\ue000')
  let plain = 0
  for (const value of strings) {
    for (const line of value.split('\n')) {
      const dumped = dump(withoutNbsp(line), {lineWidth: -1})
      if (!mayDoubleQuote(line)) test.ok(!dumped.startsWith('"'))
    }
    if (!isPlainString(value)) continue
    const expected = withoutNbsp(value)
    test.is(dump(expected, {lineWidth: -1}).slice(0, -1), expected)
    plain++
  }
  test.ok(plain > strings.size / 2)
  const scalars = [
    0,
    1,
    -1,
    42,
    2 ** 53 - 1,
    2 ** 53,
    -0,
    1.5,
    1e21,
    true,
    false
  ]
  const record = {_id: 'a', _type: 'Unknown', _index: 'a0', scalars}
  const expected = scalars.map(value => `  - ${dump(value).slice(0, -1)}`)
  test.ok(format({}, record as EntryRecord).includes(expected.join('\n')))
})

test('writes non-breaking spaces as is', () => {
  const nbsp = '\xa0'
  const values = [
    nbsp,
    `${nbsp}${nbsp}`,
    `${nbsp}a`,
    `a${nbsp}`,
    `a${nbsp}b`,
    `-${nbsp}`,
    `${nbsp}- a`,
    `${nbsp}#a`,
    `a${nbsp}#b`,
    `a #${nbsp}`,
    `a:${nbsp}b`,
    `a: ${nbsp}b`,
    `'a${nbsp}'`,
    `a${nbsp}\tb`,
    `a${nbsp}\ue000`,
    `${nbsp}\n${nbsp}a${nbsp}\n`,
    `a${nbsp}\nb${nbsp}`,
    `${nbsp}y`,
    `${nbsp}1`
  ]
  const record = {
    _id: 'a',
    _type: 'Unknown',
    _index: 'a0',
    values,
    keys: Object.fromEntries(values.map(value => [value, value]))
  }
  const yaml = format({}, record as EntryRecord)
  test.equal(parse({}, yaml), record)
  test.equal(load(yaml, {schema: CORE_SCHEMA}), record)
  test.ok(yaml.includes(`  - ${nbsp}\n`))
  test.ok(yaml.includes(`  - a${nbsp}b\n`))
  test.ok(yaml.includes(`  - 'a: ${nbsp}b'\n`))
  test.ok(yaml.includes(`  - |-\n    a${nbsp}\n    b${nbsp}\n`))
  // Double quotes escape them
  test.ok(yaml.includes('  - "a\\_\\tb"\n'))
})

test('writes CJK text with non-breaking spaces without double quotes', () => {
  const value = 'a: \u4e00\xa0\u4e8c'
  const record = {_id: 'a', _type: 'Unknown', _index: 'a0', value}
  const yaml = format({}, record as EntryRecord)
  test.ok(yaml.includes(`value: '${value}'\n`))
  test.equal(parse({}, yaml), record)
})

function collectStrings(value: unknown, strings: Set<string>) {
  if (typeof value === 'string') {
    strings.add(value)
    for (const word of value.split(/\s+/)) strings.add(word)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, strings)
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      strings.add(key)
      collectStrings(item, strings)
    }
  }
}

// The documented normalisations, applied to both sides of a comparison:
// 1. nested `_id` and `_index` keys are removed: rows, blocks, union values,
//    images and link marks get generated ids and list rows generated indexes
// 2. default attributes are removed: textAlign left, colspan 1, rowspan 1,
//    null colwidth and ordered list start 1
// 3. url links with target _self lose the target (no target reads as _blank),
//    links without a type but with an href read back as url links
// 4. heading anchor marks repeating the heading anchor are removed and a
//    heading without anchor gets the slug of its text
// 5. whitespace and hard breaks at the edges of a mark move outside it
// 6. line breaks in text become spaces
// 7. adjacent text nodes with equal marks merge, empty text nodes and empty
//    inline content are removed, marks are sorted
// 8. runs of text and hard breaks directly in a list item are wrapped in a
//    paragraph
function normalise(value: unknown, nested = false): unknown {
  if (Array.isArray(value)) return normaliseInline(value.map(normaliseNode))
  if (!isRecord(value)) return value
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (nested && (key === '_id' || key === '_index')) continue
    result[key] = normaliseNode(child)
  }
  return result
}

function normaliseNode(value: unknown): unknown {
  const node = normalise(value, true)
  if (!isRecord(node)) return node
  const type = node._type
  if ((type === 'paragraph' || type === 'heading') && node.textAlign === 'left')
    delete node.textAlign
  if (type === 'tableCell' || type === 'tableHeader') {
    if (node.colspan === 1) delete node.colspan
    if (node.rowspan === 1) delete node.rowspan
    if (node.colwidth === null) delete node.colwidth
  }
  if (type === 'orderedList' && node.start === 1) delete node.start
  if (type === 'listItem' && Array.isArray(node.content))
    node.content = paragraphs(node.content)
  if (
    type === 'link' &&
    node._link === undefined &&
    typeof node.href === 'string'
  )
    node._link = 'url'
  if (type === 'link' && node._link === 'url' && node.target === '_self')
    delete node.target
  if (type === 'heading') {
    const slug = slugify(textOf(node.content))
    const anchor = node._anchor === undefined ? slug : node._anchor
    if (node._anchor === undefined && slug) node._anchor = slug
    if (Array.isArray(node.content))
      node.content = normaliseInline(
        node.content.map(child => {
          if (!isRecord(child) || !Array.isArray(child.marks)) return child
          const marks = child.marks.filter(
            mark =>
              !(isRecord(mark) && mark._type === 'anchor' && mark.id === anchor)
          )
          return {...child, marks}
        })
      )
  }
  if (
    (type === 'paragraph' || type === 'heading') &&
    Array.isArray(node.content) &&
    node.content.length === 0
  )
    delete node.content
  return node
}

const markOrder = [
  'link',
  'anchor',
  'small',
  'bold',
  'italic',
  'strike',
  'superscript',
  'subscript',
  'highlight',
  'underline'
]

function normaliseInline(nodes: Array<unknown>): Array<unknown> {
  const isInline = (node: unknown) =>
    isRecord(node) && (node._type === 'text' || node._type === 'hardBreak')
  if (!nodes.some(isInline)) return nodes
  interface Char {
    char: string | undefined
    marks: Array<string>
  }
  const result: Array<unknown> = []
  let chars: Array<Char> = []
  const flush = () => {
    const keys = new Set(chars.flatMap(char => char.marks))
    for (const key of keys) {
      const has = (i: number) => chars[i]?.marks.includes(key)
      const space = (i: number) =>
        chars[i].char === undefined || /\s/.test(chars[i].char!)
      const remove = (i: number) => {
        chars[i].marks = chars[i].marks.filter(mark => mark !== key)
      }
      for (let start = 0; start < chars.length; start++) {
        if (!has(start) || has(start - 1)) continue
        let end = start
        while (has(end)) end++
        for (let i = start; i < end && space(i); i++) remove(i)
        for (let i = end - 1; i >= start && space(i); i--) remove(i)
      }
    }
    for (const {char, marks} of chars) {
      const sorted = marks
        .map(mark => JSON.parse(mark))
        .sort((a, b) => markOrder.indexOf(a._type) - markOrder.indexOf(b._type))
      const node: Record<string, unknown> =
        char === undefined ? {_type: 'hardBreak'} : {_type: 'text', text: char}
      if (sorted.length) node.marks = sorted
      const last = result.at(-1)
      if (
        char !== undefined &&
        isRecord(last) &&
        last._type === 'text' &&
        JSON.stringify(last.marks) === JSON.stringify(node.marks)
      )
        last.text += char
      else result.push(node)
    }
    chars = []
  }
  for (const node of nodes) {
    if (!isInline(node)) {
      flush()
      result.push(node)
      continue
    }
    const {_type, text, marks} = node as Record<string, unknown>
    const keys = ((marks as Array<unknown>) ?? []).map(mark =>
      JSON.stringify(mark, Object.keys(mark as object).sort())
    )
    if (_type === 'hardBreak') chars.push({char: undefined, marks: keys})
    else
      for (const char of (text as string) ?? '')
        chars.push({char: char === '\n' ? ' ' : char, marks: [...keys]})
  }
  flush()
  return result
}

function paragraphs(content: Array<unknown>): Array<unknown> {
  const result: Array<unknown> = []
  let run: Array<unknown> | undefined
  for (const node of content) {
    const inline =
      isRecord(node) && (node._type === 'text' || node._type === 'hardBreak')
    if (inline && run) run.push(node)
    else
      result.push(inline ? {_type: 'paragraph', content: (run = [node])} : node)
    if (!inline) run = undefined
  }
  return result
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map(node =>
      isRecord(node)
        ? node._type === 'text'
          ? String(node.text ?? '')
          : textOf(node.content)
        : ''
    )
    .join('')
}

// Ids of distinct nested objects, a link mark spanning several text nodes is
// one object
function generatedIds(
  value: unknown,
  seen = new Set<unknown>()
): Array<unknown> {
  if (seen.has(value)) return []
  seen.add(value)
  const children = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.values(value)
      : []
  const own =
    seen.size > 1 && isRecord(value) && '_id' in value ? [value._id] : []
  return own.concat(children.flatMap(child => generatedIds(child, seen)))
}
