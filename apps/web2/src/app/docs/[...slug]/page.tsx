import {cms} from '@/cms'
import {Doc} from '@/schema/Doc'
import {Page} from 'alinea/core'
import {Breadcrumbs} from '../../../layout/Breadcrumbs'

export interface DocPageProps {
  params: {
    slug: Array<string>
  }
}
export default async function DocPage({params}: DocPageProps) {
  const page = await cms.maybeGet(
    Doc()
      .where(Page.url.is(`/docs/${params.slug.join('/')}`))
      .select({
        ...Doc,
        parents({parents}) {
          return parents().select({
            id: Page.entryId,
            title: Page.title,
            url: Page.url
          })
        }
      })
  )
  if (!page) return <div>404</div>
  return (
    <div>
      <Breadcrumbs parents={page.parents} />
      <h1>{page.title}</h1>
    </div>
  )
}
