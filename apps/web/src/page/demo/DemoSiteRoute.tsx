import {Query} from 'alinea'
import type {Metadata} from 'next'
import {notFound, permanentRedirect} from 'next/navigation'
import {cms} from '@/cms'
import {DemoHome} from '@/schema/demo'
import {demoBaseUrl} from '@/schema/demo/DemoUrl'
import {hasDemoPage, renderDemoPage} from './demoPages'
import {demoBrand} from './demoWorkspace'

export interface DemoSiteRouteProps {
  params: Promise<{slug?: Array<string>}>
}

const location = {workspace: 'demo', root: 'pages'} as const

function urlOf(slug: Array<string> = []) {
  return [demoBaseUrl, ...slug.map(decodeURIComponent)].join('/')
}

async function findEntry(url: string) {
  return cms.first({
    ...location,
    url,
    select: {
      id: Query.id,
      type: Query.type,
      locale: Query.locale,
      url: Query.url,
      title: Query.title,
      // Every page type of the demo has its SEO fields under `metadata`
      metadata: DemoHome.metadata
    }
  })
}

export async function generateStaticParams() {
  const urls = await cms.find({...location, select: Query.url})
  return urls
    .filter(url => url.startsWith(demoBaseUrl))
    .map(url => ({
      slug: url.slice(demoBaseUrl.length).split('/').filter(Boolean)
    }))
}

export async function generateMetadata({
  params
}: DemoSiteRouteProps): Promise<Metadata> {
  const {slug} = await params
  const entry = await findEntry(urlOf(slug))
  if (!entry) return {title: demoBrand}
  const title = entry.metadata?.title || entry.title
  return {
    title: `${title} · ${demoBrand}`,
    description: entry.metadata?.description || undefined,
    robots: {index: false}
  }
}

export default async function DemoSiteRoute({params}: DemoSiteRouteProps) {
  const {slug} = await params
  const url = urlOf(slug)
  const entry = await findEntry(url)
  if (!entry) {
    // Renamed pages keep their old url as an alias
    const renamed = await cms.first({
      ...location,
      alias: url,
      select: Query.url
    })
    if (renamed) permanentRedirect(renamed)
    notFound()
  }
  if (!hasDemoPage(entry.type)) notFound()
  return renderDemoPage(cms, entry)
}
