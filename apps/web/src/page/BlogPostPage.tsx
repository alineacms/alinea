import styler from '@alinea/styler'
import {Query} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {get} from 'http'
import type {Metadata, MetadataRoute} from 'next'
import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {WebTypo} from '@/layout/WebTypo'
import {TextFieldView} from '@/page/blocks/TextFieldView'
import {BlogPost} from '@/schema/BlogPost'
import {getMetadata} from '@/utils/metadata'
import {Breadcrumbs} from '../layout/Breadcrumbs'
import css from './BlogPostPage.module.scss'
import {BlogPostMeta} from './blog/BlogPostMeta'

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

export default async function BlogPostPage({params}: BlogPostPageProps) {
  const {slug} = await params
  const page = await cms.get({
    type: BlogPost,
    url: `/blog/${slug}`
  })
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
            />
            <WebTypo.H1 flat className={styles.root.header.title()}>
              {page.title}
            </WebTypo.H1>
            <BlogPostMeta {...page} />
          </header>
          <TextFieldView text={page.body} />
        </article>
      </PageContent>
    </PageContainer>
  )
}

BlogPostPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const pages = await generateStaticParams()
  return pages.map(page => ({url: `/blog/${page.slug}`, priority: 0.9}))
}
