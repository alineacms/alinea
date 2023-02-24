import {fromModule, VStack} from 'alinea/ui'
import Link from 'next/link'
import css from './BlogOverview.module.scss'
import {BlogOverviewProps} from './BlogOverview.server'
import {InformationBar} from './layout/InformationBar.js'
import {Layout} from './layout/Layout.js'
import {WebTypo} from './layout/WebTypo.js'

const styles = fromModule(css)

export function BlogOverview({title, posts}: BlogOverviewProps) {
  return (
    <Layout.WithSidebar sidebar={<InformationBar />}>
      <WebTypo>
        <WebTypo.H1>{title}</WebTypo.H1>
        <VStack gap={30} align="flex-start">
          {posts.map(post => {
            return (
              <Link key={post.id} href={post.url}>
                <a className={styles.root.link()}>
                  <time className={styles.root.link.publishDate()}>
                    {post.publishDate}
                  </time>
                  <WebTypo.H2 flat>{post.title}</WebTypo.H2>
                </a>
              </Link>
            )
          })}
        </VStack>
      </WebTypo>
    </Layout.WithSidebar>
  )
}
