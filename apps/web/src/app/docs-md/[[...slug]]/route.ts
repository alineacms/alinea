import {siteUrl} from '@/cms'
import {exportDocs} from '@/page/docs/DocsExport'

export const runtime = 'nodejs'

export const dynamic = 'force-static'

export const dynamicParams = false

// The Markdown version of a docs page, served at its url plus .md through a
// rewrite in next.config.ts
export async function generateStaticParams() {
  const {pages} = await exportDocs()
  return pages.map(page => ({slug: page.url.split('/').slice(2)}))
}

export async function GET(
  _request: Request,
  {params}: {params: Promise<{slug?: Array<string>}>}
) {
  const {slug = []} = await params
  const url = ['/docs', ...slug].join('/')
  const docs = await exportDocs()
  const page = docs.pages.find(page => page.url === url)
  if (!page) return new Response('Not found', {status: 404})
  const urls = new Set(docs.pages.map(page => page.url))
  // Links to other docs pages point to their Markdown version
  const body = docs.render(page, function link(href) {
    const [path, hash] = href.split('#')
    const md = urls.has(path) ? `${path}.md` : path
    return `${siteUrl}${md}${hash ? `#${hash}` : ''}`
  })
  return new Response(`# ${page.title}\n\n${body}\n`, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8'
    }
  })
}
