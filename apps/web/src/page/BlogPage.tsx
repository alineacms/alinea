import {cms} from '@/cms'
import {InformationBar} from '@/layout/InformationBar'
import {LayoutWithSidebar} from '@/layout/Layout'
import {WebTypo} from '@/layout/WebTypo'
import {Link} from '@/nav/Link'
import {BlogOverview} from '@/schema/BlogOverview'
import {BlogPost} from '@/schema/BlogPost'
import {Entry} from 'alinea/core'
import {VStack, fromModule} from 'alinea/ui'
import css from './BlogPage.module.scss'

const styles = fromModule(css)

export default async function BlogPage() {
  const overview = await cms.get(
    BlogOverview().select({
      title: BlogOverview.title,
      posts({children}) {
        return children().select({
          id: Entry.entryId,
          url: Entry.url,
          title: BlogPost.title,
          publishDate: BlogPost.publishDate
        })
      }
    })
  )
  return (
    <LayoutWithSidebar sidebar={<InformationBar />}>
      <WebTypo>
        <WebTypo.H1>{overview.title}</WebTypo.H1>
        <VStack gap={30} align="flex-start">
          {overview.posts.map(post => {
            return (
              <Link
                key={post.id}
                href={post.url}
                className={styles.root.link()}
              >
                <time className={styles.root.link.publishDate()}>
                  {post.publishDate}
                </time>
                <WebTypo.H2 flat>{post.title}</WebTypo.H2>
              </Link>
            )
          })}
        </VStack>
      </WebTypo>
    </LayoutWithSidebar>
  )
}
