import {
  type ElementNode,
  type Mark,
  Node,
  type TextDoc,
  type TextNode
} from '#/core/TextDoc.js'

/** How the body of a mail fills in its placeholders and links */
export interface MailBody {
  /** The text that stands for a placeholder, as html in `docHtml` */
  fill(key: string): string
  /** The url of a link, undefined to show its text alone */
  href(mark: Mark): string | undefined
}

/** A link mail clients open safely */
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined
  return /^(https?:|mailto:|tel:)/i.test(href.trim()) ? href.trim() : undefined
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** A link around html */
export function linkHtml(url: string, html: string): string {
  return `<a href="${escapeHtml(url)}" style="${styles.a}">${html}</a>`
}

/** A text as html, its line breaks kept */
export function textHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>')
}

/** The text of a document, paragraphs apart by an empty line */
export function docText(doc: TextDoc, href?: MailBody['href']): string {
  return doc
    .map(node => blockText(node, href))
    .filter(Boolean)
    .join('\n\n')
}

function blockText(node: Node, href?: MailBody['href']): string {
  const content = contentOf(node)
  switch (node._type) {
    case 'bulletList':
    case 'orderedList':
      return content
        .map((item, index) => {
          const marker = node._type === 'bulletList' ? '-' : `${index + 1}.`
          return `${marker} ${docText(contentOf(item), href)}`
        })
        .join('\n')
    case 'paragraph':
    case 'heading':
      return inlineText(content, href)
    case 'horizontalRule':
      return '---'
  }
  return docText(content, href)
}

function inlineText(content: TextDoc, href?: MailBody['href']): string {
  return linkRuns(content)
    .map(({mark, nodes}) => {
      const text = nodes
        .map(node =>
          Node.isText(node)
            ? (node.text ?? '')
            : node._type === 'hardBreak'
              ? '\n'
              : ''
        )
        .join('')
      const url = mark && href?.(mark)
      return url && url !== text ? `${text} (${url})` : text
    })
    .join('')
}

const styles = {
  p: 'margin:0 0 16px',
  h1: 'margin:0 0 16px;font-size:24px;line-height:1.3',
  h2: 'margin:0 0 16px;font-size:20px;line-height:1.3',
  h3: 'margin:0 0 12px;font-size:17px;line-height:1.3',
  list: 'margin:0 0 16px;padding:0 0 0 24px',
  li: 'margin:0 0 4px',
  blockquote:
    'margin:0 0 16px;padding:0 0 0 16px;border-left:3px solid #d4d4d4',
  hr: 'margin:24px 0;border:0;border-top:1px solid #e5e5e5',
  a: 'color:#2563eb;text-decoration:underline',
  th: 'padding:8px 16px 8px 0;border-bottom:1px solid #e5e5e5;text-align:left;vertical-align:top;font-weight:600;width:35%',
  td: 'padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:left;vertical-align:top'
}

const markTags: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  subscript: 'sub',
  superscript: 'sup',
  small: 'small'
}

/**
 * A document as an html fragment for mails: inline styles only, as mail
 * clients drop style sheets and classes. A paragraph that holds nothing but
 * a placeholder with an entry in `blocks` is replaced by it, eg. a table.
 */
export function docHtml(
  doc: TextDoc,
  body: MailBody,
  blocks: Record<string, string> = {}
): string {
  return doc.map(node => blockHtml(node, body, blocks)).join('')
}

function blockHtml(
  node: Node,
  body: MailBody,
  blocks: Record<string, string>
): string {
  const content = contentOf(node)
  const tag = (name: string, style: string, inner: string) =>
    `<${name} style="${style}">${inner}</${name}>`
  switch (node._type) {
    case 'paragraph': {
      const only = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(inlineText(content))
      const block = only && blocks[only[1]]
      if (block) return block
      return tag('p', styles.p, inlineHtml(content, body))
    }
    case 'heading': {
      const level = Math.min(
        3,
        Math.max(1, Number((node as ElementNode).level) || 1)
      )
      const name = `h${level}` as 'h1' | 'h2' | 'h3'
      return tag(name, styles[name], inlineHtml(content, body))
    }
    case 'bulletList':
    case 'orderedList':
      return tag(
        node._type === 'bulletList' ? 'ul' : 'ol',
        styles.list,
        content.map(item => tag('li', styles.li, itemHtml(item, body))).join('')
      )
    case 'blockquote':
      return tag('blockquote', styles.blockquote, docHtml(content, body))
    case 'horizontalRule':
      return `<hr style="${styles.hr}">`
  }
  return docHtml(content, body, blocks)
}

/** A list item, its first paragraph without the margin of one */
function itemHtml(item: Node, body: MailBody): string {
  return contentOf(item)
    .map(node =>
      node._type === 'paragraph'
        ? inlineHtml(contentOf(node), body)
        : blockHtml(node, body, {})
    )
    .join('<br>')
}

function inlineHtml(content: TextDoc, body: MailBody): string {
  return linkRuns(content)
    .map(({mark, nodes}) => {
      const html = nodes.map(node => textNodeHtml(node, body)).join('')
      const url = mark && body.href(mark)
      return url ? linkHtml(url, html) : html
    })
    .join('')
}

function textNodeHtml(node: Node, body: MailBody): string {
  if (!Node.isText(node)) return node._type === 'hardBreak' ? '<br>' : ''
  // Keys are slugs, which html does not escape, so the parts split on them
  const html = (node.text ?? '')
    .split(placeholderPattern)
    .map((part, index) => (index % 2 ? body.fill(part) : textHtml(part)))
    .join('')
  return (node.marks ?? []).reduce((inner, mark) => {
    const name = markTags[mark._type]
    return name ? `<${name}>${inner}</${name}>` : inner
  }, html)
}

const placeholderPattern = /\{\{\s*([\w-]+|all answers|submission link)\s*\}\}/

/** Neighbouring text that shares a link, which is one link */
function linkRuns(
  content: TextDoc
): Array<{mark: Mark | undefined; nodes: Array<Node>}> {
  const runs = Array<{mark: Mark | undefined; nodes: Array<Node>}>()
  for (const node of content) {
    const mark = Node.isText(node) ? linkOf(node) : undefined
    const last = runs.at(-1)
    if (last && linkKey(last.mark) === linkKey(mark)) last.nodes.push(node)
    else runs.push({mark, nodes: [node]})
  }
  return runs
}

function linkKey(mark: Mark | undefined): string | null {
  return mark ? (mark._id ?? mark.href ?? '') : null
}

function linkOf(node: TextNode): Mark | undefined {
  return node.marks?.find(mark => mark._type === 'link')
}

function contentOf(node: Node): TextDoc {
  const content = (node as {content?: unknown}).content
  return Array.isArray(content) ? content : []
}

/** Answers as a table of two columns, the label next to the answer */
export function answersTable(answers: Array<[string, string]>): string {
  if (answers.length === 0) return ''
  const rows = answers
    .map(
      ([label, answer]) =>
        `<tr><th style="${styles.th}">${textHtml(label)}</th>` +
        `<td style="${styles.td}">${textHtml(answer)}</td></tr>`
    )
    .join('')
  return (
    '<table role="presentation" width="100%" cellpadding="0" ' +
    `cellspacing="0" style="margin:0 0 16px;border-collapse:collapse">` +
    `${rows}</table>`
  )
}

/**
 * A complete html mail around a fragment: a centered column in the system
 * font, laid out with tables, which every mail client renders alike
 */
export function mailDocument(
  subject: string,
  content: string,
  locale?: string | null
): string {
  const lang = locale ? ` lang="${escapeHtml(locale)}"` : ''
  const font =
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto," +
    'Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a'
  return (
    `<!doctype html><html${lang}><head><meta charset="utf-8">` +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${escapeHtml(subject)}</title></head>` +
    '<body style="margin:0;padding:0;background:#f4f4f5">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="max-width:600px;background:#ffffff;border-radius:8px">' +
    `<tr><td style="padding:32px;${font}">${content}</td></tr>` +
    '</table></td></tr></table></body></html>'
  )
}
