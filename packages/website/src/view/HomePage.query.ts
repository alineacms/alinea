import {Collection, Store} from '@alinea/store'
import {Doc, Home} from '../../.alinea/web'

export function homePageQuery(Home: Collection<Home>) {
  return Home.fields.with({
    gettingStarted: Doc.orderBy(Doc.index.asc())
      .select({url: Doc.url, title: Doc.title})
      .first()
  })
}

export type HomePageProps = Store.TypeOf<ReturnType<typeof homePageQuery>>
