import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import Link from 'next/link'
import {cms} from '@/cms'
import {Post} from '@/entries/post/Post.schema'
import {Blog} from './Blog.schema'

type PostLink = {id: string; title: string; url: string}

export async function BlogView() {
  const page = await cms.get({
    url: '/blog',
    type: Blog,
    select: {
      title: Blog.title,
      intro: Blog.intro,
      posts: Query.children({
        type: Post,
        select: {
          id: Entry.id,
          title: Entry.title,
          url: Entry.url
        }
      })
    }
  })
  if (!page) notFound()

  return (
    <main>
      <h1>{page.title}</h1>
      {page.intro && <p>{page.intro}</p>}
      <ul>
        {page.posts.map((post: PostLink) => (
          <li key={post.id}>
            <Link href={post.url}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await cms.get({url: '/blog', type: Blog})
  if (!page) return {}

  return {
    title: page.metadata.title || page.title,
    description: page.metadata?.description || page.intro,
    openGraph: {
      title: page.metadata.openGraph.title || page.metadata.title || page.title,
      description:
        page.metadata.openGraph.description ||
        page.metadata?.description ||
        page.intro,
      images: page.metadata?.openGraph.image
        ? [page.metadata?.openGraph.image.src]
        : undefined
    }
  }
}
