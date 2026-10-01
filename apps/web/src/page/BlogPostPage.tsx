import styler from '@alinea/styler'
import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import type {Metadata, MetadataRoute} from 'next'
import Link from 'next/link'
import {cms} from '@/cms'
import {JsonLd} from '@/layout/JsonLd'
import {Section} from '@/layout/Section'
import {BlogPost} from '@/schema/BlogPost'
import {getMetadata, siteUrl} from '@/utils/metadata'
import css from './BlogPostPage.module.scss'
import {BlogAvatar} from './blog/BlogAvatar'
import {BlogCover} from './blog/BlogCover'
import {BlogPostBody} from './blog/BlogPostBody'
import {BlogPostCard} from './blog/BlogPostCard'
import {BlogPostMeta} from './blog/BlogPostMeta'
import {blogPostSummary, findBlogPosts, readingTime} from './blog/blogPosts'

const styles = styler(css)

export interface BlogPostPageProps {
  params: Promise<{slug: string}>
}

export const dynamicParams = false
export async function generateStaticParams() {
  const slugs = await cms.find({
    type: BlogPost,
    select: Entry.path
  })
  return slugs.map(slug => ({slug}))
}

export async function generateMetadata({
  params
}: BlogPostPageProps): Promise<Metadata> {
  const {slug} = await params
  const page = await cms.get({
    type: BlogPost,
    url: `/blog/${slug}`,
    select: {
      url: Query.url,
      title: BlogPost.title,
      metadata: BlogPost.metadata,
      introduction: BlogPost.introduction,
      publishDate: BlogPost.publishDate,
      author: BlogPost.author,
      cover: BlogPost.cover
    }
  })
  if (!page) return await getMetadata(null)
  const author = page.author?.url?._url || page.author?.name
  return await getMetadata({
    url: page.url,
    title: page.title,
    metadata: page.metadata,
    description: page.introduction,
    image: page.cover,
    article: {
      publishedTime: page.publishDate,
      authors: author ? [author] : undefined
    }
  })
}

function displayUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

export default async function BlogPostPage({params}: BlogPostPageProps) {
  const {slug} = await params
  const page = await cms.get({
    type: BlogPost,
    url: `/blog/${slug}`,
    select: {...blogPostSummary, body: BlogPost.body}
  })
  const others = (await findBlogPosts())
    .filter(post => post.id !== page.id)
    .slice(0, 2)
  const author = page.author?.name ? page.author : undefined
  const authorUrl = author?.url?._url
  const blogPosting = {
    '@type': 'BlogPosting',
    headline: page.title,
    description: page.introduction || undefined,
    url: `${siteUrl}${page.url}`,
    mainEntityOfPage: `${siteUrl}${page.url}`,
    datePublished: page.publishDate || undefined,
    image: page.cover?.src ? new URL(page.cover.src, siteUrl).href : undefined,
    author: author && {'@type': 'Person', name: author.name, url: authorUrl},
    publisher: {'@type': 'Organization', name: 'Alinea', url: siteUrl}
  }
  return (
    <main className={styles.root()}>
      <JsonLd data={blogPosting} />
      <article>
        <header className={styles.root.header()}>
          <Link href="/blog" className={styles.root.header.back()}>
            ← Blog
          </Link>
          <h1 className={styles.root.header.title()}>{page.title}</h1>
          <BlogPostMeta
            category={page.category}
            publishDate={page.publishDate}
            readingTime={readingTime(page.body)}
            author={
              author && (
                <>
                  By{' '}
                  <span className={styles.root.header.author()}>
                    {author.name}
                  </span>
                </>
              )
            }
          />
          {page.introduction && (
            <p className={styles.root.header.introduction()}>
              {page.introduction}
            </p>
          )}
        </header>
        {(page.cover?.src || page.coverText) && (
          <BlogCover
            className={styles.root.cover()}
            cover={page.cover}
            text={page.coverText}
            size="post"
            sizes="(max-width: 1023px) 100vw, 747px"
            priority
          />
        )}
        <div className={styles.root.content()}>
          <BlogPostBody body={page.body} />
          {author && (
            <footer className={styles.root.author()}>
              <BlogAvatar name={author.name} src={author.avatar?._url} />
              <span className={styles.root.author.byline()}>
                Written by{' '}
                <span className={styles.root.author.byline.strong()}>
                  {author.name}
                </span>
              </span>
              {authorUrl && (
                <a
                  href={authorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.root.author.link()}
                >
                  {displayUrl(authorUrl)}
                </a>
              )}
            </footer>
          )}
        </div>
      </article>
      {others.length > 0 && (
        <Section flush className={styles.root.more()}>
          <div className={styles.root.more.header()}>
            <h2 className={styles.root.more.title()}>Keep reading</h2>
            <Link href="/blog" className={styles.root.more.all()}>
              All posts →
            </Link>
          </div>
          <div className={styles.root.more.grid()}>
            {others.map(post => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        </Section>
      )}
    </main>
  )
}

BlogPostPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const posts = await cms.find({
    type: BlogPost,
    select: {url: Query.url, publishDate: BlogPost.publishDate}
  })
  return posts.map(post => ({
    url: post.url,
    lastModified: post.publishDate || undefined,
    priority: 0.7
  }))
}
