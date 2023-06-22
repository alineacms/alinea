import {cms} from '@/cms'
import {Entry} from 'alinea/core'
import {notFound} from 'next/navigation'
import {BlocksView} from '../../../BlocksView'
import {InformationBar} from '../../../layout/InformationBar'
import {LayoutWithSidebar} from '../../../layout/Layout'
import {Page} from '../../../schema/Page'

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
        <BlocksView blocks={page.blocks} />
      </article>
    </LayoutWithSidebar>
  )
}
