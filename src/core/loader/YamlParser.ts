import {hasOwnProperty} from '../util/Objects.js'
import {
  boolCoreTag,
  CORE_SCHEMA,
  floatCoreTag,
  intCoreTag,
  load,
  NOT_RESOLVED,
  nullCoreTag,
  type ScalarTagDefinition
} from 'js-yaml'

// A fast parser for the YAML subset YamlLoader.format writes: block mappings
// and sequences, `[]`, `{}`, single line plain and quoted scalars and literal
// block scalars. Documents using anything else are parsed by js-yaml.

const unsupported = new Error('Unsupported YAML')
// The core schema tags that may resolve a plain scalar, by its first character
const implicitTags = new Map<string, Array<ScalarTagDefinition>>()
for (const tag of [nullCoreTag, boolCoreTag, intCoreTag, floatCoreTag])
  for (const char of tag.implicitFirstChars ?? [])
    implicitTags.set(char, [...(implicitTags.get(char) ?? []), tag])
const indicators = new Set('-?:,[]{}#&*!|>\'"%@` ')
// Tabs, carriage returns and characters that are not printable in YAML or
// that some parsers read as line breaks
// oxlint-disable-next-line no-control-regex
const special = /[\x00-\x09\x0b-\x1f\x7f-\x9f\u2028\u2029\ufeff\ufffe\uffff]/
const marker = /^(?:---|\.\.\.)(?: |$)/
const literalHeader = /^\|([1-9]?)([-+]?)$/
const hex = /^[0-9a-fA-F]+$/
const escapes = new Map([
  ['0', '\0'],
  ['a', '\x07'],
  ['b', '\b'],
  ['t', '\t'],
  ['n', '\n'],
  ['v', '\v'],
  ['f', '\f'],
  ['r', '\r'],
  ['e', '\x1b'],
  [' ', ' '],
  ['"', '"'],
  ['/', '/'],
  ['\\', '\\'],
  ['N', '\x85'],
  ['_', '\xa0'],
  ['L', '\u2028'],
  ['P', '\u2029']
])
const hexEscapes = new Map([
  ['x', 2],
  ['u', 4],
  ['U', 8]
])

/** Parse YAML like js-yaml's load with the core schema */
export function parseYaml(text: string): unknown {
  return parseSubset(text) ?? load(text, {schema: CORE_SCHEMA})
}

/** Parse the subset YamlLoader.format writes, undefined for other documents */
export function parseSubset(text: string): unknown {
  try {
    return parseDocument(text)
  } catch (error) {
    if (error !== unsupported) throw error
    return undefined
  }
}

function parseDocument(source: string): unknown {
  if (!source.endsWith('\n') || special.test(source) || !source.isWellFormed())
    throw unsupported
  // Offsets where lines start, lines end at the next newline
  const starts = [0]
  for (let at = source.indexOf('\n'); at < source.length - 1;) {
    starts.push(at + 1)
    at = source.indexOf('\n', at + 1)
  }
  let row = 0
  // A collection on the line of a dash continues at the column of its content
  let compactRow = -1
  let compactIndent = 0

  function end(line: number): number {
    return line + 1 < starts.length ? starts[line + 1] - 1 : source.length - 1
  }

  // The indentation of the next non blank line, -1 at the end
  function next(): number {
    for (; row < starts.length; row++) {
      if (row === compactRow) return compactIndent
      const stop = end(row)
      let pos = starts[row]
      while (pos < stop && source.charCodeAt(pos) === 32) pos++
      if (pos < stop) return pos - starts[row]
    }
    return -1
  }

  function block(indent: number, depth: number): unknown {
    if (depth > 40) throw unsupported
    return isItem(source, starts[row] + indent, end(row))
      ? sequence(indent, depth)
      : mapping(indent, depth)
  }

  function sequence(indent: number, depth: number): Array<unknown> {
    const result: Array<unknown> = []
    for (let at = next(); at >= indent; at = next()) {
      const pos = starts[row] + indent
      const stop = end(row)
      if (at > indent || !isItem(source, pos, stop)) throw unsupported
      if (pos + 1 === stop) {
        row++
        result.push(nested(indent, depth))
        continue
      }
      const content = source.slice(pos + 2, stop)
      const length = content.length
      if (isItem(content, 0, length) || entryEnd(content, 0, length) > -1) {
        compactRow = row
        compactIndent = indent + 2
        result.push(block(indent + 2, depth + 1))
      } else {
        row++
        result.push(value(content, 0, length, indent))
      }
    }
    return result
  }

  function mapping(indent: number, depth: number): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (let at = next(); at >= indent; at = next()) {
      const pos = starts[row] + indent
      const stop = end(row)
      const colon = at > indent ? -1 : entryEnd(source, pos, stop)
      if (colon === -1) throw unsupported
      const key = keyOf(source, pos, colon)
      if (hasOwnProperty.call(result, key)) throw unsupported
      row++
      const item =
        colon + 1 < stop
          ? value(source, colon + 2, stop, indent)
          : nested(indent, depth)
      if (key === '__proto__')
        Object.defineProperty(result, key, {
          value: item,
          enumerable: true,
          configurable: true,
          writable: true
        })
      else result[key] = item
    }
    return result
  }

  // The collection on the lines below `key:` or `-`, or null
  function nested(indent: number, depth: number): unknown {
    const at = next()
    return at > indent ? block(at, depth + 1) : null
  }

  // A value up to the end of its line, following the key or dash at the
  // given indentation
  function value(
    text: string,
    start: number,
    stop: number,
    indent: number
  ): unknown {
    const first = text[start]
    if (first === '|') return literal(text.slice(start, stop), indent)
    if (first === '"' || first === "'") {
      const [result, end] = quoted(text, start, stop)
      if (end !== stop) throw unsupported
      return result
    }
    const plain = text.slice(start, stop)
    if (plain === '[]') return []
    if (plain === '{}') return {}
    if (!isPlain(plain)) throw unsupported
    return resolve(plain)
  }

  // A literal block scalar on the lines following its header
  function literal(header: string, indent: number): string {
    const match = literalHeader.exec(header)
    if (!match) throw unsupported
    let contentIndent = indent + Number(match[1])
    const lines: Array<string> = []
    let empty = 0
    for (; row < starts.length; row++) {
      const stop = end(row)
      let pos = starts[row]
      if (pos === stop) {
        empty++
        continue
      }
      while (pos < stop && source.charCodeAt(pos) === 32) pos++
      if (pos === stop) throw unsupported
      if (!match[1] && lines.length === 0) contentIndent = pos - starts[row]
      if (pos - starts[row] < contentIndent) break
      for (; empty > 0; empty--) lines.push('')
      lines.push(source.slice(starts[row] + contentIndent, stop))
    }
    if (lines.length === 0 || contentIndent <= indent) throw unsupported
    const body = lines.join('\n')
    if (match[2] === '-') return body
    return body + (match[2] === '+' ? '\n'.repeat(empty + 1) : '\n')
  }

  const at = next()
  if (at !== 0) throw unsupported
  let result: unknown
  const line = source.slice(starts[row], end(row))
  if (line === '{}' || line === '[]') {
    row++
    result = line === '{}' ? {} : []
  } else {
    result = block(0, 0)
  }
  if (next() !== -1) throw unsupported
  return result
}

function isItem(text: string, pos: number, stop: number): boolean {
  return text[pos] === '-' && (pos + 1 === stop || text[pos + 1] === ' ')
}

function isPlain(text: string): boolean {
  const first = text[0]
  const last = text[text.length - 1]
  if (first === undefined || last === ' ' || last === ':') return false
  if (indicators.has(first))
    if (!'-?:'.includes(first) || text.length === 1 || text[1] === ' ')
      return false
  if (!text.includes(' ')) return true
  return !text.includes(': ') && !text.includes(' #')
}

// The position of the colon if the text has a `key:` at the start position,
// or -1. Keys of lines ending with a colon span the rest of the line.
function entryEnd(text: string, pos: number, stop: number): number {
  const first = text[pos]
  if (first === '"' || first === "'") {
    const end = quoted(text, pos, stop)[1]
    if (text[end] !== ':') return -1
    if (end + 1 < stop && text[end + 1] !== ' ') throw unsupported
    return end
  }
  if (text.charCodeAt(stop - 1) === 58) return stop - 1
  const colon = text.indexOf(': ', pos)
  return colon > -1 && colon < stop ? colon : -1
}

function keyOf(text: string, pos: number, colon: number): string {
  if (colon - pos > 1024) throw unsupported
  const first = text[pos]
  if (first === '"' || first === "'") return quoted(text, pos, colon)[0]
  const source = text.slice(pos, colon)
  if (!isPlain(source)) throw unsupported
  // Document markers only start a document at the start of a line, where
  // keys of the root mapping are
  if ((first === '-' || first === '.') && marker.test(source)) throw unsupported
  return String(resolve(source))
}

function resolve(text: string): unknown {
  for (const tag of implicitTags.get(text[0]) ?? []) {
    const value = tag.resolve(text, false, tag.tagName)
    if (value !== NOT_RESOLVED) return value
  }
  return text
}

// A quoted scalar at the start position ending before the stop position, and
// the position after it
function quoted(text: string, start: number, stop: number): [string, number] {
  let result = ''
  if (text[start] === "'") {
    for (let pos = start + 1; ;) {
      const close = text.indexOf("'", pos)
      if (close === -1 || close >= stop) throw unsupported
      result += text.slice(pos, close)
      if (text[close + 1] !== "'") return [result, close + 1]
      result += "'"
      pos = close + 2
    }
  }
  let from = start + 1
  for (let pos = from; pos < stop; pos++) {
    const char = text[pos]
    if (char === '"') return [result + text.slice(from, pos), pos + 1]
    if (char !== '\\') continue
    result += text.slice(from, pos)
    const code = text[++pos]
    const length = hexEscapes.get(code)
    if (length) {
      const digits = text.slice(pos + 1, Math.min(pos + 1 + length, stop))
      const point = Number.parseInt(digits, 16)
      if (digits.length !== length || !hex.test(digits)) throw unsupported
      if (
        length === 8 &&
        (point > 0x10ffff || (point >= 0xd800 && point < 0xe000))
      )
        throw unsupported
      result += String.fromCodePoint(point)
      pos += length
    } else {
      const escaped = escapes.get(code)
      if (escaped === undefined) throw unsupported
      result += escaped
    }
    from = pos + 1
  }
  throw unsupported
}
