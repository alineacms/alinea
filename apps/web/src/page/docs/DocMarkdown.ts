import {siteUrl, withSiteUrl} from '@/cms'
import {
  componentCatalogMarkdown,
  componentExampleMarkdown,
  componentPropsMarkdown,
  fieldCatalogMarkdown
} from '@/page/catalog/catalogMarkdown'

export type DocEntryMap = Map<string, {url: string}>
export type DocMediaMap = Map<string, {title: string; location: string}>
/** Turns a site path, eg. `/docs/fields#text`, into the link to render */
export type DocLink = (path: string) => string

interface RenderContext {
  entryMap: DocEntryMap
  mediaMap: DocMediaMap
  link: DocLink
}

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

/**
 * The Markdown is read outside of the site, so links need the site origin.
 * Links to the pages on the site by default.
 */
export function siteLink(url: string) {
  return url.startsWith('/') ? `${siteUrl}${url}` : url
}

function resolveLinks(markdown: string, link: DocLink) {
  return markdown.replace(
    /\]\((\/[^)\s]*)\)/g,
    (_, path: string) => `](${link(path)})`
  )
}

function renderInline(nodes: Array<RichNode> | undefined, ctx: RenderContext) {
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
                ctx.entryMap.get(linkMark._entry)?.url)
            if (href)
              text = `[${text}](${href.startsWith('/') ? ctx.link(href) : href})`
          }
        }
        return normalizeText(text)
      }
      if (node._type === 'hardBreak') return '\n'
      return ''
    })
    .join('')
}

function renderListItem(node: RichNode, ctx: RenderContext) {
  const content = asArray(node.content) || []
  const parts: Array<string> = []
  for (const child of content) {
    if (!child) continue
    if (child._type === 'paragraph') {
      const text = renderInline(asArray(child.content), ctx).trim()
      if (text) parts.push(text)
    } else if (child._type === 'bulletList' || child._type === 'orderedList') {
      const nested = renderNode(child, ctx)
      if (nested) parts.push(nested.replace(/\n+/g, ' '))
    }
  }
  return parts.join(' ').trim()
}

function renderNode(node: RichNode, ctx: RenderContext): string {
  if (!node) return ''
  switch (node._type) {
    case 'paragraph': {
      return renderInline(asArray(node.content), ctx).trim()
    }
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(node.level) || 2))
      const prefix = '#'.repeat(level)
      const text = renderInline(asArray(node.content), ctx).trim()
      return text ? `${prefix} ${text}` : ''
    }
    case 'bulletList': {
      const items = (asArray(node.content) || [])
        .map(item => {
          const text = renderListItem(item, ctx)
          return text ? `- ${text}` : ''
        })
        .filter(Boolean)
      return items.join('\n')
    }
    case 'orderedList': {
      const items = (asArray(node.content) || [])
        .map((item, index) => {
          const text = renderListItem(item, ctx)
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
      const body = renderBlocks(node.body, ctx).trim()
      return body ? `Note (${level}): ${body}` : `Note (${level})`
    }
    case 'CopyPromptBlock': {
      const prompt = withSiteUrl(asString(node.prompt)).trim()
      return prompt ? `> ${prompt}` : ''
    }
    case 'FieldCatalogBlock':
      return resolveLinks(fieldCatalogMarkdown(), ctx.link)
    case 'ComponentCatalogBlock':
      return resolveLinks(componentCatalogMarkdown(), ctx.link)
    case 'ComponentExampleBlock':
      return componentExampleMarkdown(asString(node.example))
    case 'ComponentPropsBlock':
      return componentPropsMarkdown(asString(node.component))
    case 'ImageBlock': {
      const image =
        node.image && typeof node.image === 'object'
          ? (node.image as Record<string, unknown>)
          : null
      const entryId = image ? (image._entry as string | undefined) : undefined
      const caption = normalizeText(asString(node.caption)).trim()
      if (typeof entryId === 'string') {
        const image = ctx.mediaMap.get(entryId)
        if (image) {
          const title = caption || normalizeText(image.title || '').trim()
          const location = siteLink(image.location || '').trim()
          if (title && location) return `Image: ${title} (${location})`
          if (location) return `Image: ${location}`
        }
      }
      return caption ? `Image: ${caption}` : 'Image'
    }
    case 'ChapterLinkBlock': {
      const link = node.link
      if (!link || typeof link !== 'object') return ''
      const linkObj = link as Record<string, unknown>
      const entryId = asString(linkObj._entry)
      const url = entryId ? ctx.entryMap.get(entryId)?.url : null
      const title = normalizeText(asString(linkObj.title)).trim()
      const description = normalizeText(asString(linkObj.description)).trim()
      const label = title || 'Chapter link'
      const details = [
        label,
        url ? `(${ctx.link(url)})` : '',
        description
      ].filter(Boolean)
      return details.join(' ').trim()
    }
    default:
      return ''
  }
}

function renderBlocks(nodes: unknown, ctx: RenderContext) {
  if (!Array.isArray(nodes)) return ''
  const blocks: Array<string> = []
  for (const node of nodes) {
    const rendered = renderNode(node, ctx)
    if (rendered) blocks.push(rendered)
  }
  return blocks.join('\n\n')
}

export function renderNodes(
  nodes: unknown,
  entryMap: DocEntryMap,
  mediaMap: DocMediaMap,
  link: DocLink = siteLink
) {
  return renderBlocks(nodes, {entryMap, mediaMap, link})
}
