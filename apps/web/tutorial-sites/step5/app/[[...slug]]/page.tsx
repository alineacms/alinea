import type {Infer} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {metadata} from 'alinea/field'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {cms} from '@/cms'
import {BlogView} from '@/entries/blog/Blog'
import {PageView} from '@/entries/page/Page'
import {Page} from '@/entries/page/Page.schema'
import {PostView} from '@/entries/post/Post'

interface RouteProps {
  params: Promise<{slug?: Array<string>}>
}

export async function generateStaticParams() {
  const urls = await cms.find({
    root: cms.workspaces.main.pages,
    select: Entry.url
  })

  return urls.map(url => ({slug: url === '/' ? [] : url.slice(1).split('/')}))
}

export async function generateMetadata({
  params
}: RouteProps): Promise<Metadata> {
  const {slug = []} = await params
  const url = slug.length > 0 ? `/${slug.join('/')}` : '/'
  const page = await cms.get({
    url,
    include: {
      title: Entry.title,
      metadata: Page.metadata // This is slightly hacky, but it will work for all document types
    }
  })
  if (!page) return {}

  return {
    title: page.metadata?.title || page.title,
    description: page.metadata?.description,
    openGraph: {
      title:
        page.metadata?.openGraph?.title || page.metadata?.title || page.title,
      description:
        page.metadata?.openGraph?.description || page.metadata?.description,
      images: page.metadata?.openGraph?.image
        ? [page.metadata.openGraph.image.src]
        : undefined
    }
  }
}

export default async function CatchAllPage({params}: RouteProps) {
  const {slug = []} = await params
  const url = slug.length > 0 ? `/${slug.join('/')}` : '/'
  const page = await cms.get({url})

  if (!page) notFound()

  if (page._type === 'Blog') {
    return <BlogView />
  }

  if (page._type === 'Post') {
    const postSlug = slug[slug.length - 1]
    if (!postSlug) notFound()
    return <PostView slug={postSlug} />
  }

  const regularPage = await cms.get({url, type: Page})
  if (!regularPage) notFound()
  return <PageView page={regularPage} />
}
