import {cms} from '@/cms'
import {Doc} from '@/schema/Doc'
import {Page} from 'alinea/core'

export interface DocPageProps {
  params: {
    slug: Array<string>
  }
}
export default async function DocPage({params}: DocPageProps) {
  const page = await cms.maybeGet(
    Doc().where(Page.url.is(`/docs/${params.slug.join('/')}`))
  )
  if (!page) return <div>404</div>
  return (
    <div>
      <h1>{page.title}</h1>
    </div>
  )
}
