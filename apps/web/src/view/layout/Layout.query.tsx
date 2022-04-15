import {Store} from '@alinea/store'
import {Page, Pages} from '../../../.alinea/web'
import {headerQuery} from './Header.query'

export async function layoutQuery(pages: Pages, page: Page) {
  return {
    meta: {
      title: page.title,
      url: page.url
    },
    header: (await headerQuery(pages))!
  }
}

export type LayoutProps = Exclude<
  Store.TypeOf<ReturnType<typeof layoutQuery>>,
  null
>
