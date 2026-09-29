import {type Infer, Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import type {Graph} from 'alinea/core/Graph'
import {cms, siteUrl} from '@/cms'
import {type DocLink, renderNodes, siteLink} from '@/page/docs/DocMarkdown'
import type {DocsNavItem} from '@/page/docs/DocsNav'
import {getDocsTree} from '@/page/docs/DocsTree'
import {Doc} from '@/schema/Doc'
import {Docs} from '@/schema/Docs'
import {describeText} from '@/utils/metadata'

// The docs as Markdown, for coding agents: llms.txt, llms-full.txt, the .md
// version of every page and the docs folder in the npm package

export interface DocsPage {
  url: string
  title: string
  /** 0 for the sidebar groups, 1 for the pages in them, 2 below those, ... */
  depth: number
  summary: string | undefined
  body: Infer<typeof Doc>['body']
}

export interface DocsExport {
  /** All docs pages in sidebar order */
  pages: Array<DocsPage>
  /** The Markdown of the page body, links to other pages go through link */
  render(page: Pick<DocsPage, 'body'>, link?: DocLink): string
}

export async function exportDocs(graph: Graph = cms): Promise<DocsExport> {
  const [tree, entries, media] = await Promise.all([
    getDocsTree(graph),
    graph.find({
      type: [Doc, Docs],
      select: {
        id: Entry.id,
        url: Entry.url,
        title: Entry.title,
        body: Doc.body
      }
    }),
    graph.find({
      location: cms.workspaces.main.media,
      select: {id: Entry.id, title: Entry.title, location: Query.url}
    })
  ])
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const mediaMap = new Map(media.map(item => [item.id, item]))
  const pages: Array<DocsPage> = []
  function add(item: DocsNavItem, depth: number) {
    const entry = byId.get(item.id)
    if (entry)
      pages.push({
        url: entry.url,
        // The docs index is titled "Docs", its navigation title is more useful
        title: item.id === tree.root.id ? item.title : entry.title,
        depth,
        summary: describeText(entry.body),
        body: entry.body
      })
    for (const child of item.children) add(child, depth + 1)
  }
  for (const group of tree.groups) {
    add({...group, children: []}, 0)
    for (const item of group.items) add(item, 1)
  }
  return {
    pages,
    render(page, link = siteLink) {
      return renderNodes(page.body, byId, mediaMap, link)
    }
  }
}

/** A list of the pages below a heading per sidebar group */
export function docsIndex(
  pages: Array<DocsPage>,
  href: (url: string) => string
) {
  return pages
    .map(page => {
      const summary = page.summary ? `: ${page.summary}` : ''
      const item = `- [${page.title}](${href(page.url)})${summary}`
      if (page.depth === 0) return `\n## ${page.title}\n\n${item}`
      return `${'  '.repeat(page.depth - 1)}${item}`
    })
    .join('\n')
    .trim()
}

/** All docs in a single file */
export function docsFullText({pages, render}: DocsExport) {
  const output = ['# Alinea CMS Docs', '']
  for (const page of pages) {
    output.push(`### ${page.title} (${siteUrl}${page.url})`)
    const body = render(page)
    if (body) output.push(body)
    output.push('')
  }
  return output.join('\n')
}
