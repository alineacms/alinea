import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {cms} from '@/cms'
import {Doc} from '@/schema/Doc'

export const runtime = 'nodejs'

type RichNode = Record<string, unknown> & {_type?: string}

function asArray(value: unknown): Array<RichNode> | undefined {
  return Array.isArray(value) ? (value as Array<RichNode>) : undefined
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeText(input: string) {
  return input
}

function renderInline(
  nodes: Array<RichNode> | undefined,
  entryMap: Map<string, {url: string}>
) {
  if (!Array.isArray(nodes)) return ''
  return nodes
    .map(node => {
      if (!node) return ''
      if (node._type === 'text') {
        let text = asString(node.text)
        if (Array.isArray(node.marks)) {
          const linkMark = node.marks.find(
            mark => mark && typeof mark === 'object' && mark._type === 'link'
          ) as RichNode | undefined
          if (linkMark) {
            const href =
              (typeof linkMark.href === 'string' && linkMark.href) ||
              (typeof linkMark._entry === 'string' &&
                entryMap.get(linkMark._entry)?.url)
            if (href) text = `[${text}](${href})`
          }
        }
        return normalizeText(text)
      }
      if (node._type === 'hardBreak') return '\n'
      return ''
    })
    .join('')
}

function renderListItem(
  node: RichNode,
  entryMap: Map<string, {url: string}>,
  mediaMap: Map<string, {title: string; location: string}>
) {
  const content = asArray(node.content) || []
  const parts: Array<string> = []
  for (const child of content) {
    if (!child) continue
    if (child._type === 'paragraph') {
      const text = renderInline(asArray(child.content), entryMap).trim()
      if (text) parts.push(text)
    } else if (child._type === 'bulletList' || child._type === 'orderedList') {
      const nested = renderNode(child, entryMap, mediaMap)
      if (nested) parts.push(nested.replace(/\n+/g, ' '))
    }
  }
  return parts.join(' ').trim()
}

function renderNode(
  node: RichNode,
  entryMap: Map<string, {url: string}>,
  mediaMap: Map<string, {title: string; location: string}>
) {
  if (!node) return ''
  switch (node._type) {
    case 'paragraph': {
      return renderInline(asArray(node.content), entryMap).trim()
    }
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(node.level) || 2))
      const prefix = '#'.repeat(level)
      const text = renderInline(asArray(node.content), entryMap).trim()
      return text ? `${prefix} ${text}` : ''
    }
    case 'bulletList': {
      const items = (asArray(node.content) || [])
        .map(item => {
          const text = renderListItem(item, entryMap, mediaMap)
          return text ? `- ${text}` : ''
        })
        .filter(Boolean)
      return items.join('\n')
    }
    case 'orderedList': {
      const items = (asArray(node.content) || [])
        .map((item, index) => {
          const text = renderListItem(item, entryMap, mediaMap)
          return text ? `${index + 1}. ${text}` : ''
        })
        .filter(Boolean)
      return items.join('\n')
    }
    case 'CodeBlock':
    case 'ExampleBlock': {
      const code = normalizeText(asString(node.code)).trimEnd()
      const language = normalizeText(asString(node.language)).trim()
      const fileName = normalizeText(asString(node.fileName)).trim()
      const lines: Array<string> = []
      if (fileName) lines.push(`File: ${fileName}`)
      lines.push(`\`\`\`${language}`.trimEnd())
      lines.push(code)
      lines.push('```')
      return lines.join('\n')
    }
    case 'CodeVariantsBlock': {
      const variants = asArray(node.variants) || []
      const blocks: Array<string> = []
      for (const variant of variants) {
        const name = normalizeText(asString(variant.name)).trim()
        const language = normalizeText(asString(variant.language)).trim()
        const code = normalizeText(asString(variant.code)).trimEnd()
        if (name) blocks.push(`Variant: ${name}`)
        blocks.push(`\`\`\`${language}`.trimEnd())
        blocks.push(code)
        blocks.push('```')
        blocks.push('')
      }
      return blocks.join('\n').trimEnd()
    }
    case 'NoticeBlock': {
      const level = normalizeText(asString(node.level) || 'info').trim()
      const body = renderNodes(node.body, entryMap, mediaMap).trim()
      return body ? `Note (${level}): ${body}` : `Note (${level})`
    }
    case 'ImageBlock': {
      const image =
        node.image && typeof node.image === 'object'
          ? (node.image as Record<string, unknown>)
          : null
      const entryId = image ? (image._entry as string | undefined) : undefined
      if (typeof entryId === 'string') {
        const image = mediaMap.get(entryId)
        if (image) {
          const title = normalizeText(image.title || '').trim()
          const location = normalizeText(image.location || '').trim()
          if (title && location) return `Image: ${title} (${location})`
          if (location) return `Image: ${location}`
        }
      }
      return 'Image'
    }
    case 'FrameworkBlock': {
      const blocks: Array<string> = []
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('_')) continue
        if (!Array.isArray(value) || value.length === 0) continue
        blocks.push(`Framework: ${normalizeText(key)}`)
        blocks.push(renderNodes(value, entryMap, mediaMap))
      }
      return blocks.filter(Boolean).join('\n\n')
    }
    case 'ChapterLinkBlock': {
      const link = node.link
      if (!link || typeof link !== 'object') return ''
      const linkObj = link as Record<string, unknown>
      const entryId = asString(linkObj._entry)
      const url = entryId ? entryMap.get(entryId)?.url : null
      const title = normalizeText(asString(linkObj.title)).trim()
      const description = normalizeText(asString(linkObj.description)).trim()
      const label = title || 'Chapter link'
      const details = [label, url ? `(${url})` : '', description].filter(
        Boolean
      )
      return details.join(' ').trim()
    }
    default:
      return ''
  }
}

function renderNodes(
  nodes: unknown,
  entryMap: Map<string, {url: string}>,
  mediaMap: Map<string, {title: string; location: string}>
) {
  if (!Array.isArray(nodes)) return ''
  const blocks: Array<string> = []
  for (const node of nodes) {
    const rendered = renderNode(node, entryMap, mediaMap)
    if (rendered) blocks.push(rendered)
  }
  return blocks.join('\n\n')
}

export const dynamic = 'force-static'

export async function GET() {
  const docsRoot = await cms.get({
    url: '/docs',
    select: {
      id: Entry.id,
      url: Entry.url,
      title: Entry.title,
      navigationTitle: Doc.navigationTitle,
      body: Doc.body
    }
  })
  const docsChildren = await cms.find({
    location: cms.workspaces.main.pages.docs,
    disableSync: true,
    select: {
      id: Entry.id,
      url: Entry.url,
      title: Entry.title,
      navigationTitle: Doc.navigationTitle,
      body: Doc.body
    }
  })
  const docsEntries = [docsRoot, ...docsChildren].filter(Boolean)

  const entryMap = new Map<string, {url: string}>()
  for (const entry of docsEntries) {
    entryMap.set(entry.id, {url: entry.url})
  }

  const media = await cms.find({
    location: cms.workspaces.main.media,
    disableSync: true,
    select: {
      id: Entry.id,
      title: Query.title,
      location: Query.url
    }
  })
  const mediaMap = new Map<string, {title: string; location: string}>()
  for (const item of media) {
    mediaMap.set(item.id, {
      title: typeof item.title === 'string' ? item.title : '',
      location: typeof item.location === 'string' ? item.location : ''
    })
  }

  const output: Array<string> = []
  output.push('# Alinea CMS Docs')
  output.push('')

  docsEntries
    .slice()
    .sort((a, b) => a.url.localeCompare(b.url))
    .forEach(entry => {
      const title = normalizeText(
        entry.navigationTitle || entry.title || 'Untitled'
      )
      output.push(`### ${title} (${entry.url})`)
      const body = renderNodes(entry.body, entryMap, mediaMap)
      if (body) output.push(body)
      output.push('')
    })

  return new Response(output.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  })
}
