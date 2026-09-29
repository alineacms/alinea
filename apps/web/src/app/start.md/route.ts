import {Entry} from 'alinea/core/Entry'
import {cms, siteUrl} from '@/cms'
import {renderNodes} from '@/page/docs/DocMarkdown'
import {Doc} from '@/schema/Doc'

export const runtime = 'nodejs'

export const dynamic = 'force-static'

// The setup guide coding agents are pointed to by the "Copy prompt" boxes.
// Its content is the "Set up with an AI agent" doc, served as Markdown.
const guideUrl = '/docs/ai-setup'

export async function GET() {
  const [guide, docs] = await Promise.all([
    cms.get({
      url: guideUrl,
      select: {title: Entry.title, body: Doc.body}
    }),
    cms.find({
      location: cms.workspaces.main.pages.docs,
      select: {id: Entry.id, url: Entry.url}
    })
  ])
  const entryMap = new Map(docs.map(doc => [doc.id, {url: doc.url}]))
  // The copy prompt block points to this file, leave it out of it
  const body = guide.body.filter(node => node._type !== 'CopyPromptBlock')
  const markdown = [
    `# ${guide.title}`,
    `Source: ${siteUrl}${guideUrl}`,
    renderNodes(body, entryMap, new Map())
  ].join('\n\n')
  return new Response(`${markdown}\n`, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8'
    }
  })
}
