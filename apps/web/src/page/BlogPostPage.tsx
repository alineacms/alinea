/* eslint-disable @next/next/no-img-element */

import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {WebTypo} from '@/layout/WebTypo'
import {TextView} from '@/page/blocks/TextBlockView'
import {BlogPost} from '@/schema/BlogPost'
import {Entry} from 'alinea/core'
import {fromModule} from 'alinea/ui'
import {notFound} from 'next/navigation'
import {Breadcrumbs} from '../layout/Breadcrumbs'
import css from './BlogPostPage.module.scss'
import {BlogPostMeta} from './blog/BlogPostMeta'

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
    <PageContainer>
      <PageContent>
        <article className={styles.root()}>
          <header className={styles.root.header()}>
            <Breadcrumbs
              parents={[
                {
                  id: 'blog',
                  title: 'Blog',
                  url: '/blog'
                }
              ]}
            ></Breadcrumbs>
            <WebTypo.H1 flat className={styles.root.header.title()}>
              {page.title}
            </WebTypo.H1>
            <BlogPostMeta {...page} />
          </header>
          <TextView text={page.body} />
        </article>
      </PageContent>
    </PageContainer>
  )
}
