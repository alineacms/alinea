import {Entry} from 'alinea/core/Entry'
import type {TextDoc} from 'alinea'
import {Node} from 'alinea/core/TextDoc'
import {RichText} from 'alinea/ui'
import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import Link from 'next/link'
import {cms} from '@/cms'
import {Post} from './Post.schema'

type PostLink = {id: string; title: string; url: string; path: string}

export async function PostView({slug}: {slug: string}) {
  const post = await cms.get({url: `/blog/${slug}`, type: Post})
  if (!post) notFound()

  const blogPage = await cms.get({url: '/blog'})
  if (!blogPage) notFound()

  const siblings = await cms.find({
    parentId: blogPage._id,
    select: {
      id: Entry.id,
      title: Entry.title,
      url: Entry.url,
      path: Entry.path
    }
  })

  const index = siblings.findIndex(candidate => candidate.path === slug)
  const previousPost: PostLink | null = index > 0 ? siblings[index - 1] : null
  const nextPost: PostLink | null =
    index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  return (
    <article>
      <h1>{post.title}</h1>
      {typeof post.body === 'string' ? <p>{post.body}</p> : <RichText doc={post.body} />}
      <p>
        <Link href="/blog">← Back to the full blog archive</Link>
      </p>
      {(previousPost || nextPost) && (
        <nav aria-label="Post navigation">
          <h2>Next/Previous blogpost</h2>
          <ul>
            {previousPost && (
              <li>
                <Link href={previousPost.url}>
                  Previous: {previousPost.title}
                </Link>
              </li>
            )}
            {nextPost && (
              <li>
                <Link href={nextPost.url}>Next: {nextPost.title}</Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </article>
  )
}

export async function generatePostMetadata(slug: string): Promise<Metadata> {
  const post = await cms.get({url: `/blog/${slug}`, type: Post})
  if (!post) return {}

  const bodyText = plainText(post.body)

  return {
    title: post.metadata.title || post.title,
    description: post.metadata?.description || post.excerpt || bodyText,
    openGraph: {
      title: post.metadata.openGraph.title || post.metadata.title || post.title,
      description:
        post.metadata.openGraph.description ||
        post.metadata?.description ||
        post.excerpt ||
        bodyText,
      images: post.metadata?.openGraph.image
        ? [post.metadata?.openGraph.image.src]
        : undefined
    }
  }
}

function plainText(value: TextDoc<any> | string | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  if (!Array.isArray(value)) return ''
  const result = value
    .reduce((acc, node) => {
      return acc + textOf(node)
    }, '')
    .trim()
  return result.replace(/ +(?= )/g, '')
}

function textOf(node: Node): string {
  if (node._type === 'hardBreak') return '\n'
  if (Node.isText(node)) {
    return node.text ? ' ' + node.text : ''
  } else if (Node.isElement(node) && node.content) {
    return node.content.reduce((acc, node) => {
      return acc + textOf(node)
    }, '')
  }
  return ''
}
