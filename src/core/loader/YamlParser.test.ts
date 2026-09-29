import {suite} from '@alinea/suite'
import {CORE_SCHEMA, load} from 'js-yaml'
import {parseSubset, parseYaml} from './YamlParser.js'

const test = suite(import.meta)

const supported = [
  'a: b\n',
  '{}\n',
  '[]\n',
  'a:\nb: 1\n',
  'a: []\nb: {}\n',
  'a:\n  b:\n    c: d\n  e: f\ng: h\n',
  'a:\n\n  b: c\n\n\nd: e\n',
  'a:\n    b: c\n',
  'list:\n  - a\n  - b\n',
  'list:\n  -\n  - b\n  -\n',
  'list:\n  - a: 1\n    b: 2\n\n  - c:\n      - d\n  - []\n  - {}\n',
  '- a\n- b: c\n  d:\n    - e\n',
  '- - a\n  - b\n- c\n',
  '- - - a\n- -\n',
  '-\n  a: b\n-\n  - c\n',
  'a: |\n  one\n  two\n',
  'a: |-\n  one\n\n  two\nb: c\n',
  'a: |\n  one\n\n\nb: c\n',
  'a: |+\n  one\n\n\nb: c\n',
  'a: |+\n  one\n\n',
  'a: |\n\n  one\n',
  'a: |\n  one\n    two\n  three\n',
  'a: |2\n   one\n  two\n',
  'a: |2-\n   one\n',
  'a:\n  b: |2\n     one\n',
  '- |\n  one\n- |2-\n   two\n',
  '- a: |2-\n     one\n  b: |\n    #not a comment\n',
  'a: |-\n  --- not a marker\n',
  "a: 'b'\n",
  "a: 'it''s'\n",
  "a: ''\n",
  "'a b': c\n",
  "'': c\n",
  "'a''s': c\n",
  "- 'a': b\n",
  '"a": b\n',
  '"a b":\n  c: d\n',
  'a: ""\n',
  'a: "b\\"c\\\\d"\n',
  'a: "\\0\\a\\b\\t\\n\\v\\f\\r\\e\\ \\/\\N\\_\\L\\P"\n',
  'a: "\\x41\\u00e9\\U0001F600\\ud83d\\ude00\\ud83d"\n',
  'a: "tab\\there"\n',
  'a: "é日本😀"\n',
  '__proto__: a\nb: 1\n',
  '1: a\n1.5: b\ntrue: c\nnull: d\n~: e\n',
  'a: b:c\n',
  'a: b#c\n',
  'a: http://example.com/a?b=c#d\n',
  'http://example.com: a\n',
  'a: b[c]{d},e\n',
  'a: -b\n',
  'a: ?b\n',
  'a: :b\n',
  'a: --- b\n',
  'a: ...\n',
  'a: a "b" c\n',
  "a: a 'b' c\n",
  'a: b\\c\n',
  'a: <<\n<<: a\n',
  'a: é\nb: 日本\nc: 😀\n',
  'a: x\u3000y\n',
  'a: b  c\n',
  '- a b: c d\n',
  'a: \xa0\n',
  'a: \xa0b\n',
  'a: b\xa0\n',
  'a: b\xa0#c\n',
  'a: -\xa0\n',
  '\xa0: b\n',
  'a: |\n  \xa0b\xa0\n  \xa0\n'
]

const scalars = [
  '~',
  'null',
  'Null',
  'NULL',
  'nulL',
  'true',
  'True',
  'TRUE',
  'tRUE',
  'false',
  'False',
  'FALSE',
  'yes',
  'no',
  'on',
  'off',
  'y',
  'n',
  '0',
  '-0',
  '+0',
  '1',
  '-1',
  '+1',
  '01',
  '007',
  '0o17',
  '0o8',
  '-0o17',
  '0x1F',
  '0xfF',
  '0xg',
  '-0x1F',
  '0b11',
  '1_000',
  '1:30',
  '123456789012345678901234567890',
  '9007199254740993',
  '1.5',
  '-1.5',
  '+1.5',
  '1.',
  '.5',
  '-.5',
  '1e3',
  '1E3',
  '1e+3',
  '1e-3',
  '1.5e3',
  '1.e3',
  '.e3',
  '1e',
  '1e400',
  '-1e400',
  '.inf',
  '.Inf',
  '.INF',
  '+.inf',
  '-.inf',
  '.iNf',
  '.nan',
  '.NaN',
  '.NAN',
  '-.nan',
  '.',
  '-',
  '+',
  '2024-01-01',
  '2024-01-01T10:00:00Z',
  '12:30',
  '1,000',
  '0.1.2',
  '=',
  'a',
  'Hello world'
]

const unsupported = [
  'a: b',
  '',
  '\n',
  '# comment\na: b\n',
  'a: b # comment\n',
  'a: b\n# comment\n',
  'a:\n  # comment\n  b: c\n',
  'a: |- # comment\n  b\n',
  '---\na: b\n',
  'a: b\n...\n',
  '%YAML 1.2\n---\na: b\n',
  'a: &x b\nc: *x\n',
  'a: !!str 1\n',
  'a: !x b\n',
  '? a\n: b\n',
  'a: [b, c]\n',
  'a: {b: c}\n',
  'a: >\n  folded\n',
  'a: |\n  x\n \n  y\n',
  'a: b\n  c\n',
  "a: 'b\n  c'\n",
  'a: "b\n  c"\n',
  'a:\tb\n',
  'a:\n\tb: c\n',
  'a: b\r\n',
  'a: b\nb: c\na: d\n',
  'a:  b\n',
  'a: b \n',
  '"a":b\n',
  '"a" : b\n',
  'a : b\n',
  'a:\n- b\n',
  'a:\n  - b\n  c: d\n',
  '  a: b\n',
  'a:\n    b: c\n  d: e\n',
  'b\n',
  '- a\nb: c\n',
  'a: - b\n',
  'a: b: c\n',
  'a: b:\n',
  'a: "\\q"\n',
  'a: "\\x4"\n',
  'a: "\\U00110000"\n',
  'a: |\n',
  'a: |0\n  b\n',
  '-   a\n',
  '\ufeffa: b\n',
  'a: b\u0085c\n',
  'a: \u0007\n',
  'a: @b\n',
  'a: `b\n',
  'a: %b\n',
  'a: |\n  x\nb: c\n  d\n',
  '--- a: b\n',
  '... a: b\n',
  '---: b\n',
  'a: b\u2028c\n',
  'a: b\u2029c\n',
  'a: b\ud800\n',
  'a: b\ufffe\n',
  'a: b #\xa0\n'
]

// The fast parser returns what js-yaml returns, or undefined to fall back
function expectSame(input: string, fast: boolean) {
  let expected: unknown
  let error: string | undefined
  try {
    expected = load(input, {schema: CORE_SCHEMA})
  } catch (thrown) {
    error = (thrown as Error).message
  }
  const subset = parseSubset(input)
  if (fast && error === undefined) test.equal(subset, expected)
  if (!fast || error !== undefined) test.is(subset, undefined)
  if (error === undefined) test.equal(parseYaml(input), expected)
  else test.throws(() => parseYaml(input), error)
}

test('parses the emitted subset like js-yaml', () => {
  for (const input of supported) expectSame(input, true)
})

test('resolves plain scalars like the core schema', () => {
  for (const scalar of scalars) {
    expectSame(`a: ${scalar}\n`, true)
    expectSame(`- ${scalar}\n`, true)
    expectSame(`${scalar}: a\n`, scalar !== '-')
    expectSame(`a: '${scalar}'\n`, true)
    expectSame(`a: "${scalar}"\n`, true)
  }
})

test('leaves other documents to js-yaml', () => {
  for (const input of unsupported) expectSame(input, false)
})

test('keeps __proto__ as an own key', () => {
  const parsed = parseSubset('__proto__:\n  a: b\n') as object
  test.equal(Object.getPrototypeOf(parsed), Object.prototype)
  test.equal(Object.keys(parsed), ['__proto__'])
})
