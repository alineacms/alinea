import {fromModule, HStack, Stack} from '@alinea/ui'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import Link from 'next/link'
import {Blocks} from './blocks/Blocks'
import css from './BlogPost.module.scss'
import {BlogPostSchema} from './BlogPost.schema'
import {Layout} from './layout/Layout'

const styles = fromModule(css)

export function BlogPost({blocks, publishDate}: BlogPostSchema) {
  return (
    <Layout.WithSidebar
      sidebar={
        <Stack.Right>
          <Link href="/blog">
            <a>
              <HStack gap={8} center>
                <IcRoundArrowBack />
                <span>Blog</span>
              </HStack>
            </a>
          </Link>
        </Stack.Right>
      }
    >
      <article>
        <time className={styles.root.publishDate()}>{publishDate}</time>
        <Blocks blocks={blocks} />
      </article>
    </Layout.WithSidebar>
  )
}
