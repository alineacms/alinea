import {cms} from '@/cms'
import {InformationBar} from '@/layout/InformationBar'
import {LayoutWithSidebar} from '@/layout/Layout'
import {Page} from '@/schema/Page'
import {Entry} from 'alinea/core'
import {notFound} from 'next/navigation'
import {TextView} from './blocks/TextBlockView'

export interface AnyPageProps {
  params: {
    slug: string
  }
}

export const dynamicParams = false
export async function generateStaticParams() {
  const slugs = await cms.find(Page().select(Entry.path))
  return slugs.map(slug => ({slug}))
}

export async function generateMetadata({params}: AnyPageProps) {
  const page = await cms.maybeGet(Page().where(Entry.url.is(`/${params.slug}`)))
  if (!page) return notFound()
  return {title: page.metadata?.title || page.title}
}

export default async function GenericPage({params}: AnyPageProps) {
  const page = await cms.maybeGet(Page().where(Entry.url.is(`/${params.slug}`)))
  if (!page) return notFound()
  return (
    <LayoutWithSidebar sidebar={<InformationBar />}>
      <article>
        <TextView text={page.body} />
      </article>
    </LayoutWithSidebar>
  )
}
