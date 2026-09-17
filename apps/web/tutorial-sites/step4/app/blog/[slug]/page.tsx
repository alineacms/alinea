import {Entry} from 'alinea/core/Entry'
import type {Metadata} from 'next'
import {cms} from '@/cms'
import {generatePostMetadata, PostView} from '@/entries/post/Post'
import {Post} from '@/entries/post/Post.schema'

interface PostRouteProps {
  params: Promise<{slug: string}>
}

export async function generateStaticParams() {
  const paths = await cms.find({
    type: Post,
    select: Entry.path
  })

  return paths.map(slug => ({slug}))
}

export async function generateMetadata({
  params
}: PostRouteProps): Promise<Metadata> {
  const {slug} = await params
  return generatePostMetadata(slug)
}

export default async function BlogPostRoute({params}: PostRouteProps) {
  const {slug} = await params
  return <PostView slug={slug} />
}
