import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {Page} from '@/schema/Page'
import {Query} from 'alinea'
import type {MetadataRoute} from 'next'
import {notFound} from 'next/navigation'
import {TextFieldView} from './blocks/TextFieldView'

export interface GenericPageProps {
  params: {
    slug: string
  }
}

export const dynamicParams = false
export async function generateStaticParams() {
  const slugs = await cms.find(Query(Page).select(Query.path))
  return slugs.map(slug => ({slug}))
}

export async function generateMetadata({params}: GenericPageProps) {
  const page = await cms.maybeGet(
    Query(Page).where(Query.url.is(`/${params.slug}`))
  )
  if (!page) return notFound()
  return {title: page.metadata?.title || page.title}
}

export default async function GenericPage({params}: GenericPageProps) {
  const page = await cms.maybeGet(
    Query(Page).where(Query.url.is(`/${params.slug}`))
  )
  if (!page) return notFound()
  return (
    <PageContainer>
      <PageContent>
        <article>
          <TextFieldView text={page.body} />
        </article>
      </PageContent>
    </PageContainer>
  )
}

GenericPage.sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const pages = await generateStaticParams()
  return pages.map(page => ({url: `/${page.slug}`, priority: 0.5}))
}
