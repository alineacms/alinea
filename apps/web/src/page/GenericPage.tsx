import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {Page} from '@/schema/Page'
import {Query} from 'alinea'
import {notFound} from 'next/navigation'
import {TextView} from './blocks/TextBlockView'

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
          <TextView text={page.body} />
        </article>
      </PageContent>
    </PageContainer>
  )
}
