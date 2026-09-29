import type {EntryRecord} from '../EntryRecord.js'
import type {Schema} from '../Schema.js'
import {Type} from '../Type.js'
import {entries, isRecord, keys} from '../util/Objects.js'
import {
  DUMP_SCHEMA,
  dump,
  NOT_RESOLVED,
  type ScalarTagDefinition
} from 'js-yaml'
import type {Loader} from '../Loader.js'
import {parseYaml} from './YamlParser.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const headerKeys = ['_id', '_type', '_index', '_i18nId', '_root', '_seeded']
// Printable text dump does not escape, not starting with whitespace or an
// indicator
const plainString =
  // oxlint-disable-next-line no-control-regex
  /^(?![\s\-?:,[\]{}#&*!|>'"%@`])[^\x00-\x1f\x7f-\x9f\u2028\u2029\ufeff\ufffe\uffff\ud800-\udfff]+$/u
const implicitTags = DUMP_SCHEMA.tags.filter(
  (tag): tag is ScalarTagDefinition => tag.nodeKind === 'scalar' && tag.implicit
)
const implicitTagsByFirst = new Map<string, Array<ScalarTagDefinition>>()
// Characters dump escapes and lines of only whitespace, which it may write in
// double quotes
const escaped =
  // oxlint-disable-next-line no-control-regex
  /[\x00-\x09\x0b-\x1f\x7f-\x9f\u2028\u2029\ufeff\ufffe\uffff]|^[^\S\n]+$/m
// A private use character dump treats like a non-breaking space in plain and
// single quoted scalars, but does not escape
const nbspStandIn = '\ue000'

export const YamlLoader: Loader = {
  extension: '.yaml',
  parse(schema: Schema, input: Uint8Array) {
    const raw = parseYaml(decoder.decode(input))
    if (!isRecord(raw)) throw new Error('Expected a YAML mapping')
    const header: Record<string, unknown> = {}
    const data: Record<string, unknown> = {}
    for (const [key, value] of entries(raw))
      (headerKeys.includes(key) ? header : data)[key] = value
    const type = schema[raw._type as string]
    return {
      ...header,
      ...(type ? Type.fromYaml(type, data, [String(raw._id)]) : data)
    } as EntryRecord
  },
  format(schema: Schema, entry: EntryRecord) {
    const header: Record<string, unknown> = {}
    const data: Record<string, unknown> = {}
    for (const key of headerKeys) if (key in entry) header[key] = entry[key]
    for (const [key, value] of entries(entry))
      if (!headerKeys.includes(key)) data[key] = value
    const type = schema[entry._type]
    const record = {...header, ...(type ? Type.toYaml(type, data) : data)}
    return encoder.encode(emitDocument(record))
  }
}

// js-yaml's dump cannot add blank lines or pick our block styles, so we emit
// the structure ourselves and only use dump to quote scalars
function emitDocument(record: Record<string, unknown>): string {
  let result = ''
  let multiline = false
  for (const [key, value] of entries(record)) {
    if (value === undefined) continue
    const text = `${scalar(key)}:${emitValue(value, 0)}`
    const isMultiline = text.includes('\n')
    if (result) result += isMultiline || multiline ? '\n\n' : '\n'
    result += text
    multiline = isMultiline
  }
  return `${result || '{}'}\n`
}

function emitMapping(record: Record<string, unknown>, indent: number): string {
  return entries(record)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${' '.repeat(indent)}${scalar(key)}:${emitValue(value, indent)}`
    )
    .join('\n')
}

function emitSequence(items: Array<unknown>, indent: number): string {
  const spaced = items.some(item => isRecord(item) && keys(item).length > 0)
  return items
    .map(item => {
      const nested =
        isRecord(item) && keys(item).length > 0
          ? emitMapping(item, indent + 2)
          : Array.isArray(item) && item.length > 0
            ? emitSequence(item, indent + 2)
            : undefined
      if (nested !== undefined)
        return `${' '.repeat(indent)}- ${nested.slice(indent + 2)}`
      return `${' '.repeat(indent)}-${emitValue(item ?? null, indent)}`
    })
    .join(spaced ? '\n\n' : '\n')
}

// The text following `key:` or `-` for a value owned by a key or dash at
// the given indentation
function emitValue(value: unknown, indent: number): string {
  if (value === null) return ''
  if (Array.isArray(value))
    return value.length ? `\n${emitSequence(value, indent + 2)}` : ' []'
  if (isRecord(value))
    return keys(value).length ? `\n${emitMapping(value, indent + 2)}` : ' {}'
  if (typeof value === 'string' && value.includes('\n'))
    return ` ${literal(value, indent + 2) ?? quoted(value)}`
  return ` ${scalar(value)}`
}

/** Whether dump writes the string as is, a plain scalar */
export function isPlainString(value: string): boolean {
  const last = value[value.length - 1]
  return (
    plainString.test(value) &&
    last !== ' ' &&
    last !== ':' &&
    !value.includes(': ') &&
    !value.includes(' #') &&
    !value.startsWith('...') &&
    value !== '=' &&
    resolvesAsString(value)
  )
}

// Whether dump reads the plain scalar back as a string, it tries the implicit
// tags accepting its first character
function resolvesAsString(value: string): boolean {
  const first = value.charAt(0)
  let tags = implicitTagsByFirst.get(first)
  if (!tags)
    implicitTagsByFirst.set(
      first,
      (tags = implicitTags.filter(
        tag => !tag.implicitFirstChars || tag.implicitFirstChars.includes(first)
      ))
    )
  return tags.every(
    tag => tag.resolve(value, false, tag.tagName) === NOT_RESOLVED
  )
}

/** Whether dump may write the text in double quotes */
export function mayDoubleQuote(text: string): boolean {
  return escaped.test(text) || !text.isWellFormed()
}

function scalar(value: unknown): string {
  if (typeof value === 'boolean' || Number.isSafeInteger(value))
    if (!Object.is(value, -0)) return String(value)
  if (typeof value !== 'string')
    return dump(value, {lineWidth: -1}).slice(0, -1)
  if (value === '') return "''"
  if (isPlainString(value)) return value
  // Non-breaking spaces are printable in YAML 1.2 but dump escapes them in
  // double quotes, keep them as is unless the string needs double quotes
  const nbsp = value.includes('\xa0')
  if (nbsp && !value.includes('\n') && !value.includes(nbspStandIn)) {
    const text = dump(value.replaceAll('\xa0', nbspStandIn), {lineWidth: -1})
    if (text[0] !== '"')
      return text.slice(0, -1).replaceAll(nbspStandIn, '\xa0')
  }
  return dump(value, {lineWidth: -1}).slice(0, -1)
}

function quoted(value: string): string {
  return dump(value, {
    lineWidth: -1,
    forceQuotes: true,
    quoteStyle: 'double'
  }).slice(0, -1)
}

// A literal block scalar, if it represents the value exactly
function literal(value: string, indent: number): string | undefined {
  const body = value.replace(/\n+$/, '')
  const newlines = value.length - body.length
  if (!body || newlines > 1) return
  const lines = body.split('\n')
  // Trailing spaces are easily lost, dump uses double quotes for characters
  // that need escaping (tabs, carriage returns, other non printables)
  if (lines.some(line => line.endsWith(' '))) return
  if (mayDoubleQuote(body))
    if (lines.some(line => scalar(line).startsWith('"'))) return
  const indicator = /^\n* /.test(body) ? '2' : ''
  const chomp = newlines === 0 ? '-' : ''
  const indented = lines.map(line =>
    line ? `${' '.repeat(indent)}${line}` : ''
  )
  return `|${indicator}${chomp}\n${indented.join('\n')}`
}
