import {cms} from '@/cms'
import {PageContainer, PageContent} from '@/layout/Page'
import {Page} from '@/schema/Page'
import {Entry} from 'alinea/core'
import {notFound} from 'next/navigation'
import {TextView} from './blocks/TextBlockView'

export interface GenericPageProps {
  params: {
    slug: string
  }
}

export const dynamicParams = false
export async function generateStaticParams() {
  const slugs = await cms.find(Page().select(Entry.path))
  return slugs.map(slug => ({slug}))
}

export async function generateMetadata({params}: GenericPageProps) {
  const page = await cms.maybeGet(Page().where(Entry.url.is(`/${params.slug}`)))
  if (!page) return notFound()
  return {title: page.metadata?.title || page.title}
}

export default async function GenericPage({params}: GenericPageProps) {
  const page = await cms.maybeGet(Page().where(Entry.url.is(`/${params.slug}`)))
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
