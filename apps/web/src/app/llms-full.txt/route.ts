import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {cms} from '@/cms'
import {renderNodes} from '@/page/docs/DocMarkdown'
import {Doc} from '@/schema/Doc'

export const runtime = 'nodejs'

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
      const title = entry.navigationTitle || entry.title || 'Untitled'
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
