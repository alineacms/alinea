import {createId} from '../Id.js'
import type {ElementNode, Mark, Node, TextDoc, TextNode} from '../TextDoc.js'
import {isRecord} from '../util/Objects.js'

/** Fenced code blocks with this info string hold a rich text block as JSON */
export const markdownBlockLanguage = 'alinea-block'

/**
 * Attributes of a fenced code block, from the words after its language:
 * ```ts id=abc fileName="app.ts" compact holds {id: 'abc', fileName: 'app.ts',
 * compact: true}
 */
export type CodeBlockAttributes = Record<string, string | true>

export interface MarkdownToTextDocOptions {
  /**
   * Create the node for a fenced code block. Defaults to a paragraph holding
   * the code as plain text, since rich text has no built-in code block node.
   */
  codeBlock?(
    code: string,
    language: string | undefined,
    attributes: CodeBlockAttributes
  ): Node
  /**
   * Create the mark for a link. Defaults to a url link mark. Return undefined
   * to render the link text without a link.
   */
  link?(href: string, title: string | undefined): Mark | undefined
  /** Create the node for an image that stands on its own line */
  image?(src: string, alt: string, title: string | undefined): Node | undefined
}

const fencePattern = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`]*?)[ \t]*$/
const infoPattern = /([^\s=]+)=(?:"([^"]*)"|(\S*))|(\S+)/g
const headingPattern = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const rulePattern = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const quotePattern = /^ {0,3}> ?(.*)$/
const listPattern = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+(.*))?$/
const tableSeparatorPattern =
  /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
const imagePattern = /^!\[([^\]]*)\]\(\s*<?([^\s>)]*)>?(?:\s+"([^"]*)")?\s*\)$/
const htmlMarks: Record<string, string> = {
  u: 'underline',
  ins: 'underline',
  sub: 'subscript',
  sup: 'superscript',
  small: 'small',
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  s: 'strike',
  del: 'strike'
}

/**
 * Convert Markdown (CommonMark subset plus GFM strikethrough and tables) to a
 * rich text document. Inline code has no mark in rich text, a code span is
 * kept as plain text with its backticks.
 */
export function markdownToTextDoc(
  markdown: string,
  options: MarkdownToTextDocOptions = {}
): TextDoc {
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')
  return new MarkdownParser(options).blocks(lines.split('\n'))
}

class MarkdownParser {
  #options: MarkdownToTextDocOptions

  constructor(options: MarkdownToTextDocOptions) {
    this.#options = options
  }

  blocks(lines: Array<string>): TextDoc {
    const result: TextDoc = []
    let index = 0
    while (index < lines.length) {
      const line = lines[index]
      if (!line.trim()) {
        index++
        continue
      }
      const fence = fencePattern.exec(line)
      if (fence) {
        const marker = fence[1]
        const code: Array<string> = []
        index++
        while (index < lines.length) {
          const current = lines[index]
          const closing = current.trim()
          if (
            closing.startsWith(marker[0].repeat(marker.length)) &&
            closing.replaceAll(marker[0], '') === ''
          ) {
            index++
            break
          }
          code.push(current)
          index++
        }
        result.push(this.codeBlock(code.join('\n'), fence[2]))
        continue
      }
      const heading = headingPattern.exec(line)
      if (heading) {
        result.push({
          _type: 'heading',
          level: heading[1].length,
          content: this.inline(heading[2] ?? '')
        })
        index++
        continue
      }
      if (rulePattern.test(line)) {
        result.push({_type: 'horizontalRule'})
        index++
        continue
      }
      if (quotePattern.test(line)) {
        const quoted: Array<string> = []
        while (index < lines.length) {
          const match = quotePattern.exec(lines[index])
          if (!match) break
          quoted.push(match[1])
          index++
        }
        result.push({_type: 'blockquote', content: this.blocks(quoted)})
        continue
      }
      if (listPattern.test(line)) {
        index = this.list(lines, index, result)
        continue
      }
      if (
        line.includes('|') &&
        index + 1 < lines.length &&
        tableSeparatorPattern.test(lines[index + 1]) &&
        lines[index + 1].includes('-')
      ) {
        index = this.table(lines, index, result)
        continue
      }
      const paragraph: Array<string> = [line]
      index++
      while (index < lines.length && !this.#interrupts(lines[index]))
        paragraph.push(lines[index++])
      result.push(...this.paragraph(paragraph))
    }
    return result
  }

  #interrupts(line: string): boolean {
    return (
      !line.trim() ||
      fencePattern.test(line) ||
      headingPattern.test(line) ||
      rulePattern.test(line) ||
      quotePattern.test(line) ||
      listPattern.test(line)
    )
  }

  codeBlock(code: string, info: string): Node {
    const {language, attributes} = parseInfo(info)
    if (language === markdownBlockLanguage) {
      try {
        const block: unknown = JSON.parse(code)
        if (isRecord(block) && typeof block._type === 'string')
          return block as unknown as Node
      } catch {
        // Fall through and keep the text
      }
    }
    if (this.#options.codeBlock)
      return this.#options.codeBlock(code, language, attributes)
    const content: TextDoc = []
    code.split('\n').forEach((line, index) => {
      if (index > 0) content.push({_type: 'hardBreak'})
      if (line) content.push({_type: 'text', text: line})
    })
    return {_type: 'paragraph', content}
  }

  paragraph(lines: Array<string>): TextDoc {
    const text = lines.map(line => line.replace(/^ +/, ''))
    if (text.length === 1) {
      const image = imagePattern.exec(text[0].trim())
      if (image) {
        const node = this.#image(image[2], image[1], image[3])
        if (node) return [node]
      }
    }
    return [{_type: 'paragraph', content: this.inline(text.join('\n'))}]
  }

  #image(src: string, alt: string, title: string | undefined) {
    if (this.#options.image) return this.#options.image(src, alt, title)
    const node: ElementNode = {_type: 'image', src, alt}
    if (title) node.title = title
    return node
  }

  list(lines: Array<string>, start: number, result: TextDoc): number {
    const first = listPattern.exec(lines[start])!
    const ordered = /\d/.test(first[2])
    const delimiter = first[2].at(-1)
    const items: TextDoc = []
    let index = start
    while (index < lines.length) {
      const match = listPattern.exec(lines[index])
      if (!match || /\d/.test(match[2]) !== ordered) break
      if (match[2].at(-1) !== delimiter) break
      const markerWidth = match[1].length + match[2].length
      const firstText = match[4] ?? ''
      const padding = match[3] ? match[3].length - firstText.length : 1
      const contentIndent = markerWidth + Math.min(Math.max(padding, 1), 4)
      const itemLines = [firstText]
      index++
      while (index < lines.length) {
        const line = lines[index]
        if (!line.trim()) {
          // A blank line continues the item when indented content follows
          let next = index + 1
          while (next < lines.length && !lines[next].trim()) next++
          if (next < lines.length && indentOf(lines[next]) >= contentIndent) {
            for (; index < next; index++) itemLines.push('')
            continue
          }
          break
        }
        if (indentOf(line) >= contentIndent) {
          itemLines.push(line.slice(contentIndent))
        } else if (listPattern.test(line) || this.#interrupts(line)) {
          break
        } else {
          // Lazy continuation of the item's paragraph
          itemLines.push(line.trim())
        }
        index++
      }
      items.push({_type: 'listItem', content: this.#listItem(itemLines)})
      // Items separated by blank lines still belong to the same list
      let next = index
      while (next < lines.length && !lines[next].trim()) next++
      const following = next < lines.length && listPattern.exec(lines[next])
      if (
        following &&
        next > index &&
        /\d/.test(following[2]) === ordered &&
        following[2].at(-1) === delimiter
      )
        index = next
    }
    const list: ElementNode = {
      _type: ordered ? 'orderedList' : 'bulletList',
      content: items
    }
    const startNumber = ordered ? Number.parseInt(first[2], 10) : 1
    if (ordered && startNumber !== 1) list.start = startNumber
    result.push(list)
    return index
  }

  #listItem(lines: Array<string>): TextDoc {
    const content = this.blocks(lines)
    if (content.length === 0) return [{_type: 'paragraph', content: []}]
    return content
  }

  table(lines: Array<string>, start: number, result: TextDoc): number {
    const header = splitTableRow(lines[start])
    let index = start + 2
    const rows: TextDoc = [
      {
        _type: 'tableRow',
        content: header.map(cell => ({
          _type: 'tableHeader',
          content: [{_type: 'paragraph', content: this.inline(cell)}]
        }))
      }
    ]
    while (index < lines.length) {
      const line = lines[index]
      if (!line.trim() || !line.includes('|')) break
      const cells = splitTableRow(line)
      rows.push({
        _type: 'tableRow',
        content: header.map((_, cellIndex) => ({
          _type: 'tableCell',
          content: [
            {_type: 'paragraph', content: this.inline(cells[cellIndex] ?? '')}
          ]
        }))
      })
      index++
    }
    result.push({_type: 'table', content: rows})
    return index
  }

  inline(text: string, marks: Array<Mark> = []): TextDoc {
    return mergeText(new InlineParser(this.#options, text).parse(marks))
  }
}

/** The language is the first word of the info string, attributes follow */
function parseInfo(info: string): {
  language: string | undefined
  attributes: CodeBlockAttributes
} {
  let language: string | undefined
  const attributes: CodeBlockAttributes = {}
  let first = true
  for (const match of info.matchAll(infoPattern)) {
    const [, key, quoted, plain, word] = match
    if (word !== undefined) {
      if (first) language = word
      else attributes[word] = true
    } else {
      attributes[key] = quoted ?? plain ?? ''
    }
    first = false
  }
  return {language, attributes}
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

function splitTableRow(line: string): Array<string> {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)
  const cells: Array<string> = []
  let current = ''
  for (let index = 0; index < row.length; index++) {
    const char = row[index]
    if (char === '\\' && row[index + 1] === '|') {
      current += '|'
      index++
    } else if (char === '|') {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

const escapable = /[\\`*_{}[\]()#+\-.!|~<>"'&]/

class InlineParser {
  #options: MarkdownToTextDocOptions
  #text: string

  constructor(options: MarkdownToTextDocOptions, text: string) {
    this.#options = options
    this.#text = text
  }

  parse(marks: Array<Mark>, from = 0, to = this.#text.length): TextDoc {
    const text = this.#text
    const result: TextDoc = []
    let buffer = ''
    const flush = () => {
      if (buffer) result.push(textNode(buffer, marks))
      buffer = ''
    }
    let index = from
    while (index < to) {
      const char = text[index]
      if (char === '\\') {
        const next = text[index + 1]
        if (next === '\n') {
          flush()
          result.push({_type: 'hardBreak'})
          index += 2
          continue
        }
        if (next && escapable.test(next)) {
          buffer += next
          index += 2
          continue
        }
      }
      if (char === '\n') {
        // Two trailing spaces make a hard break, otherwise a soft break
        if (buffer.endsWith('  ')) {
          buffer = buffer.replace(/ +$/, '')
          flush()
          result.push({_type: 'hardBreak'})
        } else {
          buffer = `${buffer.replace(/ +$/, '')} `
        }
        index++
        while (text[index] === ' ') index++
        continue
      }
      if (char === '`') {
        const run = runLength(text, index, '`')
        const close = text.indexOf('`'.repeat(run), index + run)
        if (close !== -1 && close < to) {
          // Rich text has no inline code mark: the span stays literal text,
          // backticks included, and its contents are not parsed further
          buffer += text.slice(index, close + run).replace(/\n/g, ' ')
          index = close + run
          continue
        }
        buffer += '`'.repeat(run)
        index += run
        continue
      }
      if (char === '!' && text[index + 1] === '[') {
        const link = this.#linkAt(index + 1, to)
        if (link) {
          // Rich text images are block nodes, inline images keep their alt text
          buffer += text.slice(link.labelFrom, link.labelTo)
          index = link.end
          continue
        }
      }
      if (char === '[') {
        const link = this.#linkAt(index, to)
        if (link) {
          flush()
          const mark = this.#options.link
            ? this.#options.link(link.href, link.title)
            : urlMark(link.href, link.title)
          result.push(
            ...this.parse(
              mark ? [...marks, mark] : marks,
              link.labelFrom,
              link.labelTo
            )
          )
          index = link.end
          continue
        }
      }
      if (char === '<') {
        const autolink = /^<((?:https?|mailto):[^\s<>]+)>/.exec(
          text.slice(index, to)
        )
        if (autolink) {
          flush()
          const href = autolink[1]
          const mark = this.#options.link
            ? this.#options.link(href, undefined)
            : urlMark(href, undefined)
          result.push(textNode(href, mark ? [...marks, mark] : marks))
          index += autolink[0].length
          continue
        }
        const breakTag = /^<br\s*\/?>/i.exec(text.slice(index, to))
        if (breakTag) {
          flush()
          result.push({_type: 'hardBreak'})
          index += breakTag[0].length
          continue
        }
        const tag = /^<([a-z]+)>/i.exec(text.slice(index, to))
        const markType = tag && htmlMarks[tag[1].toLowerCase()]
        if (tag && markType) {
          const closeTag = `</${tag[1]}>`
          const close = text
            .slice(index, to)
            .toLowerCase()
            .indexOf(closeTag.toLowerCase())
          if (close !== -1) {
            flush()
            const inner = index + tag[0].length
            result.push(
              ...this.parse([...marks, {_type: markType}], inner, index + close)
            )
            index += close + closeTag.length
            continue
          }
        }
      }
      if (char === '*' || char === '_' || char === '~') {
        const run = runLength(text, index, char, to)
        const size = char === '~' ? 2 : Math.min(run, 3)
        const canOpen =
          (char === '~' ? run >= 2 : true) &&
          index + run < to &&
          !/\s/.test(text[index + run]) &&
          (char !== '_' || !/[\p{L}\p{N}]/u.test(text[index - 1] ?? ''))
        if (canOpen) {
          const close = this.#closingDelimiter(char, size, index + size, to)
          if (close !== -1) {
            flush()
            const inner: Array<Mark> =
              char === '~'
                ? [{_type: 'strike'}]
                : size === 3
                  ? [{_type: 'bold'}, {_type: 'italic'}]
                  : size === 2
                    ? [{_type: 'bold'}]
                    : [{_type: 'italic'}]
            result.push(
              ...this.parse([...marks, ...inner], index + size, close)
            )
            index = close + size
            continue
          }
        }
        buffer += text.slice(index, index + run)
        index += run
        continue
      }
      buffer += char
      index++
    }
    flush()
    return result
  }

  #closingDelimiter(char: string, size: number, from: number, to: number) {
    const text = this.#text
    let index = from
    while (index < to) {
      const current = text[index]
      if (current === '\\') {
        index += 2
        continue
      }
      if (current === '`') {
        const run = runLength(text, index, '`')
        const close = text.indexOf('`'.repeat(run), index + run)
        index = close === -1 || close >= to ? index + run : close + run
        continue
      }
      if (current === '[') {
        const link = this.#linkAt(index, to)
        if (link) {
          index = link.end
          continue
        }
      }
      if (current === char) {
        const run = runLength(text, index, char, to)
        const precededBySpace = /\s/.test(text[index - 1] ?? ' ')
        const followedByWord =
          char === '_' && /[\p{L}\p{N}]/u.test(text[index + run] ?? '')
        if (
          run >= size &&
          !precededBySpace &&
          !followedByWord &&
          index > from &&
          index + size <= to
        ) {
          // For a run longer than the delimiter the closing part is at the end
          return index + run - size
        }
        index += run
        continue
      }
      index++
    }
    return -1
  }

  #linkAt(start: number, to: number) {
    const text = this.#text
    let depth = 0
    let index = start
    for (; index < to; index++) {
      const char = text[index]
      if (char === '\\') {
        index++
        continue
      }
      if (char === '[') depth++
      if (char === ']') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth !== 0 || text[index + 1] !== '(') return undefined
    const labelTo = index
    const destination =
      /^\(\s*(?:<([^>\n]*)>|([^\s()]*(?:\([^\s()]*\)[^\s()]*)*))(?:\s+"([^"]*)"|\s+'([^']*)')?\s*\)/.exec(
        text.slice(index + 1, to)
      )
    if (!destination) return undefined
    return {
      labelFrom: start + 1,
      labelTo,
      href: destination[1] ?? destination[2] ?? '',
      title: destination[3] ?? destination[4],
      end: index + 1 + destination[0].length
    }
  }
}

function runLength(
  text: string,
  index: number,
  char: string,
  to = text.length
): number {
  let end = index
  while (end < to && text[end] === char) end++
  return end - index
}

function textNode(text: string, marks: Array<Mark>): TextNode {
  const node: TextNode = {_type: 'text', text}
  if (marks.length > 0) node.marks = marks
  return node
}

function urlMark(href: string, title: string | undefined): Mark {
  const mark: Mark = {_type: 'link', _id: createId(), _link: 'url', href}
  if (title) mark.title = title
  return mark
}

function mergeText(doc: TextDoc): TextDoc {
  const result: TextDoc = []
  for (const node of doc) {
    const previous = result.at(-1)
    if (
      previous &&
      node._type === 'text' &&
      previous._type === 'text' &&
      sameMarks((previous as TextNode).marks, (node as TextNode).marks)
    ) {
      const text = `${(previous as TextNode).text ?? ''}${(node as TextNode).text ?? ''}`
      result[result.length - 1] = {...previous, text} as TextNode
      continue
    }
    result.push(node)
  }
  return result
}

function sameMarks(
  a: Array<Mark> | undefined,
  b: Array<Mark> | undefined
): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((mark, index) => mark === b[index])
}
