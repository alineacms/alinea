import type {Mark, Node, TextDoc, TextNode} from '../TextDoc.js'
import {isRecord} from '../util/Objects.js'
import {markdownBlockLanguage} from './MarkdownToTextDoc.js'

export interface TextDocToMarkdownOptions {
  /**
   * The href to render for a link mark. Defaults to the mark's href, or
   * `entry:<id>` for a link to an entry.
   */
  href?(mark: Mark): string | undefined
  /** The src to render for an image node */
  src?(node: Record<string, unknown>): string | undefined
  /**
   * Render a rich text block. Defaults to a fenced code block for blocks
   * holding `code` (and `language`) with other scalar fields in the info
   * string (```ts id=abc fileName=app.ts), and a JSON fenced block with the
   * `alinea-block` info string for other blocks, which Markdown to TextDoc
   * turns back into the same block.
   */
  block?(node: Record<string, unknown>): string | undefined
}

/** Render a rich text document as Markdown */
export function textDocToMarkdown(
  doc: TextDoc | undefined,
  options: TextDocToMarkdownOptions = {}
): string {
  if (!Array.isArray(doc)) return ''
  const writer = new MarkdownWriter(options)
  const result: Array<string> = []
  for (const node of doc) {
    const rendered = writer.topLevel(node)
    if (rendered !== undefined) result.push(rendered)
  }
  return result.join('\n\n')
}

const htmlMarks: Record<string, string> = {
  underline: 'u',
  subscript: 'sub',
  superscript: 'sup',
  small: 'small'
}

class MarkdownWriter {
  #options: TextDocToMarkdownOptions
  #escapeBackticks = true
  /** Writing a link label or image alt, which ends at the first `]` */
  #inLabel = false

  constructor(options: TextDocToMarkdownOptions) {
    this.#options = options
  }

  /**
   * Inline code has no mark, backticks are plain text: code spans in text are
   * written as they are and read back the same. Other backticks only need
   * escaping when they could pair up, which takes two of them in a block.
   */
  topLevel(node: Node): string | undefined {
    this.#escapeBackticks = backticks(node) > 1
    try {
      return this.block(node)
    } finally {
      this.#escapeBackticks = true
    }
  }

  blocks(doc: TextDoc): Array<string> {
    const result: Array<string> = []
    for (const node of doc) {
      const rendered = this.block(node)
      if (rendered !== undefined) result.push(rendered)
    }
    return result
  }

  block(node: Node): string | undefined {
    const record = node as Record<string, unknown>
    const content = Array.isArray(record.content)
      ? (record.content as TextDoc)
      : []
    switch (node._type) {
      case 'paragraph':
        return this.inline(content)
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(record.level) || 1))
        return `${'#'.repeat(level)} ${this.inline(content)}`.trimEnd()
      }
      case 'blockquote':
        return prefixLines(this.blocks(content).join('\n\n'), '> ', '>')
      case 'bulletList':
        return content.map(item => this.listItem(item, '- ')).join('\n')
      case 'orderedList': {
        const start = Number(record.start) || 1
        return content
          .map((item, index) => this.listItem(item, `${start + index}. `))
          .join('\n')
      }
      case 'horizontalRule':
        return '---'
      case 'hardBreak':
        return ''
      case 'image': {
        const src = this.#options.src?.(record) ?? imageSrc(record)
        const alt = typeof record.alt === 'string' ? record.alt : ''
        const title =
          typeof record.title === 'string' && record.title
            ? ` "${record.title.replaceAll('"', '\\"')}"`
            : ''
        return `![${this.label(() => this.escape(alt))}](${src}${title})`
      }
      case 'table':
        return this.table(content)
      case 'text':
        return this.inline([node])
    }
    if (isBlock(node)) {
      const custom = this.#options.block?.(record)
      if (custom !== undefined) return custom
      return defaultBlock(record)
    }
    // Unknown element: keep its text
    return content.length > 0 ? this.inline(content) : undefined
  }

  listItem(item: Node, marker: string): string {
    const record = item as Record<string, unknown>
    const content = Array.isArray(record.content)
      ? (record.content as TextDoc)
      : []
    const indent = ' '.repeat(marker.length)
    const parts: Array<string> = []
    content.forEach((child, index) => {
      const rendered = this.block(child)
      if (rendered === undefined) return
      const isList =
        child._type === 'bulletList' || child._type === 'orderedList'
      // Consecutive paragraphs in an item need a blank line between them
      const separator =
        index === 0 ? '' : isList ? '\n' : parts.length ? '\n\n' : ''
      parts.push(separator + rendered)
    })
    const text = parts.join('')
    return marker + prefixLines(text, indent, '').slice(indent.length)
  }

  table(rows: TextDoc): string {
    const cells = rows.map(row => {
      const record = row as Record<string, unknown>
      const content = Array.isArray(record.content)
        ? (record.content as TextDoc)
        : []
      return content.map(cell => {
        const cellRecord = cell as Record<string, unknown>
        const cellContent = Array.isArray(cellRecord.content)
          ? (cellRecord.content as TextDoc)
          : []
        return this.blocks(cellContent)
          .join(' ')
          .replace(/\n+/g, ' ')
          .replaceAll('|', '\\|')
      })
    })
    if (cells.length === 0) return ''
    const width = Math.max(...cells.map(row => row.length), 1)
    const line = (row: Array<string>) =>
      `| ${Array.from({length: width}, (_, index) => row[index] ?? '').join(' | ')} |`
    const [header, ...body] = cells
    return [
      line(header),
      `| ${Array.from({length: width}, () => '---').join(' | ')} |`,
      ...body.map(line)
    ].join('\n')
  }

  inline(content: TextDoc): string {
    let result = ''
    let index = 0
    while (index < content.length) {
      const node = content[index]
      if (node._type === 'hardBreak') {
        result += '\\\n'
        index++
        continue
      }
      if (node._type !== 'text') {
        const rendered = this.block(node)
        if (rendered) result += rendered
        index++
        continue
      }
      const link = linkMark(node as TextNode)
      if (!link) {
        result += this.marked(node as TextNode)
        index++
        continue
      }
      // Group adjacent text sharing the same link into one Markdown link
      let label = ''
      while (index < content.length) {
        const current = content[index]
        if (current._type !== 'text') break
        const currentLink = linkMark(current as TextNode)
        if (!currentLink || !sameLink(currentLink, link)) break
        label += this.label(() => this.marked(current as TextNode))
        index++
      }
      const href = this.#options.href?.(link) ?? linkHref(link)
      const title =
        typeof link.title === 'string' && link.title
          ? ` "${link.title.replaceAll('"', '\\"')}"`
          : ''
      result += href ? `[${label}](${href}${title})` : label
    }
    return result
  }

  marked(node: TextNode): string {
    const text = node.text ?? ''
    if (!text) return ''
    const escaped = this.escape(text)
    const marks = (node.marks ?? []).filter(mark => mark._type !== 'link')
    if (marks.length === 0) return escaped
    // Keep surrounding whitespace outside of the delimiters
    const leading = /^\s*/.exec(escaped)![0]
    const trailing = /\s*$/.exec(escaped.slice(leading.length))![0]
    let inner = escaped.slice(leading.length, escaped.length - trailing.length)
    if (!inner) return escaped
    for (const mark of marks) {
      switch (mark._type) {
        case 'bold':
          inner = `**${inner}**`
          break
        case 'italic':
          inner = `*${inner}*`
          break
        case 'strike':
          inner = `~~${inner}~~`
          break
        default: {
          const tag = htmlMarks[mark._type]
          if (tag) inner = `<${tag}>${inner}</${tag}>`
        }
      }
    }
    return leading + inner + trailing
  }

  label(write: () => string): string {
    const inLabel = this.#inLabel
    this.#inLabel = true
    try {
      return write()
    } finally {
      this.#inLabel = inLabel
    }
  }

  escape(text: string): string {
    const spans = codeSpans(text, this.#inLabel)
    if (spans.length === 0) return escapeText(text, this.#escapeBackticks)
    // Code spans are not parsed further, write them without escapes
    const verbatim: Array<string> = []
    let masked = ''
    let last = 0
    for (const [from, to] of spans) {
      masked += `${text.slice(last, from)}\uE000${verbatim.length}\uE001`
      verbatim.push(text.slice(from, to))
      last = to
    }
    masked += text.slice(last)
    return escapeText(masked, this.#escapeBackticks).replace(
      /\uE000(\d+)\uE001/g,
      (_, index) => verbatim[Number(index)]
    )
  }
}

/**
 * The code spans Markdown to TextDoc finds in a text: a backtick run up to the
 * next run of the same length. Spans holding characters that end a table cell
 * or a line, or brackets inside a link label (which ends at the first `]`), are
 * left out, those are escaped instead.
 */
function codeSpans(
  text: string,
  inLabel: boolean
): Array<[from: number, to: number]> {
  const unsafe = inLabel ? /[\n[\]|]/ : /[\n|]/
  const spans: Array<[number, number]> = []
  let index = text.indexOf('`')
  while (index !== -1) {
    let run = 1
    while (text[index + run] === '`') run++
    const close = text.indexOf('`'.repeat(run), index + run)
    if (close === -1) {
      index = text.indexOf('`', index + run)
      continue
    }
    const end = close + run
    if (!unsafe.test(text.slice(index, end))) spans.push([index, end])
    index = text.indexOf('`', end)
  }
  return spans
}

function backticks(value: unknown): number {
  if (Array.isArray(value))
    return value.reduce((sum: number, item) => sum + backticks(item), 0)
  if (!isRecord(value)) return 0
  let count = 0
  if (value._type === 'text' && typeof value.text === 'string')
    count += value.text.split('`').length - 1
  if (typeof value.alt === 'string') count += value.alt.split('`').length - 1
  if (Array.isArray(value.content)) count += backticks(value.content)
  return count
}

function isBlock(node: Node): boolean {
  const first = node._type[0]
  return first !== undefined && first === first.toUpperCase()
}

function defaultBlock(block: Record<string, unknown>): string {
  const {_type, _id, code, language, ...rest} = block
  const info: Array<string> = []
  let asCode =
    typeof code === 'string' &&
    (language === undefined ||
      (typeof language === 'string' && /^[^\s="`]*$/.test(language)))
  if (typeof language === 'string' && language) info.push(language)
  if (typeof _id === 'string') {
    if (/^[^\s"`]+$/.test(_id)) info.push(`id=${_id}`)
    else asCode = false
  }
  for (const [key, value] of Object.entries(rest)) {
    if (isEmptyValue(value)) continue
    if (value === true) info.push(key)
    else if (typeof value === 'number') info.push(`${key}=${value}`)
    else if (typeof value === 'string' && /^[^\s"`]+$/.test(value))
      info.push(`${key}=${value}`)
    else if (typeof value === 'string' && !/["\n`]/.test(value))
      info.push(`${key}="${value}"`)
    else asCode = false
  }
  if (asCode) {
    const source = code as string
    const longest = Math.max(
      0,
      ...(source.match(/`+/g) ?? []).map(run => run.length)
    )
    const fence = '`'.repeat(Math.max(3, longest + 1))
    return `${fence}${info.join(' ')}\n${source}\n${fence}`
  }
  return `\`\`\`${markdownBlockLanguage}\n${JSON.stringify(block, null, 2)}\n\`\`\``
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false)
    return true
  if (Array.isArray(value)) return value.length === 0
  if (isRecord(value)) return Object.values(value).every(isEmptyValue)
  return false
}

function imageSrc(node: Record<string, unknown>): string {
  if (typeof node._entry === 'string') return `entry:${node._entry}`
  return typeof node.src === 'string' ? node.src : ''
}

function linkMark(node: TextNode): Mark | undefined {
  return node.marks?.find(mark => mark._type === 'link')
}

function linkHref(mark: Mark): string | undefined {
  if (typeof mark._entry === 'string') {
    const suffix = mark._anchor ? `#${mark._anchor}` : ''
    return `entry:${mark._entry}${suffix}`
  }
  return mark.href
}

function sameLink(a: Mark, b: Mark): boolean {
  if (a === b) return true
  if (a._id || b._id) return a._id === b._id
  return a.href === b.href && a._entry === b._entry
}

function prefixLines(text: string, prefix: string, emptyPrefix: string) {
  return text
    .split('\n')
    .map(line => (line ? prefix + line : emptyPrefix))
    .join('\n')
}

/**
 * Escape what would otherwise be read as Markdown. Backticks only when asked
 * (see topLevel), `<` only where it could start an autolink or html mark.
 */
function escapeText(text: string, escapeBackticks: boolean): string {
  return (
    text
      .replace(
        escapeBackticks ? /[\\`*[\]~]/g : /[\\*[\]~]/g,
        char => `\\${char}`
      )
      .replace(
        /<(?=(?:https?|mailto):[^\s<>]+>|br\s*\/?>|(?:u|ins|sub|sup|small|b|strong|i|em|s|del)>)/gi,
        '\\<'
      )
      // Underscores inside words never start emphasis
      .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\_')
      .replace(/^([#>+-])(?=\s|$)/gm, '\\$1')
      .replace(/^(\d+)([.)])(?=\s|$)/gm, '$1\\$2')
      .replace(/\n/g, '\\\n')
  )
}
