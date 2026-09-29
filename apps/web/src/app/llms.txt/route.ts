import {siteUrl} from '@/cms'
import {docsIndex, exportDocs} from '@/page/docs/DocsExport'

export const runtime = 'nodejs'

export const dynamic = 'force-static'

// The docs index in the llms.txt format (https://llmstxt.org), linking to the
// Markdown version of every page
export async function GET() {
  const {pages} = await exportDocs()
  const output = [
    '# Alinea CMS',
    '> Alinea is an open source, Git-based headless CMS for Next.js. Content is stored as JSON files in your repository and queried with a fully typed API.',
    `Every docs page is available as Markdown by adding .md to its url. All docs in a single file: ${siteUrl}/llms-full.txt. The npm package includes these docs for its version in node_modules/alinea/docs, start at index.md.`,
    docsIndex(pages, url => `${siteUrl}${url}.md`)
  ]
  return new Response(`${output.join('\n\n')}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  })
}
