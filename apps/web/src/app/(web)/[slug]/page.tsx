import {TextView} from '@/blocks/TextBlockView'
import {cms} from '@/cms'
import {InformationBar} from '@/layout/InformationBar'
import {LayoutWithSidebar} from '@/layout/Layout'
import {Page} from '@/schema/Page'
import {Entry} from 'alinea/core'
import {notFound} from 'next/navigation'

export interface AnyPageProps {
  params: {
    slug: string
  }
}

export default async function AnyPage({params}: AnyPageProps) {
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
