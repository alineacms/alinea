import styler from '@alinea/styler'
import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import type {Metadata, MetadataRoute} from 'next'
import Link from 'next/link'
import {cms} from '@/cms'
import {Section} from '@/layout/Section'
import {BlogPost} from '@/schema/BlogPost'
import {getMetadata} from '@/utils/metadata'
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
      introduction: BlogPost.introduction
    }
  })
  if (!page) return await getMetadata(null)
  return await getMetadata({
    ...page,
    metadata: {
      ...page.metadata,
      description: page.metadata?.description || page.introduction
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
  return (
    <div className={styles.root()}>
      <article>
        <header className={styles.root.header()}>
          <Link href="/blog" className={styles.root.header.back()}>
            ← Blog
          </Link>
          <BlogPostMeta
            className={styles.root.header.meta()}
            category={page.category}
            publishDate={page.publishDate}
            readingTime={readingTime(page.body)}
            variant="accent"
          />
          <h1 className={styles.root.header.title()}>{page.title}</h1>
          {page.introduction && (
            <p className={styles.root.header.introduction()}>
              {page.introduction}
            </p>
          )}
          {author && (
            <div className={styles.root.header.author()}>
              <BlogAvatar name={author.name} src={author.avatar?._url} />
              <span>{author.name}</span>
            </div>
          )}
        </header>
        <Section flush className={styles.root.cover()}>
          <BlogCover
            className={styles.root.cover.figure()}
            cover={page.cover}
            text={page.coverText}
            size="post"
            sizes="(max-width: 1440px) 100vw, 1280px"
            priority
          />
        </Section>
        <div className={styles.root.content()}>
          <BlogPostBody body={page.body} />
          {author && (
            <div className={styles.root.authorCard()}>
              <BlogAvatar
                name={author.name}
                src={author.avatar?._url}
                size="large"
              />
              <div className={styles.root.authorCard.details()}>
                <span className={styles.root.authorCard.title()}>
                  {author.name}
                </span>
                {authorUrl && (
                  <a
                    href={authorUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.root.authorCard.link()}
                  >
                    {displayUrl(authorUrl)}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
      {others.length > 0 && (
        <Section flush className={styles.root.more()}>
          <div className={styles.root.more.inner()}>
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
          </div>
        </Section>
      )}
    </div>
  )
}

BlogPostPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const pages = await generateStaticParams()
  return pages.map(page => ({url: `/blog/${page.slug}`, priority: 0.9}))
}
