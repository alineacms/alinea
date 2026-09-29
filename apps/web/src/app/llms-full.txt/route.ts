import {docsFullText, exportDocs} from '@/page/docs/DocsExport'

export const runtime = 'nodejs'

export const dynamic = 'force-static'

export async function GET() {
  return new Response(docsFullText(await exportDocs()), {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  })
}
