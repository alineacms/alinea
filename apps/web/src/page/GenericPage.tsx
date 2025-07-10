import type {MetadataRoute} from 'next'
import {notFound} from 'next/navigation'
import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {Page} from '@/schema/Page'
import {TextFieldView} from './blocks/TextFieldView'

export interface GenericPageProps {
  params: Promise<{
    slug: string
  }>
}

export const dynamicParams = false
export async function generateStaticParams() {
  const slugs = await cms.find({
    type: Page,
    select: Page.path
  })
  return slugs.map(slug => ({slug}))
}

export async function generateMetadata({params}: GenericPageProps) {
  const {slug} = await params
  const page = await cms.first({
    type: Page,
    url: `/${slug}`
  })
  if (!page) return notFound()
  return {
    title: page.metadata?.title || page.title,
    alternates: {canonical: page._url}
  }
}

export default async function GenericPage({params}: GenericPageProps) {
  const {slug} = await params
  const page = await cms.first({
    type: Page,
    url: `/${slug}`
  })
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
