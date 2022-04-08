import {Collection, Store} from '@alineacms/store'
import {Page, Pages} from '../../../.alinea/web'
import {headerQuery} from './Header.query'

export function layoutQuery(pages: Pages, Page: Collection<Page>) {
  return {
    meta: {
      title: Page.title,
      url: Page.url
    },
    header: headerQuery()
  }
}

export type LayoutProps = Store.TypeOf<ReturnType<typeof layoutQuery>>
