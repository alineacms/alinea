import {Doc, Home, Page} from '.alinea/web'
import {Collection, Store} from '@alinea/store'
import {docPageQuery} from './DocPage.query'
import {homePageQuery} from './HomePage.query'
import {layoutQuery} from './layout/Layout.query'

export function pageViewQuery(Page: Collection<Page>) {
  return {
    layout: layoutQuery(),
    entry: Page.type.case(
      {
        Home: homePageQuery(Page as Collection<Home>),
        Doc: docPageQuery(Page as Collection<Doc>)
      },
      Page.fields
    )
  }
}

export type PageViewProps = Store.TypeOf<ReturnType<typeof pageViewQuery>>
