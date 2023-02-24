import {Page} from '@alinea/content'
import {fromModule, HStack, Stack} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import Link from 'next/link'
import {Blocks} from './blocks/Blocks'
import css from './BlogPost.module.scss'
import {Layout} from './layout/Layout'
import {WebTypo} from './layout/WebTypo'

const styles = fromModule(css)

export function BlogPost({title, author, blocks, publishDate}: Page.BlogPost) {
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
        <header className={styles.root.header()}>
          <time className={styles.root.publishDate()}>{publishDate}</time>
          <WebTypo.H1 flat className={styles.root.header.title()}>
            {title}
          </WebTypo.H1>
          <HStack className={styles.root.author()} gap={8} center>
            By
            <a href={author.url.url} className={styles.root.author.url()}>
              <HStack center gap={8}>
                {author.avatar && (
                  <img
                    className={styles.root.author.avatar()}
                    src={author.avatar.url}
                  />
                )}
                {author.name}
              </HStack>
            </a>
          </HStack>
        </header>
        <Blocks blocks={blocks} />
      </article>
    </Layout.WithSidebar>
  )
}
