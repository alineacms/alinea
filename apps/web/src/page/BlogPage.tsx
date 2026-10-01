import styler from '@alinea/styler'
import {Query} from 'alinea'
import type {Metadata, MetadataRoute} from 'next'
import Link from 'next/link'
import {cms} from '@/cms'
import {Newsletter} from '@/layout/engage/Newsletter'
import {Section} from '@/layout/Section'
import {BlogOverview} from '@/schema/BlogOverview'
import {getMetadata} from '@/utils/metadata'
import css from './BlogPage.module.scss'
import {BlogFeaturedPost} from './blog/BlogFeaturedPost'
import {BlogPostCard} from './blog/BlogPostCard'
import {findBlogPosts} from './blog/blogPosts'

const styles = styler(css)

export async function generateMetadata(): Promise<Metadata> {
  const page = await cms.first({
    type: BlogOverview,
    select: {
      url: Query.url,
      title: BlogOverview.title,
      metadata: BlogOverview.metadata
    }
  })
  if (!page) return await getMetadata(null)
  return await getMetadata({
    ...page,
    description:
      'Releases, guides and notes from the people building Alinea, the open source headless CMS for Next.js.'
  })
}

export default async function BlogPage() {
  const [featured, ...posts] = await findBlogPosts()
  return (
    <main className={styles.root()}>
      <Section flush>
        <header className={styles.root.header()}>
          <h1 className={styles.root.header.title()}>News and updates</h1>
          <p className={styles.root.header.description()}>
            Releases, guides and notes from the people building Alinea.
          </p>
          <Link href="/changelog" className={styles.root.header.link()}>
            View the changelog →
          </Link>
        </header>
      </Section>
      {featured && (
        <Section flush className={styles.root.featured()}>
          <BlogFeaturedPost post={featured} />
        </Section>
      )}
      {posts.length > 0 && (
        <Section flush className={styles.root.posts()}>
          <h2 className={styles.root.posts.title()}>All posts</h2>
          <div className={styles.root.posts.grid()}>
            {posts.map(post => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        </Section>
      )}
      <Newsletter className={styles.root.newsletter()} />
    </main>
  )
}

BlogPage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/blog', priority: 0.5}]
}
