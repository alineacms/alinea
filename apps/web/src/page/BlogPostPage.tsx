import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import type {Metadata, MetadataRoute} from 'next'
import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {WebTypo} from '@/layout/WebTypo'
import {TextFieldView} from '@/page/blocks/TextFieldView'
import {BlogPost} from '@/schema/BlogPost'
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
    url: `/blog/${slug}`
  })
  const openGraphImage = page.metadata?.openGraph.image
  return {
    metadataBase: new URL('https://alineacms.com'),
    title: page.metadata?.title || page.title,
    description: page.metadata?.description || page.introduction,
    openGraph: {
      images: openGraphImage
        ? [
            {
              url: openGraphImage.src,
              width: openGraphImage.width,
              height: openGraphImage.height
            }
          ]
        : []
    },
    alternates: {canonical: page._url}
  }
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
