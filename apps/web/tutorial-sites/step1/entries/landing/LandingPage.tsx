import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {cms} from '@/cms'
import {LandingPage} from './LandingPage.schema'

export async function LandingPageView() {
  const page = await cms.get({url: '/', type: LandingPage})
  if (!page) notFound()

  return (
    <main>
      <h1>{page.title}</h1>
    </main>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await cms.get({url: '/', type: LandingPage})
  if (!page) return {}

  return {
    title: page.metadata.title || page.title,
    description: page.metadata?.description,
    openGraph: {
      title: page.metadata.openGraph.title || page.metadata.title || page.title,
      description: page.metadata.openGraph.description || page.metadata?.description,
      images: page.metadata?.openGraph.image
        ? [page.metadata?.openGraph.image.src]
        : undefined
    }
  }
}
