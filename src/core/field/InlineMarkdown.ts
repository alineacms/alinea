import type {Mark} from '../TextDoc.js'
import {entries, isRecord, keys} from '../util/Objects.js'
import {stableId} from '../util/StableId.js'

// A small inline Markdown dialect for text and hard breaks. Emphasis
// delimiters toggle their mark, so overlapping marks need no nesting:
// **bold**, *italic*, ~~strike~~, <small>, <sub>, <sup>, <mark>, <u>,
// [text](url "title"){key=value}, [text](entry:id#anchor), [text](file:id),
// [text]{#anchor}, backslash escapes and a backslash before a line break for a
// hard break. A single line break reads as a space.

const toggles = new Map([
  ['bold', '**'],
  ['italic', '*'],
  ['strike', '~~']
])
const tags = new Map([
  ['small', 'small'],
  ['subscript', 'sub'],
  ['superscript', 'sup'],
  ['highlight', 'mark'],
  ['underline', 'u']
])
const tagMarks = new Map([...tags].map(([mark, tag]) => [tag, mark]))
// The order ProseMirror sorts marks in for the rich text editor schema
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
// Link attributes written without their underscore
const linkAliases = new Map([
  ['_locale', 'locale'],
  ['_suffix', 'suffix']
])
const linkAttributes = new Map(
  [...linkAliases].map(([key, alias]) => [alias, key])
)
const bareValue = /^[^\s"{}\\]+$/
// Characters that can start Markdown syntax
const syntax = /[\\*~<[]/
// Characters that end a run of plain text while parsing
const plainEnd = /[\\\n*~<[\]]/g
const attributeKey = /^[A-Za-z_][\w-]*$/

interface InlineNode {
  _type: string
  text?: string
  marks?: Array<Mark>
}

export interface ToMarkdownOptions {
  /** Start every sentence on a new line and wrap lines longer than 80 */
  sentences?: boolean
}

const lineWidth = 80

interface Unit {
  text: string
  hardBreak: boolean
  marks: Map<string, Mark>
}

interface LinkSuffix {
  mark: Mark
  end: number
}

interface Span {
  index: number
  marks: Array<string>
}

/** Whether toMarkdown can represent this node exactly */
export function isMarkdownInline(node: unknown): boolean {
  if (!isRecord(node)) return false
  const {_type, marks, text, ...rest} = node
  if (keys(rest).length > 0) return false
  if (
    marks !== undefined &&
    !(Array.isArray(marks) && marks.every(mark => markKey(mark) !== undefined))
  )
    return false
  if (_type === 'hardBreak') return text === undefined
  if (_type !== 'text') return false
  return (
    text === undefined || (typeof text === 'string' && !text.includes('\r'))
  )
}

/** Serialize text and hard break nodes, which must pass isMarkdownInline */
export function toMarkdown(
  nodes: Array<unknown>,
  {sentences = false}: ToMarkdownOptions = {}
): string {
  const segments = trimMarks(units(nodes))
  const open: Array<string> = []
  const openMarks = new Map<string, Mark>()
  let result = ''
  let afterLink = false
  // Start and end offsets of text, long lines may break at its spaces
  const texts: Array<number> = []
  const close = (key: string) => {
    const mark = openMarks.get(key)!
    result += closer(mark)
    afterLink = mark._type === 'link'
    open.splice(open.indexOf(key), 1)
    openMarks.delete(key)
  }
  for (let index = 0; index <= segments.length; index++) {
    const marks = segments[index]?.marks ?? new Map<string, Mark>()
    const ending = new Set(open.filter(key => !marks.has(key)))
    // Brackets have to nest, reopen the ones inside a closing bracket
    const firstBracket = open.findIndex(
      key => ending.has(key) && isBracket(openMarks.get(key)!)
    )
    if (firstBracket > -1)
      for (const key of open.slice(firstBracket))
        if (isBracket(openMarks.get(key)!)) ending.add(key)
    for (const key of open.toReversed()) if (ending.has(key)) close(key)
    const opening = [...marks.keys()].filter(key => !openMarks.has(key))
    const length = (key: string) => {
      let end = index
      while (segments[end]?.marks.has(key)) end++
      return end - index
    }
    opening.sort(
      (a, b) =>
        length(b) - length(a) ||
        markRank(marks.get(a)!) - markRank(marks.get(b)!)
    )
    for (const key of opening) {
      const mark = marks.get(key)!
      result += opener(mark)
      open.push(key)
      openMarks.set(key, mark)
      afterLink = false
    }
    const segment = segments[index]
    if (!segment) continue
    if (segment.hardBreak) {
      result += '\\\n'
    } else {
      const text = escapeText(segment.text, afterLink, sentences)
      texts.push(result.length, result.length + text.length)
      result += text
    }
    afterLink = false
  }
  if (sentences && result.length > lineWidth) result = wrap(result, texts)
  return result.includes('\n') ? `${result}\n` : result
}

// Break lines longer than the line width at single spaces between words of
// text, greedily, a single line break reads as a space
function wrap(markdown: string, texts: Array<number>): string {
  let offset = 0
  let range = 0
  return markdown
    .split('\n')
    .map(line => {
      const start = offset
      offset += line.length + 1
      if (line.length <= lineWidth) return line
      let result = ''
      // Start of the current line and the last space it may break at
      let from = 0
      let space = -1
      const breakAt = (end: number) => {
        if (end - from <= lineWidth || space < from) return
        result += `${line.slice(from, space)}\n`
        from = space + 1
      }
      for (let i = line.indexOf(' ', 1); i > -1; i = line.indexOf(' ', i + 1)) {
        while (range < texts.length && texts[range + 1] <= start + i) range += 2
        if (range === texts.length || texts[range] > start + i) continue
        if (/\s/.test(line[i - 1]) || /\s/.test(line[i + 1] ?? ' ')) continue
        breakAt(i)
        space = i
      }
      breakAt(line.length)
      return result + line.slice(from)
    })
    .join('\n')
}

/** Parse inline Markdown into text and hard break nodes */
export function fromMarkdown(
  source: string,
  path: Array<string> = []
): Array<InlineNode> {
  const input = source.endsWith('\n') ? source.slice(0, -1) : source
  if (!syntax.test(input))
    return input ? [{_type: 'text', text: input.replaceAll('\n', ' ')}] : []
  const nodes: Array<InlineNode> = []
  const active: Array<string> = []
  const spans: Array<Span> = []
  let text = ''
  let links = 0
  const flush = () => {
    if (text) nodes.push(withMarks({_type: 'text', text}, active))
    text = ''
  }
  const toggle = (mark: string, on = !active.includes(mark)) => {
    flush()
    const index = active.indexOf(mark)
    if (on && index === -1) active.push(mark)
    if (!on && index > -1) active.splice(index, 1)
  }
  let pos = 0
  while (pos < input.length) {
    const char = input[pos]
    const next = input[pos + 1]
    if (char === '\\' && next === '\n') {
      flush()
      nodes.push(withMarks({_type: 'hardBreak'}, active))
      pos += 2
    } else if (char === '\\' && next !== undefined && isPunctuation(next)) {
      text += next
      pos += 2
    } else if (char === '\n') {
      text += ' '
      pos++
    } else if (char === '*') {
      const double = next === '*'
      toggle(double ? 'bold' : 'italic')
      pos += double ? 2 : 1
    } else if (char === '~' && next === '~') {
      toggle('strike')
      pos += 2
    } else if (
      char === '<' &&
      /^<\/?(small|sub|sup|mark|u)>/.test(input.slice(pos, pos + 8))
    ) {
      const end = input.indexOf('>', pos)
      const closing = next === '/'
      toggle(tagMarks.get(input.slice(pos + (closing ? 2 : 1), end))!, !closing)
      pos = end + 1
    } else if (char === '[') {
      flush()
      spans.push({index: nodes.length, marks: [...active]})
      pos++
    } else if (char === ']' && spans.length > 0) {
      flush()
      const span = spans.pop()!
      const suffix = parseSuffix(input, pos + 1, () =>
        stableId([...path, `link:${links++}`])
      )
      if (suffix) {
        for (const node of nodes.slice(span.index))
          node.marks = [...(node.marks ?? []), suffix.mark]
        pos = suffix.end
      } else {
        nodes.splice(
          span.index,
          0,
          withMarks({_type: 'text', text: '['}, span.marks)
        )
        text = ']'
        pos++
      }
    } else {
      // Plain text up to the next special character
      plainEnd.lastIndex = pos + 1
      const end = plainEnd.exec(input)?.index ?? input.length
      text += input.slice(pos, end)
      pos = end
    }
  }
  flush()
  for (const span of spans.toReversed())
    nodes.splice(
      span.index,
      0,
      withMarks({_type: 'text', text: '['}, span.marks)
    )
  return mergeNodes(nodes)
}

function withMarks(node: InlineNode, marks: Array<string>): InlineNode {
  if (marks.length === 0) return node
  return {...node, marks: marks.map(mark => ({_type: mark}))}
}

function mergeNodes(nodes: Array<InlineNode>): Array<InlineNode> {
  const result: Array<InlineNode> = []
  for (const node of nodes) {
    if (node.marks) node.marks.sort((a, b) => markRank(a) - markRank(b))
    const last = result.at(-1)
    if (
      last?._type === 'text' &&
      node._type === 'text' &&
      (last.marks === node.marks ||
        JSON.stringify(last.marks) === JSON.stringify(node.marks))
    ) {
      last.text = (last.text ?? '') + (node.text ?? '')
    } else {
      result.push(node)
    }
  }
  return result
}

function isPunctuation(char: string): boolean {
  return /[!-/:-@[-`{-~]/.test(char)
}

function markRank(mark: Mark): number {
  const index = markOrder.indexOf(mark._type)
  return index === -1 ? markOrder.length : index
}

function isBracket(mark: Mark): boolean {
  return mark._type === 'link' || mark._type === 'anchor'
}

function units(nodes: Array<unknown>): Array<Unit> {
  const result: Array<Unit> = []
  for (const node of nodes) {
    if (!isRecord(node)) continue
    const marks = new Map<string, Mark>()
    for (const mark of (node.marks as Array<Mark> | undefined) ?? [])
      marks.set(markKey(mark)!, mark)
    if (node._type === 'hardBreak') {
      result.push({text: '\n', hardBreak: true, marks})
    } else {
      const text = (node.text as string | undefined) ?? ''
      // Text without marks is never trimmed, it stays whole. Units of a node
      // share their marks until trimMarks changes them.
      if (marks.size > 0)
        for (const char of text)
          result.push({text: char, hardBreak: false, marks})
      else if (text) result.push({text, hardBreak: false, marks})
    }
  }
  return result
}

// Move whitespace (and hard breaks) at the edges of a mark outside of it, then
// group units with the same marks
function trimMarks(units: Array<Unit>): Array<Unit> {
  const isSpace = (unit: Unit) => unit.hardBreak || /\s/.test(unit.text)
  const remove = (index: number, key: string) => {
    units[index].marks = new Map(units[index].marks)
    units[index].marks.delete(key)
  }
  const all = new Set<string>()
  let previous: Map<string, Mark> | undefined
  for (const {marks} of units)
    if (marks !== previous)
      for (const key of (previous = marks).keys()) all.add(key)
  for (const key of all) {
    let start = 0
    while (start < units.length) {
      if (!units[start].marks.has(key)) {
        start++
        continue
      }
      let end = start
      while (end < units.length && units[end].marks.has(key)) end++
      for (let i = start; i < end && isSpace(units[i]); i++) remove(i, key)
      for (let i = end - 1; i >= start && isSpace(units[i]); i--) remove(i, key)
      start = end
    }
  }
  const segments: Array<Unit> = []
  for (const unit of units) {
    const last = segments.at(-1)
    if (
      last &&
      !last.hardBreak &&
      !unit.hardBreak &&
      sameKeys(last.marks, unit.marks)
    )
      last.text += unit.text
    else segments.push({...unit})
  }
  return segments
}

function sameKeys(a: Map<string, Mark>, b: Map<string, Mark>): boolean {
  if (a === b) return true
  return a.size === b.size && [...a.keys()].every(key => b.has(key))
}

function escapeText(
  text: string,
  afterLink: boolean,
  sentences: boolean
): string {
  // A line break in text renders as a space, it is written as one
  let result = text
    .replace(/\n/g, ' ')
    .replace(/[\\*~[\]]/g, '\\$&')
    .replace(/<(?=\/?(small|sub|sup|mark|u)>)/g, '\\<')
  if (afterLink && result.startsWith('{')) result = `\\${result}`
  if (!sentences) return result
  // One sentence per line, a period after a number or a single letter
  // (`1.`, `e.g.`) does not end a sentence
  return result.replace(
    /((?<=\p{L}\p{L}|[)"'’”])\.|[?!]) (?=[\p{Lu}\d])/gu,
    '$1\n'
  )
}

function opener(mark: Mark): string {
  if (isBracket(mark)) return '['
  const tag = tags.get(mark._type)
  return tag ? `<${tag}>` : toggles.get(mark._type)!
}

function closer(mark: Mark): string {
  if (mark._type === 'anchor') return `]{#${mark.id}}`
  if (mark._type === 'link') return `]${linkSuffix(mark)}`
  const tag = tags.get(mark._type)
  return tag ? `</${tag}>` : toggles.get(mark._type)!
}

// A key identifying the mark, undefined if the mark cannot be represented
function markKey(mark: unknown): string | undefined {
  if (!isRecord(mark) || typeof mark._type !== 'string') return undefined
  const {_type, ...attributes} = mark
  const simple = toggles.has(_type) || tags.has(_type)
  if (simple && keys(attributes).length > 0) return undefined
  if (_type === 'anchor') {
    if (keys(attributes).length !== 1) return undefined
    if (typeof mark.id !== 'string' || !bareValue.test(mark.id))
      return undefined
  }
  if (_type === 'link' && linkSuffix(mark as Mark) === undefined)
    return undefined
  if (!simple && _type !== 'anchor' && _type !== 'link') return undefined
  return JSON.stringify(entries(mark).sort(([a], [b]) => (a < b ? -1 : 1)))
}

function linkSuffix(mark: Mark): string | undefined {
  const {_type, _id, _link, _entry, _anchor, href, title, target, ...rest} =
    mark as Record<string, unknown>
  const attributes: Array<[string, unknown]> = []
  let destination: string
  // Links without a type, as imported content has them, are url links
  if (_link === 'url' || (_link === undefined && typeof href === 'string')) {
    if (typeof href !== 'string' || /^(entry|file):/.test(href)) return
    destination = href
    if (_entry !== undefined) attributes.push(['_entry', _entry])
    if (_anchor !== undefined) attributes.push(['_anchor', _anchor])
    if (target !== '_blank') attributes.push(['target', target ?? '_self'])
  } else if (
    (_link === 'entry' || _link === 'file') &&
    typeof _entry === 'string' &&
    !_entry.includes('#')
  ) {
    destination = `${_link}:${_entry}`
    if (_link === 'entry' && typeof _anchor === 'string')
      destination += `#${_anchor}`
    else if (_anchor !== undefined) attributes.push(['_anchor', _anchor])
    if (href !== undefined) attributes.push(['href', href])
    if (target !== undefined) attributes.push(['target', target])
  } else {
    return
  }
  for (const [key, value] of entries(rest)) {
    if (linkAttributes.has(key) || !attributeKey.test(key)) return
    attributes.push([linkAliases.get(key) ?? key, value])
  }
  if (title !== undefined && typeof title !== 'string') return
  if (attributes.some(([, value]) => typeof value !== 'string')) return
  const titlePart = title === undefined ? '' : ` ${quote(title)}`
  const attributePart = attributes.length
    ? `{${attributes.map(([key, value]) => `${key}=${attributeValue(value as string)}`).join(' ')}}`
    : ''
  return `(${destination.replace(/[\\()\s]/g, '\\$&')}${titlePart})${attributePart}`
}

function quote(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`
}

function attributeValue(value: string): string {
  return bareValue.test(value) ? value : quote(value)
}

// Parse what follows the closing bracket of a link or anchor
function parseSuffix(
  input: string,
  start: number,
  createId: () => string
): LinkSuffix | undefined {
  if (input[start] === '{') {
    const parsed = parseAttributes(input, start)
    if (parsed?.attributes.length !== 1) return
    const [[key, id]] = parsed.attributes
    if (key !== '#') return
    return {mark: {_type: 'anchor', id}, end: parsed.end}
  }
  if (input[start] !== '(') return
  let pos = start + 1
  let destination = ''
  while (pos < input.length && input[pos] !== ')' && !/\s/.test(input[pos])) {
    if (input[pos] === '\\' && pos + 1 < input.length) pos++
    destination += input[pos++]
  }
  while (/\s/.test(input[pos] ?? '')) pos++
  let title: string | undefined
  if (input[pos] === '"') {
    const quoted = parseQuoted(input, pos)
    if (!quoted) return
    title = quoted.value
    pos = quoted.end
    while (/\s/.test(input[pos] ?? '')) pos++
  }
  if (input[pos] !== ')') return
  pos++
  const mark: Mark = {_type: 'link', _id: createId()}
  const entry = /^(entry|file):/.exec(destination)
  if (entry) {
    const [id, ...anchor] = destination.slice(entry[0].length).split('#')
    mark._link = entry[1]
    mark._entry = id
    if (entry[1] === 'entry' && anchor.length > 0)
      mark._anchor = anchor.join('#')
  } else {
    mark._link = 'url'
    mark.href = destination
    mark.target = '_blank'
  }
  if (title !== undefined) mark.title = title
  const parsed = input[pos] === '{' ? parseAttributes(input, pos) : undefined
  if (parsed && parsed.attributes.every(([key]) => key !== '#')) {
    for (const [key, value] of parsed.attributes)
      mark[linkAttributes.get(key) ?? key] = value
    if (mark._link === 'url' && mark.target === '_self') delete mark.target
    pos = parsed.end
  }
  return {mark, end: pos}
}

function parseAttributes(
  input: string,
  start: number
): {attributes: Array<[string, string]>; end: number} | undefined {
  const attributes: Array<[string, string]> = []
  let pos = start + 1
  while (pos < input.length) {
    while (/\s/.test(input[pos] ?? '')) pos++
    if (input[pos] === '}') return {attributes, end: pos + 1}
    const key = match(/#|[A-Za-z_][\w-]*=/y, input, pos)
    if (!key) return
    pos += key.length
    let value: string | undefined
    if (input[pos] === '"') {
      const quoted = parseQuoted(input, pos)
      if (!quoted) return
      value = quoted.value
      pos = quoted.end
    } else {
      value = match(/[^\s"{}\\]+/y, input, pos)
      if (!value) return
      pos += value.length
    }
    attributes.push([key === '#' ? '#' : key.slice(0, -1), value])
  }
}

function match(
  pattern: RegExp,
  input: string,
  pos: number
): string | undefined {
  pattern.lastIndex = pos
  return pattern.exec(input)?.[0]
}

function parseQuoted(
  input: string,
  start: number
): {value: string; end: number} | undefined {
  let value = ''
  let pos = start + 1
  while (pos < input.length) {
    const char = input[pos]
    if (char === '"') return {value, end: pos + 1}
    if (char === '\\' && pos + 1 < input.length) pos++
    value += input[pos++]
  }
}
