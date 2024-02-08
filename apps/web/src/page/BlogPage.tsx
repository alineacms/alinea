import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {WebTypo} from '@/layout/WebTypo'
import {Link} from '@/layout/nav/Link'
import {BlogOverview} from '@/schema/BlogOverview'
import {BlogPost} from '@/schema/BlogPost'
import {Query} from 'alinea'
import {VStack, fromModule} from 'alinea/ui'
import css from './BlogPage.module.scss'
import {BlogPostMeta} from './blog/BlogPostMeta'

const styles = fromModule(css)

export default async function BlogPage() {
  const overview = await cms.get(
    Query(BlogOverview).select({
      title: Query.title,
      posts: Query.children(BlogPost).select({
        ...Query.entry,
        introduction: BlogPost.introduction,
        author: BlogPost.author,
        publishDate: BlogPost.publishDate
      })
    })
  )
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
