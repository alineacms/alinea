import {siteUrl} from '@/cms'
import {exportDocs} from '@/page/docs/DocsExport'

export const runtime = 'nodejs'

export const dynamic = 'force-static'

// The setup guide coding agents are pointed to by the "Copy prompt" boxes.
// Its content is the "Set up with an AI agent" doc, served as Markdown.
const guideUrl = '/docs/ai-setup'

export async function GET() {
  const docs = await exportDocs()
  const guide = docs.pages.find(page => page.url === guideUrl)
  if (!guide) throw new Error(`Missing the setup guide at ${guideUrl}`)
  // The copy prompt block points to this file, leave it out of it
  const body = guide.body.filter(node => node._type !== 'CopyPromptBlock')
  const markdown = [
    `# ${guide.title}`,
    `Source: ${siteUrl}${guideUrl}`,
    docs.render({body})
  ].join('\n\n')
  return new Response(`${markdown}\n`, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8'
    }
  })
}
