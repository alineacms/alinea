import styler from '@alinea/styler'
import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {VStack} from 'alinea/ui'
import type {Metadata, MetadataRoute} from 'next'
import {cms} from '@/cms'
import {Link} from '@/layout/nav/Link'
import {PageContainer, PageContent} from '@/layout/Page'
import {WebTypo} from '@/layout/WebTypo'
import {BlogOverview} from '@/schema/BlogOverview'
import {BlogPost} from '@/schema/BlogPost'
import {getMetadata} from '@/utils/metadata'
import css from './BlogPage.module.scss'
import {BlogPostMeta} from './blog/BlogPostMeta'

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
  return await getMetadata(page)
}

export default async function BlogPage() {
  const overview = await cms.get({
    type: BlogOverview,
    select: {
      title: BlogOverview.title,
      posts: Query.children({
        type: BlogPost,
        select: {
          ...Entry,
          id: Entry.id,
          introduction: BlogPost.introduction,
          author: BlogPost.author,
          publishDate: BlogPost.publishDate
        }
      })
    }
  })
  return (
    <PageContainer>
      <PageContent>
        <WebTypo>
          <VStack>
            {overview.posts.map(post => {
              return (
                <VStack
                  gap={8}
                  key={post.id}
                  className={styles.root.post()}
                  align="flex-start"
                >
                  <div>
                    <Link href={post.url} className={styles.root.post.link()}>
                      <WebTypo.H2 flat>{post.title}</WebTypo.H2>
                    </Link>
                    <BlogPostMeta {...post} />
                  </div>
                  <Link href={post.url}>
                    <WebTypo.P flat>{post.introduction}</WebTypo.P>
                  </Link>
                </VStack>
              )
            })}
          </VStack>
        </WebTypo>
      </PageContent>
    </PageContainer>
  )
}

BlogPage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/blog', priority: 0.5}]
}
