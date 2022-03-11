import {Collection, Store} from '@alinea/store'
import {Page} from '../../../.alinea/web'
import {headerQuery} from './Header.query'

export function layoutQuery(Page: Collection<Page>) {
  return {
    meta: {
      title: Page.title,
      url: Page.url
    },
    header: headerQuery()
  }
}

export type LayoutProps = Store.TypeOf<ReturnType<typeof layoutQuery>>
