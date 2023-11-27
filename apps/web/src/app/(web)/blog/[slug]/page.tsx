/* eslint-disable @next/next/no-img-element */

import {TextView} from '@/blocks/TextBlockView'
import {cms} from '@/cms'
import {LayoutWithSidebar} from '@/layout/Layout'
import {WebTypo} from '@/layout/WebTypo'
import {Link} from '@/nav/Link'
import {BlogPost} from '@/schema/BlogPost'
import {Entry} from 'alinea/core'
import {HStack, Stack, fromModule} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {notFound} from 'next/navigation'
import css from './page.module.scss'

const styles = fromModule(css)

export interface BlogPostPageProps {
  params: {slug: string}
}

export const dynamicParams = false
export async function generateStaticParams() {
  const slugs = await cms.find(BlogPost().select(Entry.path))
  return slugs.map(slug => ({slug}))
}

export async function generateMetadata({params}: BlogPostPageProps) {
  const page = await cms.maybeGet(
    BlogPost().where(Entry.url.is(`/blog/${params.slug}`))
  )
  if (!page) return notFound()
  return {title: page.metadata?.title || page.title}
}

export default async function BlogPostPage({params}: BlogPostPageProps) {
  const page = await cms.maybeGet(
    BlogPost().where(Entry.url.is(`/blog/${params.slug}`))
  )
  if (!page) return notFound()
  return (
    <LayoutWithSidebar
      sidebar={
        <Stack.Right>
          <Link href="/blog">
            <HStack gap={8} center>
              <IcRoundArrowBack />
              <span>Blog</span>
            </HStack>
          </Link>
        </Stack.Right>
      }
    >
      <article>
        <header className={styles.root.header()}>
          <time className={styles.root.publishDate()}>{page.publishDate}</time>
          <WebTypo.H1 flat className={styles.root.header.title()}>
            {page.title}
          </WebTypo.H1>
          <HStack className={styles.root.author()} gap={8} center>
            By
            {page.author && (
              <a
                href={page.author.url.url}
                className={styles.root.author.url()}
              >
                <HStack center gap={8}>
                  {page.author.avatar && (
                    <img
                      alt="Author avatar"
                      className={styles.root.author.avatar()}
                      src={page.author.avatar.url}
                    />
                  )}
                  {page.author.name}
                </HStack>
              </a>
            )}
          </HStack>
        </header>
        <TextView text={page.body} />
      </article>
    </LayoutWithSidebar>
  )
}
