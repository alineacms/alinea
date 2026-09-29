import {suite} from '@alinea/suite'
import type {Mark} from '../TextDoc.js'
import {fromMarkdown, isMarkdownInline, toMarkdown} from './InlineMarkdown.js'

const test = suite(import.meta)

function text(value: string, ...marks: Array<Mark>) {
  return marks.length
    ? {_type: 'text', text: value, marks}
    : {_type: 'text', text: value}
}
const br = (...marks: Array<Mark>) =>
  marks.length ? {_type: 'hardBreak', marks} : {_type: 'hardBreak'}
const bold = {_type: 'bold'}
const italic = {_type: 'italic'}
const url = (extra: Record<string, string> = {}) => ({
  _type: 'link',
  _link: 'url',
  href: 'https://a.b',
  target: '_blank',
  ...extra
})

// Link ids are generated, compare without them
function parse(source: string) {
  return JSON.parse(
    JSON.stringify(fromMarkdown(source), (key, value) =>
      key === '_id' ? undefined : value
    )
  )
}

function roundTrip(nodes: Array<object>, markdown: string, expected = nodes) {
  test.is(toMarkdown(nodes), markdown)
  test.equal(parse(markdown), expected)
}

test('escapes syntax characters in text', () => {
  roundTrip(
    [text('a*b~c[d]e\\f {x} <small> <sub>, <div> x < y')],
    'a\\*b\\~c\\[d\\]e\\\\f {x} \\<small> \\<sub>, <div> x < y'
  )
  test.equal(parse('\\a \\# \\'), [text('\\a # \\')])
})

test('nests and overlaps emphasis', () => {
  roundTrip([text('a', bold), text('b', bold, italic)], '**a*b***')
  roundTrip([text('ab', bold, italic)], '***ab***')
  roundTrip(
    [text('a', bold), text('b', bold, italic), text('c', italic)],
    '**a*b**c*'
  )
  roundTrip(
    [text('a', italic), text('b', bold, italic), text('c', bold)],
    '*a**b*c**'
  )
  roundTrip([text('x', {_type: 'strike'}), text('y')], '~~x~~y')
  roundTrip(
    [
      text('s', {_type: 'small'}),
      text('b', {_type: 'subscript'}),
      text('p', {_type: 'superscript'}),
      text('m', {_type: 'highlight'})
    ],
    '<small>s</small><sub>b</sub><sup>p</sup><mark>m</mark>'
  )
})

test('moves whitespace at mark edges outside the mark', () => {
  roundTrip(
    [text('Normal '), text(' bold ', bold), text('x')],
    'Normal  **bold** x',
    [text('Normal  '), text('bold', bold), text(' x')]
  )
  roundTrip([text(' ', bold)], ' ', [text(' ')])
})

test('writes hard breaks as a backslash before a line break', () => {
  roundTrip([text('a'), br(), text('b')], 'a\\\nb\n')
  roundTrip([text('a', bold), br(bold), text('b', bold)], '**a\\\nb**\n')
  roundTrip([text('a', bold), br(bold)], '**a**\\\n\n', [text('a', bold), br()])
  roundTrip([text('a\\'), br()], 'a\\\\\\\n\n')
})

test('writes one sentence per line when asked', () => {
  const doc = [
    text('One. Two? 3 apples! four. e.g. Five.  Six '),
    text('x', bold)
  ]
  const markdown = toMarkdown(doc, {sentences: true})
  test.is(markdown, 'One.\nTwo?\n3 apples! four. e.g. Five.  Six **x**\n')
  test.equal(parse(markdown), doc)
  test.is(toMarkdown([text('1. Core slicing. Next')]), '1. Core slicing. Next')
  test.is(
    toMarkdown([text('1. Core slicing. Next')], {sentences: true}),
    '1. Core slicing.\nNext\n'
  )
  test.equal(parse('a\nb\n'), [text('a b')])
  test.equal(parse('a\n'), [text('a')])
})

test('wraps long lines of sentences at spaces in text', () => {
  const words = (count: number, word = 'word') =>
    Array.from({length: count}, (_, i) => `${word}${i}`).join(' ')
  const wrapped = (nodes: Array<object>) => {
    const markdown = toMarkdown(nodes, {sentences: true})
    test.equal(parse(markdown), nodes)
    return markdown
  }
  // Greedy, at most 80 characters a line
  const long = words(30)
  const lines = wrapped([text(long)])
    .slice(0, -1)
    .split('\n')
  test.equal(lines.join(' '), long)
  for (const [i, line] of lines.entries()) {
    test.ok(line.length <= 80)
    if (i > 0) test.ok(`${lines[i - 1]} ${line.split(' ')[0]}`.length > 80)
  }
  test.is(toMarkdown([text(long)]), long)
  // Up to 80 characters stays on one line
  const exact = `${'a'.repeat(39)} ${'b'.repeat(40)}`
  test.is(wrapped([text(exact)]), exact)
  test.is(
    wrapped([text(`${exact}c`)]),
    `${'a'.repeat(39)}\n${'b'.repeat(40)}c\n`
  )
  // Never across a sentence boundary
  const sentence = `Next ${words(20)}`
  test.is(
    wrapped([text(`Short one. ${sentence}`)]),
    `Short one.\n${wrapped([text(sentence)])}`
  )
  // A token longer than the line width stays on its own line
  const token = `https://example.com/${'x'.repeat(80)}`
  test.is(wrapped([text(`see ${token} for more`)]), `see\n${token}\nfor more\n`)
  // Not inside links, titles or attributes
  const link = url({
    href: 'https://a.b/some path',
    title: 'a title with quite a few spaces',
    rel: 'no follow'
  })
  const suffix =
    '](https://a.b/some\\ path "a title with quite a few spaces"){rel="no follow"}'
  test.is(
    wrapped([text('x '.repeat(30)), text('link', link), text(' end')]),
    `${'x '.repeat(30).trim()}\n[link${suffix}\nend\n`
  )
  // Not at double spaces or after hard breaks
  const spaced = `${'a'.repeat(78)}  b`
  test.is(wrapped([text(spaced)]), spaced)
  test.is(
    wrapped([text('a'), br(), text(` ${'b'.repeat(80)} c`)]),
    `a\\\n ${'b'.repeat(80)}\nc\n`
  )
})

test('writes links', () => {
  roundTrip([text('x', url())], '[x](https://a.b)')
  roundTrip(
    [text('x', url({target: '_top', rel: 'no follow', title: 'say "hi"'}))],
    '[x](https://a.b "say \\"hi\\""){target=_top rel="no follow"}'
  )
  const withoutTarget: Mark = url()
  delete withoutTarget.target
  roundTrip([text('x', withoutTarget)], '[x](https://a.b){target=_self}')
  roundTrip(
    [text('x', url({target: '_self'}))],
    '[x](https://a.b){target=_self}',
    [text('x', withoutTarget)]
  )
  roundTrip(
    [text('x', url({href: 'https://a.b/x (y)'}))],
    '[x](https://a.b/x\\ \\(y\\))'
  )
  roundTrip(
    [
      text('x', {
        _type: 'link',
        _link: 'entry',
        _entry: 'abc',
        _anchor: 'intro',
        _locale: 'nl-BE',
        href: '/about'
      })
    ],
    '[x](entry:abc#intro){href=/about locale=nl-BE}'
  )
  roundTrip(
    [
      text('x', {_type: 'link', _link: 'file', _entry: 'abc', target: '_blank'})
    ],
    '[x](file:abc){target=_blank}'
  )
  roundTrip(
    [text('a', url(), bold), text(' b', url())],
    '[**a** b](https://a.b)'
  )
  roundTrip([text('a', url()), text('{b=c}')], '[a](https://a.b)\\{b=c}')
})

test('drops link ids and generates them per position', () => {
  const nodes = [text('x', {...url(), _id: 'original'})]
  const markdown = toMarkdown(nodes)
  test.is(markdown, '[x](https://a.b)')
  const [first] = fromMarkdown(`${markdown} ${markdown}`, ['entry', 'field'])
  const again = fromMarkdown(`${markdown} ${markdown}`, ['entry', 'field'])
  test.equal(again[0], first)
  test.not.is(again[2].marks![0]._id, first.marks![0]._id)
  test.ok(/^[0-9a-z]{22}$/.test(first.marks![0]._id!))
})

test('writes anchors', () => {
  const anchor = {_type: 'anchor', id: 'my-anchor'}
  roundTrip([text('x', anchor)], '[x]{#my-anchor}')
  roundTrip([text('x', url(), anchor)], '[[x]{#my-anchor}](https://a.b)')
  roundTrip(
    [text('a', anchor), text('b', url(), anchor), text('c', url())],
    '[a[b](https://a.b)]{#my-anchor}[c](https://a.b)',
    [text('a', anchor), text('b', url(), anchor), text('c', url())]
  )
})

test('reads unmatched brackets as text', () => {
  test.equal(parse('[a] b [c'), [text('[a] b [c')])
  test.equal(parse('**[a**]'), [text('[a', bold), text(']')])
  test.equal(parse('[a](x'), [text('[a](x')])
})

test('rejects nodes it cannot represent', () => {
  test.not.ok(isMarkdownInline(text('x', {_type: 'custom'})))
  test.not.ok(isMarkdownInline(text('x', {_type: 'bold', level: '1'})))
  test.not.ok(isMarkdownInline(text('x', {_type: 'anchor', id: 'a b'})))
  test.not.ok(isMarkdownInline(text('a\rb')))
  test.not.ok(isMarkdownInline({...text('x'), extra: true}))
  test.not.ok(isMarkdownInline(text('x', {_type: 'link', title: 'x'})))
  test.not.ok(isMarkdownInline(text('x', url({locale: 'en'}))))
  test.not.ok(isMarkdownInline(text('x', url({href: 'entry:x'}))))
  test.not.ok(isMarkdownInline({_type: 'image'}))
  test.ok(isMarkdownInline(br()))
  test.ok(isMarkdownInline(text('x', url(), bold)))
})

test('writes links without a type as url links', () => {
  const untyped = {_type: 'link', href: 'https://a.b', target: '_blank'}
  const doc = [text('see '), text('here', italic, untyped)]
  test.ok(isMarkdownInline(doc[1]))
  test.is(toMarkdown(doc), 'see [*here*](https://a.b)')
  test.equal(parse(toMarkdown(doc)), [
    text('see '),
    text('here', url(), italic)
  ])
})

test('writes underline as a tag', () => {
  const doc = [text('under', {_type: 'underline'}), text(' <u> literal')]
  test.is(toMarkdown(doc), '<u>under</u> \\<u> literal')
  test.equal(parse(toMarkdown(doc)), doc)
})

test('writes line breaks in text as spaces', () => {
  const doc = [text('\nOne\ntwo.\nThree', bold)]
  test.ok(isMarkdownInline(doc[0]))
  test.is(toMarkdown(doc), ' **One two. Three**')
  test.equal(parse(toMarkdown(doc)), [text(' '), text('One two. Three', bold)])
})
