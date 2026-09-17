import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
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
